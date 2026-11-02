'use client';

import { useEffect, useState } from 'react';
import { computeTurns, exportLatency, summarise, type Mark, type Turn } from '@/lib/voice/lab/latency';

/**
 * T2.8: a small panel inside the app, shown only at /app/today?lab=latency. It switches on the app's timing marks and turns them
 * into one row per turn, then exports them. It lives in the app itself (not a frame) because the app refuses to be framed.
 * Nothing about the app's behaviour changes; it only reads marks the app writes when its test flag is on.
 */
type Probe = Window & { __stayFastDebug?: boolean; __stayFastMarks?: Mark[]; __stayPlayStarts?: number[]; __stayLoud?: number[] };

export function LatencyRecorder() {
  const [on, setOn] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('lab') !== 'latency') return;
    setOn(true);
    const w = window as Probe;
    w.__stayFastDebug = true;
    const id = window.setInterval(() => setTurns(computeTurns(w.__stayFastMarks ?? [], w.__stayPlayStarts ?? [], w.__stayLoud ?? [])), 500);
    return () => window.clearInterval(id);
  }, []);

  if (!on) return null;
  const s = summarise(turns);
  const download = () => {
    const blob = new Blob([exportLatency(turns)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `stay-real-mic-latency-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <aside className="fixed bottom-3 right-3 z-50 w-[min(92vw,26rem)] rounded-xl border border-line bg-[#0b1118] p-3 text-sm shadow-lg" aria-label="Real-microphone recorder" data-testid="latency-recorder">
      <div className="flex items-center justify-between gap-2">
        <strong>Real-microphone run</strong>
        <button type="button" className="btn btn-ghost px-2 py-1 text-xs" onClick={() => setOpen((o) => !o)} aria-expanded={open}>{open ? 'Hide' : 'Show'}</button>
      </div>
      <p className="mt-1" role="status" data-testid="latency-count">
        Recording marks. Turns: {turns.length}. With a reply: {s.n}.
        {s.medianMs !== null && <> Median {s.medianMs} ms, 95th percentile {s.p95Ms} ms, worst {s.worstMs} ms.</>}
      </p>
      {open && (
        <>
          <p className="meta mt-1">Headphones on. Do 20 turns in your own voice; let each reply finish. Then export.</p>
          {turns.length > 0 && (
            <div className="mt-2 max-h-40 overflow-auto">
              <table className="w-full text-left" data-testid="latency-table">
                <caption className="sr-only">One row per turn</caption>
                <thead><tr><th scope="col">Turn</th><th scope="col">Speech end to sound (ms)</th><th scope="col">Called finished to sound (ms)</th></tr></thead>
                <tbody>
                  {turns.map((t) => (
                    <tr key={t.turn}><td>{t.turn}</td><td>{t.latencyMs ?? 'none'}</td><td>{t.afterTurnCalledMs ?? 'none'}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <button type="button" className="btn btn-primary mt-2" onClick={download} disabled={turns.length === 0} data-testid="latency-export">Export JSON</button>
          <p className="meta mt-1">Fewer than 20 turns? Say so next to the number.</p>
        </>
      )}
    </aside>
  );
}
