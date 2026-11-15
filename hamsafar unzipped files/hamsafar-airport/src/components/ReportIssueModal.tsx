'use client';

import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { ReportType } from '@/types/database';

interface ReportIssueModalProps {
  bookingId: string;
  compact?: boolean;
}

export function ReportIssueModal({ bookingId, compact = false }: ReportIssueModalProps) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ReportType>('safety');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId,
          type,
          description,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message || 'Could not submit report.');
      } else {
        setSubmitted(true);
        setDescription('');
      }
    } catch {
      setError('Network error submitting report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setSubmitted(false);
          setError(null);
          setOpen(true);
        }}
        className={`inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100 font-medium transition min-h-[44px] ${
          compact ? 'px-3 py-2 text-xs' : 'w-full px-4 py-3 text-sm'
        }`}
      >
        <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
        <span>Report a safety or pricing issue</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-modal-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                <h2 id="report-modal-title" className="text-base font-bold text-slate-900">
                  Report a Safety or Pricing Issue
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Close report dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {submitted ? (
              <div className="py-6 text-center space-y-3">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                <p className="font-semibold text-slate-900">
                  Report logged with Hamsafar Safety Desk
                </p>
                <p className="text-sm text-slate-600">
                  Our Karachi operations team reviews every safety and overcharging alert immediately.
                </p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="mt-2 w-full rounded-xl bg-slate-900 text-white py-3 text-sm font-semibold min-h-[44px]"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-1.5">
                    Issue Category
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as ReportType)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 min-h-[44px]"
                  >
                    <option value="safety">Safety or harassment concern</option>
                    <option value="pricing">Driver asked for extra fare / haggling</option>
                    <option value="driver">Driver or vehicle mismatch</option>
                    <option value="route">Route deviation or delay</option>
                    <option value="other">Other issue</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-1.5">
                    What happened?
                  </label>
                  <textarea
                    required
                    minLength={5}
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Share details (plate number, location, or fare requested)..."
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-brand-600 focus:outline-none"
                  />
                </div>

                {error && (
                  <p className="text-xs font-medium text-rose-600 bg-rose-50 p-2.5 rounded-lg">
                    {error}
                  </p>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex-1 rounded-xl border border-slate-300 py-3 text-sm font-semibold text-slate-700 min-h-[44px]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 py-3 text-sm font-semibold text-white min-h-[44px]"
                  >
                    {submitting ? 'Submitting...' : 'Submit Report'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
