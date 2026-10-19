'use client';

/**
 * Chooses between the topical shape (library / emoji / procedural from useOrbShape) and the person.
 * The rules live in presence.ts; this hook only feeds them the live voice state and a timer for the linger.
 */
import { useCallback, useEffect, useState } from 'react';
import { getOrbPointCount, type OrbTarget } from '@/components/orb/OrbParticles';
import { buildHumanFigure, FIGURE_KEY, FIGURE_PALETTE, FIGURE_WAVE_CENTRE } from './human';
import { INITIAL_PRESENCE, nextPresence, togglePin, type PresenceState } from './presence';
import { lipSyncBus } from './lipSync';

const figureCache = new Map<number, OrbTarget>();

/** The person as an orb target, built once per dot count (a few milliseconds) and cached. */
export function getFigureTarget(): OrbTarget {
  const n = getOrbPointCount();
  const hit = figureCache.get(n);
  if (hit) return hit;
  const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
  const f = buildHumanFigure(n);
  if (typeof window !== 'undefined' && window.__stayOrbDebug) console.info('[orb] figure built', n, 'dots in', Math.round(performance.now() - t0), 'ms');
  const t: OrbTarget = { key: FIGURE_KEY, points: f.pts, cols: f.cols, rig: f.rig, palette: FIGURE_PALETTE, waveCenter: FIGURE_WAVE_CENTRE };
  figureCache.set(n, t);
  return t;
}

export function useOrbPresence({ topical, speaking, userTalking }: { topical: OrbTarget; speaking: boolean; userTalking: boolean }) {
  const [state, setState] = useState<PresenceState>(INITIAL_PRESENCE);

  // The agent's reply.done can arrive seconds before its queued audio has finished playing. She is still "speaking"
  // for as long as audio is audible, so the figure follows the playback clock, not the protocol event.
  const [audible, setAudible] = useState(false);
  useEffect(() => {
    const id = window.setInterval(() => setAudible(lipSyncBus.active), 150);
    return () => window.clearInterval(id);
  }, []);
  const speakingNow = speaking || audible;

  // build the figure while the browser is idle so the first "hello" does not hitch
  useEffect(() => {
    const warm = () => getFigureTarget();
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number; cancelIdleCallback?: (id: number) => void };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(warm);
      return () => w.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(warm, 600);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    setState((prev) => {
      const next = nextPresence(prev, { speaking: speakingNow, userTalking, topicKey: topical.key, now: Date.now() });
      return next.on === prev.on && next.pinned === prev.pinned && next.speaking === prev.speaking && next.topicKey === prev.topicKey && next.leaveAt === prev.leaveAt ? prev : next;
    });
  }, [speakingNow, userTalking, topical.key]);

  // the linger after speech ends: re-evaluate once it is over
  useEffect(() => {
    if (!state.on || state.pinned || speakingNow || !Number.isFinite(state.leaveAt)) return;
    const id = window.setTimeout(
      () => setState((prev) => nextPresence(prev, { speaking: false, userTalking: false, topicKey: prev.topicKey, now: Date.now() })),
      Math.max(0, state.leaveAt - Date.now()) + 20,
    );
    return () => window.clearTimeout(id);
  }, [state.on, state.pinned, state.leaveAt, speakingNow]);

  const toggle = useCallback(() => setState((prev) => togglePin(prev, Date.now())), []);

  const target = state.on ? getFigureTarget() : topical;
  return { target, figureOn: state.on, pinned: state.pinned, togglePin: toggle };
}
