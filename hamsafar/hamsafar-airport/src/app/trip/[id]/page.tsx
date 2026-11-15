'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Car,
  Check,
  ClipboardList,
  Clock,
  Copy,
  ExternalLink,
  MapPin,
  MessageCircle,
  Phone,
  Share2,
  ShieldCheck,
  Star,
  Trash2,
  XCircle,
} from 'lucide-react';
import { ReportIssueModal } from '@/components/ReportIssueModal';
import { ShareRidePanel } from '@/components/ShareRidePanel';
import {
  BookingStatusBadge,
  FareTransparencyNote,
  PoolStatusBadge,
  PoolTypeBadge,
} from '@/components/StatusBadges';
import { formatPkr, formatPktDateTime } from '@/lib/config';
import { BookingRecord, ShareLinkRecord } from '@/types/database';

interface TripPayload {
  booking: BookingRecord;
  poolSummary: {
    totalSeats: number;
    capacity: number;
    passengerGroups: number;
  };
  driverWindowActive: boolean;
  minutesToArrival: number;
  meetingPointLandmark: string;
  qrDataUrl: string;
  shareLinks: ShareLinkRecord[];
  rating: { id: string; driver_score: number; vehicle_score: number; ride_score: number } | null;
}

export default function TripDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<TripPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [shareLoading, setShareLoading] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const loadTrip = useCallback(async () => {
    try {
      const res = await fetch(`/api/bookings/${params.id}`);
      if (res.status === 401) {
        router.push(`/login?next=/trip/${params.id}`);
        return;
      }
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message || 'Unable to load trip.');
      } else {
        setData(json);
      }
    } catch {
      setError('Network error loading trip details.');
    } finally {
      setLoading(false);
    }
  }, [params.id, router]);

  useEffect(() => {
    loadTrip();
  }, [loadTrip]);

  async function handleGenerateShareLink() {
    setShareLoading(true);
    try {
      const res = await fetch(`/api/bookings/${params.id}/share`, {
        method: 'POST',
      });
      if (res.ok) {
        await loadTrip();
      }
    } finally {
      setShareLoading(false);
    }
  }

  async function handleRevokeShareLink(token: string) {
    setShareLoading(true);
    try {
      const res = await fetch(`/api/share/${token}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await loadTrip();
      }
    } finally {
      setShareLoading(false);
    }
  }

  async function handleCancelBooking() {
    if (!window.confirm('Cancel this booking and release your seat?')) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/bookings/${params.id}/cancel`, {
        method: 'POST',
      });
      if (res.ok) {
        await loadTrip();
      }
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center text-sm text-slate-500">
        Loading your boarding pass &amp; pool status...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 text-center space-y-3">
        <p className="text-sm font-semibold text-rose-600">{error || 'Trip not found.'}</p>
        <Link href="/trips" className="text-sm font-bold text-brand-700 underline">
          Back to My Trips
        </Link>
      </div>
    );
  }

  const { booking, poolSummary, driverWindowActive, meetingPointLandmark, qrDataUrl, shareLinks, rating } = data;
  const activeShareLink = shareLinks.find((l) => !l.revoked);
  const shareUrl =
    activeShareLink && typeof window !== 'undefined'
      ? `${window.location.origin}/share/${activeShareLink.token}`
      : activeShareLink
      ? `/share/${activeShareLink.token}`
      : null;

  const saving = Math.max(
    0,
    booking.solo_fare_pkr * booking.seats - booking.total_fare_pkr
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10 space-y-5">
      {/* Boarding Pass & QR Code Card */}
      <section className="rounded-3xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-brand-900 text-white p-5 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wider text-brand-200 font-semibold">
              {booking.flight?.flight_no} · {booking.flight?.airline}
            </p>
            <h1 className="text-xl font-extrabold mt-0.5">
              KHI Airport → {booking.zone?.name}
            </h1>
          </div>
          <div className="flex items-center gap-1.5">
            <BookingStatusBadge status={booking.status} />
            {booking.pool && <PoolStatusBadge status={booking.pool.status} />}
          </div>
        </div>

        <div className="p-5 sm:p-6 grid sm:grid-cols-12 gap-5 items-center">
          <div className="sm:col-span-5 flex flex-col items-center justify-center bg-slate-50 rounded-2xl p-4 border border-slate-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrDataUrl}
              alt={`Boarding QR code for ${booking.booking_code}`}
              className="w-40 h-40 rounded-lg"
            />
            <span className="mt-2 font-mono text-base font-extrabold tracking-wider text-slate-900">
              {booking.booking_code}
            </span>
            <span className="text-[11px] text-slate-500">
              Show to driver at boarding
            </span>
          </div>

          <div className="sm:col-span-7 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Pool Type</span>
              <PoolTypeBadge poolType={booking.pool_type} />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500">Seats Booked</span>
              <span className="font-bold text-slate-900">
                {booking.seats} seat{booking.seats > 1 ? 's' : ''} ({booking.luggage} luggage)
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500">Pool Occupancy</span>
              <span className="font-bold text-slate-900">
                {poolSummary.totalSeats}/{poolSummary.capacity} seats filled
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500">Pickup Time</span>
              <span className="font-bold text-brand-800">
                {formatPktDateTime(
                  booking.pool?.pickup_time || booking.flight?.estimated_arrival || booking.created_at
                )}{' '}
                PKT
              </span>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <span className="text-slate-600 font-medium">
                Total Fare ({booking.payment_method.toUpperCase()})
              </span>
              <div className="text-right">
                <span className="font-extrabold text-base text-slate-900">
                  {formatPkr(booking.total_fare_pkr)}
                </span>
                {saving > 0 && (
                  <span className="block text-[11px] font-bold text-emerald-700">
                    Saved {formatPkr(saving)} vs solo
                  </span>
                )}
              </div>
            </div>
            <FareTransparencyNote asOfDate="2026-11-11" isPlaceholder={true} />
          </div>
        </div>

        {/* Meeting Point & WhatsApp Group Link */}
        <div className="px-5 pb-5 sm:px-6 sm:pb-6 space-y-3">
          <div className="rounded-2xl bg-amber-50/80 border border-amber-200 p-4 text-xs space-y-1">
            <p className="font-extrabold text-amber-950 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-amber-700 shrink-0" />
              <span>Airport Meeting Point &amp; Landmark</span>
            </p>
            <p className="text-amber-900 font-semibold">
              {booking.pool?.meeting_point}
            </p>
            <p className="text-amber-800">Landmark: {meetingPointLandmark}</p>
          </div>

          {booking.pool?.whatsapp_link && booking.status !== 'cancelled' && (
            <a
              href={booking.pool.whatsapp_link}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 text-sm min-h-[44px]"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Join Co-Passenger WhatsApp Group (Placeholder)</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </section>

      {/* Sharing: consent, fare split and join approvals */}
      {booking.ride_mode !== 'solo' && booking.status !== 'cancelled' && (
        <ShareRidePanel bookingId={booking.id} />
      )}

      {/* Driver & Vehicle Details Card (FR-8.1) */}
      <section className="rounded-3xl bg-white p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Car className="w-5 h-5 text-brand-700" />
            <span>Assigned Vehicle &amp; Captain</span>
          </h2>
          {driverWindowActive ? (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
              <ShieldCheck className="w-3.5 h-3.5" />
              Active Window
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
              <Clock className="w-3.5 h-3.5" />
              Unlocks 60m before landing
            </span>
          )}
        </div>

        {booking.pool?.driver && booking.pool?.vehicle ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-slate-50 p-4 border border-slate-200">
            <div className="space-y-1">
              <p className="font-extrabold text-base text-slate-900">
                {booking.pool.driver.name}{' '}
                <span className="text-xs font-semibold text-emerald-700">
                  (Verified Driver)
                </span>
              </p>
              <p className="text-xs text-slate-600">
                Vehicle: <strong>{booking.pool.vehicle.model}</strong>
              </p>
              <p className="text-xs text-slate-600">
                Plate:{' '}
                <span className="font-mono font-extrabold bg-white px-2 py-0.5 rounded border border-slate-300 text-slate-900">
                  {booking.pool.vehicle.plate}
                </span>
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <a
                href={`tel:${booking.pool.driver.phone}`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 text-white px-4 py-2.5 text-xs font-bold min-h-[44px]"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>{booking.pool.driver.phone}</span>
              </a>
              <Link
                href={`/driver/${booking.pool.id}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 px-3.5 py-2.5 text-xs font-bold min-h-[44px]"
              >
                <ClipboardList className="w-3.5 h-3.5" />
                <span>Driver Manifest</span>
              </Link>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-600">
            Vehicle and verified driver details are assigned automatically once at least 2 people agree and the ride is booked.
          </p>
        )}
      </section>

      {/* Family Live Share Link Card (FR-8.4) */}
      {booking.status !== 'cancelled' && (
        <section className="rounded-3xl bg-white p-5 sm:p-6 border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Share2 className="w-5 h-5 text-sky-600" />
                <span>Share Live Trip with Family</span>
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Works without login. Shows vehicle plate, driver name, and live ride route—never your phone number.
              </p>
            </div>
          </div>

          {activeShareLink && shareUrl ? (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 rounded-xl bg-slate-100 p-2.5 border border-slate-200">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="flex-1 bg-transparent text-xs font-mono text-slate-800 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(shareUrl);
                    setCopiedUrl(true);
                    setTimeout(() => setCopiedUrl(false), 2000);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg bg-slate-900 text-white px-3 py-2 text-xs font-bold min-h-[36px]"
                >
                  {copiedUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedUrl ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/share/${activeShareLink.token}`}
                  target="_blank"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white px-4 py-2.5 text-xs font-bold min-h-[44px]"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Live Family View</span>
                </Link>
                <button
                  type="button"
                  disabled={shareLoading}
                  onClick={() => handleRevokeShareLink(activeShareLink.token)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800 px-4 py-2.5 text-xs font-bold min-h-[44px]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Revoke Link</span>
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={shareLoading}
              onClick={handleGenerateShareLink}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold px-5 py-3 text-sm min-h-[44px]"
            >
              <Share2 className="w-4 h-4" />
              <span>{shareLoading ? 'Generating...' : 'Generate Family Share Link'}</span>
            </button>
          )}
        </section>
      )}

      {/* Actions: Rate Ride, Report Safety Issue, Cancel Booking */}
      <section className="space-y-3">
        {booking.status !== 'cancelled' && (
          <Link
            href={`/trip/${booking.id}/rate`}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold py-3 px-4 text-sm min-h-[48px]"
          >
            <Star className="w-4 h-4" />
            <span>
              {rating
                ? `Rated ${rating.ride_score}/5 — Update Ride Rating`
                : 'Rate Driver, Vehicle & Ride'}
            </span>
          </Link>
        )}

        <ReportIssueModal bookingId={booking.id} />

        {booking.status !== 'cancelled' && booking.status !== 'dropped_off' && (
          <button
            type="button"
            disabled={cancelling}
            onClick={handleCancelBooking}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold py-3 px-4 text-xs min-h-[44px]"
          >
            <XCircle className="w-4 h-4 text-slate-500" />
            <span>{cancelling ? 'Cancelling...' : 'Cancel Booking & Release Seat'}</span>
          </button>
        )}
      </section>
    </div>
  );
}
