import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/rate-limit';
import { createAdminSupabaseClient, createServerSupabaseClient } from '@/lib/supabase/server';
import { appConfig } from '@/lib/config';

/** Everything the trip screen needs about sharing: who agreed, my fare, and votes waiting on me. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError(401, 'UNAUTHORIZED', 'Please sign in first.');

  const admin = createAdminSupabaseClient();
  const { data: me } = await admin.from('bookings').select('*').eq('id', params.id).single();
  if (!me) return apiError(404, 'BOOKING_NOT_FOUND', 'Booking not found.');
  if (me.user_id !== user.id) return apiError(403, 'FORBIDDEN', 'Not your booking.');

  let ride: Record<string, unknown> | null = null;
  if (me.pool_id) {
    const [{ data: pool }, { data: members }] = await Promise.all([
      admin.from('pools').select('*, vehicle:vehicles(vehicle_type, capacity, model, plate)').eq('id', me.pool_id).single(),
      admin
        .from('bookings')
        .select('id, seats, share_consent, user_id, user:users(name)')
        .eq('pool_id', me.pool_id)
        .in('status', ['pending', 'confirmed', 'checked_in']),
    ]);
    const riding = (members ?? []).filter((m) => m.share_consent === 'accepted');
    const acceptedSeats = riding.reduce((s, m) => s + m.seats, 0);
    const vehicle = Array.isArray(pool?.vehicle) ? pool?.vehicle[0] : pool?.vehicle;
    ride = {
      poolId: me.pool_id,
      booked: pool?.status === 'confirmed' || pool?.status === 'dispatched',
      status: pool?.status,
      vehicleType: vehicle?.vehicle_type ?? null,
      vehicleCapacity: vehicle?.capacity ?? null,
      rideFarePkr: pool?.ride_fare_pkr ?? 0,
      acceptedSeats,
      minPeople: appConfig.minPoolSize,
      peopleNeeded: Math.max(0, appConfig.minPoolSize - acceptedSeats),
      members: (members ?? []).map((m) => {
        const u = Array.isArray(m.user) ? m.user[0] : m.user;
        return {
          label: m.id === me.id ? 'You' : (u?.name || 'Rider').split(' ')[0],
          seats: m.seats,
          agreed: m.share_consent === 'accepted',
          isMe: m.id === me.id,
        };
      }),
    };
  }

  // Votes waiting on ME (a newcomer wants to join my booked ride)
  const { data: myVotes } = await admin
    .from('pool_join_votes')
    .select('joiner_booking_id, pool_id')
    .eq('voter_booking_id', me.id)
    .eq('vote', 'pending');
  const votesNeeded = [];
  for (const v of myVotes ?? []) {
    const { data: joiner } = await admin.from('bookings').select('id, seats, zone:zones(name)').eq('id', v.joiner_booking_id).single();
    if (!joiner) continue;
    const zone = Array.isArray(joiner.zone) ? joiner.zone[0] : joiner.zone;
    const rideFare = Number((ride as { rideFarePkr?: number } | null)?.rideFarePkr ?? 0);
    const seatsAfter = Number((ride as { acceptedSeats?: number } | null)?.acceptedSeats ?? 0) + joiner.seats;
    votesNeeded.push({
      poolId: v.pool_id,
      joinerBookingId: joiner.id,
      joinerSeats: joiner.seats,
      joinerZone: zone?.name ?? 'the same corridor',
      projectedSeatFarePkr: seatsAfter > 0 ? Math.ceil(rideFare / seatsAfter) : null,
      projectedRiders: seatsAfter,
    });
  }

  // My own request to join someone else's booked ride
  const { data: mine } = await admin.from('pool_join_votes').select('vote').eq('joiner_booking_id', me.id);
  const joinRequest = (mine ?? []).length
    ? {
        approved: (mine ?? []).filter((v) => v.vote === 'approved').length,
        total: (mine ?? []).length,
      }
    : null;

  return apiSuccess({
    consent: me.share_consent,
    bookingStatus: me.status,
    seatFarePkr: me.seat_fare_pkr,
    totalFarePkr: me.total_fare_pkr,
    soloFarePkr: me.solo_fare_pkr,
    ride,
    votesNeeded,
    joinRequest,
  });
}
