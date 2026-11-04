import { describe, expect, it } from 'vitest';
import { repairToolCall } from '@/lib/voice/repairToolCall';

/** Live film run, 4 Nov 2026: "Show my report." offered only four actions; the model wrote action "show" and the provider refused the turn. */
describe('a tool call the provider refused is made when what the model meant is clear', () => {
  const allowed = ['open', 'ground', 'outcome', 'language'];
  it('"show" with a target means open, with that target as the value', () => {
    expect(JSON.parse(repairToolCall('{"name": "app", "arguments": {"action": "show", "target": "reports"}}', allowed)!)).toEqual({ action: 'open', value: 'reports' });
  });
  it('an allowed action is kept, and its value, minutes and step with it', () => {
    expect(JSON.parse(repairToolCall('{"name":"app","arguments":{"action":"open","value":"settings"}}', allowed)!)).toEqual({ action: 'open', value: 'settings' });
  });
  it('anything else is not guessed at', () => {
    expect(repairToolCall('{"name":"app","arguments":{"action":"delete_data"}}', allowed)).toBeNull(); // not on offer, not a synonym
    expect(repairToolCall('{"name":"other","arguments":{"action":"show"}}', allowed)).toBeNull();
    expect(repairToolCall('not json', allowed)).toBeNull();
    expect(repairToolCall('{"name":"app","arguments":{"action":"show"}}', ['ground'])).toBeNull(); // open is not on offer
  });
});

import { outcomeAsOpen } from '@/lib/voice/repairToolCall';
describe('an outcome that is really a request to see a screen', () => {
  it('"Show my report." with outcome / target reports is an open of the reports', () => {
    expect(JSON.parse(outcomeAsOpen('{"action":"outcome","target":"reports"}', 'Show my report.')!)).toEqual({ action: 'open', value: 'reports' });
    expect(JSON.parse(outcomeAsOpen('{"action":"outcome"}', 'show my history')!)).toEqual({ action: 'open', value: 'history' });
  });
  it('a real outcome is left alone, and so is any other action', () => {
    expect(outcomeAsOpen('{"action":"outcome","value":"started"}', 'Yeah, I wrote two lines.')).toBeNull();
    expect(outcomeAsOpen('{"action":"outcome","value":"started"}', 'show me how it went')).toBeNull();
    expect(outcomeAsOpen('{"action":"open","value":"reports"}', 'Show my report.')).toBeNull();
    expect(outcomeAsOpen('nope', 'Show my report.')).toBeNull();
  });
});
