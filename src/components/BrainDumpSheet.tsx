'use client';

import { useEffect, useRef, useState } from 'react';
import { Sheet } from '@/components/Sheet';
import { byokHeaders } from '@/lib/byok/config';
import { detectCrisisSignal } from '@/lib/safety/crisis';
import { fallbackTriage, type TriageItem, type TriageResponse } from '@/lib/coach/triage';
import { addToday } from '@/lib/coach/todayList';
import type { DumpLive } from '@/lib/voice/useDumpCapture';

type Phase = { kind: 'write' } | { kind: 'sorting' } | { kind: 'done'; result: TriageResponse; source: string } | { kind: 'safety'; which: 'crisis' | 'medication' };

const GROUP_LABEL = { now: 'Start with this', today: 'Today', later: 'Later, no pressure' } as const;

/**
 * Brain dump: say or type everything on your mind, in any order. Stay splits it, picks ONE thing to start, a few for today,
 * and parks the rest. Everything lands in Today's list on this device.
 */
export function BrainDumpSheet({ onClose, onStart, onCrisis, onSaved, live, voiceOn, onTalk, onFinishLive, onCancelLive }: {
  onClose: () => void;
  onStart: (item: TriageItem) => void;
  onCrisis: (message?: string) => void;
  onSaved: () => void;
  /** The voice dump, when one is running or just finished. */
  live?: DumpLive;
  /** A voice session is open, so "Talk it out" can start listening. */
  voiceOn?: boolean;
  onTalk?: () => void;
  onFinishLive?: () => void;
  onCancelLive?: () => void;
}) {
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'write' });
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => area.current?.focus(), []);

  const sort = async () => {
    const t = text.trim();
    if (t.length < 2) return;
    if (detectCrisisSignal(t).triggered) return onCrisis();
    setPhase({ kind: 'sorting' });
    let result: TriageResponse | null = null;
    let source = 'fallback';
    try {
      const res = await fetch('/api/coach/triage', { method: 'POST', headers: { 'Content-Type': 'application/json', ...byokHeaders() }, body: JSON.stringify({ text: t }) });
      const json = (await res.json()) as TriageResponse & { safety?: 'crisis' | 'medication'; source?: string };
      if (json.safety) return json.safety === 'crisis' ? onCrisis() : setPhase({ kind: 'safety', which: 'medication' });
      if (res.ok && Array.isArray(json.items)) {
        result = json;
        source = json.source || 'model';
      }
    } catch {
      // offline: sort on the device
    }
    const final = result ?? fallbackTriage(t);
    addToday(final.items.map((i) => ({ text: i.text, bucket: i.bucket, firstStep: i.firstStep, minutes: i.minutes })));
    onSaved();
    setPhase({ kind: 'done', result: final, source });
  };

  const voicePhase = live && live.phase !== 'off' ? live : null;
  // closing while Stay is still listening sorts and keeps what was heard: nothing said is lost
  const close = () => (voicePhase?.phase === 'listening' ? onFinishLive?.() : null, onClose());

  return (
    <Sheet title="Brain dump" onClose={close}>
      {voicePhase?.phase === 'listening' ? (
        <div data-testid="dump-listening">
          <p className="flex items-center gap-2 font-medium" role="status" aria-live="polite">
            <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-accent" aria-hidden="true" />
            Listening. Take your time.
          </p>
          <p className="meta mt-1">Say everything on your mind. I will not interrupt. Say &ldquo;that&rsquo;s it&rdquo; when you are done, &ldquo;scratch that&rdquo; to undo the last bit, or &ldquo;never mind&rdquo; to drop it.</p>
          <ul className="mt-3 space-y-2" data-testid="dump-live-items" aria-label="What I have heard so far">
            {voicePhase.items.map((t, i) => (
              <li key={`${i}-${t}`} className="rounded-lg bg-recessed p-3">{t}</li>
            ))}
            {voicePhase.items.length === 0 && <li className="text-ink-2">Nothing yet.</li>}
          </ul>
          <div className="mt-4 flex gap-2">
            <button type="button" className="btn btn-primary flex-1" onClick={onFinishLive} disabled={voicePhase.items.length === 0} data-testid="dump-live-sort">Sort it now</button>
            <button type="button" className="btn btn-secondary" onClick={onCancelLive} data-testid="dump-live-cancel">Cancel</button>
          </div>
        </div>
      ) : voicePhase?.phase === 'sorting' ? (
        <p role="status" data-testid="dump-sorting">Sorting what I heard ({voicePhase.items.length} things)...</p>
      ) : voicePhase?.phase === 'done' && voicePhase.result ? (
        <div data-testid="dump-result">
          {voicePhase.readBack && <p className="text-ink-2" data-testid="dump-readback">{voicePhase.readBack}</p>}
          <ResultGroups result={voicePhase.result} onStart={onStart} />
          <p className="meta mt-4">Saved to Today on this device. Say &ldquo;move the bins to later&rdquo; or &ldquo;that one is done&rdquo; any time.</p>
          <button type="button" className="btn btn-secondary mt-3" onClick={onClose}>Done</button>
        </div>
      ) : phase.kind === 'write' || phase.kind === 'sorting' ? (
        <div>
          <p className="meta">Everything on your mind, in any order, as messy as it comes. Stay will sort it into one thing to start, a few for today, and the rest for later.</p>
          {onTalk && (
            <button type="button" className="btn btn-secondary mt-3 w-full" onClick={onTalk} disabled={!voiceOn} data-testid="dump-talk">
              {voiceOn ? 'Talk it out instead' : 'To talk it out, tap the orb first'}
            </button>
          )}
          <textarea
            ref={area}
            className="field mt-3 min-h-[9rem] w-full resize-y p-3"
            placeholder="landlord email, taxes, I need to call mum, the bins, that report..."
            aria-label="Everything on your mind"
            value={text}
            maxLength={2000}
            onChange={(e) => setText(e.target.value)}
            disabled={phase.kind === 'sorting'}
            data-testid="dump-input"
          />
          <button type="button" className="btn btn-primary mt-3 w-full" onClick={() => void sort()} disabled={phase.kind === 'sorting' || text.trim().length < 2} data-testid="dump-sort">
            {phase.kind === 'sorting' ? 'Sorting...' : 'Sort it for me'}
          </button>
        </div>
      ) : phase.kind === 'safety' ? (
        <p className="notice" role="status">That sounds like a question for your prescriber or pharmacist, so I have not added it to your list. Anything else on your mind?</p>
      ) : (
        <div data-testid="dump-result">
          <ResultGroups result={phase.result} onStart={onStart} />
          <p className="meta mt-4">Saved on this device. {phase.source === 'fallback' ? 'Sorted by wording, because the model was not available.' : ''}</p>
          <button type="button" className="btn btn-secondary mt-3" onClick={onClose}>Done</button>
        </div>
      )}
    </Sheet>
  );
}

function ResultGroups({ result, onStart }: { result: TriageResponse; onStart: (item: TriageItem) => void }) {
  return (
    <>
      {result.summary && <p className="text-ink-2">{result.summary}</p>}
      {(['now', 'today', 'later'] as const).map((g) => {
        const items = result.items.filter((i) => i.bucket === g);
        if (items.length === 0) return null;
        return (
          <section key={g} className="mt-4" aria-label={GROUP_LABEL[g]}>
            <p className="label">{GROUP_LABEL[g]}</p>
            <ul className="mt-2 space-y-2">
              {items.map((i) => (
                <li key={i.text} className={g === 'now' ? 'rounded-xl border border-accent/40 bg-accent-soft p-3' : 'rounded-lg bg-recessed p-3'}>
                  <span className="font-medium">{i.text}</span>
                  {g === 'now' && i.firstStep && <span className="mt-1 block text-ink-2">First step: {i.firstStep}</span>}
                  {g === 'now' && (
                    <button type="button" className="btn btn-primary mt-3" onClick={() => onStart(i)} data-testid="dump-start">
                      Start this {i.minutes ? `(${i.minutes} min)` : ''}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}
