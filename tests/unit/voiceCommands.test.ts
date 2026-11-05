import { describe, expect, it } from 'vitest';
import { detectPanel, isResumePhrase, parseVoiceCommand, parseMultiIntentUtterance } from '@/lib/voice/voiceCommands';

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

  it('opens inline panels by name, in a sentence', () => {
    const panel = (t: string) => parseMultiIntentUtterance(t).commands.filter((c) => c.type === 'show_panel');
    expect(panel('open brain dump')).toEqual([{ type: 'show_panel', panel: 'dump' }]);
    expect(panel("let's do a brain dump")).toEqual([{ type: 'show_panel', panel: 'dump' }]);
    expect(panel('show my routines')).toEqual([{ type: 'show_panel', panel: 'routines' }]);
    expect(panel('show parked thoughts')).toEqual([{ type: 'show_panel', panel: 'parking' }]);
    expect(panel('show my reminders')).toEqual([{ type: 'show_panel', panel: 'reminders' }]);
    expect(panel('show my to-do list')).toEqual([{ type: 'show_panel', panel: 'today' }]);
    expect(panel("what's on my list today")).toEqual([{ type: 'show_panel', panel: 'today' }]);
    expect(panel('call me in 5 min')).toEqual([{ type: 'show_panel', panel: 'call' }]);
    expect(panel('have Stay call me later')).toEqual([{ type: 'show_panel', panel: 'call' }]);
  });

  it('"show my ..." asks for a panel, never for an orb shape called "my"', () => {
    for (const t of ['show my history', 'show my routines', 'show parked thoughts', 'show my to-do list', 'open brain dump']) {
      expect(parseMultiIntentUtterance(t).commands.some((c) => c.type === 'synthesize_billion_shape'), t).toBe(false);
    }
    expect(parseMultiIntentUtterance('show my history').commands).toEqual([{ type: 'show_history' }]);
  });

  it('does not take other phrases for panels', () => {
    for (const t of ['call me Sam', 'I need to call mum later', 'I want to start my routine tomorrow', 'show me a rocket']) {
      expect(detectPanel(t), t).toBeNull();
    }
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

  it('detects Wispr Flow backtracking and correction voice commands', () => {
    expect(parseVoiceCommand('Scratch that')).toEqual({ type: 'scratch_that' });
    expect(parseVoiceCommand('erase that')).toEqual({ type: 'scratch_that' });
    expect(parseVoiceCommand('Actually, change that to call the bank')).toEqual({
      type: 'change_that_to',
      newText: 'call the bank',
    });
    expect(parseVoiceCommand('Repeat the last thing')).toEqual({ type: 'repeat_last' });
    expect(parseVoiceCommand('Say that again')).toEqual({ type: 'repeat_last' });
    expect(parseVoiceCommand('Show me what you heard')).toEqual({ type: 'show_what_heard' });
  });

  it('detects grounding, voice switching, quiet mode, and clear chat commands', () => {
    expect(parseVoiceCommand('Stay ground me')).toEqual({ type: 'open_grounding' });
    expect(parseVoiceCommand('help me breathe')).toEqual({ type: 'open_grounding' });
    expect(parseVoiceCommand('Switch to male voice')).toEqual({ type: 'change_voice', voiceId: 'charles' });
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

  it('detects ADHD cognitive game launch & difficulty voice commands in English, Hindi, and Korean', () => {
    expect(parseVoiceCommand('I want to play a game')).toEqual({
      type: 'start_game',
      game: 'simon',
      difficulty: undefined,
    });
    expect(parseVoiceCommand('play impulse game on hard')).toEqual({
      type: 'start_game',
      game: 'gonogo',
      difficulty: 'hard',
    });
    expect(parseVoiceCommand('play word rally game')).toEqual({
      type: 'start_game',
      game: 'wordrally',
      difficulty: undefined,
    });
    expect(parseVoiceCommand('मुझे गेम खेलना है')).toEqual({
      type: 'start_game',
      game: 'simon',
      difficulty: undefined,
    });
    expect(parseVoiceCommand('게임 하고 싶어')).toEqual({
      type: 'start_game',
      game: 'simon',
      difficulty: undefined,
    });
    expect(parseVoiceCommand('difficulty hard')).toEqual({
      type: 'set_game_difficulty',
      difficulty: 'hard',
    });
    expect(parseVoiceCommand('make it easy')).toEqual({
      type: 'set_game_difficulty',
      difficulty: 'easy',
    });
  });

  it('detects orb color/gradient, shape sandbox, and live web research commands', () => {
    expect(parseVoiceCommand('change orb color to aurora')).toEqual({
      type: 'change_orb_color',
      colorTheme: 'aurora',
    });
    expect(parseVoiceCommand('sunset gradient')).toEqual({
      type: 'change_orb_color',
      colorTheme: 'sunset',
    });
    expect(parseVoiceCommand('transform into lotus')).toEqual({
      type: 'change_orb_shape',
      shapeId: 4,
      shapeLabel: 'Therapeutic Lotus Calm',
    });
    expect(parseVoiceCommand('search web for ADHD dopamine')).toEqual({
      type: 'web_research',
      query: 'adhd dopamine',
    });
    expect(parseVoiceCommand('morph into a rocket')).toEqual({
      type: 'synthesize_billion_shape',
      concept: 'rocket',
    });
    expect(parseVoiceCommand('become a dragon')).toEqual({
      type: 'synthesize_billion_shape',
      concept: 'dragon',
    });
  });

  it('broadly understands "play the game" and conversational game requests', () => {
    expect(parseVoiceCommand('I said to play the game')).toEqual({
      type: 'start_game',
      game: 'simon',
      difficulty: undefined,
    });
    expect(parseVoiceCommand('play the game')).toEqual({
      type: 'start_game',
      game: 'simon',
      difficulty: undefined,
    });
    expect(parseVoiceCommand("let's play a game")).toEqual({
      type: 'start_game',
      game: 'simon',
      difficulty: undefined,
    });
  });
});

describe('Multi-Intent & Conversational Context Parser', () => {
  it('decomposes simultaneous game command, difficulty, shape morph, and task context in one breath', () => {
    const text =
      "I'm overwhelmed by my landlord email and quarterly taxes, let's play the game on hard and turn into a rocket ship";
    const result = parseMultiIntentUtterance(text);

    expect(result.isMultiContext).toBe(true);
    expect(result.commands.length).toBeGreaterThanOrEqual(2);
    expect(result.commands).toEqual(
      expect.arrayContaining([
        { type: 'start_game', game: 'simon', difficulty: 'hard' },
        { type: 'synthesize_billion_shape', concept: 'rocket ship' },
      ])
    );
    expect(result.conversationalContext).toContain('landlord email');
    expect(result.conversationalContext).not.toContain('play the game');
  });

  it('extracts multi-intent commands when user requests memory and timer together', () => {
    const text = 'Show me memory and start 15 minutes timer';
    const result = parseMultiIntentUtterance(text);

    expect(result.commands).toEqual(
      expect.arrayContaining([
        { type: 'show_memory' },
        { type: 'start_timer', minutes: 15 },
      ])
    );
  });

  it('hold on inside a sentence is not a pause (it muted the mic and nothing could un-mute it)', () => {
    expect(parseVoiceCommand('hold on, let me think')).not.toEqual({ type: 'pause_listening' });
  });
});

describe('isResumePhrase: the only thing heard while listening is paused', () => {
  it.each(['Hey Stay', 'Hey, Stay.', 'hey stay!', 'Resume', 'resume.', 'Resume listening', 'Stay, listen.', 'stay resume', 'Unmute', "I'm back", 'I’m back, Stay.', 'Okay, Stay.'])('wakes on %s', (t) => {
    expect(isResumePhrase(t)).toBe(true);
  });
  it.each([
    '',
    'pause listening',
    'hold on',
    'hey stay pause listening', // a pause is never a resume
    'I need to update my resume before Friday.', // long, and about a document
    'we should resume the meeting', // the word alone inside a sentence
    'let me tell you about my day',
    'stay',
  ])('stays paused on %j', (t) => {
    expect(isResumePhrase(t)).toBe(false);
  });
});
