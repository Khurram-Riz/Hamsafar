import { NextRequest } from 'next/server';
import { getFlightProvider, normalizeFlightNo } from '@/lib/flights/provider';
import { apiError, apiSuccess } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawFlightNo = searchParams.get('flightNo') || '';
  const dateStr = searchParams.get('date') || '';

  if (!rawFlightNo.trim()) {
    return apiError(400, 'MISSING_FLIGHT_NO', 'Please enter a flight number (e.g. PK-309).');
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return apiError(400, 'INVALID_DATE', 'Please provide a valid arrival date (YYYY-MM-DD).');
  }

  const normalizedNo = normalizeFlightNo(rawFlightNo);
  const provider = getFlightProvider();
  const flight = await provider.lookupFlight(normalizedNo, dateStr);

  if (!flight) {
    return apiError(
      404,
      'FLIGHT_NOT_FOUND',
      `Flight ${normalizedNo} on ${dateStr} was not found in our schedule feed. You can enter your arrival time manually below.`
    );
  }

  return apiSuccess({ flight });
}
