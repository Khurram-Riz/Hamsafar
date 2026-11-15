import { NextRequest } from 'next/server';
import { z } from 'zod';
import { reconcileFlightPools } from '@/lib/matching/service';
import { apiError, apiSuccess } from '@/lib/rate-limit';
import { createAdminSupabaseClient } from '@/lib/supabase/server';

const delaySchema = z.object({
  flightId: z.string().uuid(),
  deltaMinutes: z.number().int().min(-180).max(480).default(40),
  cancelFlight: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, 'INVALID_JSON', 'Request body must be valid JSON.');
  }

  const parsed = delaySchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, 'VALIDATION_ERROR', 'Invalid delay simulation parameters.');
  }

  const admin = createAdminSupabaseClient();
  const { data: flight } = await admin
    .from('flights')
    .select('*')
    .eq('id', parsed.data.flightId)
    .single();

  if (!flight) {
    return apiError(404, 'FLIGHT_NOT_FOUND', 'Flight not found.');
  }

  const currentEstMs = new Date(flight.estimated_arrival).getTime();
  const nextEstIso = new Date(
    currentEstMs + parsed.data.deltaMinutes * 60_000
  ).toISOString();

  const nextStatus = parsed.data.cancelFlight
    ? 'cancelled'
    : parsed.data.deltaMinutes > 0
    ? 'delayed'
    : 'scheduled';

  await admin
    .from('flights')
    .update({
      estimated_arrival: nextEstIso,
      status: nextStatus,
    })
    .eq('id', flight.id);

  await reconcileFlightPools(flight.id, {
    reason: 'flight_delayed',
    delayDeltaMinutes: parsed.data.deltaMinutes,
  });

  return apiSuccess({
    ok: true,
    estimatedArrival: nextEstIso,
    status: nextStatus,
    message: parsed.data.cancelFlight
      ? 'Flight marked cancelled and all pools notified.'
      : `Flight shifted by ${
          parsed.data.deltaMinutes >= 0
            ? `+${parsed.data.deltaMinutes}`
            : parsed.data.deltaMinutes
        } minutes. All pools and notifications updated.`,
  });
}
