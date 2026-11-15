import { NextRequest } from 'next/server';
import { z } from 'zod';
import { appConfig, generateBookingCode } from '@/lib/config';
import {
  calculateBookingFare,
  getFallbackStaticFare,
} from '@/lib/fares/calculator';
import { reconcileFlightPools } from '@/lib/matching/service';
import { getPaymentProvider } from '@/lib/payments/provider';
import { apiError, apiSuccess, checkRateLimit } from '@/lib/rate-limit';
import {
  createAdminSupabaseClient,
  createServerSupabaseClient,
} from '@/lib/supabase/server';

const createBookingSchema = z.object({
  flightId: z.string().uuid(),
  zoneId: z.string().uuid(),
  destLat: z.number().optional().nullable(),
  destLng: z.number().optional().nullable(),
  addressNote: z.string().max(240).optional().nullable(),
  seats: z.number().int().min(1).max(4),
  luggage: z.enum(['light', 'medium', 'heavy']).default('medium'),
  poolType: z.enum(['open', 'women_only', 'family_only']).default('open'),
  rideMode: z.enum(['pool', 'solo']).default('pool'),
  paymentMethod: z.enum(['cash', 'easypaisa', 'jazzcash']).default('cash'),
  womenSelfDeclared: z.boolean().optional(),
});

export async function GET() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return apiError(401, 'UNAUTHORIZED', 'Please sign in to view your bookings.');
  }

  const admin = createAdminSupabaseClient();
  const { data: bookings, error } = await admin
    .from('bookings')
    .select(
      `
      *,
      flight:flights(*),
      zone:zones(*, corridor:corridors(*)),
      pool:pools(*, vehicle:vehicles(*), driver:drivers(id, name, photo_url, verified))
    `
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return apiError(500, 'BOOKINGS_FETCH_FAILED', error.message);
  }

  return apiSuccess({ bookings: bookings ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return apiError(401, 'UNAUTHORIZED', 'Please sign in before booking a ride.');
  }

  const rl = checkRateLimit(`book:${user.id}`, 20, 60_000);
  if (!rl.allowed) {
    return apiError(
      429,
      'RATE_LIMITED',
      'Too many booking requests. Please wait a moment.'
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, 'INVALID_JSON', 'Request body must be valid JSON.');
  }

  const parsed = createBookingSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      400,
      'VALIDATION_ERROR',
      parsed.error.issues[0]?.message || 'Invalid booking details.'
    );
  }

  const data = parsed.data;

  if (data.poolType === 'family_only' && data.seats < 2) {
    return apiError(
      400,
      'FAMILY_MIN_SEATS',
      'Family-only pools require 2 or more seats.'
    );
  }

  const admin = createAdminSupabaseClient();

  // Check user profile for women-only eligibility (FR-4.3)
  const { data: profile } = await admin
    .from('users')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (data.poolType === 'women_only') {
    const isFemaleProfile = profile?.gender === 'female';
    if (!isFemaleProfile && !data.womenSelfDeclared) {
      return apiError(
        403,
        'WOMEN_ONLY_RESTRICTED',
        'Women-only pools are reserved for female travelers. Please confirm eligibility or select Open / Family-Only.'
      );
    }
    if (!isFemaleProfile && data.womenSelfDeclared && profile) {
      await admin
        .from('users')
        .update({ gender: 'female' })
        .eq('id', user.id);
    }
  }

  const [{ data: flight }, { data: zone }] = await Promise.all([
    admin.from('flights').select('*').eq('id', data.flightId).single(),
    admin
      .from('zones')
      .select('*, corridor:corridors(*), fare:zone_fares(*)')
      .eq('id', data.zoneId)
      .single(),
  ]);

  if (!flight) {
    return apiError(404, 'FLIGHT_NOT_FOUND', 'Selected flight not found.');
  }
  if (flight.status === 'cancelled') {
    return apiError(
      400,
      'FLIGHT_CANCELLED',
      'Cannot book a ride on a cancelled flight.'
    );
  }
  if (!zone) {
    return apiError(404, 'ZONE_NOT_FOUND', 'Selected zone not found.');
  }

  const fareRow = Array.isArray(zone.fare) ? zone.fare[0] : zone.fare;
  const effectiveFare = fareRow || getFallbackStaticFare(zone.slug);

  const fare = calculateBookingFare({
    seatFarePkr: effectiveFare.seat_fare_pkr,
    soloFarePkr: effectiveFare.solo_fare_pkr,
    seats: data.seats,
    commissionRate: appConfig.commissionRate,
    depositPkr: appConfig.noShowDepositPkr,
    rideMode: data.rideMode,
    asOfDate: effectiveFare.as_of_date,
    isPlaceholder: effectiveFare.is_placeholder,
  });

  const bookingCode = generateBookingCode();
  const paymentProvider = getPaymentProvider();
  const paymentResult = await paymentProvider.authorizeBooking({
    bookingCode,
    amountPkr: fare.totalFarePkr,
    depositPkr: fare.depositPkr,
    method: data.paymentMethod,
  });

  const { data: createdBooking, error: insertErr } = await admin
    .from('bookings')
    .insert({
      user_id: user.id,
      flight_id: data.flightId,
      zone_id: data.zoneId,
      dest_lat: data.destLat ?? zone.lat,
      dest_lng: data.destLng ?? zone.lng,
      address_note: data.addressNote?.trim() || null,
      seats: data.seats,
      luggage: data.luggage,
      pool_type: data.poolType,
      ride_mode: fare.rideMode,
      // Shared rides start as proposals: nothing is booked until 2+ people agree.
      share_consent: fare.rideMode === 'solo' ? 'accepted' : 'pending',
      status: fare.rideMode === 'solo' ? 'confirmed' : 'pending',
      seat_fare_pkr: fare.perSeatFarePkr,
      solo_fare_pkr: fare.soloUnitFarePkr,
      total_fare_pkr: fare.totalFarePkr,
      platform_fee_pkr: fare.platformFeePkr,
      operator_fee_pkr: fare.operatorFeePkr,
      deposit_pkr: fare.depositPkr,
      deposit_status: paymentResult.depositStatus,
      payment_method: data.paymentMethod,
      payment_status: paymentResult.paymentStatus,
      booking_code: bookingCode,
    })
    .select('*')
    .single();

  if (insertErr || !createdBooking) {
    return apiError(
      500,
      'BOOKING_CREATE_FAILED',
      insertErr?.message || 'Unable to create booking.'
    );
  }

  // Run matching engine to assign pool & notify passengers
  await reconcileFlightPools(data.flightId, {
    reason: 'booking_created',
    triggerBookingId: createdBooking.id,
  });

  const { data: hydrated } = await admin
    .from('bookings')
    .select(
      `
      *,
      flight:flights(*),
      zone:zones(*, corridor:corridors(*)),
      pool:pools(*, vehicle:vehicles(*), driver:drivers(*))
    `
    )
    .eq('id', createdBooking.id)
    .single();

  return apiSuccess(
    {
      booking: hydrated || createdBooking,
      paymentReference: paymentResult.referenceId,
    },
    201
  );
}
