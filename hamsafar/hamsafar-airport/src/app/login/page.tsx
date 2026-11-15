'use client';

import React, { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, CheckCircle2, Lock, Phone, Sparkles } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next') || '/book';

  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('+92 300 ');
  const [normalizedPhone, setNormalizedPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [gender, setGender] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || 'Could not send OTP.');
      } else {
        setNormalizedPhone(data.phone);
        setInfoMessage(data.message);
        if (data.demoMode) {
          setCode('123456');
        }
        setStep('otp');
      }
    } catch {
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: normalizedPhone || phone,
          code,
          ...(name.trim() ? { name: name.trim() } : {}),
          ...(gender ? { gender } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || 'Invalid verification code.');
      } else {
        router.push(nextPath);
        router.refresh();
      }
    } catch {
      setError('Network error verifying OTP.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-10">
      <div className="rounded-3xl bg-white p-6 sm:p-8 shadow-sm border border-slate-200">
        <div className="mb-6">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand-700 bg-brand-50 px-2.5 py-1 rounded-full">
            <Phone className="w-3.5 h-3.5" />
            Passenger Verification
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-3">
            {step === 'phone' ? 'Sign in with Pakistani Mobile' : 'Enter One-Time Code'}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            {step === 'phone'
              ? 'We verify every passenger so shared rides remain safe and accountable.'
              : `Sent to ${normalizedPhone || phone}`}
          </p>
        </div>

        {step === 'phone' ? (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div>
              <label
                htmlFor="pk-phone"
                className="block text-xs font-bold uppercase tracking-wide text-slate-700 mb-1.5"
              >
                Mobile Number (+92 format)
              </label>
              <input
                id="pk-phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+92 300 1234567"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base font-medium text-slate-900 focus:border-brand-600 focus:outline-none min-h-[48px]"
              />
              <p className="text-xs text-slate-500 mt-1">
                Accepts +923XXXXXXXXX or 03XXXXXXXXX
              </p>
            </div>

            {isDemoMode && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Demo Mode:</span> No SMS is sent. Use any valid +92 number (e.g.{' '}
                  <button
                    type="button"
                    onClick={() => setPhone('+923001234567')}
                    className="underline font-bold"
                  >
                    +923001234567
                  </button>
                  ) and OTP <span className="font-mono font-bold">123456</span>.
                </div>
              </div>
            )}

            {error && (
              <p role="alert" className="text-xs font-semibold text-rose-600 bg-rose-50 p-3 rounded-xl">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-brand-700 hover:bg-brand-800 disabled:opacity-50 text-white font-bold py-3.5 text-sm flex items-center justify-center gap-2 min-h-[48px]"
            >
              <span>{loading ? 'Sending Code...' : 'Continue with OTP'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            {infoMessage && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{infoMessage}</span>
              </div>
            )}

            <div>
              <label
                htmlFor="otp-code"
                className="block text-xs font-bold uppercase tracking-wide text-slate-700 mb-1.5"
              >
                6-Digit OTP Code
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  id="otp-code"
                  type="text"
                  inputMode="numeric"
                  required
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456"
                  className="w-full rounded-xl border border-slate-300 pl-10 pr-4 py-3 text-base font-mono font-bold tracking-widest text-slate-900 focus:border-brand-600 focus:outline-none min-h-[48px]"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-3">
              <p className="text-xs font-semibold text-slate-600">
                Quick Profile Details (optional)
              </p>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your Full Name (shown to driver)"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 min-h-[44px]"
              />
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                aria-label="Gender for women-only pool eligibility"
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 min-h-[44px]"
              >
                <option value="">Gender (optional — used for Women-Only pools)</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </div>

            {error && (
              <p role="alert" className="text-xs font-semibold text-rose-600 bg-rose-50 p-3 rounded-xl">
                {error}
              </p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setStep('phone');
                  setError(null);
                }}
                className="px-4 py-3 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 min-h-[48px]"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-xl bg-brand-700 hover:bg-brand-800 disabled:opacity-50 text-white font-bold py-3 text-sm min-h-[48px]"
              >
                {loading ? 'Verifying...' : 'Verify & Continue'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500">Loading sign-in...</div>}>
      <LoginForm />
    </Suspense>
  );
}
