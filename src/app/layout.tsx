import type { Metadata, Viewport } from 'next';
import { DM_Sans, Instrument_Sans } from 'next/font/google';
import './globals.css';
import { CrisisHelpProvider } from '@/components/CrisisHelpPanel';
import { RegisterServiceWorker } from '@/components/RegisterServiceWorker';

// Self-hosted at build time (no render-blocking request to Google, no layout shift: next/font generates the size-adjusted fallback).
const sans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans', display: 'swap' });
const display = Instrument_Sans({ subsets: ['latin'], variable: '--font-instrument', display: 'swap' });

export const metadata: Metadata = {
  title: 'Stay: start the thing you have been avoiding',
  description:
    'A voice companion for adults with ADHD. Tell it the task you cannot begin and get one small first step, a short block to do it in, and a note of what helped.',
  icons: { icon: '/icons/icon-192.png', apple: '/icons/icon-180.png' },
  appleWebApp: { capable: true, title: 'Stay', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: '#FAF8F5',
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${sans.variable} ${display.variable}`}>
      <body>
        <CrisisHelpProvider>{children}</CrisisHelpProvider>
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
