import { NextRequest } from 'next/server';
import { reconcileFlightPools } from '@/lib/matching/service';
import { getNotifier } from '@/lib/notify/notifier';
import { getPaymentProvider } from '@/lib/payments/provider';
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
    .select('*')
    .eq('id', params.id)
    .single();

  if (!booking) {
    return apiError(404, 'BOOKING_NOT_FOUND', 'Booking not found.');
  }

  if (booking.user_id !== user.id) {
    return apiError(403, 'FORBIDDEN', 'You can only cancel your own booking.');
  }

  if (booking.status === 'cancelled') {
    return apiError(400, 'ALREADY_CANCELLED', 'This booking is already cancelled.');
  }

  const paymentProvider = getPaymentProvider();
  const refundedDepositStatus =
    booking.deposit_status === 'held'
      ? await paymentProvider.refundDeposit(
          booking.booking_code,
          booking.deposit_pkr
        )
      : booking.deposit_status;

  await admin
    .from('bookings')
    .update({
      status: 'cancelled',
      pool_id: null,
      deposit_status: refundedDepositStatus,
      payment_status:
        booking.payment_status === 'paid' ? 'refunded' : booking.payment_status,
    })
    .eq('id', booking.id);

  // Re-run matching idempotently so remaining passengers keep their confirmed seats (FR-5.3, NFR-7)
  await reconcileFlightPools(booking.flight_id, {
    reason: 'booking_cancelled',
    triggerBookingId: booking.id,
  });

  const notifier = getNotifier();
  await notifier.send({
    userId: user.id,
    bookingId: booking.id,
    type: 'pool_changed',
    title: `Booking ${booking.booking_code} Cancelled`,
    body: 'Your seat has been released and the fare for the remaining riders has been re-split.',
  });

  return apiSuccess({ ok: true });
}
