import { describe, expect, it } from 'vitest';
import { runMatchingEngine } from '@/lib/matching/engine';
import { MatchBookingInput } from '@/lib/matching/types';
import {
  DriverRecord,
  FlightRecord,
  VehicleRecord,
  ZoneRecord,
} from '@/types/database';

const flight: FlightRecord = {
  id: 'flight-1',
  flight_no: 'PK-309',
  airline: 'PIA',
  origin: 'Islamabad',
  airport_code: 'KHI',
  scheduled_arrival: '2026-11-15T18:15:00.000Z',
  estimated_arrival: '2026-11-15T18:15:00.000Z',
  terminal: 'Domestic',
  status: 'scheduled',
  verified: true,
};

const zones: ZoneRecord[] = [
  {
    id: 'z-dha',
    airport_code: 'KHI',
    name: 'DHA Phase 1-8',
    slug: 'dha-phase-1-8',
    corridor_id: 'corr-defence',
    lat: 24.8138,
    lng: 67.0601,
    radius_km: 4.8,
    order_in_corridor: 1,
    active: true,
  },
  {
    id: 'z-clifton',
    airport_code: 'KHI',
    name: 'Clifton',
    slug: 'clifton',
    corridor_id: 'corr-defence',
    lat: 24.8135,
    lng: 67.03,
    radius_km: 3.5,
    order_in_corridor: 2,
    active: true,
  },
  {
    id: 'z-gulshan',
    airport_code: 'KHI',
    name: 'Gulshan-e-Iqbal',
    slug: 'gulshan-e-iqbal',
    corridor_id: 'corr-univ',
    lat: 24.92,
    lng: 67.0912,
    radius_km: 3.8,
    order_in_corridor: 2,
    active: true,
  },
];


const mkVeh = (id: string, type: 'rickshaw' | 'car' | 'van', capacity: number): VehicleRecord => ({
  id,
  operator_id: 'op-1',
  plate: `KHI-${id}`,
  vehicle_type: type,
  capacity,
  model: type,
  active: true,
});
const vehicles: VehicleRecord[] = [
  mkVeh('rick-1', 'rickshaw', 3),
  mkVeh('rick-2', 'rickshaw', 3),
  mkVeh('car-1', 'car', 4),
  mkVeh('car-2', 'car', 4),
  mkVeh('van-1', 'van', 8),
  mkVeh('van-2', 'van', 8),
];

const drivers: DriverRecord[] = Array.from({ length: 10 }, (_, i) => ({
  id: `drv-${i + 1}`,
  operator_id: 'op-1',
  name: `Driver ${i + 1}`,
  phone: `+92300111${String(i).padStart(4, '0')}`,
  photo_url: null,
  verified: true,
}));

const config = { vehicleCapacity: 8, minPoolSize: 2, matchWindowMinutes: 45 };

let n = 0;
const rider = (o: Partial<MatchBookingInput> & { zone_id?: string } = {}): MatchBookingInput => ({
  id: o.id ?? `b${++n}`,
  user_id: `u${n}`,
  zone_id: 'z-dha',
  seats: 1,
  pool_type: 'open',
  ride_mode: 'pool',
  consent: 'accepted',
  seat_fare_pkr: 750,
  solo_fare_pkr: 2600,
  created_at: `2026-11-15T10:00:${String(n).padStart(2, '0')}.000Z`,
  ...o,
});
const run = (bookings: MatchBookingInput[], extra: Partial<Parameters<typeof runMatchingEngine>[0]> = {}) =>
  runMatchingEngine({ flight, bookings, zones, vehicles, drivers, config, ...extra });

describe('Connect first, book when 2+ people agree', () => {
  it('does not book a ride for one person; offers fallbacks', () => {
    const res = run([rider({ id: 'a' })]);
    expect(res.pools[0].status).toBe('forming');
    expect(res.pools[0].vehicle_id).toBeNull();
    expect(res.fallbacksByBookingId['a'].some((f) => f.type === 'solo_fixed_fare')).toBe(true);
  });

  it('connects two riders heading the same way but books nothing until someone agrees', () => {
    const res = run([rider({ id: 'a', consent: 'pending' }), rider({ id: 'b', consent: 'pending' })]);
    expect(res.pools).toHaveLength(1);
    expect(res.pools[0].status).toBe('forming');
    expect(res.pools[0].booking_ids).toEqual(expect.arrayContaining(['a', 'b']));
    expect(res.pools[0].ride_fare_pkr).toBe(0);
  });

  it('needs 2 PEOPLE to agree: one accepted + one pending is still not booked', () => {
    const res = run([rider({ id: 'a' }), rider({ id: 'b', consent: 'pending' })]);
    expect(res.pools[0].status).toBe('forming');
  });

  it('books the ride once two people have accepted, and splits the fare', () => {
    const res = run([rider({ id: 'a' }), rider({ id: 'b', zone_id: 'z-clifton' })]);
    const pool = res.pools[0];
    expect(pool.status).toBe('confirmed');
    expect(pool.accepted_seats).toBe(2);
    expect(pool.vehicle_id).not.toBeNull();
    const total = Object.values(pool.shares).reduce((s, x) => s + x.totalFarePkr, 0);
    expect(total).toBe(pool.ride_fare_pkr);
    for (const s of Object.values(pool.shares)) expect(s.totalFarePkr).toBeLessThan(2600);
  });

  it('counts a booking of 2 seats as 2 people', () => {
    const res = run([rider({ id: 'a', seats: 2, pool_type: 'family_only' })]);
    expect(res.pools[0].status).toBe('confirmed');
  });

  it('never groups riders who declined, and gives them options', () => {
    const res = run([rider({ id: 'a' }), rider({ id: 'b' }), rider({ id: 'c', consent: 'declined' })]);
    expect(res.pools.flatMap((p) => p.booking_ids)).not.toContain('c');
    expect(res.fallbacksByBookingId['c']).toBeDefined();
  });
});

describe('Vehicle fits the group (rickshaw, car or van)', () => {
  const group = (k: number) => run(Array.from({ length: k }, () => rider()));

  it('uses the smallest vehicle that fits', () => {
    expect(group(2).pools[0].vehicle_type).toBe('rickshaw');
    expect(group(4).pools[0].vehicle_type).toBe('car');
    expect(group(6).pools[0].vehicle_type).toBe('van');
  });

  it('never exceeds the vehicle capacity', () => {
    for (const k of [2, 3, 4, 7, 8, 12]) {
      for (const p of group(k).pools) expect(p.accepted_seats).toBeLessThanOrEqual(p.capacity);
    }
  });
});

describe('Latecomers need every rider to agree, then fares are redistributed', () => {
  const first = run([rider({ id: 'a' }), rider({ id: 'b' })]);
  const pool = first.pools[0];
  const hint = {
    id: pool.id,
    pool_type: pool.pool_type,
    corridor_id: pool.corridor_id,
    vehicle_id: pool.vehicle_id,
    driver_id: pool.driver_id,
    pickup_time: pool.pickup_time,
    status: pool.status,
    booking_ids: ['a', 'b'],
  };
  const members = [
    rider({ id: 'a', existing_pool_id: pool.id }),
    rider({ id: 'b', existing_pool_id: pool.id }),
  ];

  it('turns a newcomer into a join request that both riders must approve', () => {
    const res = run([...members, rider({ id: 'c', consent: 'accepted' })], { existingPools: [hint] });
    expect(res.joinRequests).toHaveLength(1);
    expect(res.joinRequests[0].bookingId).toBe('c');
    expect(res.joinRequests[0].voterBookingIds.sort()).toEqual(['a', 'b']);
    // the booked ride is untouched until everyone approves
    const same = res.pools.find((p) => p.id === pool.id)!;
    expect(same.booking_ids.sort()).toEqual(['a', 'b']);
    expect(res.bookingToPoolId['c']).toBeUndefined();
  });

  it('re-splits the same ride fare across 3 riders after approval', () => {
    const before = pool.shares['a'].totalFarePkr;
    const joined = run(
      [...members, rider({ id: 'c', existing_pool_id: pool.id })],
      { existingPools: [hint] }
    );
    const after = joined.pools.find((p) => p.id === pool.id)!;
    expect(after.booking_ids.sort()).toEqual(['a', 'b', 'c']);
    expect(after.shares['a'].totalFarePkr).toBeLessThan(before);
    const total = Object.values(after.shares).reduce((s, x) => s + x.totalFarePkr, 0);
    expect(total).toBe(after.ride_fare_pkr);
  });

  it('does not offer a join when the vehicle is already full', () => {
    const full = run([...members, rider({ id: 'c', existing_pool_id: pool.id })], { existingPools: [hint] });
    const fullPool = full.pools.find((p) => p.id === pool.id)!;
    expect(fullPool.accepted_seats).toBe(3);
    const res = run(
      [...members, rider({ id: 'c', existing_pool_id: pool.id }), rider({ id: 'd', consent: 'accepted' })],
      { existingPools: [{ ...hint, booking_ids: ['a', 'b', 'c'] }] }
    );
    expect(res.joinRequests.find((r) => r.bookingId === 'd')).toBeUndefined();
  });

  it('puts a booked ride back to forming if riders drop below 2', () => {
    const res = run([rider({ id: 'a', existing_pool_id: pool.id })], { existingPools: [hint] });
    const p = res.pools.find((x) => x.id === pool.id)!;
    expect(p.status).toBe('forming');
    expect(res.fallbacksByBookingId['a']).toBeDefined();
  });
});

describe('Isolation rules', () => {
  it('never mixes pool types', () => {
    const res = run([
      rider({ id: 'w', pool_type: 'women_only' }),
      rider({ id: 'o', pool_type: 'open' }),
    ]);
    expect(res.pools).toHaveLength(2);
    expect(res.pools.every((p) => p.status === 'forming')).toBe(true);
  });

  it('never mixes corridors', () => {
    const res = run([rider({ id: 'a', zone_id: 'z-dha' }), rider({ id: 'g', zone_id: 'z-gulshan' })]);
    expect(res.pools).toHaveLength(2);
  });

  it('keeps solo rides separate and booked immediately', () => {
    const res = run([rider({ id: 's', ride_mode: 'solo' })]);
    expect(res.pools[0].status).toBe('confirmed');
    expect(res.pools[0].shares['s'].totalFarePkr).toBe(res.pools[0].ride_fare_pkr);
  });

  it('cancels pools when the flight is cancelled', () => {
    const res = run([rider({ id: 'a' }), rider({ id: 'b' })], {
      flight: { ...flight, status: 'cancelled' },
    });
    expect(res.pools.every((p) => p.status === 'cancelled')).toBe(true);
  });

  it('is deterministic', () => {
    const list = [rider({ id: 'a' }), rider({ id: 'b', zone_id: 'z-clifton' }), rider({ id: 'c', consent: 'pending' })];
    expect(run(list)).toEqual(run(list));
  });
});
