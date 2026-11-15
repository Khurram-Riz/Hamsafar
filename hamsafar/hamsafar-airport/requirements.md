# Requirements: Hamsafar Airport

**Version:** 0.1 (MVP)
**Date:** 11 November 2026
**Scope:** Hackathon MVP for Jinnah International Airport, Karachi.

Priority key: **P0** = must work in the demo, **P1** = should have, **P2** = nice to have.
Values marked **(?)** are unconfirmed placeholders to be validated and kept in config, never hard-coded.

---

## 1. Purpose and Users

A web platform that connects passengers from the same flight who are heading the same way. When at least 2 of them agree to share, a ride (rickshaw, car or van) is booked and the ride fare is split between them. A newcomer can join only if every current rider agrees, and the fare is then re-split.

| User | Goal |
|---|---|
| **Passenger** (overseas Pakistani, visitor, family, woman traveler) | Get a safe, predictable, cheaper ride home without haggling. |
| **Driver / operator** | Receive a full vehicle and a clear manifest. |
| **Admin / demo operator** | Seed flights, run the demo, simulate delays, view pools. |
| **Family member** (no account) | Follow a passenger's trip through a shared link. |

## 2. Assumptions

1. Launch airport is Karachi (KHI) with starting zones including DHA, Clifton and Gulshan (?). The zone list is data-driven.
2. **Vehicle types:** rickshaw (3 seats), car (4 seats) and van (8 seats) (?). Capacity is stored per vehicle and the system always picks the smallest free vehicle that fits the riders.
3. **A ride is only booked when at least 2 people have agreed to share** (`MIN_POOL_SIZE=2`). A booking of 2 seats counts as 2 people.
4. **Whole-ride pricing:** a ride has one fare (farthest rider's baseline fare x vehicle multiplier (?)). The fare is split equally per seat among the riders who agreed.
5. Pickup window is the flight's arrival time plus 45 minutes (?).
6. Demo uses seeded flight data. A live flight API is optional behind an interface.
7. Payments, ID checks and SMS are simulated in the MVP.

## 3. Functional Requirements

### 3.1 Authentication and Profile
| ID | Requirement | Priority |
|---|---|---|
| FR-1.1 | User signs in with a Pakistani mobile number (+92 format validated) and a one-time code. | P0 |
| FR-1.2 | In demo mode, the OTP is a fixed configured value and no SMS is sent. | P0 |
| FR-1.3 | Profile stores name, gender (optional, used only for women-only pools), and an optional emergency contact. | P1 |
| FR-1.4 | Simulated ID verification step (CNIC or passport number format check only) marks the profile as "verified". | P2 |

### 3.2 Flight Lookup
| ID | Requirement | Priority |
|---|---|---|
| FR-2.1 | User enters a flight number and date; system returns airline, origin, scheduled arrival, terminal and status. | P0 |
| FR-2.2 | Flight data comes through a `FlightProvider` interface with a seeded implementation. | P0 |
| FR-2.3 | If the flight is not found, show a clear error and allow manual entry of arrival time (flagged "unverified"). | P1 |
| FR-2.4 | A live provider implementation can be enabled by config. | P2 |

### 3.3 Destination Selection
| ID | Requirement | Priority |
|---|---|---|
| FR-3.1 | User selects a destination zone from a list. | P0 |
| FR-3.2 | User can instead drop a pin on a Leaflet map; the system snaps it to the nearest zone and shows which zone was chosen. | P0 |
| FR-3.3 | If the pin is outside all served zones, show a message and offer the nearest served zone or a solo-ride request. | P1 |
| FR-3.4 | The user may type an optional address note for the driver. | P2 |

### 3.4 Preferences
| ID | Requirement | Priority |
|---|---|---|
| FR-4.1 | User sets number of seats (1 to 4) and luggage level (light, medium, heavy). | P0 |
| FR-4.2 | User chooses pool type: **open**, **women-only**, or **family-only**. | P0 |
| FR-4.3 | Women-only is selectable only if the profile gender is female (or the user self-declares); family-only requires seats of 2 or more. | P1 |

### 3.5 Matching, Consent and Pools
| ID | Requirement | Priority |
|---|---|---|
| FR-5.1 | After preferences are set, the system shows how many people are matched on the route, the estimated share of the fare (assuming 2 riders) and the solo comparison. | P0 |
| FR-5.2 | **Connect:** riders on the same flight are grouped by pool type, corridor and zone order (section 6). A group is only a proposal until people agree. | P0 |
| FR-5.3 | **Consent:** each rider must explicitly accept (or decline) sharing. Booking alone does not count as consent. | P0 |
| FR-5.4 | **Book:** a ride is booked (status `confirmed`, vehicle and driver assigned) only when at least `MIN_POOL_SIZE` (2) people have accepted. Until then the group stays `forming` and no vehicle is assigned. | P0 |
| FR-5.5 | **Join:** when someone arrives after a ride is booked, every current rider must approve before they are added. One decline rejects the request and the newcomer gets fallback options. | P0 |
| FR-5.6 | **Redistribute:** whenever a rider joins or leaves, the same ride fare is re-split among the riders and everyone is notified of their new amount. | P0 |
| FR-5.7 | If a booked ride drops below 2 people, it returns to `forming` and the remaining rider is offered fallbacks. | P1 |
| FR-5.8 | Fallbacks: widen to the nearest zone on the corridor, wait for a later arrival wave, or ride alone at the full fare. | P0 |
| FR-5.9 | Pool states: `forming`, `confirmed`, `dispatched`, `completed`, `cancelled`. | P1 |

### 3.6 Fares and Payment
| ID | Requirement | Priority |
|---|---|---|
| FR-6.1 | Whole-ride fare comes from the zone's baseline fare (config, placeholder values) times a vehicle-type multiplier (?). | P0 |
| FR-6.2 | UI shows the fare math: ride fare, number of riders, your share, solo fare and saving. Before a ride is booked, the share is an estimate that assumes 2 riders. | P0 |
| FR-6.3 | Payment method options: cash (default), Easypaisa (mock), JazzCash (mock). | P0 |
| FR-6.4 | The split is equal per seat. Shares always add up exactly to the ride fare; leftover rupees go to the earliest riders. | P0 |
| FR-6.5 | Commission is computed per rider share: platform share and operator share. | P1 |
| FR-6.6 | Optional refundable deposit; refunded on completion or flight cancellation, forfeited on no-show after the grace period. | P2 |

### 3.7 Confirmation and Notifications
| ID | Requirement | Priority |
|---|---|---|
| FR-7.1 | On booking, user receives an in-app confirmation with pool details, pickup time, booking code and QR code. | P0 |
| FR-7.2 | A WhatsApp group link (placeholder URL per pool) is shown on the confirmation. | P1 |
| FR-7.3 | Notifications are sent for: booking confirmed, pool changed, flight delayed or early, driver assigned, meeting-point instructions. | P0 |
| FR-7.4 | Notifications go through a `Notifier` interface (console and in-app for MVP; SMS/WhatsApp adapter optional). | P0 |

### 3.8 Landing Day and Ride
| ID | Requirement | Priority |
|---|---|---|
| FR-8.1 | About 60 minutes before landing, the user sees driver name, photo, vehicle plate and phone. | P0 |
| FR-8.2 | After landing, the user sees meeting point text and a landmark. | P1 |
| FR-8.3 | Driver manifest page lists passengers, seats, drop-off zones in route order, and a QR/code check-in. Invalid codes are rejected. | P0 |
| FR-8.4 | User can generate a **share link** for family showing the vehicle plate, driver name, pool status and (simulated) live location. The link works without login and can be revoked. | P0 |
| FR-8.5 | Drop-off status is marked per passenger. | P1 |

### 3.9 After the Ride
| ID | Requirement | Priority |
|---|---|---|
| FR-9.1 | User can rate driver, vehicle and ride (1 to 5) with an optional comment. | P1 |
| FR-9.2 | A **Report a safety or pricing issue** button is available on every trip screen and creates a report record. | P0 |
| FR-9.3 | A reliability score updates after each completed trip or no-show. | P2 |

### 3.10 Demo Console
| ID | Requirement | Priority |
|---|---|---|
| FR-10.1 | `/demo` page shows a map with passengers grouped into live pool clusters for a selected flight. | P0 |
| FR-10.2 | Button to seed N fake passengers (default 30) across zones and pool types. | P0 |
| FR-10.3 | Button to simulate a flight delay or early arrival (+/- minutes) and watch pools re-form. | P0 |
| FR-10.4 | Button to reset the demo data. | P1 |
| FR-10.5 | Panel showing metrics: match rate, average saving per passenger, vehicle fill rate. | P1 |

## 4. Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-1 | **Mobile-first.** Fully usable on a 360 px wide screen. Tested on a low-end Android phone. |
| NFR-2 | **Performance.** Booking pages load in under 3 seconds on a slow 3G profile; matching for 300 passengers completes in under 2 seconds. |
| NFR-3 | **Load.** Handles 300 simultaneous users booking for one flight without errors (simulated). |
| NFR-4 | **Language.** English for the MVP; UI copy structured for translation so Urdu can be added. Right-to-left support is a roadmap item. |
| NFR-5 | **Privacy.** Store the minimum personal data. Share links expose only plate, driver name and status, never the passenger's phone number. Row-level security on all user data. |
| NFR-6 | **Security.** No secrets in the repo. Service-role key used server-side only. Input validation on every API route. Rate-limit OTP and booking endpoints. |
| NFR-7 | **Reliability.** Re-matching is idempotent and never leaves a confirmed passenger without a seat. |
| NFR-8 | **Accessibility.** Readable contrast, tap targets of at least 44 px, form errors announced in text. |
| NFR-9 | **Transparency.** Every price shows its basis and an "as of" date. All placeholder figures are labelled in the UI when `DEMO_MODE=true`. |
| NFR-10 | **Maintainability.** Matching, fares, zones, flights, payments and notifications are separate modules behind interfaces. Business parameters live in config, not in code. |

## 5. Data Requirements

### 5.1 Tables

```
users            id, phone, name, gender, emergency_contact, verified, reliability_score, created_at
flights          id, flight_no, airline, origin, airport_code, scheduled_arrival, estimated_arrival, terminal, status
zones            id, airport_code, name, corridor_id, lat, lng, order_in_corridor, active
corridors        id, airport_code, name
zone_fares       id, zone_id, seat_fare_pkr (indicative lowest share), solo_fare_pkr (whole ride, one rider, car), as_of_date
vehicles         id, operator_id, plate, vehicle_type (rickshaw|car|van), capacity, model, active
drivers          id, operator_id, name, phone, photo_url, verified
operators        id, name, license_no, contact
bookings         id, user_id, flight_id, zone_id, dest_lat, dest_lng, seats, luggage, pool_type,
                 share_consent (pending|accepted|declined), status (pending until the ride is booked),
                 pool_id, seat_fare_pkr (current share per seat), platform_fee_pkr, operator_fee_pkr,
                 payment_method, payment_status, booking_code, created_at
pool_join_votes  id, pool_id, joiner_booking_id, voter_booking_id, vote (pending|approved|declined)
pools            id, ride_fare_pkr, flight_id, vehicle_id, driver_id, pool_type, corridor_id, pickup_time,
                 meeting_point, whatsapp_link, status
share_links      id, booking_id, token, expires_at, revoked
ratings          id, booking_id, driver_score, vehicle_score, comment
reports          id, booking_id, type, description, status, created_at
notifications    id, user_id, booking_id, type, body, read, created_at
```

### 5.2 Seed Data (placeholders, flagged with (?))

**Zones (Karachi)** with corridor and order from the airport. Verify before use.

| Corridor | Zones in order from airport |
|---|---|
| Shahrah-e-Faisal | PECHS, Tariq Road area, Saddar (?) |
| Korangi / Defence | DHA Phase 1-8, Clifton (?) |
| University Road | Gulshan-e-Iqbal, Johar (?) |

**Per-seat fares (?)**: DHA, Clifton, Gulshan. Use placeholders such as Rs 700 per seat versus Rs 2,500 solo, and label them as unverified. Replace with real operator quotes and current ride-hailing prices.

**Demo flight:** one flight landing at night with 30 seeded passengers across zones and pool types.

## 6. Matching Rules

**Inputs:** bookings for one flight (each with seats, zone, pool type and consent), available vehicles, config (`VEHICLE_CAPACITY`, `MIN_POOL_SIZE`, `MATCH_WINDOW_MINUTES`).

**The life of a shared ride**
1. **Connect.** Riders are grouped by pool type, then corridor, then ordered by zone along the corridor. A group is a *proposal* (`forming`).
2. **Agree.** Each rider accepts or declines. Declined riders are never grouped and are offered fallbacks.
3. **Book.** When the accepted riders in a group total at least `MIN_POOL_SIZE` (2) people, the ride is `confirmed` and the smallest free vehicle that fits them (rickshaw, car or van) is assigned. The ride fare is split among the accepted riders only.
4. **Join.** Anyone else in the group, or anyone who arrives later on the same corridor and pool type, becomes a **join request** if the vehicle has room. Every current rider must approve. When all approve and the newcomer has accepted, they are added and the fare is redistributed.
5. **Leave.** If a rider cancels, the fare is re-split among those left. If fewer than 2 people remain, the ride returns to `forming`.

**Rules**
1. **Pool type isolation.** Women-only and family-only bookings only match within the same pool type.
2. **Corridor grouping and zone order.** Drop-offs follow `order_in_corridor` so the vehicle follows one route.
3. **Capacity.** A booking consumes `seats` units. A ride never exceeds its vehicle's capacity, and a booking is never split across vehicles.
4. **Consent before booking.** No ride is booked, and no vehicle is assigned, until `MIN_POOL_SIZE` people have accepted.
5. **Unanimous join.** One decline from any current rider rejects a newcomer.
6. **Stability.** A booked ride never loses a rider because of a re-run of the engine. Riders only leave by cancelling or by being declined before they join.
7. **Whole-ride fare.** `ride_fare = max(rider baseline fares) x vehicle multiplier`. It does not change when riders join, only the split changes (a farther newcomer can raise the base fare, which is then shown to everyone in the join request).
8. **Fare guarantee.** With 2 or more riders, each share is lower than riding alone. Riding alone is always an option at the full fare.
9. **Fallbacks** for riders who are not in a booked ride: (a) nearest zone on the same corridor, (b) a later pickup window, (c) a solo ride at the full fare.

**Edge cases that must be tested**
- One rider alone.
- Two riders connected but nobody has agreed yet (no ride booked).
- One accepted and one pending (still not booked).
- Two riders accept: ride booked, shares add up to the ride fare.
- Vehicle choice: 2 riders get a rickshaw, 4 a car, 6 a van.
- A newcomer joins a booked ride: both riders must approve; the fare is then re-split.
- A newcomer when the vehicle is full: no join request.
- A rider leaves and the ride drops below 2 people.
- A rider who declines is never grouped.
- Women-only and open riders never share a ride.
- Flight cancelled after a ride is booked.
- 300 bookings on one flight.

## 7. Fare Rules

- `ride_fare` = baseline solo fare of the farthest rider's zone x vehicle multiplier (rickshaw 0.6, car 1.0, van 1.6 (?)).
- `share_per_seat = ride_fare / total_seats`, with leftover rupees given one at a time to the earliest riders, so shares always add up exactly.
- `total = share_per_seat x seats` for each booking.
- `platform_fee = round(total x COMMISSION_RATE)` (rate is a placeholder (?)). `operator_fee = total - platform_fee`.
- `saving = solo_fare - total`, shown to the user.
- **Before a ride is booked** the displayed amount is an estimate that assumes the minimum 2 riders. It is updated when the ride is booked and whenever a rider joins or leaves.
- All values are integers in PKR. Every fare display shows an "as of" date.

## 8. API Endpoints (suggested)

| Method and path | Purpose |
|---|---|
| `POST /api/auth/otp/request` | Request OTP (demo mode: no SMS). |
| `POST /api/auth/otp/verify` | Verify OTP, create session. |
| `GET /api/flights?flightNo=&date=` | Look up a flight. |
| `GET /api/zones?airport=KHI` | List zones. |
| `POST /api/zones/resolve` | Snap a lat/lng to a zone. |
| `POST /api/bookings/quote` | Return pool preview and fare without booking. |
| `POST /api/bookings` | Create a booking (status `pending`, consent `pending`) and run matching. |
| `POST /api/bookings/:id/consent` | Accept or decline sharing. The ride is booked once 2+ people accept. |
| `GET /api/bookings/:id/share-status` | Who agreed, current share, and join votes waiting on this rider. |
| `POST /api/pools/:poolId/join-votes` | A current rider approves or declines a newcomer. |
| `GET /api/bookings/:id` | Booking details, pool, driver, QR code. |
| `POST /api/bookings/:id/cancel` | Cancel and re-match. |
| `POST /api/bookings/:id/share` | Create a family share link. |
| `DELETE /api/share/:token` | Revoke a share link. |
| `GET /api/share/:token` | Public trip status (no login). |
| `GET /api/driver/pools/:poolId` | Driver manifest. |
| `POST /api/driver/pools/:poolId/checkin` | Check in a passenger by booking code. |
| `POST /api/ratings` | Submit rating. |
| `POST /api/reports` | Submit safety or pricing report. |
| `POST /api/demo/seed` | Seed fake passengers. |
| `POST /api/demo/delay` | Simulate a flight time change. |
| `POST /api/demo/reset` | Reset demo data. |

All endpoints validate input and return consistent JSON errors with a code and a human-readable message.

## 9. Screens

1. Landing page (problem, how it works, "Book your ride").
2. Login (phone + OTP).
3. Booking wizard: flight, destination (list or map), preferences, pool and fare preview, payment, confirm.
4. Trip page: pool details, driver and vehicle, QR code, share-link button, safety-report button.
5. Public share page for family.
6. Driver manifest page.
7. Rating page.
8. Demo console with live pool map, seed, delay and reset controls.

## 10. Acceptance Criteria

The MVP is done when all of the following are true:

1. A new user can create a booking on the seeded flight in under 2 minutes, on a mobile screen, without help.
2. A booking alone never books a ride. With one person accepted, the group stays `forming` and no vehicle is assigned.
3. When a second person accepts, the ride becomes `confirmed`, a vehicle that fits is assigned, and both riders see their share of the fare.
4. The riders' shares add up exactly to the ride fare, and each share is lower than the solo fare.
5. When a third person asks to join a booked ride, both riders see an approval request. Only when both approve is the newcomer added.
6. When a newcomer joins, every rider's fare is re-split and each rider gets a notification with the new amount.
7. If any rider declines a newcomer, the newcomer is not added and sees fallback options.
8. A rider who declines sharing is never grouped with others.
9. Women-only and family-only riders never share a ride with open riders, and no ride exceeds its vehicle's capacity.
10. Cancelling a booking re-splits the fare for the remaining riders; if fewer than 2 remain, the ride returns to `forming`.
11. Simulating a +40 minute delay updates the pickup time for every affected rider.
12. The driver manifest lists riders in drop-off order and rejects an invalid booking code. A family share link works without login and shows no phone numbers.
13. All price figures display an "as of" date, and placeholder values are labelled in demo mode.
14. Unit tests for matching and fares pass; one end-to-end test completes the booking flow.

## 11. Test Plan

**Unit (Vitest)**
- Matching: all edge cases in section 6, plus property checks (never over capacity, never book without 2 accepted riders, never mix pool types, shares always add up to the ride fare).
- Fares: split adds up exactly; rounding is consistent.
- Zone resolver: pins near boundaries snap to the expected zone.

**Integration**
- Booking, cancellation and delay flows against a test database.

**End to end (Playwright)**
- Login, book, view trip, create and revoke share link.

**Manual**
- 5 to 8 people complete the flow unaided on phones. Record where they hesitate.
- Low-end Android on a throttled connection.
- Simulated planeload of 150 to 300 users.

## 12. Metrics to Capture (for the pitch)

| Metric | Why |
|---|---|
| Match rate (passengers placed in a pool) | Shows zone-based matching works. |
| Average saving versus solo fare | Core value claim. |
| Vehicle fill rate | Whether operators earn enough. |
| Booking-to-showup rate | Severity of no-shows. |
| Repeat bookings | Whether people come back. |
| Safety reports per 100 trips | Whether trust is earned. |

## 13. Out of Scope (MVP)

- Real payment processing and payouts.
- Real government ID verification.
- Native mobile apps and a full driver app.
- Other airports and non-airport events.
- Dynamic or surge pricing.
- Advanced routing optimization or machine learning.

## 14. Open Questions to Resolve with Real Data

1. What whole-ride fare do rickshaw, car and van operators accept for each zone?
2. What discount makes passengers willing to share (survey result)?
3. Which airport pickup point is permitted, and who grants permission?
4. What are the real seat capacities with luggage for rickshaws, cars and vans?
5. Should a joiner who is farther along the route be allowed to raise the fare for existing riders, or pay the difference alone?
5. Which flight data source is reliable and affordable?
6. Is a deposit needed, and what amount reduces no-shows without hurting conversion?
