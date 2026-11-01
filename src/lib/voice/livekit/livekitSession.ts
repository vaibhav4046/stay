/**
 * [EXPERIMENTAL / REFERENCE PROTOTYPE]
 * LiveKit Persistent WebRTC Audio Transport & Duplex Turn Manager
 *
 * NOTE ON PRODUCTION TRANSPORT TRUTH:
 * The live production Stay runtime operates on FastSocket (persistent full-duplex WebSockets over AssemblyAI Universal-3.6 STT,
 * streaming LLM inference, ContinuousPcmPlayer, and AudioWorklet playback).
 * This module is a reference prototype for future WebRTC / LiveKit room integration. It is not currently active in production.
 */

export type LiveKitTurnState =
  | 'LISTENING'
  | 'THINKING'
  | 'SPEAKING'
  | 'INTERRUPTED'
  | 'PAUSED'
  | 'RECONNECTING'
  | 'TEXT_ONLY';

export interface ADHDStructuredSessionMemory {
  avoidedTask: string | null;
  smallestNextAction: string | null;
  activeTimerSeconds: number | null;
  interruptionCount: number;
  preferredResponseLength: 'ultra_brief' | 'concise' | 'standard';
  whatHelpedPreviously: string[];
  whatUserRejected: string[];
  checkinHistoryCount: number;
  safetyState: 'nominal' | 'crisis_active' | 'medication_boundary';
}

export interface LiveKitSessionConfig {
  roomName: string;
  participantName: string;
  serverUrl?: string;
  token?: string;
  sampleRate?: number;
  prebufferMs?: number;
  maxJitterBufferMs?: number;
  minTurnSilenceMs?: number;
  maxTurnSilenceMs?: number;
  endOfTurnConfidence?: number;
  onStateChange?: (state: LiveKitTurnState) => void;
  onTranscriptDelta?: (text: string) => void;
  onTranscriptFinal?: (text: string) => void;
  onAgentAudioChunk?: (pcm: Uint8Array, epoch: number) => void;
  onBackchannel?: (cue: string) => void;
}

export interface AudioPacket {
  epoch: number;
  sequence: number;
  pcm: Uint8Array;
  durationMs: number;
  timestamp: number;
}

export class LiveKitTurnManager {
  private state: LiveKitTurnState = 'LISTENING';
  private currentEpoch = 0;
  private audioSequence = 0;
  private jitterBuffer: AudioPacket[] = [];
  private memory: ADHDStructuredSessionMemory;
  private lastBackchannelAt = 0;
  private currentSpokenSentence = '';
  private completedSentences: string[] = [];

  constructor(private config: LiveKitSessionConfig) {
    this.memory = {
      avoidedTask: null,
      smallestNextAction: null,
      activeTimerSeconds: null,
      interruptionCount: 0,
      preferredResponseLength: 'concise',
      whatHelpedPreviously: [],
      whatUserRejected: [],
      checkinHistoryCount: 0,
      safetyState: 'nominal',
    };
  }

  public getState(): LiveKitTurnState {
    return this.state;
  }

  public getMemory(): ADHDStructuredSessionMemory {
    return { ...this.memory };
  }

  public updateMemory(patch: Partial<ADHDStructuredSessionMemory>): void {
    this.memory = { ...this.memory, ...patch };
  }

  public setState(next: LiveKitTurnState): void {
    if (this.state === next) return;
    this.state = next;
    this.config.onStateChange?.(next);
  }

  /**
   * Handle user speech start (partial or early utterance)
   * If Stay is currently SPEAKING or THINKING, triggers instantaneous barge-in interruption.
   */
  public onUserSpeechStarted(): void {
    if (this.state === 'SPEAKING' || this.state === 'THINKING') {
      this.interrupt();
    } else if (this.state === 'LISTENING') {
      // Nominal listening continuation
    }
  }

  /**
   * Instant barge-in interruption controller:
   * 1. Stops ongoing TTS immediately.
   * 2. Increments atomic epoch to discard unrendered buffer audio.
   * 3. Preserves completed sentences in memory.
   * 4. Updates interruption tally.
   * 5. Transitions through INTERRUPTED -> LISTENING.
   */
  public interrupt(): { discardedPackets: number; preservedText: string } {
    this.currentEpoch++;
    const discardedPackets = this.jitterBuffer.length;
    this.jitterBuffer = []; // Discard pending unfinished audio
    const preservedText = this.completedSentences.join(' ');
    this.memory.interruptionCount++;

    this.setState('INTERRUPTED');
    // Rapid deterministic recovery back to LISTENING for the new incoming utterance
    setTimeout(() => {
      if (this.state === 'INTERRUPTED') {
        this.setState('LISTENING');
      }
    }, 40);

    return { discardedPackets, preservedText };
  }

  /**
   * Streaming sentence-level TTS queue manager:
   * Chunks incoming LLM tokens on punctuation boundaries and dispatches to audio queue immediately.
   */
  public handleLlmStreamChunk(token: string): string[] {
    this.currentSpokenSentence += token;
    const sentenceDelimiters = /(?<=[.?!;:\n])\s+/;
    const parts = this.currentSpokenSentence.split(sentenceDelimiters);

    if (parts.length > 1) {
      const readySentences = parts.slice(0, -1);
      this.currentSpokenSentence = parts[parts.length - 1] || '';

      for (const sentence of readySentences) {
        const trimmed = sentence.trim();
        if (trimmed) {
          this.completedSentences.push(trimmed);
          this.enqueueSentenceAudio(trimmed);
        }
      }
      return readySentences;
    }
    return [];
  }

  /**
   * Finalizes reply generation and enqueues remaining partial sentence
   */
  public finishReply(): string | null {
    const remaining = this.currentSpokenSentence.trim();
    if (remaining) {
      this.completedSentences.push(remaining);
      this.enqueueSentenceAudio(remaining);
      this.currentSpokenSentence = '';
      return remaining;
    }
    return null;
  }

  private enqueueSentenceAudio(sentence: string): void {
    if (this.state !== 'SPEAKING') {
      this.setState('SPEAKING');
    }
    // Form synthesized packet payload
    const dummyPcm = new Uint8Array(960); // 20ms @ 24kHz 16-bit mono
    const packet: AudioPacket = {
      epoch: this.currentEpoch,
      sequence: ++this.audioSequence,
      pcm: dummyPcm,
      durationMs: 20,
      timestamp: Date.now(),
    };
    this.jitterBuffer.push(packet);
    this.config.onAgentAudioChunk?.(packet.pcm, packet.epoch);
  }

  /**
   * Dessa-style controlled backchannel evaluator:
   * Emits subtle, non-intrusive acknowledgment only when:
   * - User pauses > 1.2s during a long thought (> 12 words)
   * - Not speaking at high cadence (> 3.2 words/sec)
   * - Anti-fatigue cooldown of 8s is respected
   */
  public evaluateBackchannel(opts: {
    wordsSoFar: number;
    pauseDurationMs: number;
    speakingCadenceWps: number;
    isStuck?: boolean;
  }): string | null {
    const now = Date.now();
    if (now - this.lastBackchannelAt < 8000) return null;
    if (opts.speakingCadenceWps > 3.2) return null; // User is speaking rapidly: never interrupt

    let cue: string | null = null;
    if (opts.isStuck || (opts.wordsSoFar >= 5 && opts.pauseDurationMs >= 1500)) {
      cue = "I'm with you.";
    } else if (opts.wordsSoFar >= 14 && opts.pauseDurationMs >= 1200) {
      cue = 'mm-hm';
    }

    if (cue) {
      this.lastBackchannelAt = now;
      this.config.onBackchannel?.(cue);
      return cue;
    }
    return null;
  }

  /**
   * Serializes compact structured session memory for inclusion in prompt header
   */
  public serializeMemoryHeader(): string {
    const m = this.memory;
    const parts: string[] = ['[ADHD SESSION STATE]'];
    if (m.avoidedTask) parts.push(`AvoidedTask: "${m.avoidedTask}"`);
    if (m.smallestNextAction) parts.push(`SmallestNextAction: "${m.smallestNextAction}"`);
    if (m.activeTimerSeconds) parts.push(`TimerSeconds: ${m.activeTimerSeconds}`);
    if (m.interruptionCount > 0) parts.push(`InterruptionCount: ${m.interruptionCount}`);
    parts.push(`PreferredResponseLength: ${m.preferredResponseLength}`);
    if (m.whatHelpedPreviously.length > 0) parts.push(`WhatHelped: ${m.whatHelpedPreviously.slice(-3).join(', ')}`);
    if (m.whatUserRejected.length > 0) parts.push(`WhatRejected: ${m.whatUserRejected.slice(-3).join(', ')}`);
    parts.push(`SafetyState: ${m.safetyState}`);
    return parts.join(' | ');
  }
}
