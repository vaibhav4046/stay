import { describe, expect, it } from 'vitest';
import { replyLanguageInstruction } from '@/lib/voice/replyLanguage';

describe('replyLanguageInstruction', () => {
  it('answers in the six languages AssemblyAI TTS speaks', () => {
    expect(replyLanguageInstruction('es')).toBe('The user is speaking Spanish. Reply in Spanish.');
    expect(replyLanguageInstruction('pt-BR')).toContain('Portuguese');
    expect(replyLanguageInstruction('DE')).toContain('German');
  });
  it('switches back to English when the person does', () => {
    expect(replyLanguageInstruction('en')).toBe('The user is speaking English. Reply in English.');
    expect(replyLanguageInstruction('')).toContain('English');
  });
  it('answers Hindi in Roman-letter Hinglish so the English voice can say it', () => {
    const i = replyLanguageInstruction('hi-IN');
    expect(i).toMatch(/Hinglish/);
    expect(i).toMatch(/never Devanagari/);
  });
  it('says honestly when the voice cannot speak the language, and stays in English', () => {
    const i = replyLanguageInstruction('ja', 'Japanese');
    expect(i).toContain('cannot speak Japanese yet');
    expect(i).toContain('reply in English');
  });
});
