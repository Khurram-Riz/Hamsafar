import { NextRequest } from 'next/server';
import { appConfig } from '@/lib/config';
import { apiError, apiSuccess } from '@/lib/rate-limit';
import {
  createAdminSupabaseClient,
  createServerSupabaseClient,
} from '@/lib/supabase/server';

/**
 * Public unauthenticated trip view (FR-8.4, NFR-5).
 * Strictly exposes ONLY vehicle plate, driver name, pool status, route waypoints,
 * and simulated live vehicle coordinates. NEVER exposes passenger or driver phone numbers.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const admin = createAdminSupabaseClient();
  const { data: link } = await admin
    .from('share_links')
    .select('*')
    .eq('token', params.token)
    .maybeSingle();

  if (!link || link.revoked || new Date(link.expires_at).getTime() <= Date.now()) {
    return apiError(
      404,
      'SHARE_LINK_INVALID',
      'This family trip share link has expired or been revoked by the passenger.'
    );
  }

  const { data: booking } = await admin
    .from('bookings')
    .select(
      `
      id,
      status,
      seats,
      pool_type,
      flight:flights(flight_no, airline, origin, estimated_arrival, status),
      zone:zones(name, lat, lng, corridor:corridors(name, color)),
      pool:pools(
        id,
        status,
        pickup_time,
        meeting_point,
        vehicle:vehicles(plate, model),
        driver:drivers(name, verified)
      )
    `
    )
    .eq('id', link.booking_id)
    .single();

  if (!booking) {
    return apiError(404, 'TRIP_NOT_FOUND', 'Trip details unavailable.');
  }

  const airport = appConfig.airportCoords;
  const zoneObj = Array.isArray(booking.zone) ? booking.zone[0] : booking.zone;
  const poolObj = Array.isArray(booking.pool) ? booking.pool[0] : booking.pool;
  const flightObj = Array.isArray(booking.flight)
    ? booking.flight[0]
    : booking.flight;
  const vehicleObj = poolObj?.vehicle
    ? Array.isArray(poolObj.vehicle)
      ? poolObj.vehicle[0]
      : poolObj.vehicle
    : null;
  const driverObj = poolObj?.driver
    ? Array.isArray(poolObj.driver)
      ? poolObj.driver[0]
      : poolObj.driver
    : null;
  const corridorObj = zoneObj?.corridor
    ? Array.isArray(zoneObj.corridor)
      ? zoneObj.corridor[0]
      : zoneObj.corridor
    : null;

  const destLat = zoneObj?.lat ?? 24.8607;
  const destLng = zoneObj?.lng ?? 67.0645;

  // Compute simulated live vehicle position along the route based on booking/pool status
  let progress = 0.08;
  if (booking.status === 'checked_in' || poolObj?.status === 'dispatched') {
    progress = 0.52;
  } else if (booking.status === 'dropped_off' || poolObj?.status === 'completed') {
    progress = 1.0;
  }

  const liveLat = airport.lat + (destLat - airport.lat) * progress;
  const liveLng = airport.lng + (destLng - airport.lng) * progress;

  return apiSuccess({
    trip: {
      bookingStatus: booking.status,
      poolStatus: poolObj?.status || 'forming',
      poolType: booking.pool_type,
      seats: booking.seats,
      flightNo: flightObj?.flight_no || 'KHI Flight',
      airline: flightObj?.airline || '',
      origin: flightObj?.origin || '',
      flightStatus: flightObj?.status || 'scheduled',
      pickupTime: poolObj?.pickup_time || flightObj?.estimated_arrival,
      meetingPoint: poolObj?.meeting_point || airport.meetingPoint,
      corridorName: corridorObj?.name || 'Karachi Corridor',
      corridorColor: corridorObj?.color || '#0d9488',
      destinationZone: zoneObj?.name || 'Karachi Zone',
      vehiclePlate: vehicleObj?.plate || 'Assigning soon',
      vehicleModel: vehicleObj?.model || '8-Seat Executive Van',
      driverName: driverObj?.name || 'Verified Hamsafar Captain',
      driverVerified: driverObj?.verified ?? true,
      route: {
        originCoords: { lat: airport.lat, lng: airport.lng, label: airport.name },
        destinationCoords: {
          lat: destLat,
          lng: destLng,
          label: zoneObj?.name || 'Destination',
        },
        liveCoords: { lat: liveLat, lng: liveLng },
        progressPercent: Math.round(progress * 100),
      },
    },
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return apiError(401, 'UNAUTHORIZED', 'Please sign in to revoke share links.');
  }

  const admin = createAdminSupabaseClient();
  const { data: link } = await admin
    .from('share_links')
    .select('id, booking:bookings(user_id)')
    .eq('token', params.token)
    .maybeSingle();

  if (!link) {
    return apiError(404, 'LINK_NOT_FOUND', 'Share link not found.');
  }

  const bookingOwner = Array.isArray(link.booking)
    ? link.booking[0]?.user_id
    : (link.booking as { user_id?: string } | null)?.user_id;

  if (bookingOwner !== user.id) {
    return apiError(403, 'FORBIDDEN', 'You can only revoke your own share links.');
  }

  await admin
    .from('share_links')
    .update({ revoked: true })
    .eq('id', link.id);

  return apiSuccess({ ok: true, revoked: true });
}
