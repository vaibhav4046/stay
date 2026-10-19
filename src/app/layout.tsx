import type { Metadata, Viewport } from 'next';
import './globals.css';
import { CrisisHelpProvider } from '@/components/CrisisHelpPanel';
import { RegisterServiceWorker } from '@/components/RegisterServiceWorker';

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
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
