import { describe, expect, it } from 'vitest';
import { toSpeech } from '@/lib/voice/speechText';

describe('toSpeech: the text the voice is given', () => {
  it('turns a model reply with markdown line breaks and quotes into plain speech', () => {
    expect(toSpeech('Got it.  \nOpen your phone and type “Hi, I’m interested in renewing.”  \nDoable?')).toBe("Got it. Open your phone and type Hi, I'm interested in renewing. Doable?");
  });
  it('removes markdown marks, list markers, code and emoji', () => {
    expect(toSpeech('**Okay**, one step:\n- open `Mail`\n- write it 😊')).toBe('Okay, one step: open Mail write it');
    expect(toSpeech('```js\nx\n``` then breathe')).toBe('then breathe');
  });
  it('turns dashes into a comma pause and fixes spacing before punctuation', () => {
    expect(toSpeech('It is fine — really , it is .')).toBe('It is fine, really, it is.');
  });
  it('leaves other languages and apostrophes alone', () => {
    expect(toSpeech('Hola, ¿qué tal? Don’t worry.')).toBe("Hola, ¿qué tal? Don't worry.");
    expect(toSpeech('नमस्ते, कैसे हैं?')).toBe('नमस्ते, कैसे हैं?');
  });
  it('is empty for text with nothing to say', () => {
    expect(toSpeech(' 😊 ** \n ')).toBe('');
  });
});
