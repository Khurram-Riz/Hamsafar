import { createAdminSupabaseClient } from '@/lib/supabase/server';

export interface NotificationPayload {
  userId: string;
  bookingId?: string | null;
  type:
    | 'booking_confirmed'
    | 'pool_confirmed'
    | 'pool_changed'
    | 'flight_delayed'
    | 'flight_cancelled'
    | 'driver_assigned'
    | 'meeting_point'
    | 'ride_booked'
    | 'match_proposal'
    | 'join_request'
    | 'ride_joined'
    | 'fare_updated';
  title: string;
  body: string;
}

export interface Notifier {
  send(payload: NotificationPayload): Promise<void>;
  sendBatch(payloads: NotificationPayload[]): Promise<void>;
}

export class InAppConsoleNotifier implements Notifier {
  async send(payload: NotificationPayload): Promise<void> {
    await this.sendBatch([payload]);
  }

  async sendBatch(payloads: NotificationPayload[]): Promise<void> {
    if (payloads.length === 0) return;

    for (const item of payloads) {
      console.info(
        `[Hamsafar Notify][${item.type}] user=${item.userId} booking=${
          item.bookingId ?? 'n/a'
        } :: ${item.title} - ${item.body}`
      );
    }

    try {
      const admin = createAdminSupabaseClient();
      await admin.from('notifications').insert(
        payloads.map((p) => ({
          user_id: p.userId,
          booking_id: p.bookingId ?? null,
          type: p.type,
          title: p.title,
          body: p.body,
          read: false,
        }))
      );
    } catch (err) {
      console.error('[Hamsafar Notify] Failed to persist notification batch:', err);
    }
  }
}

export function getNotifier(): Notifier {
  return new InAppConsoleNotifier();
}
