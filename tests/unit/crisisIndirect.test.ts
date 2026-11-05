import { describe, expect, it } from 'vitest';
import { detectCrisisSignal } from '@/lib/safety/crisis';

/** Safety review, 4 Nov 2026: indirect wording the detector missed, so the person got a productivity step and a timer. */
describe('indirect crisis wording is caught', () => {
  it.each([
    'I just want to go to sleep and never wake up',
    'sometimes I want to fall asleep and not wake up',
    'I have the pills saved up',
    "I've been saving up my pills",
    'nobody would notice if I was gone',
    'no one would care if I died',
    'अब और जीने का मन नहीं करता',
    'quiero desaparecer',
    'no quiero despertar',
    'je veux disparaître',
    'je ne veux plus me réveiller',
    'ich will nicht mehr aufwachen',
  ])('%s', (t) => expect(detectCrisisSignal(t).triggered, t).toBe(true));

  it.each([
    'I want to sleep in and not wake up early tomorrow',
    'I saved up for new headphones',
    'I took my pills this morning',
    'nobody would notice if I left the meeting early',
    'quiero desayunar',
    'I need to wake up at 7',
  ])('not a crisis: %s', (t) => expect(detectCrisisSignal(t).triggered, t).toBe(false));
});
