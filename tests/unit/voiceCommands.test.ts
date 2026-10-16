import { describe, expect, it } from 'vitest';
import { parseVoiceCommand } from '@/lib/voice/voiceCommands';

describe('Hands-Free Voice Command Parser', () => {
  it('detects pause listening commands', () => {
    expect(parseVoiceCommand('Stay pause for a second')).toEqual({ type: 'pause_listening' });
    expect(parseVoiceCommand('pause listening please')).toEqual({ type: 'pause_listening' });
    expect(parseVoiceCommand('mute microphone')).toEqual({ type: 'pause_listening' });
    expect(parseVoiceCommand('hold on')).toEqual({ type: 'pause_listening' });
  });

  it('detects resume listening commands', () => {
    expect(parseVoiceCommand('Hey Stay I am back')).toEqual({ type: 'resume_listening' });
    expect(parseVoiceCommand('Stay listen')).toEqual({ type: 'resume_listening' });
    expect(parseVoiceCommand('unmute')).toEqual({ type: 'resume_listening' });
  });

  it('detects timer start commands and extracts minute values', () => {
    expect(parseVoiceCommand('Start 20 minutes')).toEqual({ type: 'start_timer', minutes: 20 });
    expect(parseVoiceCommand('set timer for 15 min')).toEqual({ type: 'start_timer', minutes: 15 });
    expect(parseVoiceCommand('start a 10 minute focus block')).toEqual({ type: 'start_timer', minutes: 10 });
    expect(parseVoiceCommand('start focus timer')).toEqual({ type: 'start_timer', minutes: 20 });
  });

  it('detects task breakdown voice commands', () => {
    expect(parseVoiceCommand('Break this down for me')).toEqual({ type: 'break_down' });
    expect(parseVoiceCommand('shrink this task')).toEqual({ type: 'break_down' });
    expect(parseVoiceCommand('make it smaller')).toEqual({ type: 'break_down' });
  });

  it('detects outcome logging voice commands', () => {
    expect(parseVoiceCommand("I'm done with this step")).toEqual({ type: 'record_outcome', outcome: 'started' });
    expect(parseVoiceCommand('I finished the first step')).toEqual({ type: 'record_outcome', outcome: 'started' });
    expect(parseVoiceCommand('I partly started')).toEqual({ type: 'record_outcome', outcome: 'partly_started' });
    expect(parseVoiceCommand("couldn't start today")).toEqual({ type: 'record_outcome', outcome: 'not_started' });
    expect(parseVoiceCommand('had to stop early')).toEqual({ type: 'record_outcome', outcome: 'paused_or_stopped' });
  });

  it('ignores ordinary conversational speech', () => {
    expect(parseVoiceCommand('I need to reply to my landlord regarding rent')).toBeNull();
    expect(parseVoiceCommand('The weather is nice today')).toBeNull();
    expect(parseVoiceCommand('Why is it so hard to start working')).toBeNull();
  });
});
