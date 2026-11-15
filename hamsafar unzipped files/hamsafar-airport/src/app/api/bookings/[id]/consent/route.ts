import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/rate-limit';
import { createAdminSupabaseClient, createServerSupabaseClient } from '@/lib/supabase/server';
import { setShareConsent } from '@/lib/matching/consent';
import { z } from 'zod';

const schema = z.object({ decision: z.enum(['accepted', 'declined']) });

/** A rider agrees (or refuses) to share their ride. A ride is booked once 2+ people agree. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError(401, 'UNAUTHORIZED', 'Please sign in first.');

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(400, 'VALIDATION_ERROR', 'decision must be "accepted" or "declined".');

  const res = await setShareConsent(params.id, user.id, parsed.data.decision);
  if (!res.ok) return apiError(res.code === 'FORBIDDEN' ? 403 : 400, res.code, res.message);
  return apiSuccess({ ok: true });
}
