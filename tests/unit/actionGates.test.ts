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
  ];
  it.each(yes)('%s: asked by "%s"', (action, text) => expect(mayDoAction(action, text), `${action}: ${text}`).toBe(true));

  const no: Array<[string, string]> = [
    ['dump_end', 'Did you get my question? Okay, good. Actually, wait, why is the sky blue?'],
    ['dump', 'I keep avoiding my taxes'], ['timer_stop', 'I could never stop procrastinating'],
    ['quiet', 'I need some quiet time today'], ['pause', 'I want to pause my gym membership'],
    ['delete_data', 'I deleted the email'], ['export_data', 'I need to export the report for work'],
    ['memory_forget', 'I keep forgetting my keys'], ['memory_add', 'I remember my first day at school'], ['memory_add', 'what is the capital of Australia?'],
    ['list_add', 'I need to reply to my landlord'], ['remind', 'I need a reminder app'], ['park', 'I parked the car outside'],
  ];
  it.each(no)('%s: not asked by "%s"', (action, text) => expect(mayDoAction(action, text), `${action}: ${text}`).toBe(false));

  it('actions that are not gated stay available', () => {
    expect(mayDoAction('open', 'whatever')).toBe(true);
    expect(GATED_ACTIONS).toContain('dump_end');
  });
});
