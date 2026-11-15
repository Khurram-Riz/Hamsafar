import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/rate-limit';
import { createAdminSupabaseClient, createServerSupabaseClient } from '@/lib/supabase/server';
import { castJoinVote } from '@/lib/matching/consent';
import { z } from 'zod';

const schema = z.object({
  joinerBookingId: z.string().uuid(),
  vote: z.enum(['approved', 'declined']),
});

/** A current rider approves or declines someone joining their booked ride. */
export async function POST(req: NextRequest, { params }: { params: { poolId: string } }) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError(401, 'UNAUTHORIZED', 'Please sign in first.');

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(400, 'VALIDATION_ERROR', 'Invalid vote.');

  const res = await castJoinVote(params.poolId, parsed.data.joinerBookingId, user.id, parsed.data.vote);
  if (!res.ok) return apiError(400, res.code, res.message);
  return apiSuccess({ ok: true });
}
