import { describe, expect, it } from 'vitest';
import { intToWords, limitSentences, toSpeech } from '@/lib/voice/speechText';

describe('toSpeech: the text the voice is given', () => {
  it('turns a model reply with markdown line breaks and quotes into plain speech', () => {
    expect(toSpeech('Got it.  \nOpen your phone and type “Hi, I’m interested in renewing.”  \nDoable?')).toBe("Got it. Open your phone and type Hi, I'm interested in renewing. Doable?");
  });
  it('removes markdown marks, list markers, code and emoji', () => {
    expect(toSpeech('**Okay**, one step:\n- open `Mail`\n- write it 😊')).toBe('Okay, one step: open Mail write it');
    expect(toSpeech('```js\nx\n``` and breathe')).toBe('and breathe');
  });
  it('turns dashes into a comma pause and fixes spacing before punctuation', () => {
    expect(toSpeech('It is fine — really , it is .')).toBe('It is fine, really, it is.');
  });
  it('leaves other languages and apostrophes alone', () => {
    expect(toSpeech('Hola, ¿qué tal? Don’t worry.')).toBe("Hola, ¿qué tal? Don't worry.");
    expect(toSpeech('नमस्ते, कैसे हैं?')).toBe('namaste, kaise hain?'); // Devanagari is spoken in Roman letters: no TTS voice reads Devanagari (2 Nov 2026)
  });
  it('is empty for text with nothing to say', () => {
    expect(toSpeech(' 😊 ** \n ')).toBe('');
  });
});

describe('T1.4 numbers and units are said, not read out', () => {
  const cases: Array<[string, string]> = [
    ['Take 7 min.', 'Take seven minutes.'],
    ['Wait 1 min.', 'Wait one minute.'],
    ['Set a 7 min timer.', 'Set a seven minute timer.'],
    ['About 90 secs left.', 'About ninety seconds left.'],
    ['Give it 2 hrs.', 'Give it two hours.'],
    ['It took 450 ms.', 'It took four hundred fifty milliseconds.'],
    ['Do 5-10 min.', 'Do five to ten minutes.'],
    ['A 5-minute stretch.', 'A five-minute stretch.'],
    ['Start at 10:30.', 'Start at ten thirty.'],
    ['Call at 9:00.', "Call at nine o'clock."],
    ['We start at 9:05.', 'We start at nine oh five.'],
    ['Pay $5.', 'Pay five dollars.'],
    ['It costs £12.50.', 'It costs twelve pounds fifty.'],
    ['Only €1.', 'Only one euro.'],
    ['50% done.', 'Fifty percent done.'],
    ['Room 25 is open.', 'Room twenty-five is open.'],
    ['About 3.5 hours.', 'About three point five hours.'],
    ['In 2026 we start.', 'In twenty twenty-six we start.'],
    ['Since 1999.', 'Since nineteen ninety-nine.'],
    ['In 2005.', 'In two thousand five.'],
    ['On the 3rd, then the 22nd.', 'On the third, then the twenty-second.'],
    ['Takes ~5 min.', 'Takes about five minutes.'],
    ['Salt & pepper.', 'Salt and pepper.'],
    ['20°C today.', 'Twenty degrees Celsius today.'],
    ['1,250 steps.', 'One thousand two hundred fifty steps.'],
  ];
  it.each(cases)('%s -> %s', (input, expected) => {
    expect(toSpeech(input)).toBe(expected);
  });

  it('leaves ids, phone numbers, versions and codes alone', () => {
    for (const s of ['Code 12345678 is yours.', 'Order 007 is ready.', 'Call 555-1234 now.', 'Version 3.2.1 is out.', 'Use A4 paper.', 'Try mp3 files.']) expect(toSpeech(s), s).toBe(s);
  });

  it('writes the numbers out in the words a voice can say, up to the hundred thousands', () => {
    expect(intToWords(0)).toBe('zero');
    expect(intToWords(19)).toBe('nineteen');
    expect(intToWords(40)).toBe('forty');
    expect(intToWords(101)).toBe('one hundred one');
    expect(intToWords(999999)).toBe('nine hundred ninety-nine thousand nine hundred ninety-nine');
  });

  it('only English gets this; another language is left as written', () => {
    expect(toSpeech('Faltan 7 min.', 'spanish')).toBe('Faltan 7 min.');
    expect(toSpeech('अभी 7 मिनट बाकी हैं।', 'hindi')).toBe('abhee 7 minat baakee hain.'); // the number rules stay English-only; Devanagari becomes Roman letters
  });
});

describe('T1.4 sentences of 20 words or fewer, with breaths where a person takes them', () => {
  const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
  const sentences = (s: string) => s.split(/(?<=[.!?])\s+/);
  const bare = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

  const LONG_COMMA = 'You have a lot on your plate today, so the kindest thing you can do is pick one small task and give it a few minutes of your attention right now.';
  const LONG_PLAIN = 'Open the email from your landlord and read the first paragraph and then write one sentence that says you got it and that you will reply properly tomorrow.';

  it('breaks a long sentence at its comma', () => {
    const out = toSpeech(LONG_COMMA);
    for (const s of sentences(out)) expect(words(s), s).toBeLessThanOrEqual(20);
    expect(sentences(out).length).toBeGreaterThan(1);
    expect(bare(out)).toBe(bare(LONG_COMMA)); // nothing lost, nothing added
  });

  it('breaks a long sentence with no comma before a joining word', () => {
    const out = toSpeech(LONG_PLAIN);
    for (const s of sentences(out)) expect(words(s), s).toBeLessThanOrEqual(20);
    expect(sentences(out).length).toBeGreaterThan(1);
    expect(bare(out)).toBe(bare(LONG_PLAIN));
  });

  it('starts each new sentence with a capital', () => {
    for (const s of sentences(toSpeech(LONG_COMMA))) expect(s[0]).toBe(s[0].toUpperCase());
  });

  it('leaves a short sentence exactly as it is', () => {
    expect(toSpeech('Open the email. Type one line. Ready?')).toBe('Open the email. Type one line. Ready?');
  });

  it('does not cut a sentence that has nowhere sensible to break', () => {
    const s = 'Supercalifragilistic ' + 'word '.repeat(24).trim() + '.';
    expect(limitSentences(s)).toBe(s);
  });

  it.each([
    ['First open the mail.', 'First, open the mail.'],
    ['Then take a breath.', 'Then, take a breath.'],
    ['Okay so let us begin.', 'Okay, so let us begin.'],
    ['However it is fine.', 'However, it is fine.'],
    ['Got it. Finally you can rest.', 'Got it. Finally, you can rest.'],
  ])('a comma after the lead-in: %s', (input, expected) => {
    expect(toSpeech(input)).toBe(expected);
  });

  it.each(['First thing tomorrow.', 'Yes please.', 'No problem.', 'Next to the door.', 'Then it is done.'])('leaves a phrase that is not a lead-in alone: %s', (s) => {
    expect(toSpeech(s)).toBe(s);
  });

  it('is stable: speaking already-spoken text changes nothing', () => {
    for (const s of [LONG_COMMA, LONG_PLAIN, 'Take 7 min, then 10:30 works.', 'First open the mail. Then breathe.']) {
      const once = toSpeech(s);
      expect(toSpeech(once), s).toBe(once);
    }
  });
});
