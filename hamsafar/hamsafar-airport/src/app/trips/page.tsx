'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Plane, Plus } from 'lucide-react';
import {
  BookingStatusBadge,
  PoolStatusBadge,
  PoolTypeBadge,
} from '@/components/StatusBadges';
import { formatPkr, formatPktDateTime } from '@/lib/config';
import { BookingRecord } from '@/types/database';

export default function MyTripsPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/bookings');
      if (res.status === 401) {
        router.push('/login?next=/trips');
        return;
      }
      const data = await res.json();
      setBookings(data.bookings || []);
      setLoading(false);
    }
    load();
  }, [router]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">My Trips</h1>
          <p className="text-xs sm:text-sm text-slate-600">
            View your QR boarding pass, driver details, and family share link.
          </p>
        </div>
        <Link
          href="/book"
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-700 hover:bg-brand-800 text-white px-4 py-2.5 text-sm font-bold min-h-[44px]"
        >
          <Plus className="w-4 h-4" />
          <span>New Ride</span>
        </Link>
      </div>

      {loading ? (
        <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500 border border-slate-200">
          Loading your bookings...
        </div>
      ) : bookings.length === 0 ? (
        <div className="rounded-3xl bg-white p-8 text-center border border-slate-200 space-y-3">
          <Plane className="w-10 h-10 text-brand-600 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900">No rides booked yet</h2>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Book a shared ride (car, rickshaw or van) before landing at Jinnah International Airport (KHI) and split the fare with riders going your way.
          </p>
          <Link
            href="/book"
            className="inline-flex items-center gap-2 rounded-xl bg-brand-700 text-white px-5 py-3 text-sm font-bold min-h-[44px]"
          >
            <span>Book Your First Ride</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => (
            <Link
              key={b.id}
              href={`/trip/${b.id}`}
              className="block rounded-2xl bg-white p-4 sm:p-5 border border-slate-200 hover:border-brand-400 shadow-sm transition"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-extrabold px-2.5 py-1 rounded-lg bg-slate-900 text-white">
                    {b.booking_code}
                  </span>
                  <span className="font-bold text-sm text-slate-900">
                    {b.flight?.flight_no} · {b.flight?.origin}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <BookingStatusBadge status={b.status} />
                  {b.pool && <PoolStatusBadge status={b.pool.status} />}
                </div>
              </div>

              <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm">
                <div>
                  <p className="font-bold text-slate-900">
                    KHI → {b.zone?.name} ({b.seats} seat{b.seats > 1 ? 's' : ''})
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Pickup:{' '}
                    {formatPktDateTime(
                      b.pool?.pickup_time || b.flight?.estimated_arrival || b.created_at
                    )}
                  </p>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-3">
                  <PoolTypeBadge poolType={b.pool_type} />
                  <span className="font-extrabold text-brand-700 tabular-nums">
                    {formatPkr(b.total_fare_pkr)}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
