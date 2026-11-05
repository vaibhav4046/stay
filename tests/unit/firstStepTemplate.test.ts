import { describe, expect, it } from 'vitest';
import { STRATEGY_DEFINITIONS, buildDeterministicCoachPlan, buildDeterministicFirstStep } from '@/lib/coach/strategies';
import type { StrategyKey } from '@/types/domain';

const STRATEGIES = Object.keys(STRATEGY_DEFINITIONS) as StrategyKey[];

/** A long, messy sentence, the kind that was pasted whole into a step and read aloud cut off in the middle of a quote. */
const LONG =
  'ugh I really have to write the long email to my landlord about the renewal and the deposit and the broken boiler, and I keep putting it off every single night';

describe('a first step names what it is about and never pastes the person\'s own sentence', () => {
  it.each(STRATEGIES)('%s: no quotation marks, no pasted words from the sentence, ends on a full stop', (strategy) => {
    const step = buildDeterministicFirstStep(LONG, strategy);
    expect(step).not.toMatch(/["“”]/);
    expect(step).not.toContain('boiler');
    expect(step).not.toContain('every single night');
    expect(step.split(/\s+/).length).toBeLessThanOrEqual(22);
    expect(step).toMatch(/[.?]$/);
  });

  it('a message to a named person names that person', () => {
    expect(buildDeterministicFirstStep('Reply to landlord email', 'reframing')).toBe('Write two rough sentences to your landlord. Nobody sees them yet.');
    expect(buildDeterministicFirstStep('Reply to landlord email', 'task_shrinking')).toBe('Open a blank message to your landlord and type one rough sentence. Do not send it.');
  });

  it('a phone call names who it is to (the live bug: "Create a \\"version 0\\" scratch pass of \\"call the dentist\\" where spelling, polish, and completeness Ready to set 10 minutes?")', () => {
    const p = buildDeterministicCoachPlan({ taskText: 'call the dentist', preferredMinutes: 10 });
    expect(p.firstStep).toBe('Write down the one thing you need to say to your dentist. Nobody hears it yet.');
    expect(p.spokenResponse).toBe('Write down the one thing you need to say to your dentist. Nobody hears it yet. Want a 10-minute timer?');
    expect(p.spokenResponse).not.toMatch(/version 0|scratch pass|call the dentist|Ready to set|right here with you/);
    expect(buildDeterministicFirstStep('call the dentist', 'task_shrinking')).toBe('Find the number for your dentist and put it on screen. You do not have to dial yet.');
  });

  it('a document, a form and a tidy-up each name their object', () => {
    expect(buildDeterministicFirstStep('finish the essay', 'task_shrinking')).toBe('Open the essay, type a working title, and list three rough bullets.');
    expect(buildDeterministicFirstStep('do my tax return', 'task_shrinking')).toContain('your tax paperwork');
    expect(buildDeterministicFirstStep('tidy the kitchen', 'task_shrinking')).toBe('Pick up five things from the kitchen and put them in one pile.');
  });

  it('a word that only contains another ("doctor" holds "doc") is not read as that word', () => {
    expect(buildDeterministicFirstStep('ring the doctor', 'task_shrinking')).not.toContain('document');
    expect(buildDeterministicFirstStep('learn the platform', 'task_shrinking')).not.toContain('the form');
  });

  it('when the sentence does not say what it is about, the step says "this", not the sentence', () => {
    expect(buildDeterministicFirstStep('this thing', 'timeboxing')).toBe('Work on this until the timer rings. You can stop the moment it does.');
  });

  it.each(['मुझे अपना कमरा साफ करना है', '¿Cómo puedo empezar esta tarea de matemáticas?', 'Je veux préparer mon mémoire pour demain', 'Ich möchte die Steuererklärung machen'])(
    'other languages: the sentence is not pasted (%s)',
    (text) => {
      const step = buildDeterministicFirstStep(text, 'task_shrinking');
      expect(step).not.toMatch(/["“”]/);
      expect(step).not.toContain(text);
    },
  );
});

describe('the plan around the step', () => {
  const plan = buildDeterministicCoachPlan({ taskText: LONG, preferredMinutes: 10 });

  it('is spoken whole: the step, then one question, with no stock opener and nothing cut off', () => {
    expect(plan.spokenResponse).toBe(`${plan.firstStep} Want a 10-minute timer?`);
    expect(plan.spokenResponse).not.toMatch(/right here with you|I hear you|Ready to set/i);
  });

  it('shows a plain sentence as the reason, never an internal note', () => {
    expect(plan.whyThisFits).toMatch(/^[A-Z][^"]*[.]$/);
    for (const def of Object.values(STRATEGY_DEFINITIONS)) {
      expect(def.shortDescription).not.toMatch(/explicitly|working-memory|cognitive|executive|private first pass/i);
    }
  });

  it('the check-in does not quote the step back', () => {
    expect(plan.checkinPrompt).toBe('Your 10-minute block is up. Did you get started?');
  });
});
