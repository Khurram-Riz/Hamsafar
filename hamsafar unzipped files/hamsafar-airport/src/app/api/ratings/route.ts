import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/rate-limit';
import {
  createAdminSupabaseClient,
  createServerSupabaseClient,
} from '@/lib/supabase/server';

const ratingSchema = z.object({
  bookingId: z.string().uuid(),
  driverScore: z.number().int().min(1).max(5),
  vehicleScore: z.number().int().min(1).max(5),
  rideScore: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional().nullable(),
});

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return apiError(401, 'UNAUTHORIZED', 'Please sign in to rate your ride.');
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, 'INVALID_JSON', 'Request body must be valid JSON.');
  }

  const parsed = ratingSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      400,
      'VALIDATION_ERROR',
      parsed.error.issues[0]?.message || 'Invalid rating input.'
    );
  }

  const admin = createAdminSupabaseClient();
  const { data: booking } = await admin
    .from('bookings')
    .select('id, user_id')
    .eq('id', parsed.data.bookingId)
    .single();

  if (!booking || booking.user_id !== user.id) {
    return apiError(403, 'FORBIDDEN', 'You can only rate your own booking.');
  }

  const { data: saved, error } = await admin
    .from('ratings')
    .upsert(
      {
        booking_id: booking.id,
        driver_score: parsed.data.driverScore,
        vehicle_score: parsed.data.vehicleScore,
        ride_score: parsed.data.rideScore,
        comment: parsed.data.comment?.trim() || null,
      },
      { onConflict: 'booking_id' }
    )
    .select('*')
    .single();

  if (error) {
    return apiError(500, 'RATING_SAVE_FAILED', error.message);
  }

  // FR-9.3: Slightly boost user reliability score on completed trip feedback
  const { data: profile } = await admin
    .from('users')
    .select('reliability_score')
    .eq('id', user.id)
    .single();

  if (profile) {
    const nextScore = Math.min(100, (profile.reliability_score ?? 100) + 1);
    await admin
      .from('users')
      .update({ reliability_score: nextScore })
      .eq('id', user.id);
  }

  return apiSuccess({ ok: true, rating: saved }, 201);
}
