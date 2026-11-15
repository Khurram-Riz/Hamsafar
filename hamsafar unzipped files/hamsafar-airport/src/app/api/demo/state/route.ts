import { NextRequest } from 'next/server';
import { appConfig } from '@/lib/config';
import { apiError, apiSuccess } from '@/lib/rate-limit';
import { createAdminSupabaseClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const requestedFlightId = searchParams.get('flightId');

  const admin = createAdminSupabaseClient();

  const { data: flights } = await admin
    .from('flights')
    .select('*')
    .order('scheduled_arrival', { ascending: false })
    .limit(10);

  const selectedFlight =
    (flights ?? []).find((f) => f.id === requestedFlightId) ||
    (flights ?? []).find((f) => f.flight_no === 'PK-309') ||
    (flights ?? [])[0] ||
    null;

  const [{ data: zones }, { data: corridors }] = await Promise.all([
    admin
      .from('zones')
      .select('*, corridor:corridors(*), fare:zone_fares(*)')
      .eq('active', true)
      .order('order_in_corridor', { ascending: true }),
    admin.from('corridors').select('*'),
  ]);

  if (!selectedFlight) {
    return apiSuccess({
      flights: [],
      selectedFlight: null,
      pools: [],
      bookings: [],
      zones: zones ?? [],
      corridors: corridors ?? [],
      metrics: {
        totalPassengers: 0,
        matchedPassengers: 0,
        matchRatePercent: 0,
        avgSavingPkr: 0,
        vehicleFillRatePercent: 0,
        confirmedPoolsCount: 0,
      },
    });
  }

  const [{ data: pools }, { data: bookings }] = await Promise.all([
    admin
      .from('pools')
      .select(
        `
        *,
        corridor:corridors(*),
        vehicle:vehicles(*),
        driver:drivers(id, name, verified)
      `
      )
      .eq('flight_id', selectedFlight.id)
      .order('created_at', { ascending: true }),
    admin
      .from('bookings')
      .select(
        `
        *,
        zone:zones(*, corridor:corridors(*)),
        user:users(id, name, gender, verified, is_demo)
      `
      )
      .eq('flight_id', selectedFlight.id)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: true }),
  ]);

  const activeBookings = bookings ?? [];
  const activePools = pools ?? [];

  const totalSeatsBooked = activeBookings.reduce((s, b) => s + b.seats, 0);
  const confirmedPoolIds = new Set(
    activePools.filter((p) => p.status === 'confirmed' || p.status === 'dispatched').map((p) => p.id)
  );
  const matchedSeats = activeBookings
    .filter((b) => b.pool_id && confirmedPoolIds.has(b.pool_id))
    .reduce((s, b) => s + b.seats, 0);

  const matchRatePercent =
    totalSeatsBooked > 0 ? Math.round((matchedSeats / totalSeatsBooked) * 100) : 0;

  const totalSavings = activeBookings.reduce(
    (s, b) => s + Math.max(0, b.solo_fare_pkr * b.seats - b.total_fare_pkr),
    0
  );
  const avgSavingPkr =
    totalSeatsBooked > 0 ? Math.round(totalSavings / totalSeatsBooked) : 0;

  const totalCapacity = activePools.reduce(
    (s, p) => s + (p.vehicle?.capacity || appConfig.vehicleCapacity),
    0
  );
  const vehicleFillRatePercent =
    totalCapacity > 0 ? Math.round((totalSeatsBooked / totalCapacity) * 100) : 0;

  return apiSuccess({
    flights: flights ?? [],
    selectedFlight,
    pools: activePools,
    bookings: activeBookings,
    zones: zones ?? [],
    corridors: corridors ?? [],
    metrics: {
      totalPassengers: totalSeatsBooked,
      matchedPassengers: matchedSeats,
      matchRatePercent,
      avgSavingPkr,
      vehicleFillRatePercent,
      confirmedPoolsCount: confirmedPoolIds.size,
    },
  });
}
