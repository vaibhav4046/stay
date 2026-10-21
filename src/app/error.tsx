'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log unexpected client error for diagnostics
    console.error('Stay application error:', error);
  }, [error]);

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center p-6 text-center">
      <div className="card max-w-md p-6 sm:p-8 space-y-4 border border-line bg-surface shadow-sm text-left">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-caution inline-block" aria-hidden="true" />
          <p className="eyebrow !mb-0">Take a breath</p>
        </div>
        <h1 className="section-title text-xl sm:text-2xl font-semibold">
          Nothing was lost
        </h1>
        <p className="text-sm text-ink-2 leading-relaxed">
          An unexpected interruption occurred in the interface. Your saved blocks, memory, and settings remain safe on your device.
        </p>
        <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
          <button
            type="button"
            onClick={() => reset()}
            className="btn btn-primary flex-1"
          >
            Try again
          </button>
          <Link href="/app/today" className="btn btn-secondary flex-1">
            Back to Today
          </Link>
        </div>
        {error.message && (
          <details className="pt-2 text-xs text-ink-3">
            <summary className="cursor-pointer hover:text-ink">Technical details</summary>
            <p className="mt-2 font-mono p-2 rounded bg-recessed break-all">{error.message}</p>
          </details>
        )}
      </div>
    </div>
  );
}
