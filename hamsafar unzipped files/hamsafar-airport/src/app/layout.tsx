import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Navbar } from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'Hamsafar Airport — Pre-Landing Shared Rides from Karachi (KHI)',
  description:
    'One flight, one ride, a fairer fare. Match with passengers heading your way and split the fare on a shared car, rickshaw or van before landing at Jinnah International Airport, Karachi.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-slate-50 text-slate-900 antialiased">
        <Navbar />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-slate-200 bg-white py-6 px-4 text-xs text-slate-500">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="font-medium text-slate-700">
              Hamsafar Airport (MVP v0.1) — Jinnah International Airport, Karachi (KHI)
            </p>
            <p>
              Prototype build. Fares &amp; capacities shown are unconfirmed placeholders.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
