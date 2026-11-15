import faresData from '@data/fares.karachi.json';
import { appConfig } from '@/lib/config';
import { RideMode, VehicleType } from '@/types/database';

export interface FareInput {
  /** Indicative lowest per-seat share (full vehicle). Kept for display only. */
  seatFarePkr: number;
  /** Price of the WHOLE ride for one rider in a car (baseline). */
  soloFarePkr: number;
  /** Seats this booking occupies. */
  seats: number;
  /** Total seats sharing the ride, INCLUDING this booking. Defaults to the minimum (2). */
  ridersSeats?: number;
  vehicleType?: VehicleType;
  commissionRate: number;
  depositPkr?: number;
  rideMode?: RideMode;
  asOfDate?: string;
  isPlaceholder?: boolean;
}

export interface FareBreakdown {
  rideMode: RideMode;
  seats: number;
  ridersSeats: number;
  vehicleType: VehicleType;
  /** Whole-ride price for the chosen vehicle. */
  rideFarePkr: number;
  perSeatFarePkr: number;
  soloUnitFarePkr: number;
  unitChargedPkr: number;
  totalFarePkr: number;
  soloComparisonTotalPkr: number;
  savingPkr: number;
  savingPercent: number;
  platformFeePkr: number;
  operatorFeePkr: number;
  depositPkr: number;
  isSharedCheaperThanSolo: boolean;
  asOfDate: string;
  isPlaceholder: boolean;
  basisDescription: string;
}

/** Whole-ride price for a vehicle type (car baseline x multiplier). */
export function rideFareFor(soloCarFarePkr: number, vehicleType: VehicleType = 'car'): number {
  const m = appConfig.vehicleFareMultiplier[vehicleType] ?? 1;
  return Math.round(soloCarFarePkr * m);
}

/**
 * Splits one ride fare equally per SEAT among riders. The shares always add up to
 * exactly the ride fare: leftover rupees go one at a time to the earliest riders.
 * Used again whenever a rider joins or leaves ("fare is redistributed").
 */
export function splitRideFare(
  rideFarePkr: number,
  riders: { id: string; seats: number }[]
): Record<string, { seatFarePkr: number; totalFarePkr: number }> {
  const out: Record<string, { seatFarePkr: number; totalFarePkr: number }> = {};
  const totalSeats = riders.reduce((s, r) => s + Math.max(1, r.seats), 0);
  if (totalSeats === 0) return out;
  const base = Math.floor(rideFarePkr / totalSeats);
  let extra = rideFarePkr - base * totalSeats;
  for (const r of riders) {
    const seats = Math.max(1, r.seats);
    const bonus = Math.min(extra, seats);
    extra -= bonus;
    const total = base * seats + bonus;
    out[r.id] = { seatFarePkr: Math.ceil(total / seats), totalFarePkr: total };
  }
  return out;
}

/**
 * Fare for one booking: the whole-ride price divided across everyone sharing.
 * A shared ride only exists with 2+ people, so ridersSeats is clamped to >= 2
 * (solo mode pays the full ride fare).
 */
export function calculateBookingFare(input: FareInput): FareBreakdown {
  const seats = Math.max(1, Math.min(4, Math.round(input.seats)));
  const rideMode: RideMode = input.rideMode ?? 'pool';
  const vehicleType: VehicleType = input.vehicleType ?? 'car';
  const soloFarePkr = Math.round(input.soloFarePkr);
  const rideFarePkr = rideFareFor(soloFarePkr, vehicleType);
  const ridersSeats =
    rideMode === 'solo'
      ? seats
      : Math.max(appConfig.minPoolSize, seats, Math.round(input.ridersSeats ?? 0));

  const shared = rideMode !== 'solo';
  const perSeatFarePkr = shared
    ? Math.ceil(rideFarePkr / ridersSeats)
    : rideFarePkr;
  const totalFarePkr = shared ? perSeatFarePkr * seats : rideFarePkr;
  const soloComparisonTotalPkr = soloFarePkr;
  const savingPkr = Math.max(0, soloComparisonTotalPkr - totalFarePkr);
  const savingPercent =
    soloComparisonTotalPkr > 0
      ? Math.round((savingPkr / soloComparisonTotalPkr) * 100)
      : 0;

  const clampedRate = Math.max(0, Math.min(1, input.commissionRate));
  const platformFeePkr = Math.round(totalFarePkr * clampedRate);
  const operatorFeePkr = totalFarePkr - platformFeePkr;
  const depositPkr = Math.max(0, Math.round(input.depositPkr ?? 0));

  const asOfDate = input.asOfDate || faresData.as_of_date;
  const isPlaceholder = input.isPlaceholder ?? faresData.is_placeholder;

  return {
    rideMode,
    seats,
    ridersSeats,
    vehicleType,
    rideFarePkr,
    perSeatFarePkr,
    soloUnitFarePkr: soloFarePkr,
    unitChargedPkr: perSeatFarePkr,
    totalFarePkr,
    soloComparisonTotalPkr,
    savingPkr,
    savingPercent,
    platformFeePkr,
    operatorFeePkr,
    depositPkr,
    isSharedCheaperThanSolo: totalFarePkr < soloComparisonTotalPkr,
    asOfDate,
    isPlaceholder,
    basisDescription: shared
      ? `Ride fare Rs ${rideFarePkr} split equally among ${ridersSeats} riders (as of ${asOfDate})${
          isPlaceholder ? ' — unconfirmed MVP placeholder' : ''
        }`
      : `Full ride fare, no sharing (as of ${asOfDate})`,
  };
}

export function getFallbackStaticFare(zoneSlug: string) {
  const found = faresData.fares.find((f) => f.zone_slug === zoneSlug);
  if (found) {
    return {
      seat_fare_pkr: found.seat_fare_pkr,
      solo_fare_pkr: found.solo_fare_pkr,
      as_of_date: found.as_of_date,
      is_placeholder: found.is_placeholder,
    };
  }
  return {
    seat_fare_pkr: 700,
    solo_fare_pkr: 2500,
    as_of_date: faresData.as_of_date,
    is_placeholder: true,
  };
}
