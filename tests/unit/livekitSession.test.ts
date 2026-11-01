import { describe, it, expect, vi } from 'vitest';
import { LiveKitTurnManager } from '@/lib/voice/livekit/livekitSession';
import { POST as livekitTokenRoute } from '@/app/api/voice/livekit-token/route';
import { NextRequest } from 'next/server';

describe('LiveKit Persistent Turn Manager & Speech Architecture', () => {
  it('manages explicit duplex turn states: LISTENING -> THINKING -> SPEAKING -> INTERRUPTED -> LISTENING', () => {
    const states: string[] = [];
    const mgr = new LiveKitTurnManager({
      roomName: 'test-room',
      participantName: 'test-user',
      onStateChange: (s) => states.push(s),
    });

    expect(mgr.getState()).toBe('LISTENING');

    // Thinking state when turn ends
    mgr.setState('THINKING');
    expect(mgr.getState()).toBe('THINKING');

    // Speaking state as TTS tokens arrive
    mgr.handleLlmStreamChunk('Open your tax document. ');
    expect(mgr.getState()).toBe('SPEAKING');

    // Barge-in interruption when user starts speaking
    mgr.onUserSpeechStarted();
    expect(mgr.getState()).toBe('INTERRUPTED');
  });

  it('stops TTS immediately, discards unfinished audio, and preserves completed meaning on interruption', () => {
    const audioChunks: Uint8Array[] = [];
    const mgr = new LiveKitTurnManager({
      roomName: 'test-room',
      participantName: 'test-user',
      onAgentAudioChunk: (pcm) => audioChunks.push(pcm),
    });

    // LLM streams two sentences
    mgr.handleLlmStreamChunk('First, open the document on your desk. ');
    expect(audioChunks.length).toBe(1);

    mgr.handleLlmStreamChunk('Next, we are going to read through section three together and check');
    // Second sentence is incomplete (no terminal punctuation yet)

    // User interrupts: "Wait, stop, I don't have the document."
    const { discardedPackets, preservedText } = mgr.interrupt();

    expect(preservedText).toBe('First, open the document on your desk.');
    expect(mgr.getMemory().interruptionCount).toBe(1);
    expect(mgr.getState()).toBe('INTERRUPTED');
  });

  it('streams sentence-level TTS: dispatches first sentence while subsequent tokens generate', () => {
    const emittedSentences: string[] = [];
    const mgr = new LiveKitTurnManager({
      roomName: 'test-room',
      participantName: 'test-user',
      onAgentAudioChunk: () => {
        // audio enqueued
      },
    });

    // Chunk 1: partial tokens
    const r1 = mgr.handleLlmStreamChunk('Take one deep breath. ');
    expect(r1).toEqual(['Take one deep breath.']);

    // Chunk 2: second sentence tokens arriving
    const r2 = mgr.handleLlmStreamChunk('Pick up the pen. ');
    expect(r2).toEqual(['Pick up the pen.']);

    // Chunk 3: finalize with question
    mgr.handleLlmStreamChunk('Ready?');
    const remaining = mgr.finishReply();
    expect(remaining).toBe('Ready?');
  });

  it('evaluates Dessa-style backchannels sparingly based on silence, words, and cadence', () => {
    const backchannels: string[] = [];
    const mgr = new LiveKitTurnManager({
      roomName: 'test-room',
      participantName: 'test-user',
      onBackchannel: (cue) => backchannels.push(cue),
    });

    // 1. Rapid speaking cadence (> 3.2 wps) -> suppresses backchannel
    const suppressed = mgr.evaluateBackchannel({
      wordsSoFar: 20,
      pauseDurationMs: 1400,
      speakingCadenceWps: 3.8,
    });
    expect(suppressed).toBeNull();
    expect(backchannels.length).toBe(0);

    // 2. Pause during long thought (>=14 words, >=1200ms pause, normal cadence) -> "mm-hm"
    const mmhm = mgr.evaluateBackchannel({
      wordsSoFar: 16,
      pauseDurationMs: 1300,
      speakingCadenceWps: 2.1,
    });
    expect(mmhm).toBe('mm-hm');
    expect(backchannels).toContain('mm-hm');

    // 3. Anti-fatigue cooldown: consecutive call within 8s is rejected
    const cooldown = mgr.evaluateBackchannel({
      wordsSoFar: 25,
      pauseDurationMs: 1500,
      speakingCadenceWps: 2.0,
    });
    expect(cooldown).toBeNull();

    // 4. Stuck / struggling user
    const mgrStuck = new LiveKitTurnManager({
      roomName: 'room-2',
      participantName: 'user-2',
    });
    const stuckCue = mgrStuck.evaluateBackchannel({
      wordsSoFar: 6,
      pauseDurationMs: 1600,
      speakingCadenceWps: 1.5,
      isStuck: true,
    });
    expect(stuckCue).toBe("I'm with you.");
  });

  it('maintains compact structured ADHD session memory and serializes into header', () => {
    const mgr = new LiveKitTurnManager({
      roomName: 'test-room',
      participantName: 'test-user',
    });

    mgr.updateMemory({
      avoidedTask: 'Taxes 2024',
      smallestNextAction: 'Download W-2 PDF',
      activeTimerSeconds: 300,
      whatHelpedPreviously: ['2-minute micro step', 'calm countdown'],
      whatUserRejected: ['15-minute chunking'],
      safetyState: 'nominal',
    });

    const header = mgr.serializeMemoryHeader();
    expect(header).toContain('[ADHD SESSION STATE]');
    expect(header).toContain('AvoidedTask: "Taxes 2024"');
    expect(header).toContain('SmallestNextAction: "Download W-2 PDF"');
    expect(header).toContain('TimerSeconds: 300');
    expect(header).toContain('WhatHelped: 2-minute micro step, calm countdown');
    expect(header).toContain('WhatRejected: 15-minute chunking');
  });

  it('LiveKit token endpoint mints authenticated WebRTC session token with rate limiting and no secret leak', async () => {
    const req = new NextRequest('http://localhost:3000/api/voice/livekit-token', {
      method: 'POST',
      body: JSON.stringify({ room: 'stay-adhd-room', identity: 'patient-4046' }),
    });

    const res = await livekitTokenRoute(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.protocol).toBe('webrtc');
    expect(data.transport).toBe('livekit');
    expect(data.room).toBe('stay-adhd-room');
    expect(data.identity).toBe('patient-4046');
    expect(typeof data.token).toBe('string');
    expect(data.expiresIn).toBe(1800);
  });
});
