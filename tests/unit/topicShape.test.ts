import { describe, expect, it } from 'vitest';
import { detectTopicShape } from '@/lib/voice/useVoiceAgent';

describe('Topic Shape Classifier', () => {
  it('detects ice cream, sweet treats, and food as shape 1 (conical swell)', () => {
    expect(detectTopicShape('I want to eat ice cream after this')).toBe(1);
    expect(detectTopicShape('Can I have some cake or dessert as a reward?')).toBe(1);
    expect(detectTopicShape('Grab a coffee and snack')).toBe(1);
    expect(detectTopicShape('A sweet cookie')).toBe(1);
  });

  it('detects letters, paperwork, email, code, and documents as shape 2 (structured facets)', () => {
    expect(detectTopicShape('I need to reply to this letter from my landlord')).toBe(2);
    expect(detectTopicShape('Writing an email to my manager')).toBe(2);
    expect(detectTopicShape('Doing my tax paperwork and spreadsheets')).toBe(2);
    expect(detectTopicShape('Fix this code bug in the file')).toBe(2);
    expect(detectTopicShape('Drafting an essay')).toBe(2);
  });

  it('detects music, art, creativity, and brainstorming as shape 3 (spiral ribbons)', () => {
    expect(detectTopicShape('Listen to music while brainstorming')).toBe(3);
    expect(detectTopicShape('I want to draw and sketch on canvas')).toBe(3);
    expect(detectTopicShape('Creative design work for my portfolio')).toBe(3);
    expect(detectTopicShape('Playing my guitar')).toBe(3);
  });

  it('detects breathing, somatic grounding, therapeutic, and overwhelm as shape 4 (concentric calming ripples)', () => {
    expect(detectTopicShape('Help me breathe, I feel anxious')).toBe(4);
    expect(detectTopicShape('I am completely overwhelmed right now')).toBe(4);
    expect(detectTopicShape('Let us meditate and calm down')).toBe(4);
    expect(detectTopicShape('Somatic ground me')).toBe(4);
    expect(detectTopicShape('Make it feel therapeutic and soothing')).toBe(4);
    expect(detectTopicShape('Gentle zen mindfulness')).toBe(4);
  });

  it('defaults to 0 (organic fluid wave) for neutral or unclassified speech', () => {
    expect(detectTopicShape('Hello how are you today')).toBe(0);
    expect(detectTopicShape('The car is parked outside')).toBe(0);
    expect(detectTopicShape('Testing 1 2 3')).toBe(0);
  });
});
