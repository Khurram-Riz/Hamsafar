'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ShieldCheck, UserCheck } from 'lucide-react';
import { UserProfile } from '@/types/database';

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [gender, setGender] = useState('prefer_not_to_say');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [idDocType, setIdDocType] = useState<'cnic' | 'passport'>('cnic');
  const [idDocNumber, setIdDocNumber] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/profile');
      if (res.status === 401) {
        router.push('/login?next=/profile');
        return;
      }
      const data = await res.json();
      if (data.user) {
        setProfile(data.user);
        setName(data.user.name || '');
        setGender(data.user.gender || 'prefer_not_to_say');
        setEmergencyContact(data.user.emergency_contact || '');
        if (data.user.id_doc_type) setIdDocType(data.user.id_doc_type);
      }
      setLoading(false);
    }
    load();
  }, [router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          gender,
          emergency_contact: emergencyContact || null,
          ...(idDocNumber.trim()
            ? { id_doc_type: idDocType, id_doc_number: idDocNumber.trim() }
            : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || 'Failed to update profile.');
      } else {
        setProfile(data.user);
        setIdDocNumber('');
        setMessage('Profile updated successfully.');
      }
    } catch {
      setError('Network error updating profile.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="max-w-lg mx-auto px-4 py-12 text-center text-sm text-slate-500">Loading profile...</div>;
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <div className="rounded-3xl bg-white p-6 sm:p-8 border border-slate-200 shadow-sm">
        <div className="flex items-start justify-between gap-3 pb-5 border-b border-slate-100">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">Passenger Profile</h1>
            <p className="text-xs text-slate-500 mt-0.5">{profile?.phone}</p>
          </div>
          <div className="text-right">
            {profile?.verified ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
                <ShieldCheck className="w-3.5 h-3.5" />
                ID Verified ({profile.id_doc_masked})
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
                Phone Verified
              </span>
            )}
            <p className="text-[11px] text-slate-500 mt-1">
              Reliability Score: <strong className="text-slate-800">{profile?.reliability_score ?? 100}%</strong>
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-700 mb-1">
              Full Name
            </label>
            <input
              type="text"
              required
              minLength={2}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sara Ahmed"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm min-h-[44px]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-700 mb-1">
              Gender (used only for Women-Only pool eligibility)
            </label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm min-h-[44px]"
            >
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-700 mb-1">
              Emergency Contact (Optional, +92 format)
            </label>
            <input
              type="tel"
              value={emergencyContact}
              onChange={(e) => setEmergencyContact(e.target.value)}
              placeholder="+92 300 7654321"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm min-h-[44px]"
            />
          </div>

          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-brand-700" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Simulated ID Check (CNIC or Passport Format)
              </h2>
            </div>
            <p className="text-xs text-slate-600">
              In MVP mode, format validation marks your profile as ID-verified without storing raw ID numbers.
            </p>
            <div className="grid grid-cols-3 gap-2">
              <select
                value={idDocType}
                onChange={(e) => setIdDocType(e.target.value as 'cnic' | 'passport')}
                className="rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold min-h-[44px]"
              >
                <option value="cnic">CNIC</option>
                <option value="passport">Passport</option>
              </select>
              <input
                type="text"
                value={idDocNumber}
                onChange={(e) => setIdDocNumber(e.target.value)}
                placeholder={idDocType === 'cnic' ? '42101-1234567-1' : 'AB1234567'}
                className="col-span-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs min-h-[44px]"
              />
            </div>
          </div>

          {error && (
            <p className="text-xs font-semibold text-rose-600 bg-rose-50 p-3 rounded-xl">
              {error}
            </p>
          )}
          {message && (
            <p className="text-xs font-semibold text-emerald-700 bg-emerald-50 p-3 rounded-xl flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>{message}</span>
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-brand-700 hover:bg-brand-800 disabled:opacity-50 text-white font-bold py-3 text-sm min-h-[48px]"
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </div>
    </div>
  );
}
