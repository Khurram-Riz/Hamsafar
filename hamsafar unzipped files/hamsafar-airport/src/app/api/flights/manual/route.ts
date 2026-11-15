import { NextRequest } from 'next/server';
import { z } from 'zod';
import { normalizeFlightNo } from '@/lib/flights/provider';
import { apiError, apiSuccess } from '@/lib/rate-limit';
import { createAdminSupabaseClient } from '@/lib/supabase/server';

const manualFlightSchema = z.object({
  flightNo: z.string().min(2).max(12),
  airline: z.string().min(2).max(60).default('Other Airline'),
  origin: z.string().min(2).max(60).default('Origin City'),
  arrivalDateTime: z.string().min(10),
  terminal: z.string().max(60).default('Jinnah Terminal'),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, 'INVALID_JSON', 'Request body must be valid JSON.');
  }

  const parsed = manualFlightSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      400,
      'VALIDATION_ERROR',
      parsed.error.issues[0]?.message || 'Invalid manual flight details.'
    );
  }

  const arrivalDate = new Date(parsed.data.arrivalDateTime);
  if (Number.isNaN(arrivalDate.getTime())) {
    return apiError(400, 'INVALID_DATETIME', 'Please enter a valid arrival date and time.');
  }

  const normalizedNo = normalizeFlightNo(parsed.data.flightNo);
  const admin = createAdminSupabaseClient();

  const { data: inserted, error } = await admin
    .from('flights')
    .insert({
      flight_no: normalizedNo,
      airline: parsed.data.airline.trim(),
      origin: parsed.data.origin.trim(),
      airport_code: 'KHI',
      scheduled_arrival: arrivalDate.toISOString(),
      estimated_arrival: arrivalDate.toISOString(),
      terminal: parsed.data.terminal.trim(),
      status: 'scheduled',
      verified: false, // FR-2.3: manual entry flagged unverified
    })
    .select('*')
    .single();

  if (error || !inserted) {
    return apiError(500, 'FLIGHT_CREATE_FAILED', error?.message || 'Could not save flight.');
  }

  return apiSuccess({ flight: inserted }, 201);
}
