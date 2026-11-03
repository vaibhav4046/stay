import { describe, it, expect } from 'vitest';
import { makeThinkFilter, stripThink } from '@/lib/voice/thinkFilter';

describe('thinkFilter', () => {
  it('drops an empty think block and the blank space after it (real-model soak: the bubble began "<think></think>")', () => {
    expect(stripThink('<think>\n\n</think>\n\nWhat is the one thing you want?')).toBe('What is the one thing you want?');
  });
  it('drops a think block that has reasoning in it', () => {
    expect(stripThink('<think>The user is stuck. Be brief.</think>Open the document.')).toBe('Open the document.');
  });
  it('works when the tags arrive split across chunks', () => {
    const f = makeThinkFilter();
    const out = ['<th', 'ink>', '\n', '</thi', 'nk>', '\n\nOpen ', 'the file.'].map((c) => f.push(c)).join('') + f.end();
    expect(out).toBe('Open the file.');
  });
  it('leaves ordinary text and a lone less-than sign alone', () => {
    expect(stripThink('Two is < three, so start there.')).toBe('Two is < three, so start there.');
    const f = makeThinkFilter();
    expect(f.push('Hello ') + f.push('there.') + f.end()).toBe('Hello there.');
  });
  it('a think block that never closes is not spoken', () => {
    expect(stripThink('Okay. <think>still reasoning')).toBe('Okay.');
  });
});
