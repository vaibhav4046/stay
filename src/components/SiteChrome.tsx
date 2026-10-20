import Link from 'next/link';
import { StayWordmark } from '@/components/StayMark';
import { UrgentHelpButton } from '@/components/UrgentHelpButton';

const ANCHORS = [
  { href: '#watch', label: 'Watch' },
  { href: '#week', label: 'Your week' },
  { href: '#measured', label: 'Measured' },
  { href: '#platforms', label: 'Platforms' },
];

/** `anchors` adds in-page links on the landing page; privacy and terms keep the plain header. */
export function SiteHeader({ anchors = false }: { anchors?: boolean }) {
  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-5 sm:px-8">
      <Link href="/" aria-label="Stay home">
        <StayWordmark />
      </Link>
      <nav className="flex items-center gap-0.5 sm:gap-2" aria-label="Main">
        {anchors &&
          ANCHORS.map((a) => (
            <a key={a.href} href={a.href} className="btn btn-ghost nav-lg" data-testid="header-anchor">
              {a.label}
            </a>
          ))}
        <Link href="/privacy" className="btn btn-ghost nav-sm">Privacy</Link>
        <UrgentHelpButton />
        <Link href="/app/today" className="btn btn-primary !px-3 sm:!px-5">Open Stay</Link>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mx-auto mt-16 max-w-6xl border-t border-line px-5 py-10 sm:px-8">
      <div className="grid gap-8 sm:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,1fr))]">
        <div className="max-w-md">
          <StayWordmark />
          <p className="meta mt-3">
            Stay is a self-help and self-tracking tool. It is not a medical device, does not diagnose ADHD, and never gives
            medication advice. In an emergency call 999.
          </p>
        </div>
        <nav className="flex flex-col gap-2 text-[0.9rem]" aria-label="Product">
          <p className="eyebrow">Stay</p>
          <Link href="/app/today" className="text-ink-2 hover:text-ink">Open Stay</Link>
          <Link href="/app/history" className="text-ink-2 hover:text-ink">History</Link>
          <Link href="/app/reports" className="text-ink-2 hover:text-ink">Appointment report</Link>
        </nav>
        <nav className="flex flex-col gap-2 text-[0.9rem]" aria-label="Legal">
          <p className="eyebrow">Trust</p>
          <Link href="/privacy" className="text-ink-2 hover:text-ink">Privacy</Link>
          <Link href="/terms" className="text-ink-2 hover:text-ink">Terms and safety</Link>
          <a href="https://github.com/vaibhav4046/stay" rel="noopener noreferrer" className="text-ink-2 hover:text-ink">Source code</a>
        </nav>
      </div>
    </footer>
  );
}
