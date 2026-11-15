import {
  DriverRecord,
  FlightRecord,
  PoolStatus,
  PoolType,
  RideMode,
  ShareConsent,
  VehicleRecord,
  VehicleType,
  ZoneRecord,
} from '@/types/database';

export interface MatchingConfig {
  /** Ceiling on seats per ride. */
  vehicleCapacity: number;
  /** Minimum PEOPLE who must consent before a ride is booked (default 2). */
  minPoolSize: number;
  matchWindowMinutes: number;
  /** Placeholder (?) multiplier per vehicle type vs. the car baseline fare. */
  fareMultiplier?: Record<string, number>;
}

export interface MatchBookingInput {
  id: string;
  user_id: string;
  zone_id: string;
  seats: number;
  pool_type: PoolType;
  ride_mode: RideMode;
  /** Has this rider agreed to share (pending until they accept a proposal). */
  consent: ShareConsent;
  seat_fare_pkr: number;
  /** Whole-ride price for one rider in a car (baseline). */
  solo_fare_pkr: number;
  existing_pool_id?: string | null;
  created_at?: string;
}

export interface ExistingPoolHint {
  id: string;
  pool_type: PoolType;
  corridor_id: string;
  vehicle_id: string | null;
  driver_id: string | null;
  pickup_time: string;
  status: PoolStatus;
  booking_ids: string[];
}

export interface FallbackOption {
  type: 'nearest_corridor_zone' | 'later_window' | 'solo_fixed_fare';
  title: string;
  description: string;
  suggestedZoneId?: string;
  suggestedZoneName?: string;
  suggestedPickupTime?: string;
  farePkr?: number;
}

export interface FormedPool {
  id: string;
  pool_type: PoolType;
  corridor_id: string;
  vehicle_id: string | null;
  vehicle_type: VehicleType | null;
  driver_id: string | null;
  pickup_time: string;
  /** forming = riders connected, waiting for 2+ to agree. confirmed = ride booked. */
  status: PoolStatus;
  /** Seats of consenting riders (the people actually paying for this ride). */
  accepted_seats: number;
  total_seats: number;
  capacity: number;
  /** Whole-ride price (confirmed pools only; 0 while forming). */
  ride_fare_pkr: number;
  zone_ids_ordered: string[];
  /** Confirmed: riding members. Forming: everyone connected who has not declined. */
  booking_ids: string[];
  /** Fare share per member booking (confirmed pools only). */
  shares: Record<string, { seatFarePkr: number; totalFarePkr: number }>;
}

/** A rider asking to join a ride that is already booked; every member must approve. */
export interface JoinRequest {
  bookingId: string;
  poolId: string;
  voterBookingIds: string[];
  /** What each seat would cost after the joiner is added. */
  projectedSeatFarePkr: number;
  projectedRiderSeats: number;
}

export interface MatchResult {
  pools: FormedPool[];
  bookingToPoolId: Record<string, string>;
  joinRequests: JoinRequest[];
  reassignedBookingIds: string[];
  fallbacksByBookingId: Record<string, FallbackOption[]>;
  soloRecommendedBookingIds: string[];
}

export interface MatchEngineInput {
  flight: Pick<FlightRecord, 'id' | 'estimated_arrival' | 'status'>;
  bookings: MatchBookingInput[];
  zones: ZoneRecord[];
  vehicles: VehicleRecord[];
  drivers: DriverRecord[];
  existingPools?: ExistingPoolHint[];
  config: MatchingConfig;
}
