import { describe, expect, it } from 'vitest';
import {
  canTransition,
  isAllowedBackchannel,
  isHesitationOrEmpty,
  LEGAL_STATE_TRANSITIONS,
  shouldCommitBargeIn,
  shouldIgnoreEchoSpeechStarted,
  splitHeardAndUnheard,
  transitionToState,
  TURN_MACHINE_STATES,
  turnMachineReducer,
  upsertUserTurn,
  type TurnObject,
} from '@/lib/voice/turnMachine';

describe('§6.1 — Pure Turn State Machine (turnMachine.ts)', () => {
  it('defines the exact 12 required states', () => {
    expect(TURN_MACHINE_STATES).toEqual([
      'IDLE',
      'CONSENT_NEEDED',
      'CONNECTING',
      'LISTENING',
      'TRANSCRIBING',
      'THINKING',
      'SPEAKING',
      'INTERRUPTED',
      'RECONNECTING',
      'PAUSED',
      'TEXT_ONLY',
      'ERROR',
    ]);
  });

  it('permits every legal transition in LEGAL_STATE_TRANSITIONS and rejects every illegal transition', () => {
    for (const from of TURN_MACHINE_STATES) {
      const legalTargets = LEGAL_STATE_TRANSITIONS[from];
      for (const to of TURN_MACHINE_STATES) {
        const res = transitionToState(from, to);
        if (from === to) {
          expect(res).toEqual({ state: from, changed: false, rejected: false });
        } else if (legalTargets.includes(to)) {
          expect(canTransition(from, to)).toBe(true);
          expect(res).toEqual({ state: to, changed: true, rejected: false });
        } else {
          expect(canTransition(from, to)).toBe(false);
          expect(res.rejected).toBe(true);
          expect(res.state).toBe(from);
          expect(res.reason).toContain(`Illegal transition from ${from} to ${to}`);
        }
      }
    }
  });

  it('walks the complete duplex lifecycle: IDLE -> CONSENT_NEEDED -> CONNECTING -> LISTENING -> TRANSCRIBING -> THINKING -> SPEAKING -> INTERRUPTED -> LISTENING', () => {
    let s = turnMachineReducer('IDLE', { type: 'REQUEST_MIC', hasConsent: false }).state;
    expect(s).toBe('CONSENT_NEEDED');

    s = turnMachineReducer(s, { type: 'GRANT_CONSENT' }).state;
    expect(s).toBe('CONNECTING');

    s = turnMachineReducer(s, { type: 'SOCKETS_READY' }).state;
    expect(s).toBe('LISTENING');

    s = turnMachineReducer(s, { type: 'SPEECH_STARTED' }).state;
    expect(s).toBe('TRANSCRIBING');

    s = turnMachineReducer(s, { type: 'FINAL_TRANSCRIPT' }).state;
    expect(s).toBe('THINKING');

    s = turnMachineReducer(s, { type: 'REPLY_AUDIO_STARTED' }).state;
    expect(s).toBe('SPEAKING');

    s = turnMachineReducer(s, { type: 'BARGE_IN_COMMIT' }).state;
    expect(s).toBe('INTERRUPTED');

    s = turnMachineReducer(s, { type: 'CANCELLED_OR_TIMEOUT' }).state;
    expect(s).toBe('LISTENING');
  });

  it('rejects illegal reducer events without mutating state', () => {
    const r1 = turnMachineReducer('IDLE', { type: 'BARGE_IN_COMMIT' });
    expect(r1.rejected).toBe(true);
    expect(r1.state).toBe('IDLE');

    const r2 = turnMachineReducer('LISTENING', { type: 'GRANT_CONSENT' });
    expect(r2.rejected).toBe(true);
    expect(r2.state).toBe('LISTENING');

    const r3 = turnMachineReducer('SPEAKING', { type: 'CANCELLED_OR_TIMEOUT' });
    expect(r3.rejected).toBe(true);
    expect(r3.state).toBe('SPEAKING');
  });
});

describe('§6.2 — Turn Object Deduplication & Epoch Filtering', () => {
  it('updates a partial in-place, replaces it once on final, and drops older sessionEpochs', () => {
    let turns: TurnObject[] = [];

    turns = upsertUserTurn(turns, 2, {
      sessionEpoch: 1, // stale epoch
      replyEpoch: 1,
      turnOrder: 0,
      status: 'partial',
      verbatimText: 'stale turn',
    });
    expect(turns).toHaveLength(0);

    turns = upsertUserTurn(turns, 2, {
      sessionEpoch: 2,
      replyEpoch: 1,
      turnOrder: 0,
      status: 'partial',
      verbatimText: 'I need to start',
    });
    expect(turns).toHaveLength(1);
    expect(turns[0].status).toBe('partial');

    turns = upsertUserTurn(turns, 2, {
      sessionEpoch: 2,
      replyEpoch: 1,
      turnOrder: 0,
      status: 'partial',
      verbatimText: 'I need to start my report',
    });
    expect(turns).toHaveLength(1);
    expect(turns[0].verbatimText).toBe('I need to start my report');

    turns = upsertUserTurn(turns, 2, {
      sessionEpoch: 2,
      replyEpoch: 1,
      turnOrder: 0,
      status: 'final',
      verbatimText: 'I need to start my report.',
    });
    expect(turns).toHaveLength(1);
    expect(turns[0].status).toBe('final');
    expect(turns[0].verbatimText).toBe('I need to start my report.');

    // Late partial for turnOrder 0 is ignored once finalized
    turns = upsertUserTurn(turns, 2, {
      sessionEpoch: 2,
      replyEpoch: 1,
      turnOrder: 0,
      status: 'partial',
      verbatimText: 'I need to start my report late partial',
    });
    expect(turns).toHaveLength(1);
    expect(turns[0].verbatimText).toBe('I need to start my report.');
  });
});

describe('§6.3 — Two-Stage Barge-In, Backchannels ("sure" removed), Echo Guard & Heard/Unheard Split', () => {
  it('treats "yeah", "mm-hm", "uh-huh", "okay", "right" as backchannels, and removes "sure"', () => {
    expect(isAllowedBackchannel('yeah')).toBe(true);
    expect(isAllowedBackchannel('mm-hm')).toBe(true);
    expect(isAllowedBackchannel('uh-huh')).toBe(true);
    expect(isAllowedBackchannel('okay')).toBe(true);
    expect(isAllowedBackchannel('right')).toBe(true);

    // "sure" must NOT be treated as a passive backchannel per §6.3.4
    expect(isAllowedBackchannel('sure')).toBe(false);
    expect(shouldCommitBargeIn('sure')).toBe(true);
    expect(shouldCommitBargeIn('yeah')).toBe(false);
    expect(shouldCommitBargeIn('wait')).toBe(true);
    expect(shouldCommitBargeIn('stop')).toBe(true);
    expect(shouldCommitBargeIn('actually change that')).toBe(true);
    expect(isHesitationOrEmpty('um...')).toBe(true);
    expect(shouldCommitBargeIn('um...')).toBe(false);
  });

  it('ignores echo SpeechStarted within 250ms of TTS start unless mic RMS exceeds playback-correlated level', () => {
    expect(
      shouldIgnoreEchoSpeechStarted({ msSinceTtsStart: 120, micRms: 0.04, playbackRms: 0.08 })
    ).toBe(true);
    expect(
      shouldIgnoreEchoSpeechStarted({ msSinceTtsStart: 120, micRms: 0.35, playbackRms: 0.08 })
    ).toBe(false);
    expect(
      shouldIgnoreEchoSpeechStarted({ msSinceTtsStart: 350, micRms: 0.04, playbackRms: 0.08 })
    ).toBe(false);
  });

  it('splits heardText and unheardText accurately using renderedSamples and WordBoundaries', () => {
    const words = [
      { word: 'Open', start: 0, end: 200 },
      { word: 'your', start: 210, end: 380 },
      { word: 'tax', start: 400, end: 620 },
      { word: 'folder', start: 640, end: 950 },
      { word: 'now.', start: 960, end: 1250 },
    ];
    // 500ms rendered @ 24kHz = 12,000 samples -> heard "Open your tax", unheard "folder now."
    const split = splitHeardAndUnheard(
      'Open your tax folder now.',
      words,
      12_000,
      24_000
    );
    expect(split.renderedMs).toBe(500);
    expect(split.heardText).toBe('Open your tax');
    expect(split.unheardText).toBe('folder now.');
  });
});
