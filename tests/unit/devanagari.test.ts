import { describe, expect, it } from 'vitest';
import { romanizeDevanagari } from '@/lib/voice/devanagari';
import { toSpeech } from '@/lib/voice/speechText';

describe('Devanagari for the voice', () => {
  it.each([
    ['धन्यवाद', 'dhanyavaad'],
    ['आपके', 'aapke'],
    ['संदेश', 'sandesh'],
    ['लिए', 'liye'],
    ['नमस्ते', 'namaste'],
    ['मकान', 'makaan'],
    ['ठीक है', 'theek hai'],
    ['हाँ', 'haan'],
  ])('%s -> %s', (hi, roman) => {
    expect(romanizeDevanagari(hi)).toBe(roman);
  });

  it('leaves Roman text alone and keeps punctuation', () => {
    expect(romanizeDevanagari('Theek hai, bas ek line likho.')).toBe('Theek hai, bas ek line likho.');
    expect(romanizeDevanagari('ठीक है। ok')).toBe('theek hai. ok');
  });

  it('the voice never gets Devanagari, whatever the model wrote (live run: a reply came back in Devanagari)', () => {
    const spoken = toSpeech('“आपके संदेश के लिए धन्यवाद”, aise shuru karo.', 'english');
    expect(spoken).not.toMatch(/[ऀ-ॿ]/);
    expect(spoken).toContain('dhanyavaad');
  });
});
