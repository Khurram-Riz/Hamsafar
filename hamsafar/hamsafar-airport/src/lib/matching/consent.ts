import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { reconcileFlightPools } from './service';

export type ConsentDecision = 'accepted' | 'declined';

/** A rider accepts (or declines) sharing a ride with the group they were matched with. */
export async function setShareConsent(bookingId: string, userId: string, decision: ConsentDecision) {
  const admin = createAdminSupabaseClient();
  const { data: booking } = await admin.from('bookings').select('*').eq('id', bookingId).single();
  if (!booking) return { ok: false as const, code: 'BOOKING_NOT_FOUND', message: 'Booking not found.' };
  if (booking.user_id !== userId) return { ok: false as const, code: 'FORBIDDEN', message: 'Not your booking.' };
  if (['cancelled', 'dropped_off', 'no_show'].includes(booking.status))
    return { ok: false as const, code: 'BOOKING_CLOSED', message: 'This booking is no longer active.' };
  if (booking.ride_mode === 'solo')
    return { ok: false as const, code: 'SOLO_RIDE', message: 'Solo rides do not need sharing consent.' };

  await admin.from('bookings').update({ share_consent: decision }).eq('id', bookingId);
  await reconcileFlightPools(booking.flight_id, { reason: 'consent_changed', triggerBookingId: bookingId });
  return { ok: true as const };
}

/** A current rider approves or declines a newcomer joining their booked ride. */
export async function castJoinVote(
  poolId: string,
  joinerBookingId: string,
  voterUserId: string,
  vote: 'approved' | 'declined'
) {
  const admin = createAdminSupabaseClient();
  const { data: voter } = await admin
    .from('bookings')
    .select('id, flight_id')
    .eq('user_id', voterUserId)
    .eq('pool_id', poolId)
    .eq('share_consent', 'accepted')
    .in('status', ['confirmed', 'checked_in'])
    .maybeSingle();
  if (!voter) return { ok: false as const, code: 'NOT_A_RIDER', message: 'Only riders on this ride can vote.' };

  const { data: row } = await admin
    .from('pool_join_votes')
    .select('id')
    .eq('pool_id', poolId)
    .eq('joiner_booking_id', joinerBookingId)
    .eq('voter_booking_id', voter.id)
    .maybeSingle();
  if (!row) return { ok: false as const, code: 'NO_REQUEST', message: 'There is no pending request to vote on.' };

  await admin.from('pool_join_votes').update({ vote }).eq('id', row.id);

  if (vote === 'declined') {
    // One "no" is enough: the newcomer is told and offered other options.
    await admin.from('bookings').update({ share_consent: 'declined', pool_id: null }).eq('id', joinerBookingId);
    await admin.from('pool_join_votes').delete().eq('joiner_booking_id', joinerBookingId);
  }
  await reconcileFlightPools(voter.flight_id, { reason: 'join_vote', triggerBookingId: joinerBookingId });
  return { ok: true as const };
}
