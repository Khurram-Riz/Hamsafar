# Hamsafar Airport

> One flight, one ride, a fairer fare.

Hamsafar Airport is a web platform that helps passengers from the same flight share a ride home. Passengers enter their flight number and destination before landing. The system connects people heading the same **zone and corridor** at the same time. **A ride (rickshaw, car or van) is only booked once at least 2 people agree to share it**, and the ride fare is split between them. If someone new wants to join, every current rider must approve and the fare is re-split.

Built for **Startup Showdown '26**. Launch focus: **Jinnah International Airport, Karachi**, with 3 starting zones (DHA, Clifton, Gulshan).

> This README tells a builder (human or AI coding tool) what to build and how. The full requirement list is in [`requirements.md`](./requirements.md). Where this file and `requirements.md` disagree, `requirements.md` wins.

---

## 1. The Problem

When a flight lands, hundreds of passengers arrive within the same 30 minutes and all need a ride, often late at night. They face taxi touts, surge pricing and haggling. Overseas Pakistanis and first-time visitors are the easiest targets. Meanwhile many passengers on the same flight are heading to the same part of the city, yet each pays for a full ride alone.

## 2. The Core Feature

**Consent-based ride sharing: connect by zone, book at 2 people, split the fare.**

1. **Connect:** match riders by zone and corridor (not exact address) and arrival time.
2. **Agree:** each rider accepts or declines sharing. People first connect, then agree.
3. **Book:** the ride is booked when **at least 2 people** have accepted (2 seats from one booking count as 2 people). The smallest vehicle that fits is assigned: **rickshaw (3 seats), car (4) or van (8)**.
4. **Split:** the whole-ride fare is divided equally per seat among the riders.
5. **Join:** a latecomer is added only if **every current rider approves**. The fare is then **redistributed**, so everyone pays less.

Everything else (safety options, payments, WhatsApp groups, live trip link) supports this one engine. **If time is short, protect the matching engine and the consent flow first.**

## 3. MVP Scope

### In scope (must work in the demo)
1. Phone OTP login (demo mode: fixed code).
2. Enter flight number and date; arrival time is looked up (seeded data; live API optional).
3. Choose destination zone, or drop a pin that snaps to the nearest zone.
4. Choose seats, luggage and pool type (open / women-only / family-only).
5. Matching engine connects riders and shows how many people are matched and an estimated share of the fare versus riding alone.
6. **Consent flow:** accept or decline sharing; the ride is booked once 2+ people accept. Booking details show riders, vehicle, pickup time and a WhatsApp group link (placeholder link).
6a. **Join approvals:** a newcomer to a booked ride needs approval from every current rider; the fare is re-split and everyone is notified.
7. Flight delay simulation that re-forms pools and notifies passengers.
8. Driver and vehicle details shown before boarding; QR booking code for boarding.
9. Shareable live trip link (simulated route).
10. Post-ride rating and safety report.
11. **Demo dashboard:** a map showing pools forming in real time for a seeded flight.

### Out of scope for the MVP (roadmap)
- Real payment processing (Easypaisa, JazzCash). Payments are mocked; cash is the default.
- Real CNIC or passport verification (simulated).
- Native mobile apps.
- Airports other than Karachi, and non-airport events (trains, Eid terminals, stadiums).
- Driver-side app. Drivers get a simple manifest page.

## 4. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js (App Router) + TypeScript + Tailwind CSS | Mobile-first. Must work on low-end Android and slow networks. |
| Maps | Leaflet + OpenStreetMap tiles | Free, no API key. |
| Backend | Next.js Route Handlers (Node) | One repo, one deploy. |
| Database | Supabase (PostgreSQL) | Realtime subscriptions power the live pool map. |
| Auth | Supabase Auth (phone OTP) | Demo mode bypasses SMS with a fixed code. |
| Matching engine | Pure TypeScript module in `/lib/matching` | Rules-based. No ML. Handles consent, vehicle choice and join requests. Unit-testable without a database. |
| Flight data | Seeded JSON for the demo; optional adapter for a live flight API | Keep behind an interface so the source can be swapped. |
| Payments | Mock provider interface | Cash default; Easypaisa/JazzCash simulated. |
| Notifications | Console/log + in-app for the MVP; SMS/WhatsApp adapter optional | |
| Testing | Vitest (unit), Playwright (one end-to-end flow) | |

## 5. Project Structure

```
hamsafar-airport/
├── README.md
├── requirements.md
├── .env.example
├── package.json
├── supabase/
│   ├── schema.sql              # tables, indexes, RLS policies
│   └── seed.sql                # zones, corridors, fares, vehicles, drivers, demo flight
├── data/
│   ├── zones.karachi.json      # zone names, centroids, corridor order
│   ├── fares.karachi.json      # per-seat fares by zone (placeholders, see requirements)
│   └── flights.demo.json       # seeded flights with arrival times
├── src/
│   ├── app/
│   │   ├── (public)/           # landing, login
│   │   ├── book/               # booking wizard (flight -> destination -> preferences -> pool -> confirm)
│   │   ├── trip/[id]/          # booking details, QR code, live trip
│   │   ├── share/[token]/      # public live-trip link for family
│   │   ├── driver/[poolId]/    # driver manifest page
│   │   ├── demo/               # live pool map + delay simulator
│   │   └── api/                # route handlers (see requirements.md section 8)
│   ├── lib/
│   │   ├── matching/           # engine (connect, book at 2, join), service, consent and join votes
│   │   ├── fares/              # whole-ride fare, equal split per seat, commission
│   │   ├── flights/            # flight provider interface + seeded provider
│   │   ├── zones/              # pin -> nearest zone/corridor
│   │   ├── payments/           # provider interface + mock
│   │   └── notify/             # notification interface + console/in-app
│   └── components/
└── tests/
    ├── matching.test.ts
    ├── fares.test.ts
    └── e2e/booking.spec.ts
```

## 6. Getting Started

### Prerequisites
- Node.js 20+
- A Supabase project (free tier is enough) or local Supabase via the Supabase CLI

### Setup
```bash
git clone <repo-url> hamsafar-airport
cd hamsafar-airport
npm install
cp .env.example .env.local      # then fill in values
```

### Environment variables (`.env.example`)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Demo mode: bypass SMS, OTP is always DEMO_OTP_CODE
DEMO_MODE=true
DEMO_OTP_CODE=123456

# Flight provider: "seed" (default) or "live"
FLIGHT_PROVIDER=seed
FLIGHT_API_KEY=

# Business parameters (placeholders, validate before using)
COMMISSION_RATE=0.15
# Largest vehicle (van). Real capacity is stored per vehicle: rickshaw 3, car 4, van 8 (?)
VEHICLE_CAPACITY=8
# People who must agree to share before a ride is booked
MIN_POOL_SIZE=2
MATCH_WINDOW_MINUTES=45
NO_SHOW_DEPOSIT_PKR=0
```

### Database
```bash
# apply schema and seed data
psql "$DATABASE_URL" -f supabase/schema.sql
psql "$DATABASE_URL" -f supabase/seed.sql
```

### Run
```bash
npm run dev          # http://localhost:3000
npm run test         # unit tests
npm run test:e2e     # end-to-end booking flow
npm run seed:demo    # create 30 fake passengers on the demo flight
```

## 7. How the Matching Engine Works (summary)

Input: the bookings for one flight (with each rider's consent), plus available vehicles.

1. **Partition** by `pool_type` (women-only and family-only never mix with open).
2. **Group by corridor** and order zones from the airport so drop-offs follow one route.
3. **Connect:** a group with fewer than `MIN_POOL_SIZE` (2) accepted people stays `forming`. No vehicle, no booked ride.
4. **Book:** once 2+ people have accepted, the ride becomes `confirmed` and the **smallest free vehicle that fits** is assigned. Riders who have not accepted yet become join requests.
5. **Join:** every current rider must approve a newcomer (one "no" rejects). When all approve and the newcomer accepts, they are added and the fare is redistributed.
6. **Leave:** if a rider cancels, the fare is re-split. Below 2 people, the ride returns to `forming`.
7. **Re-run** whenever a booking, consent, vote or the flight time changes. A booked ride never silently loses a rider.

Fallbacks for riders without a booked ride: widen to the nearest zone, wait for a later wave, or ride alone at the full fare.

Full rules and edge cases are in `requirements.md` section 6.

## 8. Fare Model (summary)

- One **whole-ride fare** per ride: the farthest rider's baseline fare (`data/fares.karachi.json`) times a vehicle multiplier (rickshaw 0.6, car 1.0, van 1.6 (?)).
- The fare is **split equally per seat** among the riders. Shares always add up exactly; leftover rupees go to the earliest riders.
- **Redistribution:** when a rider joins or leaves, the same ride fare is split again and everyone is notified of their new amount.
- Before a ride is booked, the screen shows an **estimate that assumes 2 riders**.
- Commission: `COMMISSION_RATE` of each rider's share goes to the platform; the rest to the operator.
- **All Rs figures in the seed data are placeholders** and must be replaced with verified numbers from real operator quotes and current ride-hailing prices.

## 9. Trust and Safety (must be visible in the product)

- Women-only and family-only pools.
- Sharing is always opt-in: nobody is placed in a shared ride without accepting, and current riders approve any newcomer.
- Verified phone number (OTP); ID check simulated for the MVP.
- Driver name, photo, vehicle plate and phone shown before boarding.
- Live trip link that family can open without logging in.
- Safety-report button on every trip screen.

## 10. Demo Script

1. Open `/demo` and load the seeded Karachi flight (30 passengers, landing at night).
2. Add yourself and 2 to 3 judges as live users through the booking flow.
3. Watch the map light up with clusters. Open a booked ride: "3 people, one rickshaw, Rs 520 each versus Rs 2,600 alone." (use your real numbers)
4. Book as a new rider. Show that nothing is booked until you accept and a second person has agreed.
5. Have a late rider ask to join. Approve it from the existing rider's trip screen and watch every share drop.
6. Press **Simulate delay (+40 min)**. Pickup times update and notifications appear.
7. Show the driver manifest, the QR boarding code and the family trip link.

Use real numbers from your own data on stage. Keep a backup screen recording in case the network fails.

## 11. Known Risks

| Risk | Mitigation |
|---|---|
| Operators refuse a whole-ride price per vehicle type | Validate with 5 to 10 operator interviews before launch. |
| Not enough riders agree to share | Pre-landing booking, zone-based matching, widening to nearby zones, and a solo full-fare fallback. |
| A rider objects to a newcomer | One decline rejects the newcomer, who is offered fallbacks. Existing riders are never forced to share with someone new. |
| Regulation of airport pickups | Work only with licensed operators; seek airport authority permission. |
| Flight delays and cancellations | Live re-matching; automatic refund of deposit on cancellation. |
| No-shows | Small refundable deposit and a reliability score. |
| Passenger safety concerns | Safety features above are part of the core product, not extras. |

## 12. Validation Plan (before and after building)

- Passenger survey (50 to 100 responses) on willingness to share and the discount needed.
- 5 to 10 operator interviews on fixed fares and guaranteed loads.
- One manual "concierge" pilot: pool real passengers on one flight using a form and one booked vehicle.
- Track: match rate, average saving versus solo, booking-to-showup rate, vehicle fill rate, repeat bookings, safety complaints.

## 13. Disclaimers

- Prices, commission rate, vehicle capacity and zone fares in this repository are **unconfirmed placeholders**.
- This is a prototype. It is not an approved transport service and has no regulatory approval.

## 14. Team

Team name, lead and members: _to be filled in_.
