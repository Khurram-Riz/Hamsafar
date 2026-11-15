import { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  appConfig,
  getDemoAuthPassword,
  normalizePkPhone,
} from '@/lib/config';
import { apiError, apiSuccess, checkRateLimit } from '@/lib/rate-limit';
import {
  createAdminSupabaseClient,
  createServerSupabaseClient,
} from '@/lib/supabase/server';

const verifySchema = z.object({
  phone: z.string().min(10),
  code: z.string().min(4).max(8),
  name: z.string().max(80).optional(),
  gender: z
    .enum(['female', 'male', 'other', 'prefer_not_to_say'])
    .optional(),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'local';
  const rl = checkRateLimit(`otp-verify:${ip}`, 15, 60_000);
  if (!rl.allowed) {
    return apiError(
      429,
      'RATE_LIMITED',
      'Too many verification attempts. Please wait a minute.'
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, 'INVALID_JSON', 'Request body must be valid JSON.');
  }

  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      400,
      'VALIDATION_ERROR',
      parsed.error.issues[0]?.message || 'Invalid verification payload.'
    );
  }

  const normalizedPhone = normalizePkPhone(parsed.data.phone);
  if (!normalizedPhone) {
    return apiError(
      400,
      'INVALID_PK_PHONE',
      'Invalid Pakistani mobile number (+923XXXXXXXXX).'
    );
  }

  const supabase = createServerSupabaseClient();
  const admin = createAdminSupabaseClient();

  let authUserId: string | null = null;

  if (appConfig.demoMode) {
    if (parsed.data.code.trim() !== appConfig.demoOtpCode) {
      return apiError(
        401,
        'INVALID_OTP',
        `Invalid OTP code. In demo mode, use ${appConfig.demoOtpCode}.`
      );
    }

    const demoEmail = `${normalizedPhone.replace('+', '')}@demo.hamsafar.pk`;
    const demoPassword = getDemoAuthPassword(normalizedPhone);

    // Try signing in first
    const { data: signInData, error: signInErr } =
      await supabase.auth.signInWithPassword({
        email: demoEmail,
        password: demoPassword,
      });

    if (!signInErr && signInData.user) {
      authUserId = signInData.user.id;
    } else {
      // Create auth user via admin API so no external SMS/SMTP provider is required
      const { data: created, error: createErr } =
        await admin.auth.admin.createUser({
          email: demoEmail,
          password: demoPassword,
          email_confirm: true,
          user_metadata: { phone: normalizedPhone },
        });

      if (createErr && !createErr.message.toLowerCase().includes('already')) {
        return apiError(500, 'AUTH_CREATE_FAILED', createErr.message);
      }

      if (created?.user) {
        authUserId = created.user.id;
      }

      const { data: secondSignIn, error: secondErr } =
        await supabase.auth.signInWithPassword({
          email: demoEmail,
          password: demoPassword,
        });

      if (secondErr || !secondSignIn.user) {
        return apiError(
          500,
          'SESSION_INIT_FAILED',
          secondErr?.message || 'Could not establish user session.'
        );
      }
      authUserId = secondSignIn.user.id;
    }
  } else {
    const { data, error } = await supabase.auth.verifyOtp({
      phone: normalizedPhone,
      token: parsed.data.code.trim(),
      type: 'sms',
    });

    if (error || !data.user) {
      return apiError(
        401,
        'INVALID_OTP',
        error?.message || 'Invalid or expired verification code.'
      );
    }
    authUserId = data.user.id;
  }

  // Upsert user profile in public.users matching authUserId
  const { data: existingProfile } = await admin
    .from('users')
    .select('*')
    .eq('phone', normalizedPhone)
    .maybeSingle();

  let profile;
  if (existingProfile) {
    const { data: updated } = await admin
      .from('users')
      .update({
        ...(parsed.data.name ? { name: parsed.data.name } : {}),
        ...(parsed.data.gender ? { gender: parsed.data.gender } : {}),
      })
      .eq('id', existingProfile.id)
      .select('*')
      .single();
    profile = updated || existingProfile;
  } else {
    const { data: inserted, error: insertErr } = await admin
      .from('users')
      .insert({
        id: authUserId!,
        phone: normalizedPhone,
        name: parsed.data.name || null,
        gender: parsed.data.gender || null,
        verified: false,
        reliability_score: 100,
      })
      .select('*')
      .single();

    if (insertErr) {
      return apiError(500, 'PROFILE_UPSERT_FAILED', insertErr.message);
    }
    profile = inserted;
  }

  return apiSuccess({
    ok: true,
    user: profile,
  });
}
