import { NextRequest } from 'next/server';
import { z } from 'zod';
import { appConfig, normalizePkPhone } from '@/lib/config';
import { apiError, apiSuccess, checkRateLimit } from '@/lib/rate-limit';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const requestSchema = z.object({
  phone: z.string().min(10, 'Enter a valid Pakistani mobile number'),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'local';
  const rl = checkRateLimit(`otp-req:${ip}`, 10, 60_000);
  if (!rl.allowed) {
    return apiError(
      429,
      'RATE_LIMITED',
      'Too many OTP requests. Please wait a minute before trying again.'
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, 'INVALID_JSON', 'Request body must be valid JSON.');
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      400,
      'VALIDATION_ERROR',
      parsed.error.issues[0]?.message || 'Invalid phone number.'
    );
  }

  const normalizedPhone = normalizePkPhone(parsed.data.phone);
  if (!normalizedPhone) {
    return apiError(
      400,
      'INVALID_PK_PHONE',
      'Enter a valid Pakistani mobile number in +92 3XX XXXXXXX or 03XX XXXXXXX format.'
    );
  }

  if (appConfig.demoMode) {
    return apiSuccess({
      ok: true,
      phone: normalizedPhone,
      demoMode: true,
      message: `Demo mode active: no SMS sent. Enter code ${appConfig.demoOtpCode} to continue.`,
    });
  }

  const supabase = createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithOtp({
    phone: normalizedPhone,
  });

  if (error) {
    return apiError(400, 'OTP_SEND_FAILED', error.message);
  }

  return apiSuccess({
    ok: true,
    phone: normalizedPhone,
    demoMode: false,
    message: 'Verification code sent via SMS.',
  });
}
