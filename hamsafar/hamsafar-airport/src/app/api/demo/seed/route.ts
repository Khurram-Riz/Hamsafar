import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ensureDemoFlightAndSeedPassengers } from '@/lib/demo/seeder';
import { apiError, apiSuccess } from '@/lib/rate-limit';

const seedSchema = z.object({
  flightId: z.string().uuid().optional(),
  count: z.number().int().min(1).max(100).default(30),
});

export async function POST(req: NextRequest) {
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const parsed = seedSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, 'VALIDATION_ERROR', 'Invalid demo seed parameters.');
  }

  try {
    const result = await ensureDemoFlightAndSeedPassengers(
      parsed.data.flightId,
      parsed.data.count
    );
    return apiSuccess({
      ok: true,
      ...result,
      message: `Seeded ${result.seededCount} passengers and formed corridor pools.`,
    });
  } catch (err) {
    return apiError(
      500,
      'DEMO_SEED_FAILED',
      err instanceof Error ? err.message : 'Failed to seed demo passengers.'
    );
  }
}
