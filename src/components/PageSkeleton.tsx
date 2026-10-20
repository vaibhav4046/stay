import React from 'react';

export function PageSkeleton({ variant = 'today' }: { variant?: 'today' | 'history' | 'reports' | 'settings' | 'treatment' }) {
  if (variant === 'history' || variant === 'treatment') {
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] animate-pulse" aria-busy="true" aria-label="Loading history...">
        <div className="card p-5 sm:p-6 space-y-4">
          <div className="h-7 w-32 rounded bg-recessed" />
          <div className="h-4 w-48 rounded bg-recessed" />
          <div className="space-y-3 pt-4">
            <div className="h-16 w-full rounded-xl bg-recessed/60" />
            <div className="h-16 w-full rounded-xl bg-recessed/60" />
            <div className="h-16 w-full rounded-xl bg-recessed/60" />
          </div>
        </div>
        <div className="card p-5 sm:p-6 space-y-3">
          <div className="h-5 w-24 rounded bg-recessed" />
          <div className="h-24 w-full rounded-xl bg-recessed/60" />
        </div>
      </div>
    );
  }

  if (variant === 'settings') {
    return (
      <div className="mx-auto max-w-3xl space-y-6 animate-pulse" aria-busy="true" aria-label="Loading settings...">
        <div className="h-7 w-28 rounded bg-recessed" />
        <div className="card p-5 sm:p-6 space-y-4">
          <div className="h-5 w-32 rounded bg-recessed" />
          <div className="flex gap-2">
            <div className="h-10 w-24 rounded-full bg-recessed" />
            <div className="h-10 w-28 rounded-full bg-recessed" />
            <div className="h-10 w-32 rounded-full bg-recessed" />
          </div>
        </div>
        <div className="card p-5 sm:p-6 space-y-4">
          <div className="h-5 w-40 rounded bg-recessed" />
          <div className="h-12 w-full rounded-lg bg-recessed" />
        </div>
      </div>
    );
  }

  if (variant === 'reports') {
    return (
      <div className="space-y-4 animate-pulse" aria-busy="true" aria-label="Loading appointment report...">
        <div className="h-7 w-56 rounded bg-recessed" />
        <div className="h-4 w-72 rounded bg-recessed" />
        <div className="card p-6 h-96 rounded-2xl bg-surface border border-line" />
      </div>
    );
  }

  // default 'today' skeleton
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Loading your focus session...">
      <div className="card p-6 sm:p-8 flex flex-col items-center justify-center min-h-[380px] gap-6">
        <div className="w-44 h-44 rounded-full bg-recessed/80 border border-line" />
        <div className="h-5 w-64 rounded bg-recessed" />
        <div className="h-12 w-full max-w-lg rounded-xl bg-recessed/60 border border-line" />
      </div>
      <div className="card p-5 h-28 rounded-xl bg-surface border border-line" />
    </div>
  );
}
