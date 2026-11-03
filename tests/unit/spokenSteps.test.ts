import { describe, expect, it } from 'vitest';
import { minutesInWords, sayStep, wholeWords } from '@/lib/voice/spokenSteps';
import { toSpeech } from '@/lib/voice/speechText';

describe('steps said out loud', () => {
  it('numbers are words', () => {
    expect(minutesInWords(2)).toBe('two minutes');
    expect(minutesInWords(1)).toBe('one minute');
    expect(minutesInWords(25)).toBe('twenty-five minutes');
  });
  it('cuts between words and never ends with an ellipsis', () => {
    const long = 'Open the email thread with your landlord and read the last message they sent you before replying to it';
    const cut = wholeWords(long, 45);
    expect(cut.endsWith('…')).toBe(false);
    expect(long.startsWith(cut)).toBe(true);
    expect(cut.split(' ').every((w) => long.split(' ').includes(w))).toBe(true); // no half word
  });
  it('says a step the way a person would, with no brackets or ellipsis (was "Step one (2m): Get ready: open or fetch what you need for b…")', () => {
    const said = sayStep(0, 4, 2, 'Get ready: open or fetch what you need for baking the cake for Saturday and the party');
    expect(said).not.toMatch(/[()…]/);
    expect(said).toMatch(/^First step, two minutes: /);
    expect(said.endsWith('.')).toBe(true);
  });
  it('the last step is called the last step', () => {
    expect(sayStep(3, 4, 2, 'Stop where you are and write down the next move')).toMatch(/^Last step, two minutes: stop where you are/);
  });
  it('square-bracket placeholders are not read out: "Hi [Landlord\'s name]" (seen in live replies)', () => {
    expect(toSpeech('Type: "Hi [Landlord\'s name], thanks for the notice."', 'english')).not.toMatch(/[\[\]]/);
  });
});

describe('asides in parentheses are not read aloud (soak, 3 Nov 2026: "use the search function (Ctrl F) to look for words")', () => {
  it('drops a short aside and keeps the sentence whole', () => {
    expect(toSpeech('Use the search bar (Ctrl F) to find the date, then write it down.', 'english')).toBe('Use the search bar to find the date, then write it down.');
    expect(toSpeech('Type the first day of last month (or any date you like).', 'english')).toBe('Type the first day of last month.');
  });
  it('keeps a long parenthetical, which is part of the sentence', () => {
    const s = 'Start with the form (the one your accountant sent you last week with the blue header and the long number on top).';
    expect(toSpeech(s, 'english')).toContain('accountant');
  });
  it('works in other languages too', () => {
    expect(toSpeech('Abre el portal (el de Hacienda) y busca la sección.', 'spanish')).toBe('Abre el portal y busca la sección.');
  });
});
