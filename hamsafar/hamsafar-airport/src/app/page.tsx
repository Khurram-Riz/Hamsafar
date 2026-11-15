import React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  MapPin,
  Plane,
  Shield,
  Share2,
  Users,
  Sparkles,
} from 'lucide-react';
import faresData from '@data/fares.karachi.json';
import { FareTransparencyNote } from '@/components/StatusBadges';
import { formatPkr } from '@/lib/config';

export default function LandingPage() {
  return (
    <div className="pb-16">
      {/* Hero Section */}
      <section className="bg-gradient-to-b from-brand-950 via-brand-900 to-brand-800 text-white px-4 pt-12 pb-16">
        <div className="max-w-5xl mx-auto grid md:grid-cols-12 gap-8 items-center">
          <div className="md:col-span-7 space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-800/80 border border-brand-600/50 text-brand-100 text-xs font-semibold">
              <Plane className="w-3.5 h-3.5 text-amber-400" />
              <span>Jinnah International Airport (KHI) · Karachi</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
              One flight, one ride,{' '}
              <span className="text-amber-400">a fairer fare.</span>
            </h1>

            <p className="text-base sm:text-lg text-brand-100 leading-relaxed max-w-xl">
              Skip late-night taxi touts and surge haggling at Karachi Airport.
              Match with passengers from your own flight heading the same way, agree to
              share a car, rickshaw or van, and split the fare.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Link
                href="/book"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold px-6 py-4 text-base shadow-lg transition min-h-[52px]"
              >
                <span>Book Your Ride</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/demo"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold px-6 py-4 text-base transition min-h-[52px]"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Live Demo Console</span>
              </Link>
            </div>
          </div>

          {/* Sample Fare Comparison Card */}
          <div className="md:col-span-5">
            <div className="rounded-3xl bg-white text-slate-900 p-5 sm:p-6 shadow-2xl border border-slate-100">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-brand-700">
                    Fixed Corridor Fares
                  </span>
                  <h2 className="text-lg font-extrabold text-slate-900">
                    KHI Airport → City Zones
                  </h2>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 text-xs font-bold">
                  Up to 70% off
                </span>
              </div>

              <div className="divide-y divide-slate-100 my-2">
                {faresData.fares.slice(0, 5).map((item) => {
                  const saving = item.solo_fare_pkr - item.seat_fare_pkr;
                  return (
                    <div
                      key={item.zone_slug}
                      className="py-3 flex items-center justify-between gap-2"
                    >
                      <div>
                        <p className="font-bold text-sm text-slate-900">
                          {item.zone_name}
                        </p>
                        <p className="text-xs text-slate-500 line-through">
                          Solo cab ~{formatPkr(item.solo_fare_pkr)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-extrabold text-base text-brand-700 tabular-nums">
                          {formatPkr(item.seat_fare_pkr)}
                          <span className="text-xs font-medium text-slate-500">
                            /seat
                          </span>
                        </p>
                        <p className="text-[11px] font-semibold text-emerald-700">
                          Save {formatPkr(saving)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <FareTransparencyNote
                asOfDate={faresData.as_of_date}
                isPlaceholder={faresData.is_placeholder}
              />
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-5xl mx-auto px-4 mt-12">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            How Hamsafar Works
          </h2>
          <p className="text-sm sm:text-base text-slate-600 mt-2">
            Built around your flight&apos;s arrival time and Karachi&apos;s main road corridors—so your ride is arranged before you clear baggage claim.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div className="rounded-2xl bg-white p-5 border border-slate-200 shadow-sm space-y-2.5">
            <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center font-extrabold">
              1
            </div>
            <h3 className="font-bold text-base text-slate-900">
              Enter Flight &amp; Zone
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Enter your KHI flight number and pick your zone (DHA, Clifton, Gulshan, PECHS) or drop a pin on the Karachi map.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 border border-slate-200 shadow-sm space-y-2.5">
            <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center font-extrabold">
              2
            </div>
            <h3 className="font-bold text-base text-slate-900">
              Match Before Landing
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Choose Open, Women-Only, or Family-Only pools. Our engine clusters riders along the same corridor and adjusts automatically if your flight delays.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 border border-slate-200 shadow-sm space-y-2.5">
            <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center font-extrabold">
              3
            </div>
            <h3 className="font-bold text-base text-slate-900">
              Board &amp; Share Live Trip
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Get your driver&apos;s plate, QR boarding pass, and a no-login live tracking link to share with family waiting at home.
            </p>
          </div>
        </div>
      </section>

      {/* Trust & Safety Section */}
      <section className="max-w-5xl mx-auto px-4 mt-12">
        <div className="rounded-3xl bg-slate-900 text-white p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Built-In Protection
              </span>
              <h2 className="text-2xl font-extrabold mt-1">
                Safety &amp; Transparency First
              </h2>
            </div>
            <Link
              href="/book"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-500 px-5 py-3 text-sm font-bold text-white min-h-[44px]"
            >
              <span>Reserve a Seat Now</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 pt-6 text-sm">
            <div className="space-y-1.5">
              <Users className="w-5 h-5 text-fuchsia-400" />
              <h3 className="font-bold">Women &amp; Family Pools</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Strict pool isolation guarantees women-only and family-only rides never mix with open riders.
              </p>
            </div>
            <div className="space-y-1.5">
              <Shield className="w-5 h-5 text-emerald-400" />
              <h3 className="font-bold">Verified Captains &amp; Vehicles</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Driver name, photo, phone, and vehicle plate appear 60 minutes before landing with QR check-in.
              </p>
            </div>
            <div className="space-y-1.5">
              <Share2 className="w-5 h-5 text-sky-400" />
              <h3 className="font-bold">No-Login Family Link</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Share a revocable live route link with family—showing ride progress without exposing your phone number.
              </p>
            </div>
            <div className="space-y-1.5">
              <Clock className="w-5 h-5 text-amber-400" />
              <h3 className="font-bold">Delay-Proof Re-Matching</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                If your flight is delayed, pickup windows and shared rides update automatically with instant alerts.
              </p>
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-slate-800 flex flex-wrap items-center gap-4 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-brand-400" />
              Pickup Bay: Jinnah International Airport, Arrivals Gate B, Pillar 4
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-brand-400" />
              Cash on boarding (default), Easypaisa &amp; JazzCash supported
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
