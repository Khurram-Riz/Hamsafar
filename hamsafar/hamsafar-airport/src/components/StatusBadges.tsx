import React from 'react';
import { BookingStatus, PoolStatus, PoolType } from '@/types/database';

export function PoolStatusBadge({ status }: { status: PoolStatus | string }) {
  const styles: Record<string, string> = {
    forming: 'bg-amber-100 text-amber-800 border-amber-200',
    confirmed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    dispatched: 'bg-sky-100 text-sky-800 border-sky-200',
    completed: 'bg-slate-200 text-slate-800 border-slate-300',
    cancelled: 'bg-rose-100 text-rose-800 border-rose-200',
  };

  const labels: Record<string, string> = {
    forming: 'Waiting for riders',
    confirmed: 'Ride Booked',
    dispatched: 'En Route',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
        styles[status] || 'bg-slate-100 text-slate-700 border-slate-200'
      }`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5" />
      {labels[status] || status}
    </span>
  );
}

export function PoolTypeBadge({ poolType }: { poolType: PoolType | string }) {
  const styles: Record<string, string> = {
    open: 'bg-teal-50 text-teal-800 border-teal-200',
    women_only: 'bg-fuchsia-50 text-fuchsia-800 border-fuchsia-200',
    family_only: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  };

  const labels: Record<string, string> = {
    open: 'Open Pool',
    women_only: 'Women-Only',
    family_only: 'Family-Only',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
        styles[poolType] || 'bg-slate-100 text-slate-700 border-slate-200'
      }`}
    >
      {labels[poolType] || poolType}
    </span>
  );
}

export function BookingStatusBadge({ status }: { status: BookingStatus | string }) {
  const styles: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800',
    confirmed: 'bg-emerald-100 text-emerald-800',
    checked_in: 'bg-sky-100 text-sky-800',
    dropped_off: 'bg-slate-200 text-slate-800',
    cancelled: 'bg-rose-100 text-rose-800',
    no_show: 'bg-red-100 text-red-800',
  };

  const labels: Record<string, string> = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    checked_in: 'Boarded',
    dropped_off: 'Dropped Off',
    cancelled: 'Cancelled',
    no_show: 'No Show',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
        styles[status] || 'bg-slate-100 text-slate-700'
      }`}
    >
      {labels[status] || status}
    </span>
  );
}

export function FareTransparencyNote({
  asOfDate,
  isPlaceholder = true,
}: {
  asOfDate: string;
  isPlaceholder?: boolean;
}) {
  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || isPlaceholder;
  return (
    <p className="text-xs text-slate-500 mt-1">
      Fixed zone tariff as of <span className="font-medium text-slate-700">{asOfDate}</span>.
      {isDemo && (
        <span className="ml-1 inline-block px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-medium">
          Placeholder figure (unverified)
        </span>
      )}
    </p>
  );
}
