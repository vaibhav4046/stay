import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LIBRARY, libraryProgram } from '@/lib/orb/library';
import { proceduralProgram, sampleProgram, spherePoints, validateProgram } from '@/lib/orb/sdf';
import { extractVisualKeywords, matchConcept } from '@/lib/orb/lexicon';

describe('orb shape library', () => {
  it.each(LIBRARY.map((e) => e.id))('%s samples into a well-formed, fitted point cloud', (id) => {
    const pts = sampleProgram(libraryProgram(id)!, 4000, 1)!;
    expect(pts).not.toBeNull();
    expect(pts.length).toBe(4000 * 3);
    let maxX = 0, maxY = 0, maxZ = 0;
    for (let i = 0; i < 4000; i++) {
      maxX = Math.max(maxX, Math.abs(pts[i * 3]));
      maxY = Math.max(maxY, Math.abs(pts[i * 3 + 1]));
      maxZ = Math.max(maxZ, Math.abs(pts[i * 3 + 2]));
      expect(Number.isFinite(pts[i * 3] + pts[i * 3 + 1] + pts[i * 3 + 2])).toBe(true);
    }
    expect(Math.max(maxX, maxY)).toBeGreaterThan(0.85);
    expect(Math.max(maxX, maxY)).toBeLessThan(1.0);
    expect(maxZ).toBeLessThan(0.25);
  });

  it('is deterministic for a given seed and different across seeds', () => {
    const a = sampleProgram(libraryProgram('heart')!, 500, 5)!;
    const b = sampleProgram(libraryProgram('heart')!, 500, 5)!;
    const c = sampleProgram(libraryProgram('heart')!, 500, 6)!;
    expect(Array.from(a)).toEqual(Array.from(b));
    expect(Array.from(a)).not.toEqual(Array.from(c));
  });

  it('procedural fallback gives every word its own stable, valid shape', () => {
    const words = ['zebra', 'quokka', 'taxation', 'spaghetti', 'volcano', 'x'];
    const seen = new Set<string>();
    for (const w of words) {
      const p = proceduralProgram(w);
      expect(JSON.stringify(p)).toBe(JSON.stringify(proceduralProgram(w)));
      expect(sampleProgram(p, 800, 1)).not.toBeNull();
      seen.add(JSON.stringify(p));
    }
    expect(seen.size).toBe(words.length);
  });

  it('resting orb is a shell of points on a sphere', () => {
    const pts = spherePoints(2000);
    let outer = 0;
    for (let i = 0; i < 2000; i++) {
      const r = Math.hypot(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]);
      expect(r).toBeLessThan(0.95);
      if (r > 0.84) outer++;
    }
    expect(outer).toBeGreaterThan(1600);
  });
});

describe('untrusted shape programs', () => {
  it('rejects junk, oversized and degenerate programs', () => {
    expect(validateProgram(null)).toBeNull();
    expect(validateProgram({ parts: [] })).toBeNull();
    expect(validateProgram({ parts: [{ k: 'circle', c: [0, 0], r: -1 }] })).toBeNull();
    expect(validateProgram({ parts: [{ k: 'script', src: 'alert(1)' }] })).toBeNull();
    expect(validateProgram({ parts: Array.from({ length: 40 }, () => ({ k: 'circle', c: [0, 0], r: 0.2 })) })).toBeNull();
    expect(validateProgram({ parts: [{ k: 'circle', c: [0, 0], r: 0.4 }, { k: 'circle', c: [0, 0], r: 0.5, sub: true }] })).toBeNull(); // nothing left
  });
  it('accepts a good program and clamps stray coordinates', () => {
    const ok = validateProgram({ parts: [{ k: 'circle', c: [9, 0], r: 0.6 }, { k: 'rect', c: [0, 0], w: 0.5, h: 1 }], colors: ['#ff0000', '#00ff00'] });
    expect(ok).not.toBeNull();
    expect((ok!.parts[0] as { c: number[] }).c[0]).toBe(1.6);
  });
});

describe('conversation to concept', () => {
  const cases: Array<[string, string | null]> = [
    ['I feel so overwhelmed', 'tangle'],
    ['I am stuck, I cannot start', 'stairs'],
    ['I need to focus on one thing', 'target'],
    ['I have no energy left', 'battery'],
    ['what is on my to do list', 'list'],
    ['I keep putting off the landlord email', 'envelope'],
    ['my taxes are due', 'coin'],
    ['I cannot sleep, so tired', 'moon'],
    ['I need to breathe and calm down', 'lotus'],
    ['let us play a game', 'game'],
    ['I need to study for my exam', 'book'],
    ['what a lovely zebra', null],
    ['', null],
  ];
  it.each(cases)('%s -> %s', (text, id) => {
    expect(matchConcept(text)?.id ?? null).toBe(id);
  });
  it('keywords drop filler and never return a whole sentence', () => {
    const k = extractVisualKeywords('I really want to see a zebra on the volcano today');
    expect(k.length).toBeLessThanOrEqual(3);
    expect(k).toContain('zebra');
    expect(k).not.toContain('really');
  });
});

describe('gallery dump (dev)', () => {
  it('writes sampled clouds when STAY_ORB_DUMP is set', () => {
    const out = process.env.STAY_ORB_DUMP;
    if (!out) return;
    const src = process.env.STAY_ORB_LLM_IN;
    if (src) {
      const rows = JSON.parse(fs.readFileSync(src, 'utf8')) as Array<{ noun: string; program: unknown }>;
      const data = rows.flatMap((r): Array<{ id: string; palette: string[]; pts: number[] }> => {
        const p = validateProgram(r.program);
        const pts = p && sampleProgram(p, 2600, 1);
        return pts ? [{ id: r.noun, palette: p.colors ?? ['#0E9F9A', '#2F5BD8'], pts: Array.from(pts) }] : [{ id: r.noun + ' (INVALID)', palette: ['#999', '#999'], pts: [] }];
      });
      fs.writeFileSync(out, JSON.stringify(data));
      return;
    }
    const data = LIBRARY.map((e) => ({ id: e.id, palette: e.palette, pts: Array.from(sampleProgram(libraryProgram(e.id)!, 2600, 1)!) }));
    fs.writeFileSync(out, JSON.stringify(data));
  });
});

import { EMOJI_WORDS } from '@/lib/orb/emojiWords';
import { isSingleEmoji } from '@/lib/orb/points';

describe('offline emoji table', () => {
  it('every entry is exactly one emoji', () => {
    for (const [word, emoji] of Object.entries(EMOJI_WORDS)) expect(isSingleEmoji(emoji), `${word} -> ${emoji}`).toBe(true);
  });
  it('rejects model output that is not a single emoji', () => {
    for (const bad of ['', 'zebra', '🦓🦓', 'here you go 🦓', '<script>', '12345']) expect(isSingleEmoji(bad), bad).toBe(false);
    expect(isSingleEmoji('🦓')).toBe(true);
    expect(isSingleEmoji('🏴‍☠️')).toBe(true);
  });
});
