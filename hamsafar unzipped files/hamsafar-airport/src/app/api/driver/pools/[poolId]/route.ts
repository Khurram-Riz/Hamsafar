import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/rate-limit';
import { createAdminSupabaseClient } from '@/lib/supabase/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: { poolId: string } }
) {
  const admin = createAdminSupabaseClient();

  const { data: pool, error } = await admin
    .from('pools')
    .select(
      `
      *,
      flight:flights(*),
      corridor:corridors(*),
      vehicle:vehicles(*),
      driver:drivers(*)
    `
    )
    .eq('id', params.poolId)
    .single();

  if (error || !pool) {
    return apiError(404, 'POOL_NOT_FOUND', 'Driver manifest pool not found.');
  }

  const { data: bookings } = await admin
    .from('bookings')
    .select(
      `
      id,
      booking_code,
      seats,
      luggage,
      pool_type,
      status,
      address_note,
      seat_fare_pkr,
      total_fare_pkr,
      payment_method,
      payment_status,
      checked_in_at,
      dropped_off_at,
      user:users(id, name, phone, verified),
      zone:zones(id, name, order_in_corridor, lat, lng)
    `
    )
    .eq('pool_id', params.poolId)
    .neq('status', 'cancelled');

  // FR-8.3: Sort passengers strictly in route drop-off order (order_in_corridor ascending)
  const sortedPassengers = (bookings ?? []).sort((a, b) => {
    const zA = Array.isArray(a.zone) ? a.zone[0] : a.zone;
    const zB = Array.isArray(b.zone) ? b.zone[0] : b.zone;
    return (zA?.order_in_corridor ?? 99) - (zB?.order_in_corridor ?? 99);
  });

  return apiSuccess({
    pool,
    manifest: sortedPassengers,
  });
}
