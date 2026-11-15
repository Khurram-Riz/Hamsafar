import { describe, expect, it } from 'vitest';
import { resolvePinToZone } from '@/lib/zones/resolver';
import { ZoneRecord } from '@/types/database';

const zones: ZoneRecord[] = [
  {
    id: 'z-dha',
    airport_code: 'KHI',
    name: 'DHA Phase 1-8',
    slug: 'dha-phase-1-8',
    corridor_id: 'corr-1',
    lat: 24.8138,
    lng: 67.0601,
    radius_km: 4.8,
    order_in_corridor: 1,
    active: true,
  },
  {
    id: 'z-gulshan',
    airport_code: 'KHI',
    name: 'Gulshan-e-Iqbal',
    slug: 'gulshan-e-iqbal',
    corridor_id: 'corr-2',
    lat: 24.92,
    lng: 67.0912,
    radius_km: 3.8,
    order_in_corridor: 2,
    active: true,
  },
];

describe('Zone Pin Resolver (FR-3.2 & FR-3.3)', () => {
  it('snaps a pin inside DHA radius to DHA Phase 1-8', () => {
    const res = resolvePinToZone(24.815, 67.062, zones);
    expect(res.matched).toBe(true);
    expect(res.outsideServiceArea).toBe(false);
    expect(res.zone?.id).toBe('z-dha');
  });

  it('flags outsideServiceArea when pin is far from all served zones and offers nearest zone', () => {
    const res = resolvePinToZone(25.01, 67.25, zones);
    expect(res.matched).toBe(false);
    expect(res.outsideServiceArea).toBe(true);
    expect(res.nearestZone?.id).toBe('z-gulshan');
  });
});
