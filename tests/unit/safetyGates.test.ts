import { describe, expect, it } from 'vitest';
import { detectCrisisSignal, detectMedicationAdviceRequest } from '@/lib/safety/crisis';

const CRISIS_POSITIVE = [
  "I don't want to live anymore", 'I want to disappear forever', 'thinking about ending it tonight', 'kms',
  'i want to unalive myself', 'I want to cut myself', 'I am going to jump off the bridge', "there's no point in living",
  'I want to take my own life', 'everyone would be better off without me', 'I dont want to be here anymore',
  'I took too many pills', 'I feel like ending things', 'K I L L myself', 'kill  my self', "I'm suicidal",
  // non-English: the app advertises 32 languages, so the gate must be multilingual
  'मैं मरना चाहता हूँ', 'quiero morir', 'je veux mourir', 'ich will sterben', '죽고 싶어', '死にたい', '我想死',
  'أريد أن أموت', 'main khudkushi karna chahta hu', 'хочу умереть', 'ölmek istiyorum',
];
const CRISIS_NEGATIVE = [
  'Reply to my landlord about the renewal', 'my deadline is killing me', 'I walked 10 kms today', 'kill the process on my laptop',
  'I need to cut myself some slack', 'I keep burning myself out at work', 'end the meeting early',
  'call the pharmacy to refill my prescription', 'drown myself in work this week',
];
const MED_POSITIVE = [
  'my vyvanse makes me shaky is that dangerous', 'can I drink alcohol with adderall', 'is it ok to take two of my pills today',
  'I want to stop taking my medication', "what's the maximum dose of methylphenidate", 'is it safe to mix concerta and ibuprofen',
  'should I increase my elvanse', 'can I snort my adderall', 'my doctor said 20mg but can I do 30', 'how much vyvanse is too much',
  'Should I take 30mg or 40mg of my Vyvanse?', 'क्या मैं अपनी दवा की खुराक बढ़ा सकता हूँ', '¿puedo tomar más pastillas?',
];
const MED_NEGATIVE = [
  'call the pharmacy about my adderall prescription', 'log that I took my meds', 'remind me to pick up my prescription at 5',
  'Reply to my landlord about the renewal', 'write the 500 word essay', 'I need to take out the bins',
];

describe('crisis gate (multilingual, evasion-resistant)', () => {
  it.each(CRISIS_POSITIVE)('flags %s', (t) => expect(detectCrisisSignal(t).triggered).toBe(true));
  it.each(CRISIS_NEGATIVE)('does not flag %s', (t) => expect(detectCrisisSignal(t).triggered).toBe(false));
});

describe('medication boundary gate', () => {
  it.each(MED_POSITIVE)('flags %s', (t) => expect(detectMedicationAdviceRequest(t).triggered).toBe(true));
  it.each(MED_NEGATIVE)('does not flag %s', (t) => expect(detectMedicationAdviceRequest(t).triggered).toBe(false));
});
