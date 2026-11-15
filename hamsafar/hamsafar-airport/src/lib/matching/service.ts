import { appConfig } from '@/lib/config';
import { getNotifier, NotificationPayload } from '@/lib/notify/notifier';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import {
  BookingRecord,
  DriverRecord,
  FlightRecord,
  PoolJoinVoteRecord,
  VehicleRecord,
  ZoneRecord,
} from '@/types/database';
import { getDefaultMatchingConfig, runMatchingEngine } from './engine';
import { ExistingPoolHint } from './types';

export interface ReconcileOptions {
  reason:
    | 'booking_created'
    | 'booking_cancelled'
    | 'flight_delayed'
    | 'demo_seeded'
    | 'consent_changed'
    | 'join_vote'
    | 'rider_joined';
  triggerBookingId?: string;
  delayDeltaMinutes?: number;
  /** Internal: stops admit -> reconcile -> admit loops. */
  depth?: number;
}

const rs = (n: number) => `Rs ${Math.round(n).toLocaleString('en-PK')}`;

/**
 * Loads the flight state, runs the matching engine, and persists the result:
 *  - forming pools = riders connected, waiting for 2+ to agree (no vehicle yet)
 *  - confirmed pools = ride booked, vehicle assigned, fare split among riders
 *  - join requests = latecomers waiting for every current rider to approve
 * Whenever riders are added or removed, fares are redistributed and riders notified.
 */
export async function reconcileFlightPools(flightId: string, options: ReconcileOptions) {
  const admin = createAdminSupabaseClient();
  const notifier = getNotifier();
  const depth = options.depth ?? 0;

  const [
    { data: flight, error: flightErr },
    { data: bookingsRaw },
    { data: zonesRaw },
    { data: vehiclesRaw },
    { data: driversRaw },
    { data: existingPoolsRaw },
  ] = await Promise.all([
    admin.from('flights').select('*').eq('id', flightId).single(),
    admin
      .from('bookings')
      .select('*')
      .eq('flight_id', flightId)
      .in('status', ['pending', 'confirmed', 'checked_in'])
      .order('created_at', { ascending: true }),
    admin.from('zones').select('*').eq('active', true),
    admin.from('vehicles').select('*').eq('active', true),
    admin.from('drivers').select('*').eq('verified', true),
    admin.from('pools').select('*').eq('flight_id', flightId).neq('status', 'cancelled'),
  ]);

  if (flightErr || !flight) {
    throw new Error(`Flight ${flightId} not found for matching reconciliation.`);
  }

  const typedFlight = flight as FlightRecord;
  const activeBookings = (bookingsRaw ?? []) as BookingRecord[];
  const zones = (zonesRaw ?? []) as ZoneRecord[];
  const vehicles = (vehiclesRaw ?? []) as VehicleRecord[];
  const drivers = (driversRaw ?? []) as DriverRecord[];
  const existingPools = existingPoolsRaw ?? [];

  const existingHints: ExistingPoolHint[] = existingPools.map((p) => ({
    id: p.id,
    pool_type: p.pool_type,
    corridor_id: p.corridor_id,
    vehicle_id: p.vehicle_id,
    driver_id: p.driver_id,
    pickup_time: p.pickup_time,
    status: p.status,
    booking_ids: activeBookings.filter((b) => b.pool_id === p.id).map((b) => b.id),
  }));
  const previousStatus = new Map(existingPools.map((p) => [p.id, p.status as string]));

  const engineResult = runMatchingEngine({
    flight: typedFlight,
    bookings: activeBookings.map((b) => ({
      id: b.id,
      user_id: b.user_id,
      zone_id: b.zone_id,
      seats: b.seats,
      pool_type: b.pool_type,
      ride_mode: b.ride_mode,
      consent: b.share_consent ?? 'pending',
      seat_fare_pkr: b.seat_fare_pkr,
      solo_fare_pkr: b.solo_fare_pkr,
      existing_pool_id: b.pool_id,
      created_at: b.created_at,
    })),
    zones,
    vehicles,
    drivers,
    existingPools: existingHints,
    config: getDefaultMatchingConfig(),
  });

  const existingPoolIdSet = new Set(existingPools.map((p) => p.id));
  const retainedPoolIds = new Set<string>();
  const resolvedPoolIdMap = new Map<string, string>();

  for (const formed of engineResult.pools) {
    if (existingPoolIdSet.has(formed.id)) {
      retainedPoolIds.add(formed.id);
      resolvedPoolIdMap.set(formed.id, formed.id);
      await admin
        .from('pools')
        .update({
          vehicle_id: formed.vehicle_id,
          driver_id: formed.driver_id,
          pickup_time: formed.pickup_time,
          status: formed.status,
          ride_fare_pkr: formed.ride_fare_pkr,
        })
        .eq('id', formed.id);
    } else {
      const slug = `${typedFlight.flight_no.toLowerCase()}-${formed.pool_type}-${Math.random()
        .toString(36)
        .substring(2, 6)}`;
      const { data: created, error } = await admin
        .from('pools')
        .insert({
          flight_id: flightId,
          vehicle_id: formed.vehicle_id,
          driver_id: formed.driver_id,
          pool_type: formed.pool_type,
          corridor_id: formed.corridor_id,
          pickup_time: formed.pickup_time,
          meeting_point: appConfig.airportCoords.meetingPoint,
          whatsapp_link: `https://chat.whatsapp.com/hamsafar-demo-${slug}`,
          status: formed.status,
          ride_fare_pkr: formed.ride_fare_pkr,
        })
        .select('id')
        .single();
      if (!error && created) {
        retainedPoolIds.add(created.id);
        resolvedPoolIdMap.set(formed.id, created.id);
      }
    }
  }

  // ---- Booking rows: pool membership, status, and redistributed fares ----
  const sharesByBooking = new Map<string, { seatFarePkr: number; totalFarePkr: number }>();
  const confirmedMemberIds = new Set<string>();
  for (const formed of engineResult.pools) {
    for (const [id, share] of Object.entries(formed.shares)) sharesByBooking.set(id, share);
    if (formed.status === 'confirmed') formed.booking_ids.forEach((id) => confirmedMemberIds.add(id));
  }

  const finalBookingPoolId: Record<string, string> = {};
  const fareChanged: { booking: BookingRecord; newTotal: number; newSeat: number }[] = [];
  for (const booking of activeBookings) {
    const enginePoolId = engineResult.bookingToPoolId[booking.id];
    const realPoolId = enginePoolId ? resolvedPoolIdMap.get(enginePoolId) ?? null : null;
    if (realPoolId) finalBookingPoolId[booking.id] = realPoolId;

    const update: Record<string, unknown> = {};
    if ((booking.pool_id ?? null) !== realPoolId) update.pool_id = realPoolId;

    const nextStatus =
      booking.status === 'checked_in'
        ? 'checked_in'
        : confirmedMemberIds.has(booking.id)
        ? 'confirmed'
        : 'pending';
    if (booking.status !== nextStatus) update.status = nextStatus;

    const share = sharesByBooking.get(booking.id);
    if (share && share.totalFarePkr !== booking.total_fare_pkr) {
      const platform = Math.round(share.totalFarePkr * appConfig.commissionRate);
      update.seat_fare_pkr = share.seatFarePkr;
      update.total_fare_pkr = share.totalFarePkr;
      update.platform_fee_pkr = platform;
      update.operator_fee_pkr = share.totalFarePkr - platform;
      fareChanged.push({ booking, newTotal: share.totalFarePkr, newSeat: share.seatFarePkr });
    }
    if (Object.keys(update).length > 0) {
      await admin.from('bookings').update(update).eq('id', booking.id);
    }
  }

  const obsoletePoolIds = existingPools.map((p) => p.id).filter((id) => !retainedPoolIds.has(id));
  if (obsoletePoolIds.length > 0) {
    await admin.from('pools').delete().in('id', obsoletePoolIds);
  }

  // ---- Join requests: every current rider votes; stale votes are cleaned up ----
  const notifications: NotificationPayload[] = [];
  const joinerIds = engineResult.joinRequests.map((r) => r.bookingId);
  const { data: voteRowsRaw } = await admin
    .from('pool_join_votes')
    .select('*')
    .in('joiner_booking_id', joinerIds.length ? joinerIds : ['00000000-0000-0000-0000-000000000000']);
  const voteRows = (voteRowsRaw ?? []) as PoolJoinVoteRecord[];

  for (const req of engineResult.joinRequests) {
    const realPoolId = resolvedPoolIdMap.get(req.poolId);
    if (!realPoolId) continue;
    const mine = voteRows.filter((v) => v.joiner_booking_id === req.bookingId);
    const stale = mine.filter((v) => v.pool_id !== realPoolId || !req.voterBookingIds.includes(v.voter_booking_id));
    if (stale.length) await admin.from('pool_join_votes').delete().in('id', stale.map((v) => v.id));
    const have = new Set(mine.filter((v) => !stale.includes(v)).map((v) => v.voter_booking_id));
    const toAdd = req.voterBookingIds.filter((id) => !have.has(id));
    if (toAdd.length) {
      await admin.from('pool_join_votes').insert(
        toAdd.map((voter) => ({
          pool_id: realPoolId,
          joiner_booking_id: req.bookingId,
          voter_booking_id: voter,
          vote: 'pending',
        }))
      );
      for (const voter of toAdd) {
        const vb = activeBookings.find((b) => b.id === voter);
        if (!vb) continue;
        notifications.push({
          userId: vb.user_id,
          bookingId: vb.id,
          type: 'join_request',
          title: 'Someone wants to join your ride',
          body: `A rider heading the same way asked to join. If everyone agrees, ${req.projectedRiderSeats} people will share and your fare drops to about ${rs(req.projectedSeatFarePkr)} per seat. Open your trip to approve or decline.`,
        });
      }
    }
  }
  // Votes for joiners who are no longer waiting are removed.
  const requestSet = new Set(joinerIds);
  const orphan = voteRows.filter((v) => !requestSet.has(v.joiner_booking_id));
  if (orphan.length) await admin.from('pool_join_votes').delete().in('id', orphan.map((v) => v.id));

  // ---- Admit joiners once the joiner accepted AND every current rider approved ----
  let admitted = 0;
  for (const req of engineResult.joinRequests) {
    const realPoolId = resolvedPoolIdMap.get(req.poolId);
    const joiner = activeBookings.find((b) => b.id === req.bookingId);
    if (!realPoolId || !joiner || joiner.share_consent !== 'accepted') continue;
    const { data: votes } = await admin
      .from('pool_join_votes')
      .select('vote, voter_booking_id')
      .eq('joiner_booking_id', req.bookingId)
      .eq('pool_id', realPoolId);
    const list = votes ?? [];
    const allApproved =
      list.length === req.voterBookingIds.length && list.every((v) => v.vote === 'approved');
    if (allApproved) {
      await admin.from('bookings').update({ pool_id: realPoolId, status: 'confirmed' }).eq('id', joiner.id);
      await admin.from('pool_join_votes').delete().eq('joiner_booking_id', joiner.id);
      admitted++;
      notifications.push({
        userId: joiner.user_id,
        bookingId: joiner.id,
        type: 'ride_joined',
        title: 'You joined the ride',
        body: 'Everyone agreed. The ride fare has been re-split between all riders.',
      });
    }
  }

  // ---- Notifications ----
  const pickupFormatted = new Date(
    new Date(typedFlight.estimated_arrival).getTime() + appConfig.matchWindowMinutes * 60_000
  ).toLocaleTimeString('en-PK', { timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit' });

  for (const formed of engineResult.pools) {
    const realId = resolvedPoolIdMap.get(formed.id);
    const wasBooked = realId ? ['confirmed', 'dispatched'].includes(previousStatus.get(realId) ?? '') : false;
    if (formed.status === 'confirmed' && !wasBooked) {
      for (const id of formed.booking_ids) {
        const b = activeBookings.find((x) => x.id === id);
        if (!b) continue;
        notifications.push({
          userId: b.user_id,
          bookingId: b.id,
          type: 'ride_booked',
          title: `Ride booked: ${formed.accepted_seats} people sharing`,
          body: `Enough riders agreed. Your share is ${rs(formed.shares[id]?.totalFarePkr ?? 0)}. Pickup around ${pickupFormatted} PKT at ${appConfig.airportCoords.meetingPoint}.`,
        });
      }
    }
    if (formed.status === 'forming' && options.triggerBookingId && formed.booking_ids.includes(options.triggerBookingId)) {
      for (const id of formed.booking_ids) {
        if (id === options.triggerBookingId) continue;
        const b = activeBookings.find((x) => x.id === id);
        if (b && b.share_consent !== 'declined') {
          notifications.push({
            userId: b.user_id,
            bookingId: b.id,
            type: 'match_proposal',
            title: 'A rider is heading your way',
            body: 'Another passenger on your flight is going the same direction. Open your trip and accept to share the ride. It is only booked once at least 2 people agree.',
          });
        }
      }
    }
  }

  for (const c of fareChanged) {
    if (options.reason === 'demo_seeded') continue;
    if (c.booking.id === options.triggerBookingId && options.reason === 'booking_created') continue;
    notifications.push({
      userId: c.booking.user_id,
      bookingId: c.booking.id,
      type: 'fare_updated',
      title: 'Your fare changed',
      body: `Riders changed, so the ride fare was re-split. You now pay ${rs(c.newTotal)} (was ${rs(c.booking.total_fare_pkr)}).`,
    });
  }

  if (options.reason === 'flight_delayed') {
    const delta = options.delayDeltaMinutes ?? 0;
    const isCancelled = typedFlight.status === 'cancelled';
    for (const booking of activeBookings) {
      notifications.push({
        userId: booking.user_id,
        bookingId: booking.id,
        type: isCancelled ? 'flight_cancelled' : 'flight_delayed',
        title: isCancelled
          ? `Flight ${typedFlight.flight_no} Cancelled`
          : `Flight ${typedFlight.flight_no} Schedule Updated (${delta >= 0 ? `+${delta}` : delta} min)`,
        body: isCancelled
          ? 'Your ride has been cancelled and any held deposit has been refunded.'
          : `Rides re-synced. Your new pickup time is ${pickupFormatted} PKT.`,
      });
    }
  }

  if (notifications.length > 0 && options.reason !== 'demo_seeded') {
    await notifier.sendBatch(notifications);
  }

  // Joiner admitted: run once more so the fare is redistributed across the new rider set.
  if (admitted > 0 && depth < 2) {
    return reconcileFlightPools(flightId, { reason: 'rider_joined', depth: depth + 1 });
  }

  return { engineResult, finalBookingPoolId };
}
