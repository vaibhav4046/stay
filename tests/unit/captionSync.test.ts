import { describe, expect, it } from 'vitest';
import {
  computeProgressiveCaption,
  transitionConversationState,
  type ConversationState,
  type WordBoundary,
} from '@/lib/voice/captionSync';

describe('computeProgressiveCaption', () => {
  const sampleBoundaries: WordBoundary[] = [
    { text: 'Hey.', start: 0, end: 220 },
    { text: 'Good', start: 260, end: 450 },
    { text: 'to', start: 460, end: 580 },
    { text: 'hear', start: 600, end: 820 },
    { text: 'from', start: 850, end: 1050 },
    { text: 'you.', start: 1080, end: 1350 },
    { text: "What's", start: 1450, end: 1700 },
    { text: 'on', start: 1720, end: 1850 },
    { text: 'your', start: 1880, end: 2050 },
    { text: 'mind?', start: 2080, end: 2400 },
  ];
  const fullText = "Hey. Good to hear from you. What's on your mind?";

  it('holds captions empty during prebuffer before first audio sample is audible (elapsedMs < 0)', () => {
    const res = computeProgressiveCaption({
      elapsedMs: -80,
      wordBoundaries: sampleBoundaries,
      fallbackText: fullText,
      expectedAudioDurationMs: 2400,
      replyDoneReceived: true,
    });
    expect(res.text).toBe('');
    expect(res.finished).toBe(false);
  });

  it('does NOT dump full text when reply.done arrives early at 250ms while 2400ms of audio is still playing', () => {
    const at250 = computeProgressiveCaption({
      elapsedMs: 250,
      wordBoundaries: sampleBoundaries,
      fallbackText: fullText,
      expectedAudioDurationMs: 2400,
      replyDoneReceived: true, // network synthesis finished early
    });
    expect(at250.text).toBe('Hey. Good');
    expect(at250.finished).toBe(false);

    const at900 = computeProgressiveCaption({
      elapsedMs: 900,
      wordBoundaries: sampleBoundaries,
      fallbackText: fullText,
      expectedAudioDurationMs: 2400,
      replyDoneReceived: true,
    });
    expect(at900.text).toBe('Hey. Good to hear from');
    expect(at900.finished).toBe(false);

    const at2400 = computeProgressiveCaption({
      elapsedMs: 2400,
      wordBoundaries: sampleBoundaries,
      fallbackText: fullText,
      expectedAudioDurationMs: 2400,
      replyDoneReceived: true,
    });
    expect(at2400.text).toBe(fullText);
    expect(at2400.finished).toBe(true);
  });

  it('smoothly reveals second-sentence fallback words if flush 2 text arrived before flush 2 WordBoundaries', () => {
    const flush1Boundaries: WordBoundary[] = [
      { text: 'Hey.', start: 0, end: 250 },
      { text: 'I', start: 280, end: 380 },
      { text: 'hear', start: 400, end: 600 },
      { text: 'you.', start: 620, end: 850 },
    ];
    const twoSentenceText = 'Hey. I hear you. Let us take one tiny step together.';

    const at1300 = computeProgressiveCaption({
      elapsedMs: 1300,
      wordBoundaries: flush1Boundaries,
      fallbackText: twoSentenceText,
      expectedAudioDurationMs: 2600,
      replyDoneReceived: false,
    });
    expect(at1300.text).toContain('Hey. I hear you. Let');
    expect(at1300.finished).toBe(false);
  });

  it('reveals words proportionally using expectedAudioDurationMs when WordBoundaries are unavailable', () => {
    const resEarly = computeProgressiveCaption({
      elapsedMs: 220,
      wordBoundaries: [],
      fallbackText: fullText,
      expectedAudioDurationMs: 2200,
      replyDoneReceived: true,
    });
    expect(resEarly.text.split(/\s+/).length).toBeLessThan(4);
    expect(resEarly.finished).toBe(false);

    const resDone = computeProgressiveCaption({
      elapsedMs: 2200,
      wordBoundaries: [],
      fallbackText: fullText,
      expectedAudioDurationMs: 2200,
      replyDoneReceived: true,
    });
    expect(resDone.text).toBe(fullText);
    expect(resDone.finished).toBe(true);
  });
});

describe('transitionConversationState', () => {
  it('transitions deterministically through full-duplex voice lifecycle', () => {
    let state: ConversationState = 'IDLE';
    state = transitionConversationState(state, { type: 'connect_start' });
    expect(state).toBe('CONNECTING');

    state = transitionConversationState(state, { type: 'session_ready' });
    expect(state).toBe('LISTENING');

    state = transitionConversationState(state, { type: 'user_audio_started', at: 100 });
    expect(state).toBe('USER_SPEAKING');

    state = transitionConversationState(state, { type: 'user_partial', text: 'Hi hello' });
    expect(state).toBe('USER_SPEAKING');

    state = transitionConversationState(state, { type: 'user_turn_final', text: 'Hi hello', turnId: 'u-0' });
    expect(state).toBe('THINKING');

    state = transitionConversationState(state, { type: 'assistant_started' });
    expect(state).toBe('AGENT_SPEAKING');

    // Barge-in while agent is speaking transitions to INTERRUPTED
    state = transitionConversationState(state, { type: 'user_audio_started', at: 500 });
    expect(state).toBe('INTERRUPTED');

    // Turn finishes after interruption
    state = transitionConversationState(state, { type: 'user_turn_final', text: 'Wait stop', turnId: 'u-1' });
    expect(state).toBe('THINKING');

    state = transitionConversationState(state, { type: 'assistant_started' });
    expect(state).toBe('AGENT_SPEAKING');

    state = transitionConversationState(state, { type: 'assistant_stopped', reason: 'finished' });
    expect(state).toBe('LISTENING');

    // Emergency safety intervention returns to IDLE
    state = transitionConversationState(state, { type: 'safety_intervention', level: 'emergency' });
    expect(state).toBe('IDLE');
  });
});
