import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/rate-limit';
import {
  createAdminSupabaseClient,
  createServerSupabaseClient,
} from '@/lib/supabase/server';

const reportSchema = z.object({
  bookingId: z.string().uuid(),
  type: z.enum(['safety', 'pricing', 'driver', 'route', 'other']),
  description: z
    .string()
    .min(5, 'Please describe the issue in at least 5 characters.')
    .max(1000),
});

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return apiError(401, 'UNAUTHORIZED', 'Please sign in to submit a report.');
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, 'INVALID_JSON', 'Request body must be valid JSON.');
  }

  const parsed = reportSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      400,
      'VALIDATION_ERROR',
      parsed.error.issues[0]?.message || 'Invalid report details.'
    );
  }

  const admin = createAdminSupabaseClient();
  const { data: report, error } = await admin
    .from('reports')
    .insert({
      booking_id: parsed.data.bookingId,
      user_id: user.id,
      type: parsed.data.type,
      description: parsed.data.description.trim(),
      status: 'open',
    })
    .select('*')
    .single();

  if (error) {
    return apiError(500, 'REPORT_CREATE_FAILED', error.message);
  }

  return apiSuccess({ ok: true, report }, 201);
}
