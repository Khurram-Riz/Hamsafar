import { NextRequest } from 'next/server';
import { z } from 'zod';
import { normalizePkPhone } from '@/lib/config';
import { apiError, apiSuccess } from '@/lib/rate-limit';
import {
  createAdminSupabaseClient,
  createServerSupabaseClient,
} from '@/lib/supabase/server';

const profileUpdateSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(80),
  gender: z.enum(['female', 'male', 'other', 'prefer_not_to_say']).optional(),
  emergency_contact: z.string().max(30).optional().nullable(),
  id_doc_type: z.enum(['cnic', 'passport']).optional().nullable(),
  id_doc_number: z.string().max(25).optional().nullable(),
});

function validateAndMaskId(
  type: 'cnic' | 'passport',
  raw: string
): { valid: boolean; masked?: string; message?: string } {
  const cleaned = raw.trim().toUpperCase();
  if (type === 'cnic') {
    const digits = cleaned.replace(/-/g, '');
    if (!/^\d{13}$/.test(digits)) {
      return {
        valid: false,
        message: 'CNIC must be 13 digits (e.g. 42101-1234567-1).',
      };
    }
    return {
      valid: true,
      masked: `${digits.slice(0, 5)}-*******-${digits.slice(12)}`,
    };
  }

  if (!/^[A-Z0-9]{7,10}$/.test(cleaned)) {
    return {
      valid: false,
      message: 'Passport number must be 7 to 10 alphanumeric characters.',
    };
  }
  return {
    valid: true,
    masked: `${cleaned.slice(0, 2)}*****${cleaned.slice(-2)}`,
  };
}

export async function GET() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return apiError(401, 'UNAUTHORIZED', 'Please sign in to view your profile.');
  }

  const admin = createAdminSupabaseClient();
  const { data: profile } = await admin
    .from('users')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  return apiSuccess({ user: profile });
}

export async function PATCH(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return apiError(401, 'UNAUTHORIZED', 'Please sign in first.');
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, 'INVALID_JSON', 'Request body must be valid JSON.');
  }

  const parsed = profileUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      400,
      'VALIDATION_ERROR',
      parsed.error.issues[0]?.message || 'Invalid profile data.'
    );
  }

  let emergencyFormatted: string | null = null;
  if (parsed.data.emergency_contact && parsed.data.emergency_contact.trim()) {
    const norm = normalizePkPhone(parsed.data.emergency_contact.trim());
    if (!norm) {
      return apiError(
        400,
        'INVALID_EMERGENCY_PHONE',
        'Emergency contact must be a valid Pakistani mobile number (+923XXXXXXXXX).'
      );
    }
    emergencyFormatted = norm;
  }

  const updates: Record<string, unknown> = {
    name: parsed.data.name.trim(),
    ...(parsed.data.gender ? { gender: parsed.data.gender } : {}),
    emergency_contact: emergencyFormatted,
  };

  if (parsed.data.id_doc_type && parsed.data.id_doc_number) {
    const check = validateAndMaskId(
      parsed.data.id_doc_type,
      parsed.data.id_doc_number
    );
    if (!check.valid) {
      return apiError(400, 'INVALID_ID_FORMAT', check.message || 'Invalid ID.');
    }
    updates.id_doc_type = parsed.data.id_doc_type;
    updates.id_doc_masked = check.masked;
    updates.verified = true;
  }

  const admin = createAdminSupabaseClient();
  const { data: updated, error } = await admin
    .from('users')
    .update(updates)
    .eq('id', user.id)
    .select('*')
    .single();

  if (error) {
    return apiError(500, 'PROFILE_UPDATE_FAILED', error.message);
  }

  return apiSuccess({ ok: true, user: updated });
}
