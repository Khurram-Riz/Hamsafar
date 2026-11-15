import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/rate-limit';
import {
  createAdminSupabaseClient,
  createServerSupabaseClient,
} from '@/lib/supabase/server';

export async function GET() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return apiSuccess({ notifications: [], unreadCount: 0 });
  }

  const admin = createAdminSupabaseClient();
  const { data: notifications } = await admin
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20);

  const list = notifications ?? [];
  const unreadCount = list.filter((n) => !n.read).length;

  return apiSuccess({ notifications: list, unreadCount });
}

export async function PATCH(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return apiError(401, 'UNAUTHORIZED', 'Sign in required.');
  }

  let body: { id?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const admin = createAdminSupabaseClient();
  if (body.id) {
    await admin
      .from('notifications')
      .update({ read: true })
      .eq('id', body.id)
      .eq('user_id', user.id);
  } else {
    await admin
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false);
  }

  return apiSuccess({ ok: true });
}
