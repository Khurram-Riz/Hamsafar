import demoFlightsJson from '@data/flights.demo.json';
import { appConfig } from '@/lib/config';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { FlightRecord, FlightStatus } from '@/types/database';

export interface FlightProvider {
  lookupFlight(flightNo: string, dateStr: string): Promise<FlightRecord | null>;
}

export function normalizeFlightNo(raw: string): string {
  const cleaned = raw.trim().toUpperCase().replace(/\s+/g, '');
  const match = cleaned.match(/^([A-Z]{2,3})-?(\d{1,4})$/);
  if (match) {
    return `${match[1]}-${match[2]}`;
  }
  return cleaned;
}

function buildPktTimestamp(dateStr: string, hour: number, minute: number): string {
  // Construct YYYY-MM-DDTHH:MM:00+05:00 (Asia/Karachi UTC+5)
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return new Date(`${dateStr}T${hh}:${mm}:00+05:00`).toISOString();
}

export class SeededFlightProvider implements FlightProvider {
  async lookupFlight(flightNo: string, dateStr: string): Promise<FlightRecord | null> {
    const normalized = normalizeFlightNo(flightNo);
    const admin = createAdminSupabaseClient();

    const dayStart = new Date(`${dateStr}T00:00:00+05:00`).toISOString();
    const dayEnd = new Date(`${dateStr}T23:59:59+05:00`).toISOString();

    const { data: existing } = await admin
      .from('flights')
      .select('*')
      .eq('flight_no', normalized)
      .gte('scheduled_arrival', dayStart)
      .lte('scheduled_arrival', dayEnd)
      .limit(1)
      .maybeSingle();

    if (existing) {
      return existing as FlightRecord;
    }

    const template = demoFlightsJson.flights.find(
      (f) => normalizeFlightNo(f.flight_no) === normalized
    );

    if (!template) {
      return null;
    }

    const arrivalIso = buildPktTimestamp(
      dateStr,
      template.arrival_hour_pkt,
      template.arrival_minute_pkt
    );

    const { data: inserted, error } = await admin
      .from('flights')
      .insert({
        flight_no: normalized,
        airline: template.airline,
        origin: template.origin,
        airport_code: template.airport_code,
        scheduled_arrival: arrivalIso,
        estimated_arrival: arrivalIso,
        terminal: template.terminal,
        status: template.status as FlightStatus,
        verified: true,
      })
      .select('*')
      .single();

    if (error || !inserted) {
      return null;
    }

    return inserted as FlightRecord;
  }
}

export class LiveFlightProvider implements FlightProvider {
  private fallback = new SeededFlightProvider();

  async lookupFlight(flightNo: string, dateStr: string): Promise<FlightRecord | null> {
    const normalized = normalizeFlightNo(flightNo);
    const apiKey = appConfig.flightApiKey;

    if (!apiKey) {
      return this.fallback.lookupFlight(normalized, dateStr);
    }

    try {
      const compactNo = normalized.replace('-', '');
      const res = await fetch(
        `https://api.aviationstack.com/v1/flights?access_key=${encodeURIComponent(
          apiKey
        )}&flight_iata=${encodeURIComponent(compactNo)}&arr_iata=KHI`,
        { cache: 'no-store' }
      );

      if (!res.ok) {
        return this.fallback.lookupFlight(normalized, dateStr);
      }

      const payload = await res.json();
      const first = payload?.data?.[0];
      if (!first || !first.arrival?.scheduled) {
        return this.fallback.lookupFlight(normalized, dateStr);
      }

      const admin = createAdminSupabaseClient();
      const statusMap: Record<string, FlightStatus> = {
        scheduled: 'scheduled',
        active: 'scheduled',
        landed: 'landed',
        cancelled: 'cancelled',
        delayed: 'delayed',
      };

      const { data: upserted } = await admin
        .from('flights')
        .insert({
          flight_no: normalized,
          airline: first.airline?.name || 'Airline',
          origin: `${first.departure?.airport || 'Origin'} (${
            first.departure?.iata || 'INT'
          })`,
          airport_code: 'KHI',
          scheduled_arrival: first.arrival.scheduled,
          estimated_arrival:
            first.arrival.estimated || first.arrival.scheduled,
          terminal: first.arrival.terminal
            ? `Terminal ${first.arrival.terminal}`
            : 'Jinnah Terminal',
          status: statusMap[first.flight_status] || 'scheduled',
          verified: true,
        })
        .select('*')
        .single();

      return (upserted as FlightRecord) || null;
    } catch {
      return this.fallback.lookupFlight(normalized, dateStr);
    }
  }
}

export function getFlightProvider(): FlightProvider {
  if (appConfig.flightProvider === 'live') {
    return new LiveFlightProvider();
  }
  return new SeededFlightProvider();
}
