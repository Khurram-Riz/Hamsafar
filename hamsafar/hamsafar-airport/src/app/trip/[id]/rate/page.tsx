'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Star } from 'lucide-react';
import Link from 'next/link';

function StarSelector({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-bold uppercase tracking-wide text-slate-700">
        {label}
      </label>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            aria-label={`${label} ${star} stars`}
            className={`w-12 h-12 rounded-xl border flex items-center justify-center transition ${
              star <= value
                ? 'bg-amber-400 border-amber-500 text-slate-950'
                : 'bg-white border-slate-300 text-slate-400 hover:bg-slate-50'
            }`}
          >
            <Star className={`w-5 h-5 ${star <= value ? 'fill-current' : ''}`} />
          </button>
        ))}
      </div>
    </div>
  );
}

export default function RateRidePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [driverScore, setDriverScore] = useState(5);
  const [vehicleScore, setVehicleScore] = useState(5);
  const [rideScore, setRideScore] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: params.id,
          driverScore,
          vehicleScore,
          rideScore,
          comment,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || 'Could not save rating.');
      } else {
        setSubmitted(true);
      }
    } catch {
      setError('Network error submitting rating.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <Link
        href={`/trip/${params.id}`}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 mb-4 min-h-[36px]"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Trip</span>
      </Link>

      <div className="rounded-3xl bg-white p-6 sm:p-8 border border-slate-200 shadow-sm">
        {submitted ? (
          <div className="py-6 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
            <h1 className="text-xl font-extrabold text-slate-900">
              Thank You for Your Feedback!
            </h1>
            <p className="text-sm text-slate-600">
              Your rating helps maintain trusted captains and reliable shared rides at Karachi Airport.
            </p>
            <button
              type="button"
              onClick={() => router.push(`/trip/${params.id}`)}
              className="mt-2 w-full rounded-xl bg-brand-700 text-white font-bold py-3 text-sm min-h-[48px]"
            >
              Return to Trip Summary
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900">
                Rate Your Hamsafar Ride
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                How was your pickup experience from Jinnah International Airport?
              </p>
            </div>

            <StarSelector
              label="Driver Punctuality & Conduct"
              value={driverScore}
              onChange={setDriverScore}
            />

            <StarSelector
              label="Vehicle Cleanliness & Comfort"
              value={vehicleScore}
              onChange={setVehicleScore}
            />

            <StarSelector
              label="Overall Shared Ride Experience"
              value={rideScore}
              onChange={setRideScore}
            />

            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-700 mb-1.5">
                Optional Comment
              </label>
              <textarea
                rows={3}
                maxLength={500}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share anything that went well or could be improved..."
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
              />
            </div>

            {error && (
              <p className="text-xs font-semibold text-rose-600 bg-rose-50 p-3 rounded-xl">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-brand-700 hover:bg-brand-800 disabled:opacity-50 text-white font-extrabold py-3.5 text-sm min-h-[48px]"
            >
              {submitting ? 'Submitting...' : 'Submit Rating'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
