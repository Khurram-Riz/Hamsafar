'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Luggage,
  MapPin,
  Navigation,
  Plane,
  Shield,
  Users,
} from 'lucide-react';
import { LeafletMap } from '@/components/LeafletMap';
import {
  FareTransparencyNote,
  PoolStatusBadge,
  PoolTypeBadge,
} from '@/components/StatusBadges';
import { formatPkr, formatPktDateTime, formatPktTimeOnly } from '@/lib/config';
import { FallbackOption, FormedPool } from '@/lib/matching/types';
import { FareBreakdown } from '@/lib/fares/calculator';
import {
  FlightRecord,
  LuggageLevel,
  PaymentMethod,
  PoolType,
  RideMode,
  UserProfile,
  ZoneWithDetails,
} from '@/types/database';

function getTodayPktDateString(): string {
  const now = new Date();
  const pkt = new Date(now.getTime() + 5 * 3600_000);
  return pkt.toISOString().slice(0, 10);
}

export default function BookRideWizardPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Step 1: Flight Lookup
  const [flightNo, setFlightNo] = useState('PK-309');
  const [flightDate, setFlightDate] = useState(getTodayPktDateString());
  const [flight, setFlight] = useState<FlightRecord | null>(null);
  const [flightLoading, setFlightLoading] = useState(false);
  const [flightError, setFlightError] = useState<string | null>(null);
  const [showManualFlight, setShowManualFlight] = useState(false);
  const [manualAirline, setManualAirline] = useState('');
  const [manualOrigin, setManualOrigin] = useState('');
  const [manualArrivalTime, setManualArrivalTime] = useState('23:30');

  // Step 2: Destination
  const [zones, setZones] = useState<ZoneWithDetails[]>([]);
  const [destMode, setDestMode] = useState<'list' | 'map'>('list');
  const [selectedZoneId, setSelectedZoneId] = useState<string>('');
  const [pickedPin, setPickedPin] = useState<{ lat: number; lng: number } | null>(null);
  const [pinNotice, setPinNotice] = useState<string | null>(null);
  const [outsideZoneWarning, setOutsideZoneWarning] = useState<{
    message: string;
    nearestZone: ZoneWithDetails | null;
  } | null>(null);
  const [addressNote, setAddressNote] = useState('');

  // Step 3: Preferences
  const [seats, setSeats] = useState<number>(1);
  const [luggage, setLuggage] = useState<LuggageLevel>('medium');
  const [poolType, setPoolType] = useState<PoolType>('open');
  const [rideMode, setRideMode] = useState<RideMode>('pool');
  const [womenSelfDeclared, setWomenSelfDeclared] = useState(false);

  // Step 4: Quote & Payment
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [fareBreakdown, setFareBreakdown] = useState<FareBreakdown | null>(null);
  const [previewPool, setPreviewPool] = useState<{
    status: FormedPool['status'];
    poolType: PoolType;
    totalSeats: number;
    capacity: number;
    minPoolSize: number;
    acceptedSeats: number;
    peopleNeeded: number;
    rideFarePkr: number;
    vehicleType: 'rickshaw' | 'car' | 'van' | null;
    estimatedSeatFarePkr: number;
    joinRequiresApproval: boolean;
    pickupTime: string;
    corridorName: string;
    zonesInRoute: Array<{ id: string; name: string; order: number }>;
  } | null>(null);
  const [fallbacks, setFallbacks] = useState<FallbackOption[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [submittingBooking, setSubmittingBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const [profileRes, zonesRes] = await Promise.all([
        fetch('/api/profile'),
        fetch('/api/zones?airport=KHI'),
      ]);

      if (profileRes.ok) {
        const pData = await profileRes.json();
        setUserProfile(pData.user || null);
      }
      setAuthChecked(true);

      if (zonesRes.ok) {
        const zData = await zonesRes.json();
        const list: ZoneWithDetails[] = zData.zones || [];
        setZones(list);
        if (list.length > 0) {
          setSelectedZoneId(list[0].id);
        }
      }
    }
    init();
  }, []);

  async function handleLookupFlight(e?: React.FormEvent, overrideNo?: string) {
    if (e) e.preventDefault();
    const targetNo = overrideNo || flightNo;
    if (overrideNo) setFlightNo(overrideNo);
    setFlightLoading(true);
    setFlightError(null);
    setShowManualFlight(false);

    try {
      const res = await fetch(
        `/api/flights?flightNo=${encodeURIComponent(targetNo)}&date=${encodeURIComponent(
          flightDate
        )}`
      );
      const data = await res.json();
      if (!res.ok) {
        setFlight(null);
        setFlightError(data?.error?.message || 'Flight not found.');
        setShowManualFlight(true);
      } else {
        setFlight(data.flight);
      }
    } catch {
      setFlightError('Network error looking up flight.');
    } finally {
      setFlightLoading(false);
    }
  }

  async function handleSaveManualFlight(e: React.FormEvent) {
    e.preventDefault();
    setFlightLoading(true);
    setFlightError(null);
    try {
      const arrivalIso = new Date(`${flightDate}T${manualArrivalTime}:00+05:00`).toISOString();
      const res = await fetch('/api/flights/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flightNo,
          airline: manualAirline || 'Other Airline',
          origin: manualOrigin || 'Origin City',
          arrivalDateTime: arrivalIso,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFlightError(data?.error?.message || 'Could not save manual flight.');
      } else {
        setFlight(data.flight);
        setShowManualFlight(false);
      }
    } catch {
      setFlightError('Network error saving manual arrival time.');
    } finally {
      setFlightLoading(false);
    }
  }

  async function handleMapPinDrop(lat: number, lng: number) {
    setPickedPin({ lat, lng });
    setOutsideZoneWarning(null);
    setPinNotice('Snapping pin to nearest Karachi corridor zone...');

    try {
      const res = await fetch('/api/zones/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng, airport: 'KHI' }),
      });
      const data = await res.json();
      if (res.ok) {
        setPinNotice(data.message);
        if (data.matched && data.zone) {
          setSelectedZoneId(data.zone.id);
          setRideMode('pool');
        } else if (data.outsideServiceArea) {
          if (data.nearestZone) {
            setSelectedZoneId(data.nearestZone.id);
          }
          setOutsideZoneWarning({
            message: data.message,
            nearestZone: data.nearestZone || null,
          });
        }
      }
    } catch {
      setPinNotice('Could not resolve map pin.');
    }
  }

  async function loadPoolAndFareQuote(overrideZoneId?: string, overrideMode?: RideMode) {
    if (!flight) return;
    const targetZoneId = overrideZoneId || selectedZoneId;
    const targetMode = overrideMode || rideMode;
    if (!targetZoneId) return;

    setQuoteLoading(true);
    setBookingError(null);
    try {
      const res = await fetch('/api/bookings/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flightId: flight.id,
          zoneId: targetZoneId,
          seats,
          poolType,
          rideMode: targetMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBookingError(data?.error?.message || 'Could not calculate quote.');
      } else {
        setFareBreakdown(data.fare);
        setPreviewPool(data.previewPool);
        setFallbacks(data.fallbacks || []);
      }
    } catch {
      setBookingError('Network error calculating pool quote.');
    } finally {
      setQuoteLoading(false);
    }
  }

  async function handleConfirmBooking() {
    if (!flight || !selectedZoneId) return;

    if (!userProfile) {
      router.push('/login?next=/book');
      return;
    }

    setSubmittingBooking(true);
    setBookingError(null);

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flightId: flight.id,
          zoneId: selectedZoneId,
          destLat: pickedPin?.lat ?? null,
          destLng: pickedPin?.lng ?? null,
          addressNote: addressNote.trim() || null,
          seats,
          luggage,
          poolType,
          rideMode,
          paymentMethod,
          womenSelfDeclared,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/login?next=/book');
          return;
        }
        setBookingError(data?.error?.message || 'Booking failed.');
      } else {
        router.push(`/trip/${data.booking.id}`);
      }
    } catch {
      setBookingError('Network error completing booking.');
    } finally {
      setSubmittingBooking(false);
    }
  }

  const selectedZone = zones.find((z) => z.id === selectedZoneId) || null;
  const isFemaleEligible = userProfile?.gender === 'female' || womenSelfDeclared;

  const stepLabels = [
    { num: 1, title: 'Flight' },
    { num: 2, title: 'Destination' },
    { num: 3, title: 'Preferences' },
    { num: 4, title: 'Pool & Pay' },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10">
      {/* Stepper Indicator */}
      <nav aria-label="Booking progress" className="mb-6">
        <ol className="grid grid-cols-4 gap-2">
          {stepLabels.map((s) => {
            const active = step === s.num;
            const done = step > s.num;
            return (
              <li
                key={s.num}
                className={`rounded-xl px-2.5 py-2 text-center border text-xs font-bold transition ${
                  active
                    ? 'bg-brand-700 text-white border-brand-700 shadow-sm'
                    : done
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-white text-slate-400 border-slate-200'
                }`}
              >
                <span className="block text-[10px] opacity-80">Step {s.num}</span>
                <span>{s.title}</span>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* STEP 1: FLIGHT LOOKUP */}
      {step === 1 && (
        <section className="rounded-3xl bg-white p-5 sm:p-7 border border-slate-200 shadow-sm space-y-5">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
              Which flight are you landing on?
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              We sync your pickup window to your Jinnah International (KHI) arrival time.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500 mr-1">
              Seeded KHI flights:
            </span>
            {['PK-309', 'EK-606', 'QR-610', 'PA-201'].map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => handleLookupFlight(undefined, code)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border min-h-[36px] ${
                  flightNo === code
                    ? 'bg-brand-50 border-brand-600 text-brand-800'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {code}
              </button>
            ))}
          </div>

          <form onSubmit={handleLookupFlight} className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-600 mb-1">
                Flight Number
              </label>
              <input
                type="text"
                required
                value={flightNo}
                onChange={(e) => setFlightNo(e.target.value.toUpperCase())}
                placeholder="PK-309"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-3 text-sm font-bold uppercase min-h-[48px]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-600 mb-1">
                Arrival Date
              </label>
              <input
                type="date"
                required
                value={flightDate}
                onChange={(e) => setFlightDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-3 text-sm min-h-[48px]"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={flightLoading}
                className="w-full rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-4 text-sm min-h-[48px]"
              >
                {flightLoading ? 'Looking up...' : 'Find Flight'}
              </button>
            </div>
          </form>

          {flightError && (
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-900 space-y-2">
              <p className="font-semibold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{flightError}</span>
              </p>
            </div>
          )}

          {showManualFlight && (
            <form
              onSubmit={handleSaveManualFlight}
              className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-3"
            >
              <p className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Manual Arrival Time Entry (Flagged Unverified)
              </p>
              <div className="grid sm:grid-cols-3 gap-2.5">
                <input
                  type="text"
                  value={manualAirline}
                  onChange={(e) => setManualAirline(e.target.value)}
                  placeholder="Airline (e.g. SereneAir)"
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs min-h-[44px]"
                />
                <input
                  type="text"
                  value={manualOrigin}
                  onChange={(e) => setManualOrigin(e.target.value)}
                  placeholder="Origin (e.g. Lahore)"
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs min-h-[44px]"
                />
                <input
                  type="time"
                  required
                  value={manualArrivalTime}
                  onChange={(e) => setManualArrivalTime(e.target.value)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs min-h-[44px]"
                />
              </div>
              <button
                type="submit"
                disabled={flightLoading}
                className="rounded-xl bg-brand-700 text-white text-xs font-bold px-4 py-2.5 min-h-[44px]"
              >
                Use Manual Arrival Time
              </button>
            </form>
          )}

          {flight && (
            <div className="rounded-2xl bg-emerald-50/70 border border-emerald-200 p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Plane className="w-5 h-5 text-brand-700" />
                  <div>
                    <p className="font-extrabold text-base text-slate-900">
                      {flight.flight_no} · {flight.airline}
                    </p>
                    <p className="text-xs text-slate-600">
                      From {flight.origin} → {flight.terminal}
                    </p>
                  </div>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    flight.verified
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {flight.verified ? flight.status.toUpperCase() : 'UNVERIFIED MANUAL'}
                </span>
              </div>
              <p className="text-xs text-slate-700 pt-1">
                Scheduled Arrival:{' '}
                <strong>{formatPktDateTime(flight.estimated_arrival)} PKT</strong>
              </p>
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              disabled={!flight}
              onClick={() => setStep(2)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-brand-700 hover:bg-brand-800 disabled:opacity-40 text-white font-bold px-6 py-3.5 text-sm min-h-[48px]"
            >
              <span>Choose Destination</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>
      )}

      {/* STEP 2: DESTINATION ZONE OR MAP PIN */}
      {step === 2 && (
        <section className="rounded-3xl bg-white p-5 sm:p-7 border border-slate-200 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                Where in Karachi are you heading?
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                Pick a corridor zone or drop a pin on the map to snap automatically.
              </p>
            </div>

            <div className="inline-flex rounded-xl bg-slate-100 p-1 self-start">
              <button
                type="button"
                onClick={() => setDestMode('list')}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold min-h-[40px] ${
                  destMode === 'list'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600'
                }`}
              >
                Zone List
              </button>
              <button
                type="button"
                onClick={() => setDestMode('map')}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold min-h-[40px] flex items-center gap-1 ${
                  destMode === 'map'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600'
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>Drop Pin on Map</span>
              </button>
            </div>
          </div>

          {destMode === 'list' ? (
            <div className="grid sm:grid-cols-2 gap-3">
              {zones.map((z) => {
                const selected = z.id === selectedZoneId;
                return (
                  <button
                    key={z.id}
                    type="button"
                    onClick={() => {
                      setSelectedZoneId(z.id);
                      setOutsideZoneWarning(null);
                      setRideMode('pool');
                    }}
                    className={`text-left rounded-2xl p-4 border transition min-h-[76px] ${
                      selected
                        ? 'border-brand-600 bg-brand-50/60 ring-2 ring-brand-600/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span
                          className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mb-1"
                          style={{
                            backgroundColor: `${z.corridor.color}18`,
                            color: z.corridor.color,
                          }}
                        >
                          {z.corridor.name}
                        </span>
                        <p className="font-extrabold text-sm text-slate-900">
                          {z.name}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-extrabold text-sm text-brand-700 tabular-nums">
                          {formatPkr(z.fare.seat_fare_pkr)}
                        </p>
                        <p className="text-[11px] text-slate-400 line-through">
                          {formatPkr(z.fare.solo_fare_pkr)}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              <LeafletMap
                mode="picker"
                heightClass="h-72 sm:h-80"
                zones={zones}
                selectedZoneId={selectedZoneId}
                pickedPin={pickedPin}
                onPickLocation={handleMapPinDrop}
              />

              {pinNotice && (
                <div className="rounded-xl bg-slate-100 px-3.5 py-2.5 text-xs font-medium text-slate-800 flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-brand-700 shrink-0" />
                  <span>{pinNotice}</span>
                </div>
              )}

              {outsideZoneWarning && (
                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-950 space-y-2.5">
                  <p className="font-semibold">{outsideZoneWarning.message}</p>
                  <div className="flex flex-wrap gap-2">
                    {outsideZoneWarning.nearestZone && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedZoneId(outsideZoneWarning.nearestZone!.id);
                          setRideMode('pool');
                          setOutsideZoneWarning(null);
                        }}
                        className="rounded-xl bg-brand-700 text-white px-3.5 py-2 font-bold min-h-[40px]"
                      >
                        Snap to {outsideZoneWarning.nearestZone.name} (Shared)
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setRideMode('solo');
                        setOutsideZoneWarning(null);
                      }}
                      className="rounded-xl bg-slate-900 text-white px-3.5 py-2 font-bold min-h-[40px]"
                    >
                      Request Solo Fixed-Fare Ride
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-600 mb-1">
              Optional Landmark / Drop-off Note for Driver
            </label>
            <input
              type="text"
              maxLength={200}
              value={addressNote}
              onChange={(e) => setAddressNote(e.target.value)}
              placeholder="e.g. Near Bukhari Commercial Lane 4, main gate"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm min-h-[44px]"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-4 py-3 rounded-xl border border-slate-300 text-sm font-bold text-slate-700 min-h-[48px] inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <button
              type="button"
              disabled={!selectedZoneId}
              onClick={() => setStep(3)}
              className="flex-1 rounded-xl bg-brand-700 hover:bg-brand-800 disabled:opacity-40 text-white font-bold py-3 text-sm min-h-[48px] inline-flex items-center justify-center gap-2"
            >
              <span>Set Seats &amp; Pool Type</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>
      )}

      {/* STEP 3: PREFERENCES */}
      {step === 3 && (
        <section className="rounded-3xl bg-white p-5 sm:p-7 border border-slate-200 shadow-sm space-y-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
              Seats, Luggage &amp; Comfort Pool
            </h1>
            <p className="text-sm text-slate-600 mt-0.5">
              Customize your ride preferences before we preview your shared ride.
            </p>
          </div>

          {/* Seats (1 to 4) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-700 mb-2">
              Number of Seats (1 to 4)
            </label>
            <div className="grid grid-cols-4 gap-2.5">
              {[1, 2, 3, 4].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    setSeats(n);
                    if (poolType === 'family_only' && n < 2) {
                      setPoolType('open');
                    }
                  }}
                  className={`rounded-xl py-3 text-base font-extrabold border min-h-[48px] transition ${
                    seats === n
                      ? 'bg-brand-700 text-white border-brand-700'
                      : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {n} {n === 1 ? 'Seat' : 'Seats'}
                </button>
              ))}
            </div>
          </div>

          {/* Luggage */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-700 mb-2">
              <Luggage className="w-4 h-4 inline mr-1 text-slate-500" />
              Luggage Level
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {(
                [
                  { id: 'light', title: 'Light', sub: 'Cabin bag' },
                  { id: 'medium', title: 'Medium', sub: '1 suitcase' },
                  { id: 'heavy', title: 'Heavy', sub: '2+ large bags' },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setLuggage(item.id)}
                  className={`rounded-xl p-3 border text-left min-h-[56px] ${
                    luggage === item.id
                      ? 'border-brand-600 bg-brand-50 text-brand-900'
                      : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  <span className="block text-xs font-extrabold">{item.title}</span>
                  <span className="block text-[11px] text-slate-500">{item.sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Pool Type */}
          <div className="space-y-2.5">
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-700">
              <Users className="w-4 h-4 inline mr-1 text-slate-500" />
              Pool Type
            </label>

            {(
              [
                {
                  id: 'open',
                  title: 'Open Shared Pool',
                  desc: 'Match with any verified passenger heading along your corridor.',
                  disabled: false,
                },
                {
                  id: 'women_only',
                  title: 'Women-Only Pool',
                  desc: 'Strictly isolated ride for female passengers only.',
                  disabled: false,
                },
                {
                  id: 'family_only',
                  title: 'Family-Only Pool (Requires 2+ seats)',
                  desc: 'Matched exclusively with families or groups of 2+ traveling together.',
                  disabled: seats < 2,
                },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                disabled={opt.disabled}
                onClick={() => {
                  setPoolType(opt.id);
                  setRideMode('pool');
                }}
                className={`w-full text-left rounded-2xl p-4 border transition min-h-[64px] ${
                  opt.disabled
                    ? 'opacity-45 cursor-not-allowed bg-slate-50 border-slate-200'
                    : poolType === opt.id
                    ? 'border-brand-600 bg-brand-50/70 ring-2 ring-brand-600/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-900">{opt.title}</span>
                  <PoolTypeBadge poolType={opt.id} />
                </div>
                <p className="text-xs text-slate-600 mt-1">{opt.desc}</p>
              </button>
            ))}

            {poolType === 'women_only' && !isFemaleEligible && (
              <label className="flex items-start gap-2.5 rounded-xl bg-fuchsia-50 border border-fuchsia-200 p-3 text-xs text-fuchsia-950 cursor-pointer">
                <input
                  type="checkbox"
                  checked={womenSelfDeclared}
                  onChange={(e) => setWomenSelfDeclared(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-fuchsia-700"
                />
                <span>
                  I confirm I am a female traveler (or booking exclusively for female travelers). This updates your profile preference for Women-Only pool verification.
                </span>
              </label>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="px-4 py-3 rounded-xl border border-slate-300 text-sm font-bold text-slate-700 min-h-[48px] inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <button
              type="button"
              disabled={poolType === 'women_only' && !isFemaleEligible}
              onClick={async () => {
                setStep(4);
                await loadPoolAndFareQuote();
              }}
              className="flex-1 rounded-xl bg-brand-700 hover:bg-brand-800 disabled:opacity-40 text-white font-bold py-3 text-sm min-h-[48px] inline-flex items-center justify-center gap-2"
            >
              <span>Preview Pool &amp; Fare</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>
      )}

      {/* STEP 4: POOL & FARE PREVIEW + PAYMENT + CONFIRM */}
      {step === 4 && (
        <section className="rounded-3xl bg-white p-5 sm:p-7 border border-slate-200 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                Your Pool &amp; Fare Breakdown
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                {flight?.flight_no} → {selectedZone?.name}
              </p>
            </div>
            {previewPool && <PoolStatusBadge status={previewPool.status} />}
          </div>

          {quoteLoading ? (
            <div className="py-10 text-center text-sm text-slate-500">
              Finding riders on your route and calculating your share...
            </div>
          ) : (
            <>
              {/* Live Pool Preview Card */}
              {previewPool && (
                <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-brand-700">
                        {previewPool.corridorName}
                      </p>
                      <p className="text-sm font-extrabold text-slate-900 mt-0.5">
                        {previewPool.totalSeats} {previewPool.totalSeats === 1 ? 'person' : 'people'} matched on this route
                        {previewPool.joinRequiresApproval
                          ? ' · a ride is already booked, so current riders must approve you'
                          : ' · the ride is booked once at least 2 people agree to share'}
                      </p>
                    </div>
                    <PoolTypeBadge poolType={previewPool.poolType} />
                  </div>

                  <div className="text-xs text-slate-600 space-y-1">
                    <p>
                      <strong>Pickup Window:</strong>{' '}
                      {formatPktTimeOnly(previewPool.pickupTime)} PKT (Arrival + 45 min)
                    </p>
                    <p>
                      <strong>Drop-off Route Order:</strong>{' '}
                      KHI Airport →{' '}
                      {previewPool.zonesInRoute.map((z) => z.name).join(' → ')}
                    </p>
                  </div>
                </div>
              )}

              {/* Fallbacks if pool is still forming */}
              {fallbacks.length > 0 && rideMode === 'pool' && (
                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 space-y-2.5">
                  <p className="text-xs font-bold text-amber-950">
                    Fewer than 2 people have agreed to share so far. You can book now and we will notify you as riders match, or pick a fallback:
                  </p>
                  <div className="space-y-2">
                    {fallbacks.map((fb) => (
                      <div
                        key={fb.type}
                        className="rounded-xl bg-white border border-amber-200 p-3 flex items-center justify-between gap-2 text-xs"
                      >
                        <div>
                          <p className="font-bold text-slate-900">{fb.title}</p>
                          <p className="text-slate-600 mt-0.5">{fb.description}</p>
                        </div>
                        {fb.type === 'nearest_corridor_zone' && fb.suggestedZoneId && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedZoneId(fb.suggestedZoneId!);
                              loadPoolAndFareQuote(fb.suggestedZoneId!, 'pool');
                            }}
                            className="shrink-0 rounded-lg bg-brand-700 text-white px-3 py-2 font-bold min-h-[36px]"
                          >
                            Switch Zone
                          </button>
                        )}
                        {fb.type === 'solo_fixed_fare' && (
                          <button
                            type="button"
                            onClick={() => {
                              setRideMode('solo');
                              loadPoolAndFareQuote(selectedZoneId, 'solo');
                            }}
                            className="shrink-0 rounded-lg bg-slate-900 text-white px-3 py-2 font-bold min-h-[36px]"
                          >
                            Switch Solo
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {rideMode === 'pool' && (
                <div className="rounded-2xl bg-sky-50 border border-sky-200 p-4 text-xs text-sky-950 space-y-1">
                  <p className="font-bold">How sharing works</p>
                  <p>
                    You will be asked to agree once we connect you with other riders. The ride is booked only when at least 2
                    people agree, and the ride fare is split between them. If someone new wants to join later, everyone
                    approves first and the fare is re-split. The amount below assumes 2 riders and gets cheaper with more.
                  </p>
                </div>
              )}

              {/* Fare Math Card */}
              {fareBreakdown && (
                <div className="rounded-2xl bg-emerald-50/70 border border-emerald-200 p-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">
                      {fareBreakdown.rideMode === 'solo'
                        ? 'Fixed Solo Vehicle Fare'
                        : `Your share (${formatPkr(
                            fareBreakdown.rideFarePkr
                          )} ride ÷ ${fareBreakdown.ridersSeats} riders)`}
                    </span>
                    <span className="font-extrabold text-lg text-slate-900 tabular-nums">
                      {formatPkr(fareBreakdown.totalFarePkr)}
                    </span>
                  </div>

                  {fareBreakdown.savingPkr > 0 && (
                    <div className="flex items-center justify-between text-xs text-emerald-800 pt-1 border-t border-emerald-200/70">
                      <span>
                        Compared to solo cab ({formatPkr(fareBreakdown.soloComparisonTotalPkr)})
                      </span>
                      <span className="font-extrabold">
                        You Save {formatPkr(fareBreakdown.savingPkr)} ({fareBreakdown.savingPercent}%)
                      </span>
                    </div>
                  )}

                  <FareTransparencyNote
                    asOfDate={fareBreakdown.asOfDate}
                    isPlaceholder={fareBreakdown.isPlaceholder}
                  />
                </div>
              )}

              {/* Payment Method */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-700 mb-2">
                  <CreditCard className="w-4 h-4 inline mr-1 text-slate-500" />
                  Payment Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'cash', label: 'Cash (Default)', sub: 'Pay at boarding' },
                      { id: 'easypaisa', label: 'Easypaisa', sub: 'Simulated wallet' },
                      { id: 'jazzcash', label: 'JazzCash', sub: 'Simulated wallet' },
                    ] as const
                  ).map((pm) => (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => setPaymentMethod(pm.id)}
                      className={`rounded-xl p-3 border text-left min-h-[56px] ${
                        paymentMethod === pm.id
                          ? 'border-brand-600 bg-brand-50 text-brand-900'
                          : 'border-slate-200 bg-white text-slate-700'
                      }`}
                    >
                      <span className="block text-xs font-extrabold">{pm.label}</span>
                      <span className="block text-[10px] text-slate-500">{pm.sub}</span>
                    </button>
                  ))}
                </div>
              </div>

              {authChecked && !userProfile && (
                <div className="rounded-xl bg-sky-50 border border-sky-200 p-3 text-xs text-sky-900 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-sky-700 shrink-0" />
                  <span>
                    You&apos;ll be asked to verify your +92 mobile number with a 1-step OTP before your seat is locked in.
                  </span>
                </div>
              )}

              {bookingError && (
                <p role="alert" className="text-xs font-semibold text-rose-600 bg-rose-50 p-3 rounded-xl">
                  {bookingError}
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="px-4 py-3 rounded-xl border border-slate-300 text-sm font-bold text-slate-700 min-h-[48px] inline-flex items-center gap-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  disabled={submittingBooking}
                  onClick={handleConfirmBooking}
                  className="flex-1 rounded-xl bg-brand-700 hover:bg-brand-800 disabled:opacity-50 text-white font-extrabold py-3.5 text-sm min-h-[48px] inline-flex items-center justify-center gap-2 shadow-md"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {submittingBooking
                      ? 'Confirming Seat...'
                      : userProfile
                      ? 'Confirm & Get Boarding QR'
                      : 'Sign In & Confirm Seat'}
                  </span>
                </button>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
