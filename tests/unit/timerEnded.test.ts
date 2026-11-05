import { describe, expect, it } from 'vitest';
import { looksLikeInstruction, timerEndedInstruction, timerEndedNoPlanInstruction } from '@/lib/voice/proactive';
import { isCalm } from '@/lib/coach/dailyGreeting';

describe('what Stay is told when a focus block ends', () => {
  const text = timerEndedInstruction(25, 'open the email draft');

  it('is recognised as an instruction from the app, not something the person said', () => {
    expect(looksLikeInstruction(text)).toBe(true);
    expect(looksLikeInstruction(timerEndedNoPlanInstruction(10))).toBe(true);
  });

  it('asks whether they got started first, and one question at a time', () => {
    expect(text).toContain('open the email draft');
    expect(text).toMatch(/ask whether they got started/i);
    expect(text).toMatch(/Ask just that one question/);
    expect(text.indexOf('call record_session_outcome')).toBeLessThan(text.indexOf('follow-up'));
  });

  it('then asks what helped, or what got in the way, once, and lets a skip stand', () => {
    expect(text).toMatch(/what helped/);
    expect(text).toMatch(/what got in the way/);
    expect(text).toMatch(/never ask it twice/);
    expect(text).toMatch(/skip/);
  });

  it('keeps every spoken part short and calm', () => {
    expect(text).toMatch(/under 20 words/);
    expect(text).toMatch(/under 12 words/);
    expect(isCalm(text)).toBe(true);
  });

  it('a timer with no plan only says the time is up', () => {
    const t = timerEndedNoPlanInstruction(10);
    expect(t).toMatch(/10-minute/);
    expect(t).toMatch(/Ask nothing/);
    expect(t).not.toMatch(/helped/);
  });
});
