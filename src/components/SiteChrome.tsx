import Link from 'next/link';
import { StayWordmark } from '@/components/StayMark';

export function SiteHeader() {
  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
      <Link href="/" aria-label="Stay home">
        <StayWordmark />
      </Link>
      <nav className="flex items-center gap-1 sm:gap-2" aria-label="Main">
        <Link href="/demo" className="btn btn-ghost">Try the demo</Link>
        <Link href="/app/today" className="btn btn-primary">Open Stay</Link>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mx-auto max-w-6xl px-5 py-10 sm:px-8 border-t border-line mt-16">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-md">
          <StayWordmark />
          <p className="meta mt-3">
            Stay is a self-help and self-tracking tool. It is not a medical device, does not diagnose ADHD, and never gives
            medication advice. In an emergency call 999.
          </p>
        </div>
        <nav className="flex gap-4 text-[0.9rem]" aria-label="Legal">
          <Link href="/privacy" className="text-ink-2 hover:text-ink">Privacy</Link>
          <Link href="/terms" className="text-ink-2 hover:text-ink">Terms and safety</Link>
        </nav>
      </div>
    </footer>
  );
}
