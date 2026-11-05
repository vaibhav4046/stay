import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { OUTCOME, SCENES, onSecondScreen, plan } from '@/components/landing/HeroExample';

const real = ['soak-run6-hour-elevenlabs-genz', 'soak-run7-gate-40min-real-model']
  .map((f) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'docs', 'evidence', 'loop', `${f}.json`), 'utf8')) as { turns: Array<{ said: string; reply: string }> })
  .flatMap((j) => j.turns);

const norm = (s: string) => s.replace(/[’‘]/g, "'").replace(/[‑–]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase();

describe('landing example scenes', () => {
  it('every Stay line is word for word a real reply from a recorded test call', () => {
    const replies = new Set(real.map((t) => norm(t.reply)));
    const missing = SCENES.flatMap((s) => s.lines.filter((l) => l.who === 'stay').filter((l) => !replies.has(norm(l.text))).map((l) => l.text));
    expect(missing).toEqual([]);
  });

  it('every speaker line is something the synthetic speaker really said', () => {
    const said = new Set(real.map((t) => norm(t.said)));
    const missing = SCENES.flatMap((s) => s.lines.filter((l) => l.who === 'you').filter((l) => !said.has(norm(l.text))).map((l) => l.text));
    expect(missing).toEqual([]);
  });

  it('lines alternate, and each scene has a timeline that ends after its last line', () => {
    for (const s of SCENES) {
      expect(s.lines.map((l) => l.who)).toEqual(s.lines.map((_, i) => (i % 2 === 0 ? 'you' : 'stay')));
      const { steps, total } = plan(s.lines);
      expect(total).toBeGreaterThan(steps[steps.length - 1].end);
      expect(steps.every((st, i) => i === 0 || st.start > steps[i - 1].end)).toBe(true);
    }
  });

  it('the solved card of every scene quotes one of the real replies in that scene', () => {
    for (const s of SCENES) {
      const o = OUTCOME[s.id];
      expect(o, s.id).toBeDefined();
      const replies = s.lines.filter((l) => l.who === 'stay').map((l) => norm(l.text));
      expect(replies.some((r) => r.includes(norm(o.detail))), `${s.id}: "${o.detail}"`).toBe(true);
    }
  });

  it('the first screen holds the first exchange and about half the call, the second screen the rest, and both are used', () => {
    for (const s of SCENES) {
      const n = s.lines.length;
      const onB = s.lines.map((_, i) => onSecondScreen(i, n));
      expect(onB[0] || onB[1]).toBe(false); // the first exchange is on the first screen
      expect(onB.lastIndexOf(false)).toBeLessThan(onB.indexOf(true)); // never back and forth: screen one, then screen two
      expect(onB.filter(Boolean).length).toBeGreaterThan(0);
    }
  });

  it('names no other product', () => {
    expect(JSON.stringify(SCENES)).not.toMatch(/chatgpt|claude|gemini|alexa|siri/i);
  });
});
