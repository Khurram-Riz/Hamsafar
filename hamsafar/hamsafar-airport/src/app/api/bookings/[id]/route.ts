import { NextRequest } from 'next/server';
import QRCode from 'qrcode';
import { appConfig } from '@/lib/config';
import { apiError, apiSuccess } from '@/lib/rate-limit';
import {
  createAdminSupabaseClient,
  createServerSupabaseClient,
} from '@/lib/supabase/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return apiError(401, 'UNAUTHORIZED', 'Please sign in to view this trip.');
  }

  const admin = createAdminSupabaseClient();
  const { data: booking, error } = await admin
    .from('bookings')
    .select(
      `
      *,
      flight:flights(*),
      zone:zones(*, corridor:corridors(*)),
      pool:pools(*, vehicle:vehicles(*), driver:drivers(*), corridor:corridors(*))
    `
    )
    .eq('id', params.id)
    .single();

  if (error || !booking) {
    return apiError(404, 'BOOKING_NOT_FOUND', 'Trip booking not found.');
  }

  if (booking.user_id !== user.id) {
    return apiError(403, 'FORBIDDEN', 'You do not have access to this booking.');
  }

  // Fetch co-passenger count in the same pool, share links, and existing rating
  const [{ data: poolBookings }, { data: shareLinks }, { data: rating }] =
    await Promise.all([
      booking.pool_id
        ? admin
            .from('bookings')
            .select('id, seats, zone:zones(name, order_in_corridor)')
            .eq('pool_id', booking.pool_id)
            .in('status', ['confirmed', 'checked_in', 'dropped_off'])
        : Promise.resolve({ data: [] }),
      admin
        .from('share_links')
        .select('*')
        .eq('booking_id', booking.id)
        .order('created_at', { ascending: false }),
      admin
        .from('ratings')
        .select('*')
        .eq('booking_id', booking.id)
        .maybeSingle(),
    ]);

  const totalPoolSeats = (poolBookings ?? []).reduce(
    (sum, item) => sum + (item.seats || 0),
    0
  );

  // FR-8.1: About 60 minutes before landing, user sees driver name, photo, vehicle plate & phone
  const arrivalMs = new Date(booking.flight.estimated_arrival).getTime();
  const minutesToArrival = Math.round((arrivalMs - Date.now()) / 60_000);
  const driverWindowActive = minutesToArrival <= 60 || appConfig.demoMode;

  const qrPayload = JSON.stringify({
    code: booking.booking_code,
    poolId: booking.pool_id,
    flight: booking.flight.flight_no,
    seats: booking.seats,
  });

  const qrDataUrl = await QRCode.toDataURL(qrPayload, {
    width: 240,
    margin: 2,
    color: {
      dark: '#0f453c',
      light: '#ffffff',
    },
  });

  return apiSuccess({
    booking,
    poolSummary: {
      totalSeats: totalPoolSeats,
      capacity: booking.pool?.vehicle?.capacity || appConfig.vehicleCapacity,
      passengerGroups: (poolBookings ?? []).length,
    },
    driverWindowActive,
    minutesToArrival,
    meetingPointLandmark: appConfig.airportCoords.landmark,
    qrDataUrl,
    shareLinks: shareLinks ?? [],
    rating: rating ?? null,
  });
}
