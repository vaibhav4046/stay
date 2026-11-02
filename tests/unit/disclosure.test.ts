import { describe, expect, it } from 'vitest';
import { AI_DISCLOSED_KEY, aiDisclosureLine, takeAiDisclosure } from '@/lib/voice/disclosure';

const memoryStore = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

describe('T0.7 AI disclosure', () => {
  it('says the words from the spec the first time on a device, and not again', () => {
    const s = memoryStore();
    expect(takeAiDisclosure('en', s)).toBe("Just so you know, I'm an AI, not a person.");
    expect(s.getItem(AI_DISCLOSED_KEY)).toBe('1');
    expect(takeAiDisclosure('en', s)).toBeNull();
  });

  it('uses the language of the session, and English when there is no translation', () => {
    expect(aiDisclosureLine('es')).toMatch(/IA/);
    expect(aiDisclosureLine('fr-FR')).toMatch(/IA/);
    expect(aiDisclosureLine('th')).toBe(aiDisclosureLine('en'));
  });

  it('every line says it is an AI and not a person, in its own language', () => {
    for (const l of ['en', 'es', 'fr', 'de', 'it', 'pt', 'hi']) expect(aiDisclosureLine(l).length, l).toBeGreaterThan(15);
  });

  it('blocked storage means it is said every time, never skipped', () => {
    const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(takeAiDisclosure('en', blocked)).toContain('AI');
    expect(takeAiDisclosure('en', null)).toContain('AI');
  });
});
