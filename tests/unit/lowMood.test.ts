import { describe, expect, it } from 'vitest';
import { LOW_MOOD_INSTRUCTION, isPersistentLowMood } from '@/lib/conversation/lowMood';
import { buildServerVoiceSystemPrompt } from '@/lib/voice/agentTool';

describe('low mood that has lasted (judge panel, 2 Nov 2026)', () => {
  it.each([
    "I've been feeling really low for a few weeks and nothing feels worth doing.",
    "I've felt down for months",
    "I'm so flat lately, it's been weeks",
    'nothing seems worth it anymore, nothing feels good',
    "I can't enjoy anything",
    'I lost interest in everything',
    'I have been depressed for a while',
  ])('notices: %s', (t) => expect(isPersistentLowMood(t)).toBe(true));

  it.each([
    'I feel a bit low today',
    'I keep avoiding my taxes',
    'the battery is low',
    'what is worth doing first on my list?',
    'I feel overwhelmed',
  ])('leaves alone: %s', (t) => expect(isPersistentLowMood(t)).toBe(false));

  it('the instruction suggests a doctor or someone they trust, points to urgent help, and never diagnoses', () => {
    expect(LOW_MOOD_INSTRUCTION).toMatch(/doctor or someone they trust/);
    expect(LOW_MOOD_INSTRUCTION).toMatch(/local emergency number/);
    expect(LOW_MOOD_INSTRUCTION).toMatch(/116 123/);
    expect(LOW_MOOD_INSTRUCTION).toMatch(/No diagnosis/);
    expect(LOW_MOOD_INSTRUCTION).toMatch(/never start with "I hear" or "It sounds like"/); // live, 3 Nov 2026: it opened with "I hear that"
  });

  it('is added to the prompt only when asked for', () => {
    expect(buildServerVoiceSystemPrompt(undefined, 'feeling', { lowMood: true })).toContain(LOW_MOOD_INSTRUCTION);
    expect(buildServerVoiceSystemPrompt(undefined, 'feeling')).not.toContain(LOW_MOOD_INSTRUCTION);
  });
});
