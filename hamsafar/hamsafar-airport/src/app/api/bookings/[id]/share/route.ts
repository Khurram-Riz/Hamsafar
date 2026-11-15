import { NextRequest } from 'next/server';
import { generateShareToken } from '@/lib/config';
import { apiError, apiSuccess } from '@/lib/rate-limit';
import {
  createAdminSupabaseClient,
  createServerSupabaseClient,
} from '@/lib/supabase/server';

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return apiError(401, 'UNAUTHORIZED', 'Please sign in first.');
  }

  const admin = createAdminSupabaseClient();
  const { data: booking } = await admin
    .from('bookings')
    .select('id, user_id')
    .eq('id', params.id)
    .single();

  if (!booking) {
    return apiError(404, 'BOOKING_NOT_FOUND', 'Booking not found.');
  }

  if (booking.user_id !== user.id) {
    return apiError(403, 'FORBIDDEN', 'Unauthorized.');
  }

  // Return existing active non-revoked link if still valid
  const { data: existing } = await admin
    .from('share_links')
    .select('*')
    .eq('booking_id', booking.id)
    .eq('revoked', false)
    .gt('expires_at', new Date().toISOString())
    .limit(1)
    .maybeSingle();

  if (existing) {
    return apiSuccess({ shareLink: existing });
  }

  const token = generateShareToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60_000).toISOString();

  const { data: created, error } = await admin
    .from('share_links')
    .insert({
      booking_id: booking.id,
      token,
      expires_at: expiresAt,
      revoked: false,
    })
    .select('*')
    .single();

  if (error || !created) {
    return apiError(500, 'SHARE_CREATE_FAILED', error?.message || 'Failed to create share link.');
  }

  return apiSuccess({ shareLink: created }, 201);
}
