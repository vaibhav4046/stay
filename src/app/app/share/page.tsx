'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { parkThought } from '@/lib/coach/parkingLot';

/** Target of the manifest share_target: what you share to Stay from another app lands in the parking lot. Local only. */
export default function SharePage() {
  const [parked, setParked] = useState<string | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const text = [q.get('title'), q.get('text'), q.get('url')].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    if (!text) return setParked('');
    const saved = parkThought(text);
    setParked(saved[0]?.text ?? text);
  }, []);

  return (
    <section className="card mx-auto mt-6 max-w-md p-6 text-center" data-testid="share-result">
      {parked === null ? null : parked ? (
        <>
          <h1 className="card-title">Parked</h1>
          <p className="mt-2 text-ink-2" data-testid="share-text">{parked}</p>
          <p className="meta mt-1">It is in your parking lot, out of the way until you want it.</p>
        </>
      ) : (
        <>
          <h1 className="card-title">Nothing to park</h1>
          <p className="mt-2 text-ink-2">Share some text or a link to Stay and it will wait here for you.</p>
        </>
      )}
      <Link href="/app/today" className="btn btn-primary mt-5 inline-flex">
        Back to Stay
      </Link>
    </section>
  );
}
