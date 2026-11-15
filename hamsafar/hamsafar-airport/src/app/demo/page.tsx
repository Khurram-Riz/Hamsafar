'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Clock,
  ClipboardList,
  Plane,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Users,
} from 'lucide-react';
import {
  DemoMapPassenger,
  DemoMapPoolRoute,
  LeafletMap,
  MapZoneItem,
} from '@/components/LeafletMap';
import { PoolStatusBadge, PoolTypeBadge } from '@/components/StatusBadges';
import { formatPkr, formatPktDateTime } from '@/lib/config';
import { createClient } from '@/lib/supabase/client';
import { FlightRecord } from '@/types/database';

interface DemoPoolItem {
  id: string;
  pool_type: string;
  status: string;
  pickup_time: string;
  corridor: { id: string; name: string; color: string } | null;
  vehicle: { plate: string; model: string; capacity: number } | null;
  driver: { id: string; name: string; verified: boolean } | null;
}

interface DemoBookingItem {
  id: string;
  pool_id: string | null;
  seats: number;
  pool_type: string;
  dest_lat: number | null;
  dest_lng: number | null;
  seat_fare_pkr: number;
  solo_fare_pkr: number;
  total_fare_pkr: number;
  zone: {
    id: string;
    name: string;
    lat: number;
    lng: number;
    order_in_corridor: number;
    corridor: { name: string; color: string } | null;
  } | null;
  user: { name: string | null } | null;
}

interface DemoMetrics {
  totalPassengers: number;
  matchedPassengers: number;
  matchRatePercent: number;
  avgSavingPkr: number;
  vehicleFillRatePercent: number;
  confirmedPoolsCount: number;
}

export default function DemoConsolePage() {
  const [flights, setFlights] = useState<FlightRecord[]>([]);
  const [selectedFlight, setSelectedFlight] = useState<FlightRecord | null>(null);
  const [pools, setPools] = useState<DemoPoolItem[]>([]);
  const [bookings, setBookings] = useState<DemoBookingItem[]>([]);
  const [zones, setZones] = useState<MapZoneItem[]>([]);
  const [metrics, setMetrics] = useState<DemoMetrics>({
    totalPassengers: 0,
    matchedPassengers: 0,
    matchRatePercent: 0,
    avgSavingPkr: 0,
    vehicleFillRatePercent: 0,
    confirmedPoolsCount: 0,
  });

  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const loadDemoState = useCallback(async (flightId?: string) => {
    const query = flightId ? `?flightId=${encodeURIComponent(flightId)}` : '';
    const res = await fetch(`/api/demo/state${query}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      setFlights(data.flights || []);
      setSelectedFlight(data.selectedFlight || null);
      setPools(data.pools || []);
      setBookings(data.bookings || []);
      setZones(data.zones || []);
      if (data.metrics) setMetrics(data.metrics);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDemoState();
  }, [loadDemoState]);

  // Subscribe to Supabase Realtime updates on pools, bookings & flights
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('demo-live-pools')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pools' },
        () => loadDemoState(selectedFlight?.id)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        () => loadDemoState(selectedFlight?.id)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'flights' },
        () => loadDemoState(selectedFlight?.id)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadDemoState, selectedFlight?.id]);

  async function runDemoAction(
    endpoint: string,
    payload: Record<string, unknown>
  ) {
    setActionBusy(true);
    setToast(null);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setToast(data.message || 'Updated.');
        await loadDemoState(data.flightId || selectedFlight?.id);
      } else {
        setToast(data?.error?.message || 'Action failed.');
      }
    } finally {
      setActionBusy(false);
    }
  }

  const mapPassengers: DemoMapPassenger[] = bookings.map((b) => ({
    id: b.id,
    lat: b.dest_lat ?? b.zone?.lat ?? 24.86,
    lng: b.dest_lng ?? b.zone?.lng ?? 67.06,
    zoneName: b.zone?.name || 'Karachi Zone',
    poolType: b.pool_type,
    seats: b.seats,
    corridorColor: b.zone?.corridor?.color || '#0d9488',
    passengerName: b.user?.name || 'Passenger',
  }));

  const mapPools: DemoMapPoolRoute[] = pools.map((pool) => {
    const poolBookings = bookings.filter((b) => b.pool_id === pool.id);
    const totalSeats = poolBookings.reduce((s, b) => s + b.seats, 0);
    const uniqueStops = Array.from(
      new Map(
        poolBookings
          .filter((b) => b.zone)
          .sort(
            (a, b) =>
              (a.zone?.order_in_corridor ?? 99) -
              (b.zone?.order_in_corridor ?? 99)
          )
          .map((b) => [
            b.zone!.id,
            { lat: b.zone!.lat, lng: b.zone!.lng, label: b.zone!.name },
          ])
      ).values()
    );

    return {
      id: pool.id,
      poolType: pool.pool_type,
      status: pool.status,
      totalSeats,
      capacity: pool.vehicle?.capacity || 8,
      corridorColor: pool.corridor?.color || '#0d9488',
      waypoints: uniqueStops,
    };
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8 space-y-6">
      {/* Top Control Header */}
      <div className="rounded-3xl bg-slate-900 text-white p-5 sm:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
              Startup Showdown &apos;26 · Live Operations Console
            </span>
            <h1 className="text-2xl font-extrabold mt-0.5">
              Karachi Airport (KHI) Live Pool Clustering
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Select flight"
              value={selectedFlight?.id || ''}
              onChange={(e) => loadDemoState(e.target.value)}
              className="rounded-xl bg-slate-800 border border-slate-700 text-white px-3.5 py-2.5 text-xs font-bold min-h-[44px]"
            >
              {flights.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.flight_no} ({f.origin}) — {f.status.toUpperCase()}
                </option>
              ))}
            </select>

            <button
              type="button"
              disabled={actionBusy}
              onClick={() =>
                runDemoAction('/api/demo/seed', {
                  flightId: selectedFlight?.id,
                  count: 30,
                })
              }
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white px-4 py-2.5 text-xs font-extrabold min-h-[44px]"
            >
              <Sparkles className="w-4 h-4" />
              <span>Seed 30 Passengers</span>
            </button>

            {selectedFlight && (
              <>
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() =>
                    runDemoAction('/api/demo/delay', {
                      flightId: selectedFlight.id,
                      deltaMinutes: 40,
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 px-4 py-2.5 text-xs font-extrabold min-h-[44px]"
                >
                  <Clock className="w-4 h-4" />
                  <span>Simulate Delay (+40m)</span>
                </button>

                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() =>
                    runDemoAction('/api/demo/delay', {
                      flightId: selectedFlight.id,
                      deltaMinutes: -15,
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white px-3.5 py-2.5 text-xs font-bold min-h-[44px]"
                >
                  <span>Early (-15m)</span>
                </button>
              </>
            )}

            <button
              type="button"
              disabled={actionBusy}
              onClick={() =>
                runDemoAction('/api/demo/reset', {
                  flightId: selectedFlight?.id,
                })
              }
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600/90 hover:bg-rose-600 disabled:opacity-50 text-white px-3.5 py-2.5 text-xs font-bold min-h-[44px]"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {selectedFlight && (
          <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-slate-800 text-xs text-slate-300">
            <span className="inline-flex items-center gap-1.5">
              <Plane className="w-4 h-4 text-brand-400" />
              <strong>{selectedFlight.flight_no}</strong> · {selectedFlight.airline}
            </span>
            <span>
              Estimated Arrival:{' '}
              <strong className="text-white">
                {formatPktDateTime(selectedFlight.estimated_arrival)} PKT
              </strong>
            </span>
            <span>
              Status:{' '}
              <strong className="uppercase text-amber-300">
                {selectedFlight.status}
              </strong>
            </span>
          </div>
        )}

        {toast && (
          <div className="rounded-xl bg-emerald-950/80 border border-emerald-700 px-3.5 py-2.5 text-xs text-emerald-200 flex items-center justify-between">
            <span>{toast}</span>
            <button
              type="button"
              onClick={() => loadDemoState(selectedFlight?.id)}
              className="inline-flex items-center gap-1 text-emerald-300 font-bold"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>
        )}
      </div>

      {/* Pitch Metrics Strip (FR-10.5) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl bg-white p-4 border border-slate-200 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Match Rate
          </span>
          <p className="text-2xl font-extrabold text-brand-700 mt-1 tabular-nums">
            {metrics.matchRatePercent}%
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {metrics.matchedPassengers} of {metrics.totalPassengers} people in booked rides
          </p>
        </div>

        <div className="rounded-2xl bg-white p-4 border border-slate-200 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Avg Saving / Passenger
          </span>
          <p className="text-2xl font-extrabold text-emerald-700 mt-1 tabular-nums">
            {formatPkr(metrics.avgSavingPkr)}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            Versus solo airport cab tariff
          </p>
        </div>

        <div className="rounded-2xl bg-white p-4 border border-slate-200 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Vehicle Fill Rate
          </span>
          <p className="text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">
            {metrics.vehicleFillRatePercent}%
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            Across {pools.length} active shared ride{pools.length === 1 ? '' : 's'}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-4 border border-slate-200 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Booked Rides
          </span>
          <p className="text-2xl font-extrabold text-amber-600 mt-1 tabular-nums">
            {metrics.confirmedPoolsCount} / {pools.length}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            Booked once 2+ people agree
          </p>
        </div>
      </div>

      {/* Main Split: Live Cluster Map + Formed Pools */}
      <div className="grid lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-700">
              Live Corridor &amp; Pool Clusters
            </h2>
            <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-600">
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-600" /> Defence/Clifton
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-600" /> University Rd
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600" /> Shahrah-e-Faisal
              </span>
            </div>
          </div>

          <LeafletMap
            mode="demo"
            heightClass="h-[420px]"
            zones={zones}
            demoPassengers={mapPassengers}
            demoPools={mapPools}
          />
        </div>

        <div className="lg:col-span-5 space-y-3">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-700">
            Shared Rides ({pools.length})
          </h2>

          {loading ? (
            <div className="rounded-2xl bg-white p-6 text-center text-xs text-slate-500 border border-slate-200">
              Loading clusters...
            </div>
          ) : pools.length === 0 ? (
            <div className="rounded-2xl bg-white p-6 text-center border border-slate-200 space-y-2">
              <Users className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-sm font-bold text-slate-800">No pools formed yet</p>
              <p className="text-xs text-slate-500">
                Click <strong>Seed 30 Passengers</strong> above or book a live seat to watch shared rides form automatically.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {pools.map((pool) => {
                const pBookings = bookings.filter((b) => b.pool_id === pool.id);
                const filledSeats = pBookings.reduce((s, b) => s + b.seats, 0);
                const cap = pool.vehicle?.capacity || 8;
                const fillPct = Math.min(100, Math.round((filledSeats / cap) * 100));
                const sampleFare = pBookings[0];

                return (
                  <div
                    key={pool.id}
                    className="rounded-2xl bg-white p-4 border border-slate-200 shadow-sm space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p
                          className="text-xs font-extrabold uppercase tracking-wide"
                          style={{ color: pool.corridor?.color || '#0d9488' }}
                        >
                          {pool.corridor?.name}
                        </p>
                        <p className="text-sm font-extrabold text-slate-900 mt-0.5">
                          {filledSeats} of {cap} seats ·{' '}
                          <span className="font-mono text-xs text-slate-600">
                            {pool.vehicle?.plate || 'Assigning'}
                          </span>
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <PoolStatusBadge status={pool.status} />
                        <PoolTypeBadge poolType={pool.pool_type} />
                      </div>
                    </div>

                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-brand-600 transition-all"
                        style={{ width: `${fillPct}%` }}
                      />
                    </div>

                    {sampleFare && (
                      <p className="text-xs text-slate-600">
                        Fare: <strong>{formatPkr(sampleFare.seat_fare_pkr)}/seat</strong> vs{' '}
                        <span className="line-through">
                          {formatPkr(sampleFare.solo_fare_pkr)} solo
                        </span>
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-1 text-xs">
                      <span className="text-slate-500">
                        Pickup: {formatPktDateTime(pool.pickup_time)}
                      </span>
                      <Link
                        href={`/driver/${pool.id}`}
                        className="inline-flex items-center gap-1 font-bold text-brand-700 hover:underline"
                      >
                        <ClipboardList className="w-3.5 h-3.5" />
                        <span>Manifest</span>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
