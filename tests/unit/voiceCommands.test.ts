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

  it('detects memory and history inspection commands', () => {
    expect(parseVoiceCommand('Show me the memory')).toEqual({ type: 'show_memory' });
    expect(parseVoiceCommand('show me memory')).toEqual({ type: 'show_memory' });
    expect(parseVoiceCommand('open memory')).toEqual({ type: 'show_memory' });
    expect(parseVoiceCommand('what do you remember about me')).toEqual({ type: 'show_memory' });
    expect(parseVoiceCommand('Show history')).toEqual({ type: 'show_history' });
    expect(parseVoiceCommand('show me chat history')).toEqual({ type: 'show_history' });
    expect(parseVoiceCommand('open chat history')).toEqual({ type: 'show_history' });
    expect(parseVoiceCommand('chat history')).toEqual({ type: 'show_history' });
  });

  it('detects navigation, modal close, training, and view switching commands', () => {
    expect(parseVoiceCommand('go to settings')).toEqual({
      type: 'navigate',
      path: '/app/settings',
      label: 'Settings',
    });
    expect(parseVoiceCommand('open clinical report')).toEqual({
      type: 'navigate',
      path: '/app/reports',
      label: 'Clinician Report',
    });
    expect(parseVoiceCommand('take me to treatment page')).toEqual({
      type: 'navigate',
      path: '/app/treatment',
      label: 'Treatment Context',
    });
    expect(parseVoiceCommand('go to history page')).toEqual({
      type: 'navigate',
      path: '/app/history',
      label: 'Session History',
    });
    expect(parseVoiceCommand('open orb diagnostic')).toEqual({
      type: 'navigate',
      path: '/demo/orb-diagnostic',
      label: 'Orb Diagnostic',
    });
    expect(parseVoiceCommand('switch to grid view')).toEqual({
      type: 'switch_view',
      mode: 'grid',
    });
    expect(parseVoiceCommand('switch to orb mode')).toEqual({
      type: 'switch_view',
      mode: 'orb',
    });
    expect(parseVoiceCommand('open model training')).toEqual({
      type: 'open_training',
    });
    expect(parseVoiceCommand('close panel')).toEqual({
      type: 'close_modals',
    });
  });

  it('detects grounding, voice switching, quiet mode, and clear chat commands', () => {
    expect(parseVoiceCommand('Stay ground me')).toEqual({ type: 'open_grounding' });
    expect(parseVoiceCommand('help me breathe')).toEqual({ type: 'open_grounding' });
    expect(parseVoiceCommand('Switch to male voice')).toEqual({ type: 'change_voice', voiceId: 'oliver' });
    expect(parseVoiceCommand('Change voice to Anna')).toEqual({ type: 'change_voice', voiceId: 'anna' });
    expect(parseVoiceCommand('Switch voice')).toEqual({ type: 'open_voice_menu' });
    expect(parseVoiceCommand('Turn on quiet mode')).toEqual({ type: 'toggle_quiet_mode' });
    expect(parseVoiceCommand('Clear chat')).toEqual({ type: 'clear_chat' });
    expect(parseVoiceCommand('Start over')).toEqual({ type: 'clear_chat' });
  });

  it('ignores ordinary conversational speech', () => {
    expect(parseVoiceCommand('I need to reply to my landlord regarding rent')).toBeNull();
    expect(parseVoiceCommand('The weather is nice today')).toBeNull();
    expect(parseVoiceCommand('Why is it so hard to start working')).toBeNull();
  });
});
