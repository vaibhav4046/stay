'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { StayWordmark } from '@/components/StayMark';

const NAV = [
  { href: '/app/today', label: 'Today' },
  { href: '/app/history', label: 'History' },
  { href: '/app/treatment', label: 'Check-in' },
  { href: '/app/reports', label: 'Report' },
  { href: '/app/settings', label: 'Settings' },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-canvas/95 sticky top-0 z-30 backdrop-blur-[2px]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-8">
          <Link href="/" aria-label="Stay home">
            <StayWordmark />
          </Link>
          <nav aria-label="App" className="-mx-1 flex overflow-x-auto">
            {NAV.map((n) => {
              const active = pathname === n.href;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? 'page' : undefined}
                  className="px-3 py-2 text-[0.92rem] rounded-lg whitespace-nowrap"
                  style={{
                    color: active ? '#212422' : '#626B66',
                    fontWeight: active ? 600 : 500,
                    background: active ? '#F1EFE9' : 'transparent',
                  }}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 pb-24">{children}</main>
    </div>
  );
}
