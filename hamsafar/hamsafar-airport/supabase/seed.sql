-- Hamsafar Airport - Karachi (KHI) Initial Seed Data
-- Note: All fares and capacities are unconfirmed MVP placeholders (see requirements.md Section 5.2).

-- 1. Corridors
insert into public.corridors (id, airport_code, name, slug, color) values
  ('11111111-1111-4111-8111-111111111101', 'KHI', 'Korangi / Defence Corridor', 'korangi-defence', '#0d9488'),
  ('11111111-1111-4111-8111-111111111102', 'KHI', 'University Road Corridor', 'university-road', '#d97706'),
  ('11111111-1111-4111-8111-111111111103', 'KHI', 'Shahrah-e-Faisal Corridor', 'shahrah-e-faisal', '#2563eb')
on conflict (slug) do update set name = excluded.name, color = excluded.color;

-- 2. Zones (ordered from KHI airport along each corridor)
insert into public.zones (id, airport_code, name, slug, corridor_id, lat, lng, radius_km, order_in_corridor, active) values
  ('22222222-2222-4222-8222-222222222201', 'KHI', 'DHA Phase 1-8', 'dha-phase-1-8', '11111111-1111-4111-8111-111111111101', 24.8138, 67.0601, 4.8, 1, true),
  ('22222222-2222-4222-8222-222222222202', 'KHI', 'Clifton', 'clifton', '11111111-1111-4111-8111-111111111101', 24.8135, 67.0300, 3.5, 2, true),
  ('22222222-2222-4222-8222-222222222203', 'KHI', 'Gulistan-e-Johar', 'gulistan-e-johar', '11111111-1111-4111-8111-111111111102', 24.9207, 67.1344, 3.6, 1, true),
  ('22222222-2222-4222-8222-222222222204', 'KHI', 'Gulshan-e-Iqbal', 'gulshan-e-iqbal', '11111111-1111-4111-8111-111111111102', 24.9200, 67.0912, 3.8, 2, true),
  ('22222222-2222-4222-8222-222222222205', 'KHI', 'PECHS', 'pechs', '11111111-1111-4111-8111-111111111103', 24.8675, 67.0645, 3.0, 1, true),
  ('22222222-2222-4222-8222-222222222206', 'KHI', 'Tariq Road Area', 'tariq-road', '11111111-1111-4111-8111-111111111103', 24.8716, 67.0589, 2.6, 2, true),
  ('22222222-2222-4222-8222-222222222207', 'KHI', 'Saddar', 'saddar', '11111111-1111-4111-8111-111111111103', 24.8556, 67.0285, 3.0, 3, true)
on conflict (slug) do update set
  lat = excluded.lat,
  lng = excluded.lng,
  radius_km = excluded.radius_km,
  order_in_corridor = excluded.order_in_corridor;

-- 3. Zone Fares (unconfirmed placeholders as of 2026-11-11)
insert into public.zone_fares (zone_id, seat_fare_pkr, solo_fare_pkr, as_of_date, is_placeholder) values
  ('22222222-2222-4222-8222-222222222201', 750, 2600, '2026-11-11', true),
  ('22222222-2222-4222-8222-222222222202', 800, 2800, '2026-11-11', true),
  ('22222222-2222-4222-8222-222222222203', 550, 1800, '2026-11-11', true),
  ('22222222-2222-4222-8222-222222222204', 650, 2100, '2026-11-11', true),
  ('22222222-2222-4222-8222-222222222205', 700, 2300, '2026-11-11', true),
  ('22222222-2222-4222-8222-222222222206', 700, 2400, '2026-11-11', true),
  ('22222222-2222-4222-8222-222222222207', 850, 2900, '2026-11-11', true)
on conflict (zone_id) do update set
  seat_fare_pkr = excluded.seat_fare_pkr,
  solo_fare_pkr = excluded.solo_fare_pkr,
  as_of_date = excluded.as_of_date,
  is_placeholder = excluded.is_placeholder;

-- 4. Fleet Operators
insert into public.operators (id, name, license_no, contact) values
  ('33333333-3333-4333-8333-333333333301', 'Sindh Airport Express Fleet', 'KHI-OP-2026-019', '+923008211001'),
  ('33333333-3333-4333-8333-333333333302', 'Karachi Executive Vans', 'KHI-OP-2026-042', '+923008211002')
on conflict (license_no) do nothing;

-- 5. Vehicles: rickshaws (3 seats), cars (4 seats) and vans (8 seats). Capacities are placeholders (?).
insert into public.vehicles (id, operator_id, plate, vehicle_type, capacity, model, active) values
  ('44444444-4444-4444-8444-444444444401', '33333333-3333-4333-8333-333333333301', 'KHI-26-8412', 'van', 8, 'Toyota Hiace Grand Cabin (White)', true),
  ('44444444-4444-4444-8444-444444444402', '33333333-3333-4333-8333-333333333301', 'KHI-26-9034', 'van', 8, 'Toyota Hiace High Roof (Silver)', true),
  ('44444444-4444-4444-8444-444444444403', '33333333-3333-4333-8333-333333333301', 'BMA-418', 'van', 8, 'Hyundai H-1 Starex (White)', true),
  ('44444444-4444-4444-8444-444444444404', '33333333-3333-4333-8333-333333333302', 'BNC-772', 'van', 8, 'Toyota Hiace Grand Cabin (Pearl)', true),
  ('44444444-4444-4444-8444-444444444405', '33333333-3333-4333-8333-333333333302', 'KHI-25-6190', 'van', 8, 'Changan Karvaan Plus (Silver)', true),
  ('44444444-4444-4444-8444-444444444406', '33333333-3333-4333-8333-333333333302', 'BPD-509', 'van', 8, 'Toyota Hiace High Roof (White)', true),
  ('44444444-4444-4444-8444-444444444407', '33333333-3333-4333-8333-333333333301', 'KHI-26-3318', 'van', 8, 'Hyundai H-1 Starex (Grey)', true),
  ('44444444-4444-4444-8444-444444444408', '33333333-3333-4333-8333-333333333302', 'BQA-914', 'van', 8, 'Toyota Hiace Grand Cabin (White)', true),
  ('44444444-4444-4444-8444-444444444409', '33333333-3333-4333-8333-333333333301', 'KHI-26-1101', 'car', 4, 'Suzuki Cultus (White)', true),
  ('44444444-4444-4444-8444-444444444410', '33333333-3333-4333-8333-333333333301', 'KHI-26-1102', 'car', 4, 'Toyota Corolla (Silver)', true),
  ('44444444-4444-4444-8444-444444444411', '33333333-3333-4333-8333-333333333302', 'KHI-26-1103', 'car', 4, 'Honda City (Grey)', true),
  ('44444444-4444-4444-8444-444444444412', '33333333-3333-4333-8333-333333333302', 'KHI-26-1104', 'car', 4, 'Suzuki Alto (White)', true),
  ('44444444-4444-4444-8444-444444444413', '33333333-3333-4333-8333-333333333301', 'KHI-R-2201', 'rickshaw', 3, 'Auto rickshaw (Yellow)', true),
  ('44444444-4444-4444-8444-444444444414', '33333333-3333-4333-8333-333333333302', 'KHI-R-2202', 'rickshaw', 3, 'Auto rickshaw (Green)', true)
on conflict (plate) do nothing;

-- 6. Verified Drivers
insert into public.drivers (id, operator_id, name, phone, photo_url, verified) values
  ('55555555-5555-4555-8555-555555555501', '33333333-3333-4333-8333-333333333301', 'Tariq Mahmood', '+923212401101', null, true),
  ('55555555-5555-4555-8555-555555555502', '33333333-3333-4333-8333-333333333301', 'Kamran Siddiqui', '+923212401102', null, true),
  ('55555555-5555-4555-8555-555555555503', '33333333-3333-4333-8333-333333333301', 'Nadeem Akhter', '+923212401103', null, true),
  ('55555555-5555-4555-8555-555555555504', '33333333-3333-4333-8333-333333333302', 'Farhan Qureshi', '+923212401104', null, true),
  ('55555555-5555-4555-8555-555555555505', '33333333-3333-4333-8333-333333333302', 'Sajid Mehmood', '+923212401105', null, true),
  ('55555555-5555-4555-8555-555555555506', '33333333-3333-4333-8333-333333333302', 'Imran Haider', '+923212401106', null, true),
  ('55555555-5555-4555-8555-555555555507', '33333333-3333-4333-8333-333333333301', 'Bilal Raza', '+923212401107', null, true),
  ('55555555-5555-4555-8555-555555555508', '33333333-3333-4333-8333-333333333302', 'Zeeshan Ali', '+923212401108', null, true)
on conflict (id) do nothing;

-- 7. Seeded Demo Flight (PK-309 landing tonight at 23:15 PKT / 18:15 UTC)
insert into public.flights (id, flight_no, airline, origin, airport_code, scheduled_arrival, estimated_arrival, terminal, status, verified) values
  (
    '66666666-6666-4666-8666-666666666601',
    'PK-309',
    'Pakistan International Airlines',
    'Islamabad (ISB)',
    'KHI',
    (date_trunc('day', now() at time zone 'Asia/Karachi') + interval '23 hours 15 minutes') at time zone 'Asia/Karachi',
    (date_trunc('day', now() at time zone 'Asia/Karachi') + interval '23 hours 15 minutes') at time zone 'Asia/Karachi',
    'Jinnah Terminal - Domestic',
    'scheduled',
    true
  ),
  (
    '66666666-6666-4666-8666-666666666602',
    'EK-606',
    'Emirates',
    'Dubai (DXB)',
    'KHI',
    (date_trunc('day', now() at time zone 'Asia/Karachi') + interval '23 hours 45 minutes') at time zone 'Asia/Karachi',
    (date_trunc('day', now() at time zone 'Asia/Karachi') + interval '23 hours 45 minutes') at time zone 'Asia/Karachi',
    'Jinnah Terminal - International',
    'scheduled',
    true
  )
on conflict (id) do nothing;
