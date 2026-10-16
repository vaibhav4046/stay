import type { Metadata, Viewport } from 'next';
import './globals.css';
import { CrisisHelpProvider } from '@/components/CrisisHelpPanel';

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
    <html lang="en-GB">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400..700;1,9..40,400..700&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&display=swap"
        />
      </head>
      <body>
        <CrisisHelpProvider>{children}</CrisisHelpProvider>
      </body>
    </html>
  );
}
