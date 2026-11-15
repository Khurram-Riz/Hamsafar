'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Car, Clock, MapPin, Navigation, ShieldCheck, ShieldOff } from 'lucide-react';
import { LeafletMap } from '@/components/LeafletMap';
import { PoolStatusBadge, PoolTypeBadge } from '@/components/StatusBadges';
import { formatPktDateTime } from '@/lib/config';

interface SharedTripData {
  bookingStatus: string;
  poolStatus: string;
  poolType: string;
  seats: number;
  flightNo: string;
  airline: string;
  origin: string;
  flightStatus: string;
  pickupTime: string;
  meetingPoint: string;
  corridorName: string;
  corridorColor: string;
  destinationZone: string;
  vehiclePlate: string;
  vehicleModel: string;
  driverName: string;
  driverVerified: boolean;
  route: {
    originCoords: { lat: number; lng: number; label: string };
    destinationCoords: { lat: number; lng: number; label: string };
    liveCoords: { lat: number; lng: number };
    progressPercent: number;
  };
}

export default function FamilySharePage() {
  const params = useParams<{ token: string }>();
  const [trip, setTrip] = useState<SharedTripData | null>(null);
  const [loading, setLoading] = useState(true);
  const [revokedMessage, setRevokedMessage] = useState<string | null>(null);
  const [simStep, setSimStep] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/share/${params.token}`, {
          cache: 'no-store',
        });
        const data = await res.json();
        if (!res.ok) {
          setRevokedMessage(
            data?.error?.message || 'This share link is no longer active.'
          );
        } else {
          setTrip(data.trip);
        }
      } catch {
        setRevokedMessage('Unable to verify share link.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.token]);

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center text-sm text-slate-500">
        Loading live family trip status...
      </div>
    );
  }

  if (revokedMessage || !trip) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="rounded-3xl bg-white p-8 border border-slate-200 text-center space-y-3 shadow-sm">
          <ShieldOff className="w-12 h-12 text-rose-500 mx-auto" />
          <h1 className="text-xl font-extrabold text-slate-900">
            Trip Link Revoked or Expired
          </h1>
          <p className="text-sm text-slate-600">{revokedMessage}</p>
        </div>
      </div>
    );
  }

  const effectiveProgress =
    simStep !== null ? simStep : trip.route.progressPercent;
  const fraction = effectiveProgress / 100;
  const liveLat =
    trip.route.originCoords.lat +
    (trip.route.destinationCoords.lat - trip.route.originCoords.lat) * fraction;
  const liveLng =
    trip.route.originCoords.lng +
    (trip.route.destinationCoords.lng - trip.route.originCoords.lng) * fraction;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10 space-y-5">
      <div className="rounded-3xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-900 text-white p-5 flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-sky-400">
              Live Family Trip Tracker · No Login Required
            </span>
            <h1 className="text-xl font-extrabold mt-0.5">
              {trip.flightNo} → {trip.destinationZone}
            </h1>
          </div>
          <PoolStatusBadge status={trip.poolStatus} />
        </div>

        <div className="p-5 space-y-4">
          <LeafletMap
            mode="tracker"
            heightClass="h-64 sm:h-72"
            trackerRoute={{
              origin: trip.route.originCoords,
              destination: trip.route.destinationCoords,
              live: { lat: liveLat, lng: liveLng },
              color: trip.corridorColor,
            }}
          />

          {/* Simulated Route Progress Scrub for Demo */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-slate-700 flex items-center gap-1.5">
              <Navigation className="w-3.5 h-3.5 text-amber-600" />
              Simulated Route Progress: <strong>{effectiveProgress}%</strong>
            </span>
            <div className="flex gap-1.5">
              {[
                { label: 'At KHI', val: 8 },
                { label: 'En Route', val: 52 },
                { label: 'Arrived', val: 100 },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setSimStep(preset.val)}
                  className={`px-2.5 py-1 rounded-lg font-bold border min-h-[32px] ${
                    effectiveProgress === preset.val
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-300'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Vehicle & Driver Details (No phone numbers exposed per NFR-5) */}
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200 space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <Car className="w-3.5 h-3.5 text-brand-700" />
                Vehicle &amp; Plate
              </p>
              <p className="font-mono text-base font-extrabold text-slate-900">
                {trip.vehiclePlate}
              </p>
              <p className="text-xs text-slate-600">{trip.vehicleModel}</p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200 space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Verified Captain
              </p>
              <p className="text-base font-extrabold text-slate-900">
                {trip.driverName}
              </p>
              <div className="pt-0.5">
                <PoolTypeBadge poolType={trip.poolType} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-emerald-50/70 border border-emerald-200 p-4 text-xs text-emerald-950 space-y-1">
            <p className="flex items-center gap-1.5 font-bold">
              <Clock className="w-4 h-4 text-emerald-700" />
              Scheduled Airport Pickup: {formatPktDateTime(trip.pickupTime)} PKT
            </p>
            <p className="flex items-center gap-1.5 text-emerald-900">
              <MapPin className="w-4 h-4 text-emerald-700" />
              Corridor: {trip.corridorName} → {trip.destinationZone}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
