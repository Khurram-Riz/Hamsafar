import { describe, expect, it } from 'vitest';
import { calculateBookingFare, rideFareFor, splitRideFare } from '@/lib/fares/calculator';

describe('Fare splitting (shared ride)', () => {
  it('splits a whole-ride fare so the shares add up exactly', () => {
    const shares = splitRideFare(1000, [
      { id: 'a', seats: 1 },
      { id: 'b', seats: 1 },
      { id: 'c', seats: 1 },
    ]);
    const total = Object.values(shares).reduce((s, x) => s + x.totalFarePkr, 0);
    expect(total).toBe(1000);
    // leftover rupee goes to the earliest rider
    expect(shares.a.totalFarePkr).toBe(334);
    expect(shares.b.totalFarePkr).toBe(333);
  });

  it('weights the split by seats (a couple pays for two seats)', () => {
    const shares = splitRideFare(1200, [
      { id: 'couple', seats: 2 },
      { id: 'solo', seats: 1 },
    ]);
    expect(shares.couple.totalFarePkr).toBe(800);
    expect(shares.solo.totalFarePkr).toBe(400);
  });

  it('redistributes: everyone pays less when another rider joins', () => {
    const two = splitRideFare(1560, [{ id: 'a', seats: 1 }, { id: 'b', seats: 1 }]);
    const three = splitRideFare(1560, [{ id: 'a', seats: 1 }, { id: 'b', seats: 1 }, { id: 'c', seats: 1 }]);
    expect(three.a.totalFarePkr).toBeLessThan(two.a.totalFarePkr);
    expect(Object.values(three).reduce((s, x) => s + x.totalFarePkr, 0)).toBe(1560);
  });
});

describe('Booking fare estimate', () => {
  it('prices a ride by vehicle type', () => {
    expect(rideFareFor(2600, 'car')).toBe(2600);
    expect(rideFareFor(2600, 'rickshaw')).toBe(1560);
    expect(rideFareFor(2600, 'van')).toBe(4160);
  });

  it('assumes at least 2 people share, and is always cheaper than riding alone', () => {
    const f = calculateBookingFare({ seatFarePkr: 750, soloFarePkr: 2600, seats: 1, commissionRate: 0.15 });
    expect(f.ridersSeats).toBe(2);
    expect(f.totalFarePkr).toBe(1300);
    expect(f.savingPkr).toBe(1300);
    expect(f.isSharedCheaperThanSolo).toBe(true);
    expect(f.platformFeePkr + f.operatorFeePkr).toBe(f.totalFarePkr);
  });

  it('shows a lower fare when more riders are expected', () => {
    const two = calculateBookingFare({ seatFarePkr: 750, soloFarePkr: 2600, seats: 1, ridersSeats: 2, commissionRate: 0.15 });
    const four = calculateBookingFare({ seatFarePkr: 750, soloFarePkr: 2600, seats: 1, ridersSeats: 4, commissionRate: 0.15 });
    expect(four.totalFarePkr).toBeLessThan(two.totalFarePkr);
  });

  it('charges the full ride fare in solo mode', () => {
    const f = calculateBookingFare({ seatFarePkr: 750, soloFarePkr: 2600, seats: 1, rideMode: 'solo', commissionRate: 0.15 });
    expect(f.totalFarePkr).toBe(2600);
    expect(f.savingPkr).toBe(0);
  });
});
