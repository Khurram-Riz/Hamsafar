-- Hamsafar Airport - Complete PostgreSQL Schema & Row Level Security (RLS)
-- Target: Supabase (PostgreSQL 15+)

create extension if not exists "pgcrypto";

-- 1. USERS
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  phone text unique not null,
  name text,
  gender text check (gender in ('female', 'male', 'other', 'prefer_not_to_say')),
  emergency_contact text,
  id_doc_type text check (id_doc_type in ('cnic', 'passport')),
  id_doc_masked text,
  verified boolean not null default false,
  reliability_score integer not null default 100 check (reliability_score between 0 and 100),
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

-- 2. FLIGHTS
create table if not exists public.flights (
  id uuid primary key default gen_random_uuid(),
  flight_no text not null,
  airline text not null,
  origin text not null,
  airport_code text not null default 'KHI',
  scheduled_arrival timestamptz not null,
  estimated_arrival timestamptz not null,
  terminal text not null default 'Jinnah Terminal',
  status text not null default 'scheduled' check (status in ('scheduled', 'delayed', 'landed', 'cancelled')),
  verified boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_flights_no_date on public.flights (flight_no, scheduled_arrival);

-- 3. CORRIDORS
create table if not exists public.corridors (
  id uuid primary key default gen_random_uuid(),
  airport_code text not null default 'KHI',
  name text not null,
  slug text unique not null,
  color text not null default '#0d9488'
);

-- 4. ZONES
create table if not exists public.zones (
  id uuid primary key default gen_random_uuid(),
  airport_code text not null default 'KHI',
  name text not null,
  slug text unique not null,
  corridor_id uuid not null references public.corridors(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  radius_km double precision not null default 3.5,
  order_in_corridor integer not null,
  active boolean not null default true
);

create index if not exists idx_zones_airport_corridor on public.zones (airport_code, corridor_id, order_in_corridor);

-- 5. ZONE FARES
create table if not exists public.zone_fares (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid unique not null references public.zones(id) on delete cascade,
  seat_fare_pkr integer not null check (seat_fare_pkr > 0),
  solo_fare_pkr integer not null check (solo_fare_pkr > 0),
  as_of_date date not null default current_date,
  is_placeholder boolean not null default true
);

-- 6. OPERATORS
create table if not exists public.operators (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  license_no text unique not null,
  contact text not null
);

-- 7. VEHICLES
create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.operators(id) on delete cascade,
  plate text unique not null,
  vehicle_type text not null default 'van' check (vehicle_type in ('rickshaw', 'car', 'van')),
  capacity integer not null default 8 check (capacity > 0),
  model text not null,
  active boolean not null default true
);

-- 8. DRIVERS
create table if not exists public.drivers (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.operators(id) on delete cascade,
  name text not null,
  phone text not null,
  photo_url text,
  verified boolean not null default true
);

-- 9. POOLS
create table if not exists public.pools (
  id uuid primary key default gen_random_uuid(),
  flight_id uuid not null references public.flights(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  driver_id uuid references public.drivers(id) on delete set null,
  pool_type text not null check (pool_type in ('open', 'women_only', 'family_only')),
  corridor_id uuid not null references public.corridors(id) on delete restrict,
  pickup_time timestamptz not null,
  meeting_point text not null default 'Jinnah International Airport - Arrivals Gate B, Pillar 4 (Hamsafar Bay)',
  whatsapp_link text,
  -- Whole-ride price split among the riders (0 while the group is still forming).
  ride_fare_pkr integer not null default 0,
  status text not null default 'forming' check (status in ('forming', 'confirmed', 'dispatched', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists idx_pools_flight on public.pools (flight_id, status);

-- 10. BOOKINGS
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  flight_id uuid not null references public.flights(id) on delete cascade,
  zone_id uuid not null references public.zones(id) on delete restrict,
  dest_lat double precision,
  dest_lng double precision,
  address_note text,
  seats integer not null check (seats between 1 and 4),
  luggage text not null default 'medium' check (luggage in ('light', 'medium', 'heavy')),
  pool_type text not null default 'open' check (pool_type in ('open', 'women_only', 'family_only')),
  ride_mode text not null default 'pool' check (ride_mode in ('pool', 'solo')),
  -- Has this rider agreed to share? A ride is only booked once 2+ people have accepted.
  share_consent text not null default 'pending' check (share_consent in ('pending', 'accepted', 'declined')),
  status text not null default 'confirmed' check (status in ('pending', 'confirmed', 'checked_in', 'dropped_off', 'cancelled', 'no_show')),
  pool_id uuid references public.pools(id) on delete set null,
  seat_fare_pkr integer not null,
  solo_fare_pkr integer not null,
  total_fare_pkr integer not null,
  platform_fee_pkr integer not null,
  operator_fee_pkr integer not null,
  deposit_pkr integer not null default 0,
  deposit_status text not null default 'none' check (deposit_status in ('none', 'held', 'refunded', 'forfeited')),
  payment_method text not null default 'cash' check (payment_method in ('cash', 'easypaisa', 'jazzcash')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'refunded')),
  booking_code text unique not null,
  checked_in_at timestamptz,
  dropped_off_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_bookings_user on public.bookings (user_id, created_at desc);
create index if not exists idx_bookings_flight on public.bookings (flight_id, status);
create index if not exists idx_bookings_pool on public.bookings (pool_id);
create index if not exists idx_bookings_code on public.bookings (booking_code);

-- 11. SHARE LINKS
create table if not exists public.share_links (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  token text unique not null,
  expires_at timestamptz not null,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_share_links_token on public.share_links (token);

-- 12. RATINGS
create table if not exists public.ratings (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid unique not null references public.bookings(id) on delete cascade,
  driver_score integer not null check (driver_score between 1 and 5),
  vehicle_score integer not null check (vehicle_score between 1 and 5),
  ride_score integer not null check (ride_score between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

-- 13. REPORTS (Safety & Pricing)
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  type text not null check (type in ('safety', 'pricing', 'driver', 'route', 'other')),
  description text not null,
  status text not null default 'open' check (status in ('open', 'investigating', 'resolved')),
  created_at timestamptz not null default now()
);

-- 13b. POOL JOIN VOTES
-- When someone asks to join a ride that is already booked, every current rider must approve.
create table if not exists public.pool_join_votes (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  joiner_booking_id uuid not null references public.bookings(id) on delete cascade,
  voter_booking_id uuid not null references public.bookings(id) on delete cascade,
  vote text not null default 'pending' check (vote in ('pending', 'approved', 'declined')),
  created_at timestamptz not null default now(),
  unique (joiner_booking_id, voter_booking_id)
);

create index if not exists idx_join_votes_pool on public.pool_join_votes (pool_id);

-- 14. NOTIFICATIONS
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user on public.notifications (user_id, created_at desc);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

alter table public.users enable row level security;
alter table public.flights enable row level security;
alter table public.corridors enable row level security;
alter table public.zones enable row level security;
alter table public.zone_fares enable row level security;
alter table public.operators enable row level security;
alter table public.vehicles enable row level security;
alter table public.drivers enable row level security;
alter table public.pools enable row level security;
alter table public.bookings enable row level security;
alter table public.share_links enable row level security;
alter table public.ratings enable row level security;
alter table public.reports enable row level security;
alter table public.notifications enable row level security;
alter table public.pool_join_votes enable row level security;

-- Reference & public read tables (zones, corridors, fares, flights)
drop policy if exists "Public read corridors" on public.corridors;
create policy "Public read corridors" on public.corridors for select using (true);

drop policy if exists "Public read zones" on public.zones;
create policy "Public read zones" on public.zones for select using (true);

drop policy if exists "Public read zone_fares" on public.zone_fares;
create policy "Public read zone_fares" on public.zone_fares for select using (true);

drop policy if exists "Public read flights" on public.flights;
create policy "Public read flights" on public.flights for select using (true);

-- Users: users can read and update only their own profile
drop policy if exists "Users read own profile" on public.users;
create policy "Users read own profile" on public.users
  for select using (auth.uid() = id);

drop policy if exists "Users insert own profile" on public.users;
create policy "Users insert own profile" on public.users
  for insert with check (auth.uid() = id);

drop policy if exists "Users update own profile" on public.users;
create policy "Users update own profile" on public.users
  for update using (auth.uid() = id);

-- Pools & Vehicles: readable for live pool discovery / demo map
drop policy if exists "Public read pools" on public.pools;
create policy "Public read pools" on public.pools for select using (true);

drop policy if exists "Public read vehicles" on public.vehicles;
create policy "Public read vehicles" on public.vehicles for select using (true);

-- Drivers: only visible to passengers who have an active booking assigned to that driver's pool
drop policy if exists "Passengers read assigned driver" on public.drivers;
create policy "Passengers read assigned driver" on public.drivers
  for select using (
    exists (
      select 1 from public.pools p
      join public.bookings b on b.pool_id = p.id
      where p.driver_id = drivers.id
        and b.user_id = auth.uid()
    )
  );

-- Bookings: strict per-user access
drop policy if exists "Users read own bookings" on public.bookings;
create policy "Users read own bookings" on public.bookings
  for select using (auth.uid() = user_id);

drop policy if exists "Users create own bookings" on public.bookings;
create policy "Users create own bookings" on public.bookings
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users update own bookings" on public.bookings;
create policy "Users update own bookings" on public.bookings
  for update using (auth.uid() = user_id);

-- Share links: owner manages their own booking share links; unauthenticated public lookup happens via sanitized API route
drop policy if exists "Users manage own share links" on public.share_links;
create policy "Users manage own share links" on public.share_links
  for all using (
    exists (
      select 1 from public.bookings b
      where b.id = share_links.booking_id
        and b.user_id = auth.uid()
    )
  );

-- Ratings: owner reads/creates ratings for their bookings
drop policy if exists "Users manage own ratings" on public.ratings;
create policy "Users manage own ratings" on public.ratings
  for all using (
    exists (
      select 1 from public.bookings b
      where b.id = ratings.booking_id
        and b.user_id = auth.uid()
    )
  );

-- Reports: owner reads/creates safety or pricing reports
drop policy if exists "Users manage own reports" on public.reports;
create policy "Users manage own reports" on public.reports
  for all using (
    auth.uid() = user_id
    or exists (
      select 1 from public.bookings b
      where b.id = reports.booking_id
        and b.user_id = auth.uid()
    )
  );

-- Notifications: owner reads/marks read
drop policy if exists "Users read own notifications" on public.notifications;
create policy "Users read own notifications" on public.notifications
  for select using (auth.uid() = user_id);

drop policy if exists "Users update own notifications" on public.notifications;
create policy "Users update own notifications" on public.notifications
  for update using (auth.uid() = user_id);

-- Enable Supabase Realtime for live demo map & trip updates
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.pools;
    alter publication supabase_realtime add table public.bookings;
    alter publication supabase_realtime add table public.notifications;
    alter publication supabase_realtime add table public.pool_join_votes;
    alter publication supabase_realtime add table public.flights;
  end if;
exception when duplicate_object then
  null;
end $$;

-- Join votes: riders see votes about their own ride only (writes go through the server API).
drop policy if exists "Riders read own join votes" on public.pool_join_votes;
create policy "Riders read own join votes" on public.pool_join_votes
  for select using (
    exists (
      select 1 from public.bookings b
      where b.user_id = auth.uid()
        and b.id in (pool_join_votes.joiner_booking_id, pool_join_votes.voter_booking_id)
    )
  );
