'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, Plane, ShieldCheck, User, LogOut, Menu, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { NotificationRecord } from '@/types/database';

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [userEmailOrPhone, setUserEmailOrPhone] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

  useEffect(() => {
    const supabase = createClient();

    async function loadSessionAndNotifs() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const metaPhone = user.user_metadata?.phone as string | undefined;
        setUserEmailOrPhone(metaPhone || user.phone || 'Passenger');
        try {
          const res = await fetch('/api/notifications');
          if (res.ok) {
            const data = await res.json();
            setNotifications(data.notifications || []);
            setUnreadCount(data.unreadCount || 0);
          }
        } catch {
          // ignore transient error
        }
      } else {
        setUserEmailOrPhone(null);
        setNotifications([]);
        setUnreadCount(0);
      }
    }

    loadSessionAndNotifs();

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      loadSessionAndNotifs();
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [pathname]);

  async function markAllRead() {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  async function handleSignOut() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUserEmailOrPhone(null);
    router.push('/');
    router.refresh();
  }

  const navLinks = [
    { href: '/book', label: 'Book Ride' },
    { href: '/trips', label: 'My Trips' },
    { href: '/demo', label: 'Demo Console' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
      {isDemoMode && (
        <div className="bg-amber-500 text-slate-950 text-xs font-semibold px-3 py-1.5 text-center">
          DEMO MODE — Placeholder fares &amp; simulated OTP/payments active (OTP: 123456)
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-2">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-slate-900 font-extrabold tracking-tight min-h-[44px]"
        >
          <span className="w-9 h-9 rounded-xl bg-brand-700 text-white flex items-center justify-center shadow-sm">
            <Plane className="w-5 h-5" />
          </span>
          <div className="leading-tight">
            <span className="block text-base">Hamsafar</span>
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-brand-700">
              Karachi KHI
            </span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
          {navLinks.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition min-h-[44px] flex items-center ${
                  active
                    ? 'bg-brand-50 text-brand-800'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1.5">
          {userEmailOrPhone && (
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotifOpen((o) => !o);
                  if (!notifOpen && unreadCount > 0) {
                    markAllRead();
                  }
                }}
                aria-label="Notifications"
                className="relative p-2.5 rounded-xl text-slate-600 hover:bg-slate-100 min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 max-w-[90vw] rounded-2xl bg-white shadow-xl border border-slate-200 p-3 z-50">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Trip Updates
                    </span>
                    <button
                      type="button"
                      onClick={() => setNotifOpen(false)}
                      className="text-xs text-slate-400 hover:text-slate-700"
                    >
                      Close
                    </button>
                  </div>
                  {notifications.length === 0 ? (
                    <p className="text-xs text-slate-500 py-4 text-center">
                      No notifications yet.
                    </p>
                  ) : (
                    <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                      {notifications.map((n) => (
                        <div key={n.id} className="py-2.5 text-xs">
                          <p className="font-semibold text-slate-900">{n.title}</p>
                          <p className="text-slate-600 mt-0.5 leading-relaxed">{n.body}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {userEmailOrPhone ? (
            <div className="hidden sm:flex items-center gap-1.5">
              <Link
                href="/profile"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 min-h-[44px]"
              >
                <ShieldCheck className="w-4 h-4 text-brand-600" />
                <span>{userEmailOrPhone}</span>
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                aria-label="Sign out"
                className="p-2.5 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-700 hover:bg-brand-800 text-white text-sm font-semibold min-h-[44px]"
            >
              <User className="w-4 h-4" />
              <span>Sign In</span>
            </Link>
          )}

          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Toggle menu"
            className="md:hidden p-2.5 rounded-xl text-slate-700 hover:bg-slate-100 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-3 rounded-xl text-sm font-semibold text-slate-800 hover:bg-slate-100 min-h-[44px]"
            >
              {link.label}
            </Link>
          ))}
          {userEmailOrPhone && (
            <>
              <Link
                href="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-3 rounded-xl text-sm font-semibold text-slate-800 hover:bg-slate-100 min-h-[44px]"
              >
                Profile &amp; ID Verification ({userEmailOrPhone})
              </Link>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleSignOut();
                }}
                className="w-full text-left px-3 py-3 rounded-xl text-sm font-semibold text-rose-600 hover:bg-rose-50 min-h-[44px]"
              >
                Sign Out
              </button>
            </>
          )}
        </div>
      )}
    </header>
  );
}
