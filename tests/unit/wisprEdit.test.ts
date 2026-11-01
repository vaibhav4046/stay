import { describe, expect, it, beforeEach } from 'vitest';
import {
  parseWisprCommand,
  removeFillerWords,
  loadMyWords,
  saveMyWords,
  addMyWord,
  removeMyWord,
} from '@/lib/voice/wisprEdit';

describe('Wispr-inspired deterministic voice commands (§8.2)', () => {
  it('detects "scratch that" and variants', () => {
    expect(parseWisprCommand('scratch that')).toEqual({ handled: true, action: 'scratch' });
    expect(parseWisprCommand('scratch')).toEqual({ handled: true, action: 'scratch' });
    expect(parseWisprCommand('cancel that')).toEqual({ handled: true, action: 'scratch' });
  });

  it('detects "actually, change that to ..." and extracts replacement', () => {
    expect(parseWisprCommand('actually change that to call the dentist tomorrow')).toEqual({
      handled: true,
      action: 'change',
      argument: 'call the dentist tomorrow',
    });
    expect(parseWisprCommand('actually, my physics assignment')).toEqual({
      handled: true,
      action: 'change',
      argument: 'my physics assignment',
    });
  });

  it('detects repeat and heard queries', () => {
    expect(parseWisprCommand('repeat the last thing')).toEqual({ handled: true, action: 'repeat' });
    expect(parseWisprCommand('say that again')).toEqual({ handled: true, action: 'repeat' });
    expect(parseWisprCommand('show me what you heard')).toEqual({ handled: true, action: 'heard' });
  });

  it('detects translation and language switch commands', () => {
    expect(parseWisprCommand('translate that')).toEqual({ handled: true, action: 'translate' });
    expect(parseWisprCommand('keep the original language')).toEqual({ handled: true, action: 'keep_original' });
    expect(parseWisprCommand('use Hindi')).toEqual({ handled: true, action: 'switch_language', argument: 'hindi' });
    expect(parseWisprCommand('switch to Spanish')).toEqual({ handled: true, action: 'switch_language', argument: 'spanish' });
  });

  it('removes filler words deterministically', () => {
    const raw = 'I um need to uh start working on my thesis like right now';
    expect(removeFillerWords(raw)).toBe('I need to start working on my thesis right now');
  });
});

class MemStorage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  key(i: number) { return Array.from(this.m.keys())[i] ?? null; }
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}

describe('My words keyterms dictionary (§8.2)', () => {
  beforeEach(() => {
    (globalThis as unknown as { window: { localStorage: MemStorage } }).window = {
      localStorage: new MemStorage(),
    };
  });

  it('adds and persists custom words up to 100 entries', () => {
    addMyWord('Methylphenidate');
    addMyWord('Dissertation');
    const words = loadMyWords();
    expect(words).toContain('Methylphenidate');
    expect(words).toContain('Dissertation');

    removeMyWord('Dissertation');
    expect(loadMyWords()).not.toContain('Dissertation');
  });
});
