import { apiSuccess } from '@/lib/rate-limit';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = createServerSupabaseClient();
  await supabase.auth.signOut();
  return apiSuccess({ ok: true });
}
