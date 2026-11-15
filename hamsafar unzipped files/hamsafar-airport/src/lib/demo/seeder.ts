import { appConfig, generateBookingCode } from '@/lib/config';
import {
  calculateBookingFare,
  getFallbackStaticFare,
} from '@/lib/fares/calculator';
import { reconcileFlightPools } from '@/lib/matching/service';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { GenderOption, LuggageLevel, PoolType } from '@/types/database';

const DEMO_PASSENGER_TEMPLATES: Array<{
  name: string;
  gender: GenderOption;
  zoneSlug: string;
  seats: number;
  poolType: PoolType;
  luggage: LuggageLevel;
}> = [
  { name: 'Ayesha Siddiqui', gender: 'female', zoneSlug: 'dha-phase-1-8', seats: 1, poolType: 'women_only', luggage: 'medium' },
  { name: 'Zainab Raza', gender: 'female', zoneSlug: 'dha-phase-1-8', seats: 1, poolType: 'women_only', luggage: 'light' },
  { name: 'Hira Tariq', gender: 'female', zoneSlug: 'clifton', seats: 2, poolType: 'women_only', luggage: 'heavy' },
  { name: 'Fatima Noor', gender: 'female', zoneSlug: 'clifton', seats: 1, poolType: 'women_only', luggage: 'medium' },
  { name: 'Usman Farooq & Family', gender: 'male', zoneSlug: 'dha-phase-1-8', seats: 3, poolType: 'family_only', luggage: 'heavy' },
  { name: 'Sana Kamran & Kids', gender: 'female', zoneSlug: 'clifton', seats: 3, poolType: 'family_only', luggage: 'heavy' },
  { name: 'Hamza Sheikh', gender: 'male', zoneSlug: 'dha-phase-1-8', seats: 1, poolType: 'open', luggage: 'medium' },
  { name: 'Bilal Memon', gender: 'male', zoneSlug: 'dha-phase-1-8', seats: 2, poolType: 'open', luggage: 'medium' },
  { name: 'Daniyal Ahmed', gender: 'male', zoneSlug: 'clifton', seats: 1, poolType: 'open', luggage: 'light' },
  { name: 'Omer Javed', gender: 'male', zoneSlug: 'dha-phase-1-8', seats: 1, poolType: 'open', luggage: 'medium' },
  { name: 'Taha Qureshi', gender: 'male', zoneSlug: 'clifton', seats: 2, poolType: 'open', luggage: 'heavy' },
  { name: 'Saad Mahmood', gender: 'male', zoneSlug: 'dha-phase-1-8', seats: 1, poolType: 'open', luggage: 'light' },
  { name: 'Raza Kazmi', gender: 'male', zoneSlug: 'gulshan-e-iqbal', seats: 2, poolType: 'open', luggage: 'medium' },
  { name: 'Noman Baig', gender: 'male', zoneSlug: 'gulistan-e-johar', seats: 1, poolType: 'open', luggage: 'light' },
  { name: 'Haris Ansari', gender: 'male', zoneSlug: 'gulshan-e-iqbal', seats: 1, poolType: 'open', luggage: 'medium' },
  { name: 'Waqas Hashmi', gender: 'male', zoneSlug: 'gulistan-e-johar', seats: 2, poolType: 'open', luggage: 'heavy' },
  { name: 'Salman Zubairi', gender: 'male', zoneSlug: 'gulshan-e-iqbal', seats: 1, poolType: 'open', luggage: 'light' },
  { name: 'Maryam Yousuf', gender: 'female', zoneSlug: 'gulshan-e-iqbal', seats: 1, poolType: 'women_only', luggage: 'medium' },
  { name: 'Khadija Imran', gender: 'female', zoneSlug: 'gulistan-e-johar', seats: 2, poolType: 'women_only', luggage: 'medium' },
  { name: 'Adnan Gilani', gender: 'male', zoneSlug: 'pechs', seats: 1, poolType: 'open', luggage: 'medium' },
  { name: 'Faisal Lodhi', gender: 'male', zoneSlug: 'tariq-road', seats: 2, poolType: 'open', luggage: 'medium' },
  { name: 'Kashif Niazi', gender: 'male', zoneSlug: 'saddar', seats: 1, poolType: 'open', luggage: 'light' },
  { name: 'Junaid Akhtar', gender: 'male', zoneSlug: 'pechs', seats: 1, poolType: 'open', luggage: 'medium' },
  { name: 'Zohaib Mirza', gender: 'male', zoneSlug: 'tariq-road', seats: 1, poolType: 'open', luggage: 'light' },
  { name: 'Hassan Durrani', gender: 'male', zoneSlug: 'saddar', seats: 2, poolType: 'open', luggage: 'heavy' },
  { name: 'Mahnoor Aslam', gender: 'female', zoneSlug: 'pechs', seats: 1, poolType: 'open', luggage: 'light' },
  { name: 'Arsalan Bukhari & Family', gender: 'male', zoneSlug: 'gulshan-e-iqbal', seats: 3, poolType: 'family_only', luggage: 'heavy' },
  { name: 'Nadia Sohail & Family', gender: 'female', zoneSlug: 'pechs', seats: 2, poolType: 'family_only', luggage: 'medium' },
  { name: 'Shahzad Iqbal', gender: 'male', zoneSlug: 'dha-phase-1-8', seats: 1, poolType: 'open', luggage: 'light' },
  { name: 'Rizwan Haq', gender: 'male', zoneSlug: 'gulistan-e-johar', seats: 1, poolType: 'open', luggage: 'medium' },
];

export async function ensureDemoFlightAndSeedPassengers(
  targetFlightId?: string,
  count = 30
) {
  const admin = createAdminSupabaseClient();

  // Resolve or create featured demo flight PK-309
  let flightId = targetFlightId;
  if (!flightId) {
    const { data: existingFlight } = await admin
      .from('flights')
      .select('id')
      .eq('flight_no', 'PK-309')
      .order('scheduled_arrival', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingFlight) {
      flightId = existingFlight.id;
    } else {
      const tonight = new Date();
      tonight.setUTCHours(18, 15, 0, 0); // 23:15 PKT
      const { data: insertedFlight, error } = await admin
        .from('flights')
        .insert({
          flight_no: 'PK-309',
          airline: 'Pakistan International Airlines',
          origin: 'Islamabad (ISB)',
          airport_code: 'KHI',
          scheduled_arrival: tonight.toISOString(),
          estimated_arrival: tonight.toISOString(),
          terminal: 'Jinnah Terminal - Domestic',
          status: 'scheduled',
          verified: true,
        })
        .select('id')
        .single();

      if (error || !insertedFlight) {
        throw new Error('Failed to create default demo flight PK-309.');
      }
      flightId = insertedFlight.id;
    }
  }

  const { data: zones } = await admin
    .from('zones')
    .select('*, fare:zone_fares(*)')
    .eq('airport_code', 'KHI')
    .eq('active', true);

  if (!zones || zones.length === 0) {
    throw new Error('No zones found in database. Please run supabase/seed.sql first.');
  }

  const zoneBySlug = new Map(zones.map((z) => [z.slug, z]));
  const totalToCreate = Math.max(1, Math.min(100, count));

  for (let i = 0; i < totalToCreate; i++) {
    const tpl = DEMO_PASSENGER_TEMPLATES[i % DEMO_PASSENGER_TEMPLATES.length];
    const zone = zoneBySlug.get(tpl.zoneSlug) || zones[0];
    const fareRow = Array.isArray(zone.fare) ? zone.fare[0] : zone.fare;
    const effectiveFare = fareRow || getFallbackStaticFare(zone.slug);

    const demoPhone = `+92399${String(1000000 + i * 137 + Math.floor(Math.random() * 90)).slice(
      0,
      7
    )}`;

    const { data: demoUser, error: userErr } = await admin
      .from('users')
      .insert({
        phone: demoPhone,
        name: i < DEMO_PASSENGER_TEMPLATES.length ? tpl.name : `${tpl.name} #${i + 1}`,
        gender: tpl.gender,
        verified: true,
        reliability_score: 96 + (i % 5),
        is_demo: true,
      })
      .select('id')
      .single();

    if (userErr || !demoUser) continue;

    const fare = calculateBookingFare({
      seatFarePkr: effectiveFare.seat_fare_pkr,
      soloFarePkr: effectiveFare.solo_fare_pkr,
      seats: tpl.seats,
      commissionRate: appConfig.commissionRate,
      depositPkr: appConfig.noShowDepositPkr,
      rideMode: 'pool',
      asOfDate: effectiveFare.as_of_date,
      isPlaceholder: effectiveFare.is_placeholder,
    });

    // Jitter coordinates slightly around zone centroid so map clusters look natural
    const jitterLat = zone.lat + (Math.random() - 0.5) * 0.016;
    const jitterLng = zone.lng + (Math.random() - 0.5) * 0.016;

    await admin.from('bookings').insert({
      user_id: demoUser.id,
      flight_id: flightId,
      zone_id: zone.id,
      dest_lat: jitterLat,
      dest_lng: jitterLng,
      seats: tpl.seats,
      luggage: tpl.luggage,
      pool_type: tpl.poolType,
      ride_mode: 'pool',
      // Most demo riders have agreed to share; every 5th is still deciding (shows join approvals).
      share_consent: i % 5 === 4 ? 'pending' : 'accepted',
      status: 'pending',
      seat_fare_pkr: fare.perSeatFarePkr,
      solo_fare_pkr: fare.soloUnitFarePkr,
      total_fare_pkr: fare.totalFarePkr,
      platform_fee_pkr: fare.platformFeePkr,
      operator_fee_pkr: fare.operatorFeePkr,
      deposit_pkr: 0,
      deposit_status: 'none',
      payment_method: i % 3 === 0 ? 'easypaisa' : 'cash',
      payment_status: i % 3 === 0 ? 'paid' : 'pending',
      booking_code: generateBookingCode(),
    });
  }

  await reconcileFlightPools(flightId!, {
    reason: 'demo_seeded',
  });

  return { flightId: flightId!, seededCount: totalToCreate };
}

export async function resetDemoFlightData(flightId?: string) {
  const admin = createAdminSupabaseClient();

  if (flightId) {
    await admin.from('pools').delete().eq('flight_id', flightId);
    await admin.from('bookings').delete().eq('flight_id', flightId);
    const { data: flight } = await admin
      .from('flights')
      .select('scheduled_arrival')
      .eq('id', flightId)
      .single();

    if (flight) {
      await admin
        .from('flights')
        .update({
          estimated_arrival: flight.scheduled_arrival,
          status: 'scheduled',
        })
        .eq('id', flightId);
    }
  }

  await admin.from('users').delete().eq('is_demo', true);
}
