import Link from 'next/link';
import { AppLink } from '@/components/landing/AppLink';
import { StayWordmark } from '@/components/StayMark';
import { UrgentHelpButton } from '@/components/UrgentHelpButton';

const ANCHORS = [
  { href: '#watch', label: 'Watch' },
  { href: '#how', label: 'How it works' },
  { href: '#trust', label: 'Trust' },
];

/**
 * `anchors` adds in-page links and the floating pill on the landing page. Privacy and terms use the same bar as the app
 * (`glass-bar`), so moving between them and the app does not change the header.
 */
export function SiteHeader({ anchors = false }: { anchors?: boolean }) {
  const home = (
    <Link href="/" aria-label="Stay home" className="inline-flex min-h-11 items-center">
      <StayWordmark />
    </Link>
  );
  const nav = (
    <nav className="flex items-center gap-0.5 sm:gap-2" aria-label="Main">
      {anchors &&
        ANCHORS.map((a) => (
          <a key={a.href} href={a.href} className="btn btn-ghost nav-lg" data-testid="header-anchor">
            {a.label}
          </a>
        ))}
      <Link href="/privacy" className="btn btn-ghost nav-sm">Privacy</Link>
      <UrgentHelpButton />
      <AppLink href="/app/today" className="btn btn-primary !px-3 sm:!px-5">Open Stay</AppLink>
    </nav>
  );

  if (!anchors) {
    return (
      <header className="glass-bar sticky top-0 z-40">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-5 sm:px-8">
          {home}
          {nav}
        </div>
      </header>
    );
  }
  return (
    <div className="sticky top-0 z-40 px-2 pt-2 sm:px-4 sm:pt-3">
      <header className="glass-nav mx-auto flex max-w-6xl items-center justify-between gap-2 py-1.5 pl-4 pr-1.5 sm:pl-6">
        {home}
        {nav}
      </header>
    </div>
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
            medication advice. In an emergency call your local emergency number (999 in the UK, 911 in the US and Canada).
          </p>
        </div>
        <nav className="flex flex-col text-[0.9rem]" aria-label="Product">
          <p className="mb-1 font-medium text-ink">Stay</p>
          <AppLink href="/app/today" className="inline-flex min-h-11 items-center text-ink-2 hover:text-ink">Open Stay</AppLink>
          <AppLink href="/app/history" className="inline-flex min-h-11 items-center text-ink-2 hover:text-ink">History</AppLink>
          <AppLink href="/app/reports" className="inline-flex min-h-11 items-center text-ink-2 hover:text-ink">Appointment report</AppLink>
        </nav>
        <nav className="flex flex-col text-[0.9rem]" aria-label="Legal">
          <p className="mb-1 font-medium text-ink">About</p>
          <Link href="/privacy" className="inline-flex min-h-11 items-center text-ink-2 hover:text-ink">Privacy</Link>
          <Link href="/terms" className="inline-flex min-h-11 items-center text-ink-2 hover:text-ink">Terms and safety</Link>
          <Link href="/proof" className="inline-flex min-h-11 items-center text-ink-2 hover:text-ink">How we tested it</Link>
          <a href="https://github.com/vaibhav4046/stay" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-ink-2 hover:text-ink">Source code</a>
        </nav>
      </div>
    </footer>
  );
}
