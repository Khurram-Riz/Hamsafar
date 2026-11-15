import { appConfig } from '@/lib/config';
import { rideFareFor, splitRideFare } from '@/lib/fares/calculator';
import { PoolType, VehicleRecord, VehicleType } from '@/types/database';
import {
  ExistingPoolHint,
  FallbackOption,
  FormedPool,
  JoinRequest,
  MatchBookingInput,
  MatchEngineInput,
  MatchResult,
} from './types';

function addMinutesIso(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

function deterministicPoolKey(index: number): string {
  return `pool-${index + 1}`;
}

const byCreated = (a: MatchBookingInput, b: MatchBookingInput) =>
  (a.created_at || '').localeCompare(b.created_at || '');

/**
 * Pure, deterministic, zero-DB matching engine (requirements.md section 6).
 *
 * How a ride comes to exist:
 *  1. CONNECT  - riders are grouped by pool type, corridor and zone order. A group with
 *                fewer than MIN_POOL_SIZE (2) consenting people is only a proposal
 *                (status "forming"): no vehicle, no booked ride.
 *  2. CONFIRM  - as soon as MIN_POOL_SIZE people have accepted, the ride is booked
 *                ("confirmed"), a vehicle that fits (rickshaw, car or van) is assigned,
 *                and the whole-ride fare is split among the accepted riders.
 *  3. JOIN     - anyone arriving after a ride is booked becomes a JOIN REQUEST. Every
 *                current rider must approve; the caller then redistributes the fare.
 * Riders who declined are never grouped and get fallback options instead.
 */
export function runMatchingEngine(input: MatchEngineInput): MatchResult {
  const { flight, bookings, zones, vehicles, drivers, existingPools = [], config } = input;

  const zoneMap = new Map(zones.map((z) => [z.id, z]));
  const activeVehicles = vehicles.filter((v) => v.active);
  const verifiedDrivers = drivers.filter((d) => d.verified);
  const maxCap = Math.max(
    1,
    Math.min(
      config.vehicleCapacity,
      activeVehicles.length ? Math.max(...activeVehicles.map((v) => v.capacity)) : config.vehicleCapacity
    )
  );

  const pickupTime = addMinutesIso(flight.estimated_arrival, config.matchWindowMinutes);
  const laterPickupTime = addMinutesIso(pickupTime, config.matchWindowMinutes);
  const cancelled = flight.status === 'cancelled';

  const pools: FormedPool[] = [];
  const bookingToPoolId: Record<string, string> = {};
  const joinRequests: JoinRequest[] = [];
  const reassignedBookingIds: string[] = [];
  const fallbacksByBookingId: Record<string, FallbackOption[]> = {};

  const result = (): MatchResult => ({
    pools,
    bookingToPoolId,
    joinRequests,
    reassignedBookingIds,
    fallbacksByBookingId,
    soloRecommendedBookingIds: [],
  });
  if (bookings.length === 0) return result();

  const usedVehicleIds = new Set<string>();
  const usedDriverIds = new Set<string>();

  /** Smallest free vehicle that fits `seats` (prefers the pool's current vehicle). */
  function claimVehicle(seats: number, preferredId?: string | null) {
    const fits = activeVehicles
      .filter((v) => !usedVehicleIds.has(v.id) && Math.min(v.capacity, config.vehicleCapacity) >= seats)
      .sort((a, b) => a.capacity - b.capacity);
    const vehicle: VehicleRecord | undefined =
      fits.find((v) => v.id === preferredId) ?? fits[0];
    if (vehicle) usedVehicleIds.add(vehicle.id);
    const driver = verifiedDrivers.find((d) => !usedDriverIds.has(d.id));
    if (driver) usedDriverIds.add(driver.id);
    return {
      vehicleId: vehicle?.id ?? null,
      vehicleType: (vehicle?.vehicle_type ?? null) as VehicleType | null,
      capacity: vehicle ? Math.min(vehicle.capacity, config.vehicleCapacity) : maxCap,
      driverId: driver?.id ?? null,
    };
  }

  /** Whole-ride price: farthest member's baseline fare, for the vehicle type. */
  function rideFare(members: MatchBookingInput[], type: VehicleType | null): number {
    const base = Math.max(...members.map((m) => m.solo_fare_pkr));
    const t = type ?? 'car';
    const mult = config.fareMultiplier?.[t];
    return mult !== undefined ? Math.round(base * mult) : rideFareFor(base, t);
  }

  function sharesFor(members: MatchBookingInput[], fare: number) {
    const ordered = [...members].sort(byCreated);
    return splitRideFare(fare, ordered.map((m) => ({ id: m.id, seats: m.seats })));
  }

  function orderedZoneIds(list: MatchBookingInput[]): string[] {
    return Array.from(new Set(list.map((b) => b.zone_id))).sort(
      (a, b) => (zoneMap.get(a)?.order_in_corridor ?? 99) - (zoneMap.get(b)?.order_in_corridor ?? 99)
    );
  }

  function fallbacksFor(b: MatchBookingInput, corridorId: string, needMore: boolean) {
    const out: FallbackOption[] = [];
    const nearby = zones
      .filter((z) => z.corridor_id === corridorId && z.active && z.id !== b.zone_id)
      .sort((x, y) => x.order_in_corridor - y.order_in_corridor)[0];
    if (nearby) {
      out.push({
        type: 'nearest_corridor_zone',
        title: `Look for riders via ${nearby.name}`,
        description: `Widen your search to riders heading to ${nearby.name} on the same corridor.`,
        suggestedZoneId: nearby.id,
        suggestedZoneName: nearby.name,
      });
    }
    out.push({
      type: 'later_window',
      title: 'Wait for the next arrival wave',
      description: `Match with riders from the next landing window (pickup ${new Date(laterPickupTime).toLocaleTimeString('en-PK', { timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit' })}).`,
      suggestedPickupTime: laterPickupTime,
    });
    out.push({
      type: 'solo_fixed_fare',
      title: 'Ride alone at the full fare',
      description: `${needMore ? 'Not enough riders have agreed yet. ' : ''}Leave right away on your own for Rs ${b.solo_fare_pkr.toLocaleString()} (whole ride).`,
      farePkr: b.solo_fare_pkr,
    });
    return out;
  }

  // ---- Solo rides: booked immediately, full fare, never shared ----
  const soloBookings = bookings.filter((b) => b.ride_mode === 'solo');
  const shareable = bookings.filter((b) => b.ride_mode !== 'solo');

  // ---- Rides that are already booked stay stable (rule 8) ----
  const lockedHints = existingPools.filter((p) => ['confirmed', 'dispatched', 'completed'].includes(p.status));
  const placed = new Set<string>();
  const lockedPools: { pool: FormedPool; members: MatchBookingInput[] }[] = [];

  for (const hint of lockedHints) {
    const members = shareable.filter((b) => b.existing_pool_id === hint.id && b.consent === 'accepted');
    if (members.length === 0) continue;
    const vehicle = activeVehicles.find((v) => v.id === hint.vehicle_id);
    const claimed = vehicle
      ? (usedVehicleIds.add(vehicle.id), {
          vehicleId: vehicle.id,
          vehicleType: vehicle.vehicle_type,
          capacity: Math.min(vehicle.capacity, config.vehicleCapacity),
          driverId: hint.driver_id,
        })
      : claimVehicle(members.reduce((s, m) => s + m.seats, 0), hint.vehicle_id);
    if (claimed.driverId) usedDriverIds.add(claimed.driverId);
    const seats = members.reduce((s, m) => s + m.seats, 0);
    // A booked ride that drops below the minimum people goes back to "forming".
    const stillBooked = seats >= config.minPoolSize;
    const fare = stillBooked ? rideFare(members, claimed.vehicleType) : 0;
    const formed: FormedPool = {
      id: hint.id,
      pool_type: hint.pool_type,
      corridor_id: hint.corridor_id,
      vehicle_id: claimed.vehicleId,
      vehicle_type: claimed.vehicleType,
      driver_id: claimed.driverId,
      pickup_time: pickupTime,
      status: cancelled ? 'cancelled' : stillBooked ? hint.status : 'forming',
      accepted_seats: seats,
      total_seats: seats,
      capacity: claimed.capacity,
      ride_fare_pkr: fare,
      zone_ids_ordered: orderedZoneIds(members),
      booking_ids: members.map((m) => m.id),
      shares: stillBooked ? sharesFor(members, fare) : {},
    };
    pools.push(formed);
    lockedPools.push({ pool: formed, members });
    members.forEach((m) => {
      placed.add(m.id);
      bookingToPoolId[m.id] = formed.id;
      if (!stillBooked) fallbacksByBookingId[m.id] = fallbacksFor(m, hint.corridor_id, true);
    });
  }

  // Riders who said no are never grouped; they just get options.
  for (const b of shareable) {
    if (b.consent === 'declined' && !placed.has(b.id)) {
      const z = zoneMap.get(b.zone_id);
      if (z) fallbacksByBookingId[b.id] = fallbacksFor(b, z.corridor_id, false);
      placed.add(b.id);
    }
  }

  // ---- Latecomers ask to join a booked ride (all members must approve) ----
  for (const b of [...shareable].sort(byCreated)) {
    if (placed.has(b.id)) continue;
    const zone = zoneMap.get(b.zone_id);
    if (!zone) continue;
    const target = lockedPools.find(
      ({ pool }) =>
        pool.status === 'confirmed' &&
        pool.pool_type === b.pool_type &&
        pool.corridor_id === zone.corridor_id &&
        pool.accepted_seats + b.seats <= pool.capacity
    );
    if (!target) continue;
    const { pool, members } = target;
    const newSeats = pool.accepted_seats + b.seats;
    const projectedFare = Math.max(pool.ride_fare_pkr, rideFare([b], pool.vehicle_type));
    joinRequests.push({
      bookingId: b.id,
      poolId: pool.id,
      voterBookingIds: members.map((m) => m.id),
      projectedSeatFarePkr: Math.ceil(projectedFare / newSeats),
      projectedRiderSeats: newSeats,
    });
    pool.total_seats += b.seats;
    placed.add(b.id);
  }

  // ---- Connect remaining riders by corridor, then book once 2+ agree ----
  const poolTypes: PoolType[] = ['women_only', 'family_only', 'open'];
  for (const poolType of poolTypes) {
    const typeBookings = shareable.filter((b) => b.pool_type === poolType && !placed.has(b.id));
    const byCorridor = new Map<string, MatchBookingInput[]>();
    for (const b of typeBookings) {
      const zone = zoneMap.get(b.zone_id);
      if (!zone) continue;
      byCorridor.set(zone.corridor_id, [...(byCorridor.get(zone.corridor_id) ?? []), b]);
    }

    for (const [corridorId, list] of Array.from(byCorridor.entries())) {
      const byZone = new Map<string, MatchBookingInput[]>();
      for (const b of list) byZone.set(b.zone_id, [...(byZone.get(b.zone_id) ?? []), b]);

      const zoneEntries = Array.from(byZone.entries()).sort(([za, la], [zb, lb]) => {
        const sa = la.reduce((s, i) => s + i.seats, 0);
        const sb = lb.reduce((s, i) => s + i.seats, 0);
        if (sb !== sa) return sb - sa;
        return (zoneMap.get(za)?.order_in_corridor ?? 99) - (zoneMap.get(zb)?.order_in_corridor ?? 99);
      });

      const ordered: MatchBookingInput[] = [];
      for (const [, zb] of zoneEntries) {
        ordered.push(
          ...[...zb].sort((a, b) => {
            // Riders who already accepted anchor the group first.
            if ((a.consent === 'accepted') !== (b.consent === 'accepted')) return a.consent === 'accepted' ? -1 : 1;
            if (b.seats !== a.seats) return b.seats - a.seats;
            return byCreated(a, b);
          })
        );
      }

      interface Bin {
        items: MatchBookingInput[];
        seats: number;
        hint?: ExistingPoolHint;
      }
      const bins: Bin[] = [];
      for (const b of ordered) {
        const hint = existingPools.find(
          (ep) =>
            ep.corridor_id === corridorId &&
            ep.pool_type === poolType &&
            ep.status === 'forming' &&
            (ep.id === b.existing_pool_id || ep.booking_ids.includes(b.id))
        );
        let target = hint ? bins.find((x) => x.hint?.id === hint.id && x.seats + b.seats <= maxCap) : undefined;
        target ??= bins.find((x) => x.seats + b.seats <= maxCap);
        if (!target) {
          target = { items: [], seats: 0, hint };
          bins.push(target);
        }
        target.items.push(b);
        target.seats += b.seats;
      }

      for (const bin of bins) {
        const poolId =
          bin.hint?.id && !pools.some((p) => p.id === bin.hint!.id)
            ? bin.hint.id
            : deterministicPoolKey(pools.length);
        const accepted = bin.items.filter((i) => i.consent === 'accepted');
        const acceptedSeats = accepted.reduce((s, i) => s + i.seats, 0);
        const booked = !cancelled && acceptedSeats >= config.minPoolSize;

        let formed: FormedPool;
        if (booked) {
          const claimed = claimVehicle(acceptedSeats, bin.hint?.vehicle_id);
          const fare = rideFare(accepted, claimed.vehicleType);
          formed = {
            id: poolId,
            pool_type: poolType,
            corridor_id: corridorId,
            vehicle_id: claimed.vehicleId,
            vehicle_type: claimed.vehicleType,
            driver_id: claimed.driverId,
            pickup_time: pickupTime,
            status: 'confirmed',
            accepted_seats: acceptedSeats,
            total_seats: acceptedSeats,
            capacity: claimed.capacity,
            ride_fare_pkr: fare,
            zone_ids_ordered: orderedZoneIds(accepted),
            booking_ids: accepted.map((i) => i.id),
            shares: sharesFor(accepted, fare),
          };
          // Anyone in the group who had not accepted yet must be approved by the riders.
          let room = formed.capacity - acceptedSeats;
          for (const p of bin.items.filter((i) => i.consent !== 'accepted').sort(byCreated)) {
            if (p.seats > room) {
              fallbacksByBookingId[p.id] = fallbacksFor(p, corridorId, false);
              continue;
            }
            room -= p.seats;
            const seatsAfter = acceptedSeats + p.seats;
            joinRequests.push({
              bookingId: p.id,
              poolId,
              voterBookingIds: formed.booking_ids,
              projectedSeatFarePkr: Math.ceil(fare / seatsAfter),
              projectedRiderSeats: seatsAfter,
            });
            formed.total_seats += p.seats;
          }
        } else {
          formed = {
            id: poolId,
            pool_type: poolType,
            corridor_id: corridorId,
            vehicle_id: null,
            vehicle_type: null,
            driver_id: null,
            pickup_time: pickupTime,
            status: cancelled ? 'cancelled' : 'forming',
            accepted_seats: acceptedSeats,
            total_seats: bin.seats,
            capacity: maxCap,
            ride_fare_pkr: 0,
            zone_ids_ordered: orderedZoneIds(bin.items),
            booking_ids: bin.items.map((i) => i.id),
            shares: {},
          };
          bin.items.forEach((i) => (fallbacksByBookingId[i.id] = fallbacksFor(i, corridorId, true)));
        }

        pools.push(formed);
        for (const id of formed.booking_ids) {
          bookingToPoolId[id] = formed.id;
          const src = bin.items.find((i) => i.id === id);
          if (src?.existing_pool_id && src.existing_pool_id !== formed.id) reassignedBookingIds.push(id);
        }
      }
    }
  }

  // ---- Dedicated solo rides ----
  for (const solo of soloBookings) {
    const zone = zoneMap.get(solo.zone_id);
    if (!zone) continue;
    const claimed = claimVehicle(solo.seats);
    const poolId = solo.existing_pool_id || deterministicPoolKey(pools.length);
    const fare = rideFare([solo], claimed.vehicleType);
    pools.push({
      id: poolId,
      pool_type: solo.pool_type,
      corridor_id: zone.corridor_id,
      vehicle_id: claimed.vehicleId,
      vehicle_type: claimed.vehicleType,
      driver_id: claimed.driverId,
      pickup_time: pickupTime,
      status: cancelled ? 'cancelled' : 'confirmed',
      accepted_seats: solo.seats,
      total_seats: solo.seats,
      capacity: Math.max(solo.seats, claimed.capacity),
      ride_fare_pkr: fare,
      zone_ids_ordered: [solo.zone_id],
      booking_ids: [solo.id],
      shares: { [solo.id]: { seatFarePkr: fare, totalFarePkr: fare } },
    });
    bookingToPoolId[solo.id] = poolId;
  }

  return result();
}

export function getDefaultMatchingConfig() {
  return {
    vehicleCapacity: appConfig.vehicleCapacity,
    minPoolSize: appConfig.minPoolSize,
    matchWindowMinutes: appConfig.matchWindowMinutes,
  };
}
