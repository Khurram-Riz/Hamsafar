export type GenderOption = 'female' | 'male' | 'other' | 'prefer_not_to_say';
export type IdDocType = 'cnic' | 'passport';
export type FlightStatus = 'scheduled' | 'delayed' | 'landed' | 'cancelled';
export type PoolType = 'open' | 'women_only' | 'family_only';
export type LuggageLevel = 'light' | 'medium' | 'heavy';
export type RideMode = 'pool' | 'solo';
export type VehicleType = 'rickshaw' | 'car' | 'van';
export type ShareConsent = 'pending' | 'accepted' | 'declined';
export type JoinVote = 'pending' | 'approved' | 'declined';
export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'checked_in'
  | 'dropped_off'
  | 'cancelled'
  | 'no_show';
export type PoolStatus =
  | 'forming'
  | 'confirmed'
  | 'dispatched'
  | 'completed'
  | 'cancelled';
export type PaymentMethod = 'cash' | 'easypaisa' | 'jazzcash';
export type PaymentStatus = 'pending' | 'paid' | 'refunded';
export type DepositStatus = 'none' | 'held' | 'refunded' | 'forfeited';
export type ReportType = 'safety' | 'pricing' | 'driver' | 'route' | 'other';

export interface UserProfile {
  id: string;
  phone: string;
  name: string | null;
  gender: GenderOption | null;
  emergency_contact: string | null;
  id_doc_type: IdDocType | null;
  id_doc_masked: string | null;
  verified: boolean;
  reliability_score: number;
  is_demo: boolean;
  created_at: string;
}

export interface FlightRecord {
  id: string;
  flight_no: string;
  airline: string;
  origin: string;
  airport_code: string;
  scheduled_arrival: string;
  estimated_arrival: string;
  terminal: string;
  status: FlightStatus;
  verified: boolean;
  created_at?: string;
}

export interface CorridorRecord {
  id: string;
  airport_code: string;
  name: string;
  slug: string;
  color: string;
}

export interface ZoneRecord {
  id: string;
  airport_code: string;
  name: string;
  slug: string;
  corridor_id: string;
  lat: number;
  lng: number;
  radius_km: number;
  order_in_corridor: number;
  active: boolean;
}

export interface ZoneFareRecord {
  id: string;
  zone_id: string;
  seat_fare_pkr: number;
  solo_fare_pkr: number;
  as_of_date: string;
  is_placeholder: boolean;
}

export interface ZoneWithDetails extends ZoneRecord {
  corridor: CorridorRecord;
  fare: ZoneFareRecord;
}

export interface VehicleRecord {
  id: string;
  operator_id: string;
  plate: string;
  capacity: number;
  vehicle_type: VehicleType;
  model: string;
  active: boolean;
}

export interface DriverRecord {
  id: string;
  operator_id: string;
  name: string;
  phone: string;
  photo_url: string | null;
  verified: boolean;
}

export interface PoolRecord {
  id: string;
  flight_id: string;
  vehicle_id: string | null;
  driver_id: string | null;
  pool_type: PoolType;
  corridor_id: string;
  pickup_time: string;
  meeting_point: string;
  whatsapp_link: string | null;
  status: PoolStatus;
  created_at: string;
  vehicle?: VehicleRecord | null;
  driver?: DriverRecord | null;
  corridor?: CorridorRecord | null;
}

export interface BookingRecord {
  id: string;
  user_id: string;
  flight_id: string;
  zone_id: string;
  dest_lat: number | null;
  dest_lng: number | null;
  address_note: string | null;
  seats: number;
  luggage: LuggageLevel;
  pool_type: PoolType;
  ride_mode: RideMode;
  share_consent: ShareConsent;
  status: BookingStatus;
  pool_id: string | null;
  seat_fare_pkr: number;
  solo_fare_pkr: number;
  total_fare_pkr: number;
  platform_fee_pkr: number;
  operator_fee_pkr: number;
  deposit_pkr: number;
  deposit_status: DepositStatus;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  booking_code: string;
  checked_in_at: string | null;
  dropped_off_at: string | null;
  created_at: string;
  flight?: FlightRecord;
  zone?: ZoneRecord & { corridor?: CorridorRecord };
  pool?: PoolRecord | null;
  user?: Pick<UserProfile, 'id' | 'name' | 'gender' | 'verified' | 'reliability_score'>;
}

export interface PoolJoinVoteRecord {
  id: string;
  pool_id: string;
  joiner_booking_id: string;
  voter_booking_id: string;
  vote: JoinVote;
  created_at: string;
}

export interface ShareLinkRecord {
  id: string;
  booking_id: string;
  token: string;
  expires_at: string;
  revoked: boolean;
  created_at: string;
}

export interface NotificationRecord {
  id: string;
  user_id: string;
  booking_id: string | null;
  type: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
}
