'use client';

import { useState } from 'react';
import { Sheet } from '@/components/Sheet';
import {
  currentStrength, deleteLearning, editLearning, loadLearnings, markNoticeSeen, resetLearnings, setLearningsEnabled, togglePinLearning, whyLine, type Learning, type LearningsState,
} from '@/lib/coach/learnings';
import { clearAllUserMemories, removeUserMemoryFact, removeUserMemoryList, type UserMemoryProfile } from '@/lib/coach/userMemory';

/**
 * What Stay remembers, and why. Things you told Stay, then things Stay worked out from your own blocks, each with the evidence
 * that supports it. Every item can be edited, pinned or deleted, and learning can be switched off.
 */
export function MemorySheet({ memory, onChanged, onClose }: { memory: UserMemoryProfile; onChanged: () => void; onClose: () => void }) {
  const [state, setState] = useState<LearningsState>(() => loadLearnings());
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const sync = (s: LearningsState) => setState(s);
  const sorted = [...state.items].sort((a, b) => Number(b.pinned) - Number(a.pinned) || currentStrength(b) - currentStrength(a));
  const told = memory.facts.length + memory.coreTriggers.length + memory.knownStrengths.length + (memory.name ? 1 : 0);

  const row = (l: Learning) => (
    <li key={l.id} className="rounded-lg bg-recessed p-3" data-testid="learning-item">
      {editing?.id === l.id ? (
        <div className="flex gap-2">
          <input className="field h-10 flex-1" value={editing.text} maxLength={160} onChange={(e) => setEditing({ id: l.id, text: e.target.value })} aria-label="Edit what Stay learned" data-testid="learning-edit-input" />
          <button type="button" className="btn btn-primary !px-3" onClick={() => (sync(editLearning(l.id, editing.text)), setEditing(null))} data-testid="learning-save">Save</button>
          <button type="button" className="btn btn-ghost !px-2" onClick={() => setEditing(null)}>Cancel</button>
        </div>
      ) : (
        <>
          <p className="font-medium">
            {l.text}
            {l.pinned && <span className="meta ml-2">pinned</span>}
            {l.edited && <span className="meta ml-2">edited by you</span>}
          </p>
          <p className="meta mt-1" data-testid="learning-why">Why: {whyLine(l) || 'From your own words.'}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            <button type="button" className="btn btn-ghost !px-2 !py-1" onClick={() => sync(togglePinLearning(l.id))} aria-pressed={l.pinned} data-testid="learning-pin">{l.pinned ? 'Unpin' : 'Pin'}</button>
            <button type="button" className="btn btn-ghost !px-2 !py-1" onClick={() => setEditing({ id: l.id, text: l.text })} data-testid="learning-edit">Edit</button>
            <button type="button" className="btn btn-ghost !px-2 !py-1" onClick={() => sync(deleteLearning(l.id))} aria-label={`Delete: ${l.text}`} data-testid="learning-delete">Delete</button>
          </div>
        </>
      )}
    </li>
  );

  return (
    <Sheet title="What Stay remembers" onClose={onClose}>
      <p className="meta">Only what you said or finished. It is stored on this device and you can remove anything.</p>

      <section className="mt-4" aria-label="What Stay has learned">
        <div className="flex items-center justify-between gap-3">
          <h3 className="label">What Stay has learned</h3>
          <label className="flex cursor-pointer items-center gap-2 text-[0.9rem]">
            <input type="checkbox" className="h-5 w-5 accent-[#006A67]" checked={state.enabled} onChange={(e) => sync(setLearningsEnabled(e.target.checked))} data-testid="learning-toggle" />
            Learn from my blocks
          </label>
        </div>
        {!state.noticeSeen && (
          <div className="notice mt-2" data-testid="learning-notice">
            <p>Stay can notice what helps you start, using your own logged blocks and your own words, on this device. Every item shows why it was learned, and you can edit, pin or delete it, or turn learning off. Nothing is guessed.</p>
            <button type="button" className="btn btn-secondary mt-2" onClick={() => sync(markNoticeSeen())} data-testid="learning-notice-ok">Got it</button>
          </div>
        )}
        {!state.enabled && <p className="meta mt-2">Learning is off. Nothing new is saved, and what is below is not used.</p>}
        <ul className="mt-2 space-y-2" data-testid="learning-list">
          {sorted.map(row)}
          {sorted.length === 0 && <li className="text-ink-2">Nothing learned yet. Stay needs at least three logged blocks before it says anything about what works for you.</li>}
        </ul>
        {state.items.length + state.removed.length > 0 && (
          <button type="button" className="btn btn-ghost mt-2" onClick={() => sync(resetLearnings())} data-testid="learning-reset">Reset what Stay learned</button>
        )}
      </section>

      <section className="mt-5" aria-label="What you told Stay">
        <h3 className="label">What you told Stay</h3>
        <ul className="mt-2 space-y-2" data-testid="memory-list">
          {memory.name && <li className="rounded-lg bg-recessed p-3">Your name: {memory.name}</li>}
          {memory.facts.map((f, i) => (
            <li key={`${f}-${i}`} className="flex items-start justify-between gap-2 rounded-lg bg-recessed p-3">
              <span>{f}</span>
              <button type="button" className="btn btn-ghost !px-2 !py-1" onClick={() => (removeUserMemoryFact(i), onChanged())} aria-label={`Remove: ${f}`}>Remove</button>
            </li>
          ))}
          {memory.coreTriggers.map((t, i) => (
            <li key={`t-${t}`} className="flex items-start justify-between gap-2 rounded-lg bg-recessed p-3">
              <span>Something you find hard to start: {t}</span>
              <button type="button" className="btn btn-ghost !px-2 !py-1" onClick={() => (removeUserMemoryList('coreTriggers', i), onChanged())} aria-label={`Remove: ${t}`}>Remove</button>
            </li>
          ))}
          {memory.knownStrengths.map((t, i) => (
            <li key={`s-${t}`} className="flex items-start justify-between gap-2 rounded-lg bg-recessed p-3">
              <span>Something that helps you: {t}</span>
              <button type="button" className="btn btn-ghost !px-2 !py-1" onClick={() => (removeUserMemoryList('knownStrengths', i), onChanged())} aria-label={`Remove: ${t}`}>Remove</button>
            </li>
          ))}
          {memory.recentSessionsSummary.slice(0, 6).map((s) => (
            <li key={s.timestamp} className="rounded-lg bg-recessed p-3">{s.task} · {s.outcome.replace('_', ' ')}</li>
          ))}
          {told === 0 && memory.recentSessionsSummary.length === 0 && <li className="text-ink-2">Nothing yet. Tell Stay what you are working on and it will remember.</li>}
        </ul>
      </section>

      <button type="button" className="btn btn-danger mt-4" onClick={() => (clearAllUserMemories(), resetLearnings(), onChanged(), sync(loadLearnings()))}>
        Forget everything
      </button>
    </Sheet>
  );
}
