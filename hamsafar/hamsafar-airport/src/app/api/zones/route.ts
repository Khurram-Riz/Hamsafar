import { NextRequest } from 'next/server';
import { getFallbackStaticFare } from '@/lib/fares/calculator';
import { apiError, apiSuccess } from '@/lib/rate-limit';
import { createAdminSupabaseClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const airport = (searchParams.get('airport') || 'KHI').toUpperCase();

  const admin = createAdminSupabaseClient();
  const { data: zones, error } = await admin
    .from('zones')
    .select(
      `
      *,
      corridor:corridors(*),
      fare:zone_fares(*)
    `
    )
    .eq('airport_code', airport)
    .eq('active', true)
    .order('order_in_corridor', { ascending: true });

  if (error) {
    return apiError(500, 'ZONES_FETCH_FAILED', error.message);
  }

  const normalized = (zones ?? []).map((z) => {
    const fareRow = Array.isArray(z.fare) ? z.fare[0] : z.fare;
    const fallback = getFallbackStaticFare(z.slug);
    return {
      ...z,
      fare: fareRow || fallback,
    };
  });

  return apiSuccess({ airport, zones: normalized });
}
