import { NextRequest } from 'next/server';
import { z } from 'zod';
import { appConfig } from '@/lib/config';
import {
  calculateBookingFare,
  getFallbackStaticFare,
} from '@/lib/fares/calculator';
import {
  getDefaultMatchingConfig,
  runMatchingEngine,
} from '@/lib/matching/engine';
import { apiError, apiSuccess } from '@/lib/rate-limit';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import {
  BookingRecord,
  DriverRecord,
  FlightRecord,
  VehicleRecord,
  ZoneRecord,
} from '@/types/database';

const quoteSchema = z.object({
  flightId: z.string().uuid(),
  zoneId: z.string().uuid(),
  seats: z.number().int().min(1).max(4),
  poolType: z.enum(['open', 'women_only', 'family_only']).default('open'),
  rideMode: z.enum(['pool', 'solo']).default('pool'),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, 'INVALID_JSON', 'Request body must be valid JSON.');
  }

  const parsed = quoteSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      400,
      'VALIDATION_ERROR',
      parsed.error.issues[0]?.message || 'Invalid quote parameters.'
    );
  }

  const { flightId, zoneId, seats, poolType, rideMode } = parsed.data;

  if (poolType === 'family_only' && seats < 2) {
    return apiError(
      400,
      'FAMILY_MIN_SEATS',
      'Family-only pools require 2 or more seats.'
    );
  }

  const admin = createAdminSupabaseClient();

  const [
    { data: flight },
    { data: zone },
    { data: allZones },
    { data: existingBookings },
    { data: vehicles },
    { data: drivers },
  ] = await Promise.all([
    admin.from('flights').select('*').eq('id', flightId).single(),
    admin
      .from('zones')
      .select('*, corridor:corridors(*), fare:zone_fares(*)')
      .eq('id', zoneId)
      .single(),
    admin.from('zones').select('*').eq('active', true),
    admin
      .from('bookings')
      .select('*')
      .eq('flight_id', flightId)
      .in('status', ['pending', 'confirmed', 'checked_in']),
    admin.from('vehicles').select('*').eq('active', true),
    admin.from('drivers').select('*').eq('verified', true),
  ]);

  if (!flight) {
    return apiError(404, 'FLIGHT_NOT_FOUND', 'Selected flight was not found.');
  }
  if (!zone) {
    return apiError(404, 'ZONE_NOT_FOUND', 'Selected destination zone was not found.');
  }

  const fareRow = Array.isArray(zone.fare) ? zone.fare[0] : zone.fare;
  const effectiveFare = fareRow || getFallbackStaticFare(zone.slug);

  // Preview assumes the minimum shared ride (2 people); the real share depends on who agrees.
  const fare = calculateBookingFare({
    seatFarePkr: effectiveFare.seat_fare_pkr,
    soloFarePkr: effectiveFare.solo_fare_pkr,
    seats,
    commissionRate: appConfig.commissionRate,
    depositPkr: appConfig.noShowDepositPkr,
    rideMode,
    asOfDate: effectiveFare.as_of_date,
    isPlaceholder: effectiveFare.is_placeholder,
  });

  const candidateId = '00000000-0000-4000-8000-000000000999';
  const typedBookings = (existingBookings ?? []) as BookingRecord[];
  const typedZones = (allZones ?? []) as ZoneRecord[];

  const simResult = runMatchingEngine({
    flight: flight as FlightRecord,
    bookings: [
      ...typedBookings.map((b) => ({
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
      {
        id: candidateId,
        user_id: 'preview-user',
        zone_id: zoneId,
        seats,
        pool_type: poolType,
        ride_mode: fare.rideMode,
        consent: 'accepted',
        seat_fare_pkr: fare.perSeatFarePkr,
        solo_fare_pkr: fare.soloUnitFarePkr,
        created_at: new Date().toISOString(),
      },
    ],
    zones: typedZones,
    vehicles: (vehicles ?? []) as VehicleRecord[],
    drivers: (drivers ?? []) as DriverRecord[],
    config: getDefaultMatchingConfig(),
  });

  const assignedPoolId = simResult.bookingToPoolId[candidateId];
  const matchedPool = simResult.pools.find((p) => p.id === assignedPoolId) || null;
  const zoneMap = new Map(typedZones.map((z) => [z.id, z]));

  const poolZones = matchedPool
    ? matchedPool.zone_ids_ordered
        .map((id) => zoneMap.get(id))
        .filter((z): z is ZoneRecord => Boolean(z))
    : [];

  return apiSuccess({
    fare,
    previewPool: matchedPool
      ? {
          status: matchedPool.status,
          poolType: matchedPool.pool_type,
          totalSeats: matchedPool.total_seats,
          acceptedSeats: matchedPool.accepted_seats,
          peopleNeeded: Math.max(0, appConfig.minPoolSize - matchedPool.accepted_seats),
          rideFarePkr: matchedPool.ride_fare_pkr,
          vehicleType: matchedPool.vehicle_type,
          estimatedSeatFarePkr: Math.ceil(
            (matchedPool.ride_fare_pkr || fare.rideFarePkr) /
              Math.max(appConfig.minPoolSize, matchedPool.accepted_seats, seats)
          ),
          joinRequiresApproval: simResult.joinRequests.some((r) => r.bookingId === candidateId),
          capacity: matchedPool.capacity,
          minPoolSize: appConfig.minPoolSize,
          pickupTime: matchedPool.pickup_time,
          corridorName: zone.corridor?.name || 'Karachi Corridor',
          zonesInRoute: poolZones.map((z) => ({
            id: z.id,
            name: z.name,
            order: z.order_in_corridor,
          })),
        }
      : null,
    fallbacks: simResult.fallbacksByBookingId[candidateId] ?? [],
    soloRecommended: simResult.soloRecommendedBookingIds.includes(candidateId),
  });
}
