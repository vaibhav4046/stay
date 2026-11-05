import { describe, expect, it } from 'vitest';
import { mayDoAction, GATED_ACTIONS } from '@/lib/conversation/actionGates';

/** Soak, 3 Nov 2026: "...why is the sky blue?" made the model call dump_end, and Stay said "That did not work: no brain dump is running." */
describe('actions that change something happen only when the words ask for them', () => {
  const yes: Array<[string, string]> = [
    ['dump_end', "That's it, I'm done dumping."], ['dump_end', 'end the brain dump'], ['dump_end', 'stop the dump'],
    ['dump', 'let me do a brain dump'], ['dump', 'I need to get it all out of my head'],
    ['timer_stop', 'stop the timer'], ['timer_stop', 'cancel my timer'],
    ['quiet', 'be quiet for a bit'], ['quiet', 'mute yourself'], ['quiet', 'stop talking'],
    ['pause', 'pause for a minute'], ['pause', 'hold on a second'],
    ['delete_data', 'delete all my data'], ['export_data', 'export my data'], ['export_data', 'download everything'],
    ['memory_forget', 'forget that'], ['memory_forget', 'forget what I said about mornings'],
    ['memory_add', 'remember that I focus best in the morning'], ['memory_add', "don't forget I'm allergic to nuts"], ['memory_add', 'note that I hate calls'],
    ['list_add', 'add buy milk to my list'], ['list_add', 'put the dentist on my list'],
    ['remind', 'remind me in ten minutes'], ['remind', 'check in with me at three'],
    ['park', 'park it for later'],
    ['break_down', 'break it down into steps'], ['break_down', 'can you split this into smaller pieces'], ['break_down', 'give me a step by step'],
    ['plan_day', 'plan my day'], ['plan_day', 'what should I work on first'],
    ['step_next', "what's next"], ['step_next', "I'm done, next step"], ['resume', 'pick it up again'], ['wrap_up', 'what did we actually get done today'],
    ['open', 'show my report'], ['open', 'take me to my check-in'], ['plan', 'help me start the email'], ['memory_show', 'what do you remember about me'],
    ['list_show', 'show my list'], ['game', 'let us play a game'], ['voice', 'change your voice'],
    // found by a review, 4 Nov 2026: ordinary ways of asking that the first wording missed
    ['step_next', 'done'], ['step_next', 'okay done'], ['step_next', 'finished'], ['step_next', 'next'], ['step_next', 'what do I do next'],
    ['timer_stop', 'turn the timer off'], ['timer_stop', 'cancel it'], ['timer_stop', 'stop'],
    ['quiet', 'shut up'], ['break_down', 'make it smaller'], ['break_down', 'chunk it'], ['break_down', 'desglosa esto en pasos'],
    ['plan_day', 'organise my day'], ['plan_day', 'plan out my day'], ['plan_day', 'plan my whole day'],
    ['remind', 'tell me when five minutes pass'], ['remind', 'check on me in ten minutes'],
    ['resume', 'continue'], ['resume', 'let us continue'], ['wrap_up', 'I am done for the day'], ['wrap_up', 'how did I do today'],
    ['list_add', 'add milk to my shopping'], ['open', 'I want to see my list'], ['open', 'where is my plan'],
  ];
  it.each(yes)('%s: asked by "%s"', (action, text) => expect(mayDoAction(action, text), `${action}: ${text}`).toBe(true));

  // a bare yes to Stay's own offer asks for what Stay offered (the timer already worked this way; the other actions did not)
  it.each([
    ['break_down', 'Want me to break this into steps?', 'yes please'],
    ['plan', 'Want to start with the first step?', 'yeah'],
    ['plan_day', 'Should I plan your day?', 'sure'],
    ['wrap_up', 'Want me to wrap up the day?', 'ok'],
  ])('%s: "%s" then "%s"', (action, offer, reply) => expect(mayDoAction(action, reply, offer)).toBe(true));
  it('a bare yes after a line that offered something else, or no question, asks for nothing', () => {
    expect(mayDoAction('break_down', 'yes', 'Want me to start a timer?')).toBe(false);
    expect(mayDoAction('break_down', 'yes', 'I will break this into steps.')).toBe(false);
    expect(mayDoAction('delete_data', 'yes', 'Want me to delete all my data?')).toBe(false); // never by a bare yes
  });

  const no: Array<[string, string]> = [
    ['dump_end', 'Did you get my question? Okay, good. Actually, wait, why is the sky blue?'],
    ['dump', 'I keep avoiding my taxes'], ['timer_stop', 'I could never stop procrastinating'],
    ['quiet', 'I need some quiet time today'], ['pause', 'I want to pause my gym membership'],
    ['delete_data', 'I deleted the email'], ['export_data', 'I need to export the report for work'],
    ['memory_forget', 'I keep forgetting my keys'], ['memory_add', 'I remember my first day at school'], ['memory_add', 'what is the capital of Australia?'],
    ['list_add', 'I need to reply to my landlord'], ['remind', 'I need a reminder app'], ['park', 'I parked the car outside'],
    // live use, 4 Nov 2026: this sentence made the model start a four-step plan with a timer button and a timer of its own
    ['break_down', "Don't give me a lecture. Just tell me what to do right now."], ['break_down', 'I have a paper due at nine tomorrow and I keep scrolling'],
    ['plan_day', "I'm behind on everything"], ['step_next', 'I keep avoiding my email'], ['resume', 'I want to feel better about this'],
    ['wrap_up', 'The day is almost over'],
    // "I just avoid it. Every time I open the text my stomach drops." opened a panel on screen (4 Nov 2026)
    ['open', 'I just avoid it. Every time it is quiet my stomach drops.'], ['plan', 'I keep avoiding the email to my landlord'],
    ['memory_show', 'I just avoid it'], ['list_show', 'I keep avoiding my taxes'], ['game', 'I keep scrolling reels'], ['voice', 'I hate how this sounds'],
  ];
  it.each(no)('%s: not asked by "%s"', (action, text) => expect(mayDoAction(action, text), `${action}: ${text}`).toBe(false));

  it('actions that are not gated stay available', () => {
    expect(mayDoAction('ground', 'whatever')).toBe(true); // a grounding exercise carries no side effect and is a safety tool
    expect(mayDoAction('open', 'whatever')).toBe(false);
    expect(GATED_ACTIONS).toContain('dump_end');
  });
});
