'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  CheckCircle2,
  ClipboardCheck,
  MapPin,
  QrCode,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import {
  BookingStatusBadge,
  PoolStatusBadge,
  PoolTypeBadge,
} from '@/components/StatusBadges';
import { formatPkr, formatPktDateTime } from '@/lib/config';

interface ManifestPassenger {
  id: string;
  booking_code: string;
  seats: number;
  luggage: string;
  pool_type: string;
  status: string;
  address_note: string | null;
  total_fare_pkr: number;
  payment_method: string;
  payment_status: string;
  user: { name: string | null; phone: string; verified: boolean } | null;
  zone: { id: string; name: string; order_in_corridor: number } | null;
}

interface ManifestPool {
  id: string;
  pool_type: string;
  status: string;
  pickup_time: string;
  meeting_point: string;
  flight: { flight_no: string; airline: string; terminal: string } | null;
  corridor: { name: string } | null;
  vehicle: { plate: string; model: string; capacity: number } | null;
  driver: { name: string; phone: string } | null;
}

export default function DriverManifestPage() {
  const params = useParams<{ poolId: string }>();
  const [pool, setPool] = useState<ManifestPool | null>(null);
  const [manifest, setManifest] = useState<ManifestPassenger[]>([]);
  const [loading, setLoading] = useState(true);

  const [codeInput, setCodeInput] = useState('');
  const [checkingIn, setCheckingIn] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const loadManifest = useCallback(async () => {
    try {
      const res = await fetch(`/api/driver/pools/${params.poolId}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        setPool(data.pool);
        setManifest(data.manifest || []);
      }
    } finally {
      setLoading(false);
    }
  }, [params.poolId]);

  useEffect(() => {
    loadManifest();
  }, [loadManifest]);

  async function submitAction(bookingCode: string, action: 'checkin' | 'dropoff') {
    setCheckingIn(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/driver/pools/${params.poolId}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingCode, action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({
          type: 'error',
          text: data?.error?.message || 'Invalid booking code.',
        });
      } else {
        setFeedback({
          type: 'success',
          text: data.message,
        });
        setCodeInput('');
        await loadManifest();
      }
    } catch {
      setFeedback({
        type: 'error',
        text: 'Network error updating passenger status.',
      });
    } finally {
      setCheckingIn(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center text-sm text-slate-500">
        Loading driver manifest...
      </div>
    );
  }

  if (!pool) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 text-center text-sm font-semibold text-rose-600">
        Pool manifest not found.
      </div>
    );
  }

  const totalSeats = manifest.reduce((s, p) => s + p.seats, 0);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10 space-y-5">
      {/* Header Card */}
      <section className="rounded-3xl bg-slate-900 text-white p-5 sm:p-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
              Driver Boarding Manifest
            </span>
            <h1 className="text-xl font-extrabold mt-0.5">
              {pool.corridor?.name} · {pool.flight?.flight_no}
            </h1>
          </div>
          <div className="flex items-center gap-1.5">
            <PoolTypeBadge poolType={pool.pool_type} />
            <PoolStatusBadge status={pool.status} />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 text-xs text-slate-300">
          <div>
            <span className="block text-slate-400">Vehicle</span>
            <strong className="text-white font-mono">
              {pool.vehicle?.plate || 'TBD'}
            </strong>
          </div>
          <div>
            <span className="block text-slate-400">Seats Filled</span>
            <strong className="text-white">
              {totalSeats} / {pool.vehicle?.capacity || 8} seats
            </strong>
          </div>
          <div>
            <span className="block text-slate-400">Pickup Time</span>
            <strong className="text-amber-300">
              {formatPktDateTime(pool.pickup_time)}
            </strong>
          </div>
        </div>
      </section>

      {/* QR / Code Check-In Box (FR-8.3) */}
      <section className="rounded-3xl bg-white p-5 border border-slate-200 shadow-sm space-y-3">
        <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
          <QrCode className="w-4 h-4 text-brand-700" />
          <span>Verify Passenger Booking Code</span>
        </h2>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitAction(codeInput, 'checkin');
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            required
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
            placeholder="Enter code (e.g. HMS-8K2P9A)"
            className="flex-1 rounded-xl border border-slate-300 px-3.5 py-3 text-sm font-mono font-bold uppercase min-h-[48px]"
          />
          <button
            type="submit"
            disabled={checkingIn}
            className="rounded-xl bg-brand-700 hover:bg-brand-800 disabled:opacity-50 text-white font-bold px-5 py-3 text-sm min-h-[48px]"
          >
            Check In
          </button>
        </form>

        {feedback && (
          <div
            role="alert"
            className={`rounded-xl p-3 text-xs font-semibold flex items-center gap-2 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}
      </section>

      {/* Route-Ordered Passenger List (FR-8.3, FR-8.5) */}
      <section className="rounded-3xl bg-white p-5 border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-brand-700" />
            <span>Drop-Off Route Order (Nearest Stop First)</span>
          </h2>
          <span className="text-xs text-slate-500">{manifest.length} bookings</span>
        </div>

        {manifest.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">
            No active passengers in this pool yet.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {manifest.map((pax, idx) => (
              <div key={pax.id} className="py-4 first:pt-2 last:pb-1 space-y-2.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-brand-700 text-white text-xs font-extrabold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="font-extrabold text-sm text-slate-900">
                        {pax.user?.name || 'Verified Passenger'}
                      </span>
                      {pax.user?.verified && (
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-1 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-brand-600" />
                      Stop #{pax.zone?.order_in_corridor}:{' '}
                      <strong>{pax.zone?.name}</strong>
                      {pax.address_note ? ` — "${pax.address_note}"` : ''}
                    </p>
                  </div>

                  <div className="text-right">
                    <BookingStatusBadge status={pax.status} />
                    <span className="block font-mono text-xs font-bold text-slate-700 mt-1">
                      {pax.booking_code}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-slate-50 rounded-xl p-2.5">
                  <span className="text-slate-700">
                    <strong>{pax.seats}</strong> seat{pax.seats > 1 ? 's' : ''} ·{' '}
                    {pax.luggage} luggage ·{' '}
                    {pax.payment_method === 'cash'
                      ? `Collect ${formatPkr(pax.total_fare_pkr)} Cash`
                      : `Paid (${pax.payment_method.toUpperCase()})`}
                  </span>

                  <div className="flex gap-1.5">
                    {pax.status === 'confirmed' && (
                      <button
                        type="button"
                        disabled={checkingIn}
                        onClick={() => submitAction(pax.booking_code, 'checkin')}
                        className="rounded-lg bg-brand-700 text-white px-3 py-1.5 font-bold min-h-[36px]"
                      >
                        Boarded
                      </button>
                    )}
                    {(pax.status === 'confirmed' || pax.status === 'checked_in') && (
                      <button
                        type="button"
                        disabled={checkingIn}
                        onClick={() => submitAction(pax.booking_code, 'dropoff')}
                        className="rounded-lg bg-slate-900 text-white px-3 py-1.5 font-bold min-h-[36px]"
                      >
                        Dropped Off
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
