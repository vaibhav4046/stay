import { describe, expect, it } from 'vitest';
import { MORE_MENU_ASKS } from '@/components/moreMenuAsks';
import { parseMultiIntentUtterance } from '@/lib/voice/voiceCommands';
import { detectCrisisSignal, detectImpulsiveActionRisk, detectMedicationAdviceRequest, detectSensoryGroundingRequest } from '@/lib/safety/crisis';
import { isSmallTalk } from '@/lib/voice/smallTalk';
import { answerAboutStay } from '@/lib/voice/aboutStay';
import { wantsToShow } from '@/lib/vision/image';
import { APP_TOOL } from '@/lib/voice/agentTool';

/** What each line at the bottom of the More menu must open. The panels were taken out of the menu; this is what keeps them reachable. */
const OPENS = {
  'show my history': { type: 'show_history' },
  'show my memory': { type: 'show_memory' },
  'show parked thoughts': { type: 'show_panel', panel: 'parking' },
  'show my reminders': { type: 'show_panel', panel: 'reminders' },
  'have Stay call me': { type: 'show_panel', panel: 'call' },
} as const;

describe('the More menu asks', () => {
  it('lists exactly the phrases this test knows about', () => {
    expect([...MORE_MENU_ASKS].sort()).toEqual(Object.keys(OPENS).sort());
  });

  it.each(Object.entries(OPENS))('"%s" is understood as the command that opens its panel', (phrase, command) => {
    expect(parseMultiIntentUtterance(phrase).commands).toContainEqual(command);
  });

  it.each([...MORE_MENU_ASKS])('"%s" is not caught by a gate that runs before the conversation (small talk, about-Stay, show-me, safety)', (phrase) => {
    expect(isSmallTalk(phrase)).toBe(false);
    expect(answerAboutStay(phrase)).toBeNull();
    expect(wantsToShow(phrase)).toBe(false);
    expect(detectCrisisSignal(phrase).triggered).toBe(false);
    expect(detectMedicationAdviceRequest(phrase).triggered).toBe(false);
    expect(detectSensoryGroundingRequest(phrase).triggered).toBe(false);
    expect(detectImpulsiveActionRisk(phrase).triggered).toBe(false);
  });

  it('tells the model it can open history, memory, parked thoughts and reminders', () => {
    const tool = JSON.stringify(APP_TOOL).toLowerCase();
    for (const screen of ['history', 'memory', 'parked thoughts', 'reminders']) expect(tool, screen).toContain(screen);
  });
});
