import type { Metadata, Viewport } from 'next';
import { DM_Sans, Instrument_Sans } from 'next/font/google';
import './globals.css';
import { CrisisHelpProvider } from '@/components/CrisisHelpPanel';

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const instrument = Instrument_Sans({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-instrument',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Stay — make starting easier',
  description:
    'A voice-first companion that helps adults with ADHD turn hard tasks into a first step, learn what helps them begin, and bring a clear summary to their clinician.',
};

export const viewport: Viewport = {
  themeColor: '#FAF8F5',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${dmSans.variable} ${instrument.variable}`}>
      <body>
        <CrisisHelpProvider>{children}</CrisisHelpProvider>
      </body>
    </html>
  );
}
