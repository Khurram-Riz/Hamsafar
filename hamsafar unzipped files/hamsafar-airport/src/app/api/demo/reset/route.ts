import { NextRequest } from 'next/server';
import { z } from 'zod';
import { resetDemoFlightData } from '@/lib/demo/seeder';
import { apiError, apiSuccess } from '@/lib/rate-limit';

const resetSchema = z.object({
  flightId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const parsed = resetSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, 'VALIDATION_ERROR', 'Invalid reset parameters.');
  }

  await resetDemoFlightData(parsed.data.flightId);

  return apiSuccess({
    ok: true,
    message: 'Demo passengers and pools cleared; flight schedule restored.',
  });
}
