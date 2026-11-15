'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Check, Users, X } from 'lucide-react';
import { formatPkr } from '@/lib/config';

interface ShareStatus {
  consent: 'pending' | 'accepted' | 'declined';
  bookingStatus: string;
  seatFarePkr: number;
  totalFarePkr: number;
  soloFarePkr: number;
  ride: {
    poolId: string;
    booked: boolean;
    vehicleType: 'rickshaw' | 'car' | 'van' | null;
    rideFarePkr: number;
    acceptedSeats: number;
    minPeople: number;
    peopleNeeded: number;
    members: { label: string; seats: number; agreed: boolean; isMe: boolean }[];
  } | null;
  votesNeeded: {
    poolId: string;
    joinerBookingId: string;
    joinerSeats: number;
    joinerZone: string;
    projectedSeatFarePkr: number | null;
    projectedRiders: number;
  }[];
  joinRequest: { approved: number; total: number } | null;
}

const VEHICLE_LABEL = { rickshaw: 'Rickshaw', car: 'Car', van: 'Van' } as const;

/**
 * Sharing flow for a booking:
 *  1. we connect you with riders heading your way,
 *  2. you accept sharing; the ride is booked once 2+ people have accepted,
 *  3. the whole-ride fare is split between riders,
 *  4. if someone new asks to join, every current rider approves first and the fare is re-split.
 */
export function ShareRidePanel({ bookingId }: { bookingId: string }) {
  const [s, setS] = useState<ShareStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/bookings/${bookingId}/share-status`);
    if (res.ok) setS(await res.json());
  }, [bookingId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);

  async function post(url: string, body: unknown) {
    setBusy(true);
    setError(null);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      setError(j?.error?.message || j?.message || 'Something went wrong. Please try again.');
    }
    setBusy(false);
    await load();
  }

  if (!s) return null;
  const ride = s.ride;
  const saving = Math.max(0, s.soloFarePkr - s.totalFarePkr);

  return (
    <section className="rounded-3xl bg-white p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4">
      <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
        <Users className="w-5 h-5 text-brand-700" />
        <span>Sharing this ride</span>
      </h2>

      {/* Step 1-2: connected, waiting for agreement */}
      {s.consent === 'pending' && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 space-y-3 text-sm">
          <p className="font-bold text-amber-950">
            {ride && ride.members.length > 1
              ? `${ride.members.length} people are heading your way.`
              : 'We are looking for riders heading your way.'}
          </p>
          <p className="text-slate-700 text-xs">
            Do you agree to ride together? Nothing is booked until at least 2 people agree. The ride fare is shared
            between everyone, so your price depends on how many people ride.
          </p>
          <div className="flex gap-2">
            <button
              disabled={busy}
              onClick={() => post(`/api/bookings/${bookingId}/consent`, { decision: 'accepted' })}
              className="rounded-xl bg-emerald-700 text-white px-4 py-2.5 text-xs font-bold min-h-[44px] disabled:opacity-50"
            >
              Yes, I agree to share
            </button>
            <button
              disabled={busy}
              onClick={() => post(`/api/bookings/${bookingId}/consent`, { decision: 'declined' })}
              className="rounded-xl border border-slate-300 bg-white text-slate-800 px-4 py-2.5 text-xs font-bold min-h-[44px] disabled:opacity-50"
            >
              No thanks
            </button>
          </div>
        </div>
      )}

      {s.consent === 'declined' && (
        <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 text-xs text-slate-700 space-y-2">
          <p className="font-bold text-slate-900">You are not sharing this ride.</p>
          <button
            disabled={busy}
            onClick={() => post(`/api/bookings/${bookingId}/consent`, { decision: 'accepted' })}
            className="rounded-xl bg-brand-700 text-white px-4 py-2.5 font-bold min-h-[44px]"
          >
            Look for riders again
          </button>
        </div>
      )}

      {/* Waiting for the minimum number of people */}
      {s.consent === 'accepted' && ride && !ride.booked && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-950">
          <p className="font-bold">
            Waiting for {Math.max(1, ride.peopleNeeded)} more {ride.peopleNeeded <= 1 ? 'person' : 'people'} to agree.
          </p>
          <p className="mt-1">The ride is booked automatically as soon as {ride.minPeople} people have agreed.</p>
        </div>
      )}

      {/* Join request that I sent to an already booked ride */}
      {s.joinRequest && (
        <div className="rounded-2xl bg-sky-50 border border-sky-200 p-4 text-xs text-sky-950">
          <p className="font-bold">Asking to join a booked ride</p>
          <p className="mt-1">
            {s.joinRequest.approved} of {s.joinRequest.total} riders have approved. You join once everyone agrees.
          </p>
        </div>
      )}

      {/* Ride booked: members + fare */}
      {ride?.booked && s.consent === 'accepted' && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 space-y-2 text-xs">
          <p className="font-extrabold text-emerald-900 text-sm">
            Ride booked · {ride.acceptedSeats} people
            {ride.vehicleType ? ` · ${VEHICLE_LABEL[ride.vehicleType]}` : ''}
          </p>
          <p className="text-slate-700">
            Ride fare {formatPkr(ride.rideFarePkr)} split between riders. Your share:{' '}
            <strong className="text-slate-900">{formatPkr(s.totalFarePkr)}</strong>
            {saving > 0 && <> (you save {formatPkr(saving)} vs riding alone)</>}
          </p>
          <p className="text-slate-600">Your share changes automatically if a rider joins or leaves.</p>
        </div>
      )}

      {ride && ride.members.length > 0 && (
        <ul className="flex flex-wrap gap-2 text-xs">
          {ride.members.map((m, i) => (
            <li
              key={i}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-semibold ${
                m.agreed ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              {m.agreed ? <Check className="w-3 h-3" /> : null}
              {m.label}
              {m.seats > 1 ? ` ×${m.seats}` : ''}
              {!m.agreed && ' (deciding)'}
            </li>
          ))}
        </ul>
      )}

      {/* Someone new wants to join: every current rider votes */}
      {s.votesNeeded.map((v) => (
        <div key={v.joinerBookingId} className="rounded-2xl bg-sky-50 border border-sky-200 p-4 space-y-3 text-xs">
          <p className="font-extrabold text-sky-950 text-sm">A new rider wants to join</p>
          <p className="text-slate-700">
            Going to {v.joinerZone} ({v.joinerSeats} seat{v.joinerSeats > 1 ? 's' : ''}). If everyone agrees, {v.projectedRiders}{' '}
            people will share
            {v.projectedSeatFarePkr ? ` and the fare drops to about ${formatPkr(v.projectedSeatFarePkr)} per seat.` : '.'}
          </p>
          <div className="flex gap-2">
            <button
              disabled={busy}
              onClick={() => post(`/api/pools/${v.poolId}/join-votes`, { joinerBookingId: v.joinerBookingId, vote: 'approved' })}
              className="rounded-xl bg-emerald-700 text-white px-4 py-2.5 font-bold min-h-[44px] disabled:opacity-50"
            >
              Approve
            </button>
            <button
              disabled={busy}
              onClick={() => post(`/api/pools/${v.poolId}/join-votes`, { joinerBookingId: v.joinerBookingId, vote: 'declined' })}
              className="rounded-xl border border-slate-300 bg-white text-slate-800 px-4 py-2.5 font-bold min-h-[44px] inline-flex items-center gap-1 disabled:opacity-50"
            >
              <X className="w-3.5 h-3.5" /> Decline
            </button>
          </div>
        </div>
      ))}

      {error && <p className="text-xs font-semibold text-rose-700">{error}</p>}
    </section>
  );
}
