'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { StayWordmark } from '@/components/StayMark';
import { UrgentHelpButton } from '@/components/UrgentHelpButton';

const ICON = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const NAV = [
  { href: '/app/today', label: 'Today', icon: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></> },
  { href: '/app/history', label: 'History', icon: <><path d="M4 12a8 8 0 1 0 2.4-5.7" /><path d="M4 4v4h4" /><path d="M12 8v4l3 2" /></> },
  { href: '/app/treatment', label: 'Check-in', icon: <><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></> },
  { href: '/app/reports', label: 'Report', icon: <><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4" /><path d="M10 12h5M10 16h5" /></> },
  { href: '/app/settings', label: 'Settings', icon: <><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14.2 3h-4l-.4 2.6a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7 7 0 0 0 2-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z" /></> },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-[100dvh]">
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/95 backdrop-blur-[2px]">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-5 sm:px-8">
          <Link href="/" aria-label="Stay home">
            <StayWordmark />
          </Link>
          <nav aria-label="App" className="hidden items-center sm:flex">
            {NAV.map((n) => {
              const active = pathname === n.href;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? 'page' : undefined}
                  className="whitespace-nowrap rounded-lg px-3 py-2 text-[0.92rem]"
                  style={{ color: active ? '#212422' : '#626B66', fontWeight: active ? 600 : 500, background: active ? '#F1EFE9' : 'transparent' }}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <UrgentHelpButton />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-4 sm:px-8 sm:py-8 sm:pb-12">{children}</main>

      <nav
        aria-label="App"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-canvas sm:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        data-testid="bottom-nav"
      >
        <ul className="mx-auto flex max-w-md items-stretch justify-around">
          {NAV.map((n) => {
            const active = pathname === n.href;
            return (
              <li key={n.href} className="flex-1">
                <Link
                  href={n.href}
                  aria-current={active ? 'page' : undefined}
                  className="flex h-16 flex-col items-center justify-center gap-1 text-[0.7rem]"
                  style={{ color: active ? '#006A67' : '#626B66', fontWeight: active ? 600 : 500 }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" {...ICON}>{n.icon}</svg>
                  {n.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
