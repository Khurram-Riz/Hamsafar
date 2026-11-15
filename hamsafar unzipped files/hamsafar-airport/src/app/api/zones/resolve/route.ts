import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getFallbackStaticFare } from '@/lib/fares/calculator';
import { apiError, apiSuccess } from '@/lib/rate-limit';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { resolvePinToZone } from '@/lib/zones/resolver';
import { ZoneRecord } from '@/types/database';

const resolveSchema = z.object({
  lat: z.number().min(24.0).max(26.0),
  lng: z.number().min(66.0).max(68.5),
  airport: z.string().default('KHI'),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, 'INVALID_JSON', 'Request body must be valid JSON.');
  }

  const parsed = resolveSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      400,
      'INVALID_COORDINATES',
      'Dropped pin must be within the greater Karachi metropolitan area.'
    );
  }

  const admin = createAdminSupabaseClient();
  const { data: zones, error } = await admin
    .from('zones')
    .select('*, corridor:corridors(*), fare:zone_fares(*)')
    .eq('airport_code', parsed.data.airport.toUpperCase())
    .eq('active', true);

  if (error || !zones) {
    return apiError(500, 'ZONES_FETCH_FAILED', error?.message || 'Failed to load zones.');
  }

  const resolution = resolvePinToZone(
    parsed.data.lat,
    parsed.data.lng,
    zones as ZoneRecord[]
  );

  const enrichZone = (z: ZoneRecord | null) => {
    if (!z) return null;
    const full = zones.find((item) => item.id === z.id);
    const fareRow = Array.isArray(full?.fare) ? full.fare[0] : full?.fare;
    return {
      ...full,
      fare: fareRow || getFallbackStaticFare(z.slug),
    };
  };

  return apiSuccess({
    ...resolution,
    zone: enrichZone(resolution.zone),
    nearestZone: enrichZone(resolution.nearestZone),
  });
}
