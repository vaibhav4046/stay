'use client';

/**
 * Turns conversation into a shape for the orb. Three layers, fastest first:
 *  1. Hand-drawn library: matched words morph instantly, even while the user is still speaking.
 *  2. Emoji: an offline word table, then the shape service (an LLM that only names the best emoji). The glyph is
 *     sampled into coloured dots; only dots are ever drawn. Up to three keywords leave the device, never sentences.
 *  3. Procedural: a deterministic rosette for words nobody anticipated, so something sensible always forms.
 * The voice agent can also request a shape directly with its show_shape tool.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { REST_TARGET, getOrbPointCount, type OrbTarget } from '@/components/orb/OrbParticles';
import { LIBRARY, libraryProgram } from './library';
import { EMOJI_WORDS } from './emojiWords';
import { extractVisualKeywords, matchConcept, normalizeConceptKey } from './lexicon';
import { colorize, emojiCloud, isSingleEmoji } from './points';
import { hashString, proceduralProgram, sampleProgram, type ShapeProgram } from './sdf';
import { detectCrisisSignal, detectMedicationAdviceRequest } from '@/lib/safety/crisis';

export type FeedKind = 'partial' | 'user' | 'typed';

const STORE_KEY = 'stay_orb_emoji_v1';
const STORE_MAX = 120;
const MIN_DWELL_MS = 1500;
const REST_AFTER_MS = 18000;
const AI_GAP_MS = 1200;

function loadStore(): Record<string, string> {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || '{}') as Record<string, unknown>;
    return Object.fromEntries(Object.entries(raw).filter(([, v]) => typeof v === 'string' && isSingleEmoji(v as string))) as Record<string, string>;
  } catch {
    return {};
  }
}
function saveStore(map: Map<string, string>) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(Object.fromEntries(Array.from(map.entries()).slice(-STORE_MAX))));
  } catch {
    // storage full or blocked: shapes simply are not remembered
  }
}

function hsl(h: number, s: number, l: number): string {
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
const paletteFor = (key: string): [string, string] => {
  const h = hashString(key) % 360;
  return [hsl(h, 82, 62), hsl((h + 38) % 360, 78, 42)];
};

export function useOrbShape() {
  const [target, setTarget] = useState<OrbTarget>(REST_TARGET);
  const [thinking, setThinking] = useState(false);

  const clouds = useRef(new Map<string, OrbTarget>());
  const emojiStore = useRef(new Map<string, string>());
  const storeLoaded = useRef(false);
  const lastApply = useRef(0);
  const lastAI = useRef(0);
  const intent = useRef(0);
  const queued = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentKey = useRef('orb');

  const ensureStore = () => {
    if (storeLoaded.current || typeof window === 'undefined') return;
    storeLoaded.current = true;
    for (const [k, v] of Object.entries(loadStore())) emojiStore.current.set(k, v);
  };

  /** Show a ready target, respecting a minimum dwell so shapes never flicker through. */
  const show = useCallback((next: OrbTarget) => {
    if (queued.current) clearTimeout(queued.current);
    queued.current = null;
    if (next.key === currentKey.current) return;
    const run = () => {
      lastApply.current = Date.now();
      currentKey.current = next.key;
      setTarget(next);
    };
    const wait = MIN_DWELL_MS - (Date.now() - lastApply.current);
    if (wait > 0 && currentKey.current !== 'orb') queued.current = setTimeout(run, wait);
    else run();
  }, []);

  const rest = useCallback(() => {
    if (queued.current) clearTimeout(queued.current);
    queued.current = null;
    intent.current++;
    setThinking(false);
    if (currentKey.current === 'orb') return;
    currentKey.current = 'orb';
    lastApply.current = Date.now();
    setTarget(REST_TARGET);
  }, []);

  const buildProgramTarget = useCallback((key: string, program: ShapeProgram, palette: [string, string]): OrbTarget | null => {
    const N = getOrbPointCount();
    const ck = `${key}:${N}`;
    const hit = clouds.current.get(ck);
    if (hit) return hit;
    const pts = sampleProgram(program, N, hashString(key) | 1);
    if (!pts) return null;
    const t: OrbTarget = { key, points: pts, cols: colorize(pts, program.colors ?? palette), palette: program.colors ?? palette };
    clouds.current.set(ck, t);
    return t;
  }, []);

  const buildEmojiTarget = useCallback((key: string, emoji: string): OrbTarget | null => {
    const N = getOrbPointCount();
    const ck = `emoji:${emoji}:${N}`;
    const hit = clouds.current.get(ck);
    if (hit) return hit;
    const cloud = emojiCloud(emoji, N, hashString(emoji) | 1);
    if (!cloud) return null;
    const t: OrbTarget = { key: `emoji:${emoji}`, points: cloud.pts, cols: cloud.cols, palette: paletteFor(key) };
    clouds.current.set(ck, t);
    return t;
  }, []);

  const showLibrary = useCallback(
    (id: string) => {
      const entry = LIBRARY.find((e) => e.id === id);
      const program = libraryProgram(id);
      if (!entry || !program) return;
      const t = buildProgramTarget(id, program, entry.palette);
      if (t) show(t);
    },
    [buildProgramTarget, show],
  );

  const showProcedural = useCallback(
    (key: string) => {
      const t = buildProgramTarget(`proc:${key}`, proceduralProgram(key), paletteFor(key));
      if (t) show(t);
    },
    [buildProgramTarget, show],
  );

  /** Resolve a concept the library does not know: offline emoji table, then the shape service, then procedural. */
  const author = useCallback(
    async (keywords: string[], force: boolean) => {
      ensureStore();
      const key = normalizeConceptKey(keywords.join(' '));
      if (!key) return;

      const local = keywords.map((w) => EMOJI_WORDS[w]).find(Boolean) ?? emojiStore.current.get(key);
      if (local) {
        const t = buildEmojiTarget(key, local);
        if (t) {
          intent.current++;
          setThinking(false);
          return show(t);
        }
      }
      if (!force && Date.now() - lastAI.current < AI_GAP_MS) return;
      lastAI.current = Date.now();
      const mine = ++intent.current;
      setThinking(true);
      let emoji: string | null = null;
      let withheld = false;
      try {
        const res = await fetch('/api/orb/shape', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keywords }),
        });
        if (res.ok) {
          const json = (await res.json()) as { emoji: string | null; source: string };
          if (json.source === 'withheld') withheld = true;
          else if (json.emoji && isSingleEmoji(json.emoji)) emoji = json.emoji;
        }
      } catch {
        // offline: fall through to procedural
      }
      if (intent.current !== mine) return; // the conversation moved on while we were choosing
      setThinking(false);
      if (withheld) return rest();
      if (emoji) {
        emojiStore.current.set(key, emoji);
        saveStore(emojiStore.current);
        const t = buildEmojiTarget(key, emoji);
        if (t) return show(t);
      }
      showProcedural(key);
    },
    [buildEmojiTarget, rest, show, showProcedural],
  );

  /** Feed a piece of conversation. Partial transcripts use only instant sources; finals may call the service. */
  const feed = useCallback(
    (text: string, kind: FeedKind) => {
      const t = (text || '').trim();
      if (!t) return;
      if (detectCrisisSignal(t).triggered || detectMedicationAdviceRequest(t).triggered) return rest();
      const m = matchConcept(t);
      if (m) {
        intent.current++;
        setThinking(false);
        return showLibrary(m.id);
      }
      const keywords = extractVisualKeywords(t);
      if (keywords.length === 0) return;
      const offline = keywords.map((w) => EMOJI_WORDS[w]).find(Boolean);
      if (kind === 'partial' && !offline) return;
      if (kind !== 'typed' && t.split(/\s+/).length < 2 && !offline) return;
      void author(keywords, false);
    },
    [author, rest, showLibrary],
  );

  /** Direct request, e.g. the agent's show_shape tool. Always resolves to something. */
  const request = useCallback(
    (concept: string) => {
      const t = (concept || '').trim().slice(0, 40);
      if (!t) return;
      if (detectCrisisSignal(t).triggered || detectMedicationAdviceRequest(t).triggered) return rest();
      const m = matchConcept(t);
      if (m) return showLibrary(m.id);
      const kw = extractVisualKeywords(t);
      void author(kw.length ? kw : [t.toLowerCase()], true);
    },
    [author, rest, showLibrary],
  );

  useEffect(() => {
    const id = setInterval(() => {
      if (currentKey.current !== 'orb' && Date.now() - lastApply.current > REST_AFTER_MS) rest();
    }, 1000);
    return () => {
      clearInterval(id);
      if (queued.current) clearTimeout(queued.current);
    };
  }, [rest]);

  return { target, thinking, feed, request, rest };
}
