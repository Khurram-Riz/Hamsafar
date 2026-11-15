import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/rate-limit';
import { createAdminSupabaseClient } from '@/lib/supabase/server';

const checkinSchema = z.object({
  bookingCode: z.string().min(4).max(20),
  action: z.enum(['checkin', 'dropoff']).default('checkin'),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { poolId: string } }
) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, 'INVALID_JSON', 'Request body must be valid JSON.');
  }

  const parsed = checkinSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      400,
      'VALIDATION_ERROR',
      'Enter a valid booking code (e.g. HMS-XXXXXX).'
    );
  }

  const normalizedCode = parsed.data.bookingCode.trim().toUpperCase();
  const admin = createAdminSupabaseClient();

  const { data: booking } = await admin
    .from('bookings')
    .select('id, pool_id, status, booking_code, seats, user:users(name)')
    .eq('booking_code', normalizedCode)
    .maybeSingle();

  // FR-8.3: Reject invalid codes or codes belonging to another pool
  if (!booking) {
    return apiError(
      404,
      'INVALID_BOOKING_CODE',
      `Booking code "${normalizedCode}" was not found. Reject boarding.`
    );
  }

  if (booking.pool_id !== params.poolId) {
    return apiError(
      400,
      'WRONG_POOL',
      `Code ${normalizedCode} belongs to a different van/pool. Please direct passenger to their assigned bay.`
    );
  }

  if (booking.status === 'cancelled') {
    return apiError(
      400,
      'BOOKING_CANCELLED',
      `Booking ${normalizedCode} was cancelled and is not valid for boarding.`
    );
  }

  const nowIso = new Date().toISOString();

  if (parsed.data.action === 'dropoff') {
    const { data: updated, error } = await admin
      .from('bookings')
      .update({
        status: 'dropped_off',
        dropped_off_at: nowIso,
        payment_status: 'paid',
      })
      .eq('id', booking.id)
      .select('*')
      .single();

    if (error) {
      return apiError(500, 'DROPOFF_FAILED', error.message);
    }

    // If all passengers in this pool are dropped off, mark pool completed
    const { data: remaining } = await admin
      .from('bookings')
      .select('id')
      .eq('pool_id', params.poolId)
      .in('status', ['confirmed', 'checked_in']);

    if ((remaining ?? []).length === 0) {
      await admin
        .from('pools')
        .update({ status: 'completed' })
        .eq('id', params.poolId);
    }

    return apiSuccess({
      ok: true,
      message: `Marked ${normalizedCode} as dropped off.`,
      booking: updated,
    });
  }

  const { data: checkedIn, error: checkinErr } = await admin
    .from('bookings')
    .update({
      status: 'checked_in',
      checked_in_at: nowIso,
    })
    .eq('id', booking.id)
    .select('*')
    .single();

  if (checkinErr) {
    return apiError(500, 'CHECKIN_FAILED', checkinErr.message);
  }

  await admin
    .from('pools')
    .update({ status: 'dispatched' })
    .eq('id', params.poolId)
    .in('status', ['forming', 'confirmed']);

  return apiSuccess({
    ok: true,
    message: `Checked in ${normalizedCode} (${booking.seats} seat${
      booking.seats > 1 ? 's' : ''
    }).`,
    booking: checkedIn,
  });
}
