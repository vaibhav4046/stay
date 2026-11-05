import { describe, expect, it } from 'vitest';
import { clipToBytes, fitHistory, historyBytes, HISTORY_BUDGET_BYTES } from '@/lib/voice/historyBudget';

type Turn = { role: 'user' | 'assistant' | 'tool'; content: string | null };
const u = (content: string): Turn => ({ role: 'user', content });
const a = (content: string): Turn => ({ role: 'assistant', content });
const t = (content: string): Turn => ({ role: 'tool', content });

describe('conversation history budget', () => {
  it('leaves a short conversation exactly as it is', () => {
    const chat = [u('hi'), a('hello'), u('I need to email my landlord')];
    expect(fitHistory(chat)).toEqual(chat);
  });

  it('drops the oldest turns, never the newest, and keeps the order', () => {
    const chat = Array.from({ length: 30 }, (_, i) => (i % 2 === 0 ? u(`question ${i} ${'x'.repeat(300)}`) : a(`answer ${i} ${'y'.repeat(300)}`)));
    const fit = fitHistory(chat, 2_000);
    expect(historyBytes(fit)).toBeLessThanOrEqual(2_000);
    expect(fit[fit.length - 1]).toBe(chat[chat.length - 1]);
    expect(fit[0].role).toBe('user');
    const idx = fit.map((m) => chat.indexOf(m));
    expect(idx).toEqual([...idx].sort((x, y) => x - y));
  });

  it('is what stops the 413: a long Hindi conversation fits the server limit', () => {
    const hindi = 'मुझे अपने मकान मालिक को ईमेल लिखना है लेकिन मैं शुरू नहीं कर पा रहा हूँ';
    const chat = Array.from({ length: 16 }, (_, i) => (i % 2 === 0 ? u(hindi.repeat(6)) : a(hindi)));
    expect(historyBytes(chat)).toBeGreaterThan(8_192); // this is the conversation that used to be refused
    const fit = fitHistory(chat);
    expect(historyBytes(fit)).toBeLessThanOrEqual(HISTORY_BUDGET_BYTES);
    expect(HISTORY_BUDGET_BYTES).toBeLessThan(8_192);
    expect(fit[fit.length - 1]).toBe(chat[chat.length - 1]);
  });

  it('never leaves a tool answer without the turn that asked for it', () => {
    const chat = [u('old '.repeat(900)), a(''), t('result '.repeat(100)), a('done'), u('next ' + 'z'.repeat(2000)), a('ok'), u('last one')];
    const fit = fitHistory(chat, 2_300);
    expect(fit[0].role).toBe('user');
    expect(fit.some((m) => m.role === 'tool')).toBe(false);
  });

  it('keeps the newest person turn, cut short, when it alone is too big', () => {
    const fit = fitHistory([u('old'), a('reply'), u('é'.repeat(9_000))], 1_000);
    expect(fit).toHaveLength(1);
    expect(historyBytes(fit)).toBeLessThanOrEqual(1_000);
    expect(fit[0].content!.startsWith('é')).toBe(true);
  });

  it('cuts on a character, not in the middle of an emoji or a letter', () => {
    const cut = clipToBytes('a😀b😀c', 5);
    expect(cut).toBe('a😀'); // 1 + 4 bytes; the next letter would pass 5
    expect(new TextEncoder().encode(cut).length).toBeLessThanOrEqual(5);
    expect(clipToBytes('a😀b😀c', 8)).toBe('a😀b'); // never half an emoji
    expect(cut).not.toContain('�');
  });

  it('handles an empty conversation', () => {
    expect(fitHistory([])).toEqual([]);
  });
});
