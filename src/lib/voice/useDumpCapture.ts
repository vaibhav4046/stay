'use client';

/**
 * Voice brain dump as a listening mode. While it is on, Stay says nothing: each finished sentence is added to a live list the
 * screen shows. "That's it" (or the Sort button) sorts it with the existing triage, saves it to Today, and reads back ONE thing to
 * start plus a few for today. Works on the fast engine (the socket is told not to answer) and on the managed agent (its replies
 * are muted from the first spoken turn of the dump; it still thinks about them, so this engine is the less quiet of the two).
 */
import { useCallback, useRef, useState } from 'react';
import { byokHeaders } from '@/lib/byok/config';
import { CRISIS_FIXED_MESSAGE, detectMedicationAdviceRequest } from '@/lib/safety/crisis';
import { enforceLater, fallbackTriage, type TriageResponse } from '@/lib/coach/triage';
import { addToday } from '@/lib/coach/todayList';
import { captureItems, classifyDumpUtterance, detectDumpStart, dropFromCapture, readBackLine } from '@/lib/coach/dumpSession';

export interface DumpLive {
  phase: 'off' | 'listening' | 'sorting' | 'done';
  /** The items heard so far (listening) or the sorted result (done). */
  items: string[];
  result?: TriageResponse;
  source?: string;
  readBack?: string;
}
export const DUMP_OFF: DumpLive = { phase: 'off', items: [] };

const MAX_CHARS = 1900; // the triage route accepts 2000
const NUDGE_MS = 40_000;
const AUTO_SORT_MS = 150_000;

export interface DumpDeps {
  /** Tell the fast socket to hear without answering (a no-op on the managed agent). */
  setCapture: (on: boolean) => void;
  /** Exact words, no model: the fast engine's reply.say, or the best available fallback. */
  speakExact: (text: string) => void;
  stopPlayback: () => void;
  /** Give the live session a note about what was just read back, so it can handle "move the bins to later". */
  note: (content: string) => void;
  showSheet: () => void;
  todayChanged: () => void;
  crisis: (message: string) => void;
  medication: (message: string) => void;
  isManagedAgent: () => boolean;
  isLive: () => boolean;
}

export function useDumpCapture(deps: DumpDeps) {
  const [dump, setDump] = useState<DumpLive>(DUMP_OFF);
  const parts = useRef<string[]>([]);
  const active = useRef(false);
  const muteAgent = useRef(false);
  const nudged = useRef(false);
  const nudgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sortTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const d = useRef(deps);
  d.current = deps;

  const clearTimers = () => {
    if (nudgeTimer.current) clearTimeout(nudgeTimer.current);
    if (sortTimer.current) clearTimeout(sortTimer.current);
    nudgeTimer.current = sortTimer.current = null;
  };
  /**
   * Capture stays on a moment after a dump ends. The sentence that ended it ("that's it", "never mind") is still being delivered to
   * the socket, and if capture were already off the model would answer it ("that's it" got read as "wrap up my day").
   */
  const releaseSoon = (ms = 700) => setTimeout(() => {
    if (!active.current) d.current.setCapture(false);
  }, ms);
  const publish = () => setDump({ phase: 'listening', items: captureItems(parts.current) });

  const finish = useCallback(async () => {
    if (!active.current) return;
    active.current = false;
    clearTimers();
    const heard = captureItems(parts.current);
    if (heard.length === 0) {
      muteAgent.current = false;
      releaseSoon();
      setDump(DUMP_OFF);
      d.current.speakExact('I did not hear anything to sort. Say I need to dump my head whenever you are ready.');
      return;
    }
    setDump({ phase: 'sorting', items: heard });
    // the triage takes the first ~2000 characters; say so rather than silently dropping the rest
    let text = '';
    let kept = 0;
    for (const h of heard) {
      if (text.length + h.length + 1 > MAX_CHARS) break;
      text += `${text ? '\n' : ''}${h}`;
      kept += 1;
    }
    let result: TriageResponse | null = null;
    let source = 'fallback';
    try {
      const res = await fetch('/api/coach/triage', { method: 'POST', headers: { 'Content-Type': 'application/json', ...byokHeaders() }, body: JSON.stringify({ text }) });
      const json = (await res.json()) as TriageResponse & { safety?: 'crisis' | 'medication'; source?: string };
      if (json.safety === 'crisis') {
        muteAgent.current = false;
        releaseSoon(0);
        setDump(DUMP_OFF);
        return d.current.crisis(CRISIS_FIXED_MESSAGE);
      }
      if (json.safety === 'medication') {
        muteAgent.current = false;
        releaseSoon(0);
        setDump(DUMP_OFF);
        return d.current.medication(detectMedicationAdviceRequest(text).message);
      }
      if (res.ok && Array.isArray(json.items)) {
        result = { ...json, items: enforceLater(json.items, text) };
        source = json.source || 'model';
      }
    } catch {
      // offline: sort on the device
    }
    const final = result ?? fallbackTriage(text);
    addToday(final.items.map((i) => ({ text: i.text, bucket: i.bucket, firstStep: i.firstStep, minutes: i.minutes })));
    d.current.todayChanged();
    const trimmed = kept < heard.length ? ` That was a lot, so I sorted the first ${kept} things. Tell me the rest after.` : '';
    const line = `${readBackLine(final.items)}${trimmed}`;
    muteAgent.current = false;
    releaseSoon(0);
    setDump({ phase: 'done', items: final.items.map((i) => i.text), result: final, source, readBack: line });
    d.current.speakExact(line);
    d.current.note(`Just read back to the person (already saved to their list): ${final.items.map((i) => `${i.text} [${i.bucket}]`).join('; ').slice(0, 400)}. If they ask to change it, use list_edit.`);
  }, []);

  const armTimers = useCallback(() => {
    clearTimers();
    nudgeTimer.current = setTimeout(() => {
      if (active.current && parts.current.length > 0 && !nudged.current) {
        nudged.current = true;
        d.current.speakExact('Take your time. Say that is it when you want me to sort.');
      }
    }, NUDGE_MS);
    sortTimer.current = setTimeout(() => void finish(), AUTO_SORT_MS);
  }, [finish]);

  const start = useCallback((first = ''): string => {
    if (!active.current) {
      active.current = true;
      parts.current = first ? [first] : [];
      nudged.current = false;
      d.current.stopPlayback();
      d.current.setCapture(true);
      d.current.showSheet();
      armTimers();
      publish();
    }
    return "I'm listening. Take your time, and say that's it when you're done.";
  }, [armTimers]);

  /** The voice session ended mid-dump (network drop, mic closed): keep what was heard, sorted on the device, without speaking. */
  const rescue = useCallback(() => {
    if (!active.current) return;
    active.current = false;
    clearTimers();
    muteAgent.current = false;
    d.current.setCapture(false);
    const heard = captureItems(parts.current);
    parts.current = [];
    if (heard.length === 0) return setDump(DUMP_OFF);
    const final = fallbackTriage(heard.join('\n').slice(0, MAX_CHARS));
    addToday(final.items.map((i) => ({ text: i.text, bucket: i.bucket, firstStep: i.firstStep, minutes: i.minutes })));
    d.current.todayChanged();
    setDump({ phase: 'done', items: final.items.map((i) => i.text), result: final, source: 'fallback', readBack: 'The voice stopped, so I saved what I heard and sorted it by wording.' });
  }, []);

  const cancel = useCallback((say = true) => {
    if (!active.current) return;
    active.current = false;
    clearTimers();
    parts.current = [];
    muteAgent.current = false;
    releaseSoon();
    setDump(DUMP_OFF);
    if (say) d.current.speakExact('Okay, I dropped that. Nothing was saved.');
  }, []);

  /**
   * Called with each finished sentence AFTER the safety gates. Returns true when the sentence was handled here (so nothing else
   * should answer it). Also recognises "I need to dump my head" before any model has a chance to reply.
   */
  const handleUtterance = useCallback((text: string): boolean => {
    if (!active.current) {
      const s = detectDumpStart(text);
      if (!s) return false;
      if (!d.current.isLive()) {
        d.current.showSheet(); // typed, with no microphone open: the written brain dump, not a listening mode
        return true;
      }
      if (d.current.isManagedAgent()) muteAgent.current = true;
      d.current.speakExact(start(s.rest));
      return true;
    }
    if (d.current.isManagedAgent()) {
      muteAgent.current = true;
      d.current.stopPlayback();
    }
    const c = classifyDumpUtterance(text);
    if (c.kind === 'cancel') cancel();
    else if (c.kind === 'end') {
      if (c.rest) parts.current.push(c.rest);
      void finish();
    } else if (c.kind === 'scratch') {
      parts.current.pop();
      publish();
    } else if (c.kind === 'drop') {
      parts.current = dropFromCapture(parts.current, c.target).parts;
      publish();
    } else if (c.text) {
      parts.current.push(c.text);
      publish();
      armTimers();
    }
    return true;
  }, [armTimers, cancel, finish, start]);

  return {
    dump,
    isActive: () => active.current,
    /** True while the managed agent's replies must not be heard. */
    isAgentMuted: () => muteAgent.current,
    start,
    finish: () => void finish(),
    cancel: () => cancel(true),
    rescue,
    dismiss: () => setDump(DUMP_OFF),
    handleUtterance,
  };
}
