export const appConfig = {
  demoMode:
    process.env.DEMO_MODE === 'true' ||
    process.env.NEXT_PUBLIC_DEMO_MODE === 'true',
  demoOtpCode: process.env.DEMO_OTP_CODE || '123456',
  flightProvider: (process.env.FLIGHT_PROVIDER || 'seed') as 'seed' | 'live',
  flightApiKey: process.env.FLIGHT_API_KEY || '',
  commissionRate: Number(process.env.COMMISSION_RATE ?? '0.15'),
  // Upper ceiling on seats per ride (largest vehicle type: van).
  vehicleCapacity: Number(process.env.VEHICLE_CAPACITY ?? '8'),
  // Minimum number of PEOPLE who must consent to share before a ride is booked.
  minPoolSize: Number(process.env.MIN_POOL_SIZE ?? '2'),
  // Placeholder (?) seats per vehicle type; actual capacity is stored per vehicle.
  vehicleTypeCapacity: { rickshaw: 3, car: 4, van: 8 } as Record<string, number>,
  // Placeholder (?) ride-price multiplier vs. the car baseline fare in data/fares.karachi.json.
  vehicleFareMultiplier: { rickshaw: 0.6, car: 1, van: 1.6 } as Record<string, number>,
  matchWindowMinutes: Number(process.env.MATCH_WINDOW_MINUTES ?? '45'),
  noShowDepositPkr: Number(process.env.NO_SHOW_DEPOSIT_PKR ?? '0'),
  defaultAirportCode: 'KHI',
  airportCoords: {
    lat: 24.9065,
    lng: 67.1608,
    name: 'Jinnah International Airport (KHI)',
    meetingPoint:
      'Jinnah International Airport - Arrivals Gate B, Pillar 4 (Hamsafar Bay)',
    landmark: 'Opposite International Arrivals Exit Ramp B near Masjid Gate',
  },
};

/**
 * Validates and normalizes a Pakistani mobile number into E.164 format (+923XXXXXXXXX).
 * Accepts +923001234567, 923001234567, 03001234567, or with spaces/dashes.
 */
export function normalizePkPhone(raw: string): string | null {
  const cleaned = raw.replace(/[\s()-]/g, '');
  if (/^\+923\d{9}$/.test(cleaned)) {
    return cleaned;
  }
  if (/^923\d{9}$/.test(cleaned)) {
    return `+${cleaned}`;
  }
  if (/^03\d{9}$/.test(cleaned)) {
    return `+92${cleaned.slice(1)}`;
  }
  return null;
}

/**
 * Deterministic internal password for demo-mode Supabase Auth session creation.
 * Never exposed to clients.
 */
export function getDemoAuthPassword(phone: string): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || 'hamsafar-mvp-secret';
  const digest = Buffer.from(`${phone}:${secret.slice(0, 16)}`).toString('base64url');
  return `Hm#${digest.slice(0, 24)}9!`;
}

export function generateBookingCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `HMS-${suffix}`;
}

export function generateShareToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = '';
  for (let i = 0; i < 24; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

export function formatPkr(amount: number): string {
  return `Rs ${Math.round(amount).toLocaleString('en-PK')}`;
}

export function formatPktDateTime(isoString: string): string {
  try {
    return new Intl.DateTimeFormat('en-PK', {
      timeZone: 'Asia/Karachi',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(isoString));
  } catch {
    return isoString;
  }
}

export function formatPktTimeOnly(isoString: string): string {
  try {
    return new Intl.DateTimeFormat('en-PK', {
      timeZone: 'Asia/Karachi',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(isoString));
  } catch {
    return isoString;
  }
}
