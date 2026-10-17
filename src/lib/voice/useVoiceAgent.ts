'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AudioSpectrumBands,
  BarrierType,
  CoachPlanProposal,
  SessionOutcome,
  StrategyKey,
  VoiceVisualState,
} from '@/types/domain';
import {
  detectCrisisSignal,
  detectMedicationAdviceRequest,
} from '@/lib/safety/crisis';
import {
  ProposeCoachingPlanToolArgsSchema,
  RecordSessionOutcomeToolArgsSchema,
  StartFocusTimerToolArgsSchema,
} from '@/lib/coach/schema';
import { buildDeterministicCoachPlan } from '@/lib/coach/strategies';
import { analyzeStreamingUtterance, type RealtimeStreamingAnalysis } from '@/lib/coach/knowledge';
import { loadUserCalibration, buildAdaptiveSystemPrompt } from '@/lib/coach/selfImprovement';
import {
  loadUserMemory,
  extractMemoriesFromUtterance,
  buildMemorySystemPrompt,
  type UserMemoryProfile,
} from '@/lib/coach/userMemory';
import { detectVoiceCommand, type VoiceCommandAction } from '@/lib/voice/voiceCommands';

export interface VoiceTranscriptEntry {
  id: string;
  role: 'user' | 'agent' | 'system';
  text: string;
  timestamp: string;
}

export interface UseVoiceAgentOptions {
  onPlanProposed?: (plan: CoachPlanProposal) => void;
  onStartTimerRequested?: (minutes: number, firstStep: string) => void;
  onOutcomeRecorded?: (outcome: SessionOutcome, helpfulRating?: number) => void;
  onCrisisDetected?: (message: string) => void;
  onMedicalBoundaryDetected?: (message: string) => void;
  onVoiceCommandDetected?: (command: VoiceCommandAction) => void;
  onShowMemoryRequested?: () => void;
  onShowHistoryRequested?: () => void;
  onGroundingRequested?: () => void;
  onChangeVoiceRequested?: (voiceId?: string) => void;
  onToggleQuietModeRequested?: () => void;
  onClearChatRequested?: () => void;
}

export interface AvailableVoice {
  id: string;
  name: string;
  gender: 'female' | 'male';
  accent: 'British' | 'American';
  description: string;
}

export const AVAILABLE_VOICES: AvailableVoice[] = [
  { id: 'anna', name: 'Anna', gender: 'female', accent: 'British', description: 'Calm, steadying British female voice' },
  { id: 'oliver', name: 'Oliver', gender: 'male', accent: 'British', description: 'Warm, thoughtful British male voice' },
  { id: 'amanda', name: 'Amanda', gender: 'female', accent: 'American', description: 'Supportive, conversational American female voice' },
  { id: 'charles', name: 'Charles', gender: 'male', accent: 'American', description: 'Grounded, reassuring American male voice' },
  { id: 'rachel', name: 'Rachel', gender: 'female', accent: 'American', description: 'Clear, gentle American female voice' },
  { id: 'josh', name: 'Josh', gender: 'male', accent: 'American', description: 'Crisp, attentive American male voice' },
];

export function detectTopicShape(text: string): number {
  const clean = text.toLowerCase();
  // 1. Calming Concentric Ripples / Somatic Grounding / Breathing / Overwhelm (Mode 4)
  if (/\b(?:breath|breathe|breathing|calm|ground|grounding|overwhelm(?:ed|ing)?|anxious|anxiety|panic|relax|slow|meditate|meditation|peace|rest)\b/i.test(clean)) {
    return 4;
  }
  // 2. Dual Fluid Spiral Ribbons / Creative / Music / Brainstorming / Art (Mode 3)
  if (/\b(?:music|song|art|draw|drawing|paint|painting|creative|creativity|design|brainstorm|idea|sketch|dance|guitar|canvas|create|build)\b/i.test(clean)) {
    return 3;
  }
  // 3. Conical Swell / Sweet Treats / Food / Rewards / Energy (Mode 1)
  if (/\b(?:ice\s*cream|sweet|treat|cake|coffee|snack|dessert|reward|sugar|fruit|cookie|eat|eating)\b/i.test(clean)) {
    return 1;
  }
  // 4. Structured Geometric Facets / Letters / Writing / Docs / Taxes / Code / Paperwork (Mode 2)
  if (/\b(?:letter|email|write|writing|doc|document|form|tax|taxes|paper|paperwork|report|text|code|coding|draft|essay|spreadsheet|work|file)\b/i.test(clean)) {
    return 2;
  }
  return 0; // Standard organic liquid wave
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToInt16Array(base64: string): Int16Array {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Int16Array(bytes.buffer);
}

export const SUPPORTED_LANGUAGES = [
  { code: 'auto', label: 'Auto Detect', flag: '🌐' },
  { code: 'en-US', label: 'English', flag: '🇬🇧' },
  { code: 'hi-IN', label: 'हिन्दी', flag: '🇮🇳' },
  { code: 'es-ES', label: 'Español', flag: '🇪🇸' },
  { code: 'fr-FR', label: 'Français', flag: '🇫🇷' },
  { code: 'de-DE', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'ja-JP', label: '日本語', flag: '🇯🇵' },
  { code: 'zh-CN', label: '中文', flag: '🇨🇳' },
  { code: 'ar-SA', label: 'العربية', flag: '🇸🇦' },
] as const;

export function detectTextLanguage(text: string, manualPreference?: string): string {
  if (manualPreference && manualPreference !== 'auto') {
    return manualPreference;
  }
  // 1. Non-Latin scripts
  if (/[\u0900-\u097F]/.test(text)) return 'hi-IN'; // Devanagari / Hindi
  if (/[\u0600-\u06FF]/.test(text)) return 'ar-SA'; // Arabic
  if (/[\u3040-\u30FF]/.test(text)) return 'ja-JP'; // Japanese Kana
  if (/[\u4E00-\u9FFF]/.test(text)) return 'zh-CN'; // CJK / Chinese

  // 2. German
  if (/[äöüß]/i.test(text) || /\b(ich|du|er|sie|es|wir|ihr|der|die|das|und|nicht|ein|eine|mit|für|machen)\b/i.test(text)) {
    return 'de-DE';
  }

  // 3. French
  if (/[œæçèêëîïôûù]/i.test(text) || /\b(je|tu|il|elle|nous|vous|ils|le|la|les|un|une|des|du|dans|pour|avec|est|sur|veux|faire|mon|mémoire)\b/i.test(text)) {
    return 'fr-FR';
  }

  // 4. Spanish
  if (/[¿¡ñáíóú]/i.test(text) || /\b(el|la|los|las|un|una|de|en|por|para|con|como|tarea|hacer|empezar|quiero|puedo|esta)\b/i.test(text)) {
    return 'es-ES';
  }

  return 'en-GB';
}

export function useVoiceAgent(options: UseVoiceAgentOptions = {}) {
  const [visualState, setVisualState] = useState<VoiceVisualState>('idle');
  const [isConnected, setIsConnected] = useState(false);
  const [audioEnergy, setAudioEnergy] = useState(0);
  const [audioBands, setAudioBands] = useState<AudioSpectrumBands>({
    low: 0,
    mid: 0,
    high: 0,
    overall: 0,
  });
  const [partialUserTranscript, setPartialUserTranscript] = useState('');
  const [transcripts, setTranscripts] = useState<VoiceTranscriptEntry[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [streamingAnalysis, setStreamingAnalysis] = useState<RealtimeStreamingAnalysis | null>(null);
  const [isHandsFreePaused, setIsHandsFreePaused] = useState(false);
  const [selectedLanguage, setSelectedLanguageState] = useState<string>('auto');
  const selectedLanguageRef = useRef<string>('auto');
  const [selectedVoice, setSelectedVoiceState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem('stay_selected_voice') || 'anna';
      } catch {
        return 'anna';
      }
    }
    return 'anna';
  });
  const selectedVoiceRef = useRef<string>(selectedVoice);
  const [topicShape, setTopicShape] = useState<number>(0);

  const setSelectedVoice = useCallback((voiceId: string) => {
    const valid = AVAILABLE_VOICES.find((v) => v.id === voiceId) ? voiceId : 'anna';
    setSelectedVoiceState(valid);
    selectedVoiceRef.current = valid;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('stay_selected_voice', valid);
      } catch {
        // ignore
      }
    }
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN && sessionReadyRef.current) {
      ws.send(
        JSON.stringify({
          type: 'session.update',
          session: {
            output: {
              type: 'audio',
              voice: valid,
              format: { encoding: 'audio/pcm', sample_rate: 24000 },
            },
          },
        })
      );
    }
  }, []);

  const [userMemory, setUserMemory] = useState<UserMemoryProfile>(() => {
    try {
      return loadUserMemory();
    } catch {
      return {
        name: null,
        roleOrField: null,
        coreTriggers: [],
        knownStrengths: [],
        facts: [],
        recentSessionsSummary: [],
        lastActive: new Date().toISOString(),
      };
    }
  });

  const wsRef = useRef<WebSocket | null>(null);
  const sessionReadyRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const backchannelTimerRef = useRef<NodeJS.Timeout | null>(null);
  const speechStartTimeRef = useRef<number>(0);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const speechRecRef = useRef<any>(null);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextPlaybackTimeRef = useRef<number>(0);
  const pendingToolResultsRef = useRef<
    Array<{ call_id: string; result: string; is_error: boolean }>
  >([]);
  const medicationSuppressionRef = useRef(false);
  const handsFreePausedRef = useRef(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const playEarcon = useCallback((type: 'pause' | 'resume' | 'chime') => {
    if (typeof window === 'undefined') return;
    try {
      const ctx = audioCtxRef.current || new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      if (type === 'pause') {
        osc.frequency.setValueAtTime(520, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(330, ctx.currentTime + 0.22);
      } else if (type === 'resume') {
        osc.frequency.setValueAtTime(380, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(640, ctx.currentTime + 0.22);
      } else {
        osc.frequency.setValueAtTime(660, ctx.currentTime);
      }
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.26);
    } catch {
      // ignore
    }
  }, []);

  const toggleHandsFreeMute = useCallback(() => {
    handsFreePausedRef.current = !handsFreePausedRef.current;
    setIsHandsFreePaused(handsFreePausedRef.current);
    if (handsFreePausedRef.current) {
      setVisualState('idle');
      playEarcon('pause');
    } else {
      setVisualState('listening');
      playEarcon('resume');
    }
  }, [playEarcon]);

  const stopPlaybackQueue = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
    for (const source of activeSourcesRef.current) {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // already stopped
      }
    }
    activeSourcesRef.current.clear();
    if (audioCtxRef.current) {
      nextPlaybackTimeRef.current = audioCtxRef.current.currentTime;
    }
  }, []);

  const triggerConversationalBackchannel = useCallback(() => {
    if (handsFreePausedRef.current || !sessionReadyRef.current) return;
    setVisualState('backchannel');
    if (audioCtxRef.current && audioCtxRef.current.state === 'running') {
      try {
        const ctx = audioCtxRef.current;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.18);
        gain.gain.setValueAtTime(0.001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.035, ctx.currentTime + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.32);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.33);
      } catch {
        // ignore
      }
    }
    setTimeout(() => {
      setVisualState((prev) => (prev === 'backchannel' ? 'listening' : prev));
    }, 750);
  }, []);

  const speakDeterministicBoundary = useCallback((text: string) => {
    if (typeof window === 'undefined') return;

    // 1. Play soft clinical boundary tone if audio context is active
    if (audioCtxRef.current && audioCtxRef.current.state === 'running') {
      try {
        const ctx = audioCtxRef.current;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(520, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(390, ctx.currentTime + 0.22);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.28);
      } catch {
        // ignore audio tone failure
      }
    }

    // 2. Play spoken audio via browser SpeechSynthesis with dynamic fluid wave pulsing
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        const detectedLang = detectTextLanguage(text, selectedLanguageRef.current);
        utterance.lang = detectedLang;
        const voices = window.speechSynthesis.getVoices();
        const langPrefix = detectedLang.split('-')[0].toLowerCase();
        const isMale = ['oliver', 'charles', 'josh'].includes(selectedVoiceRef.current);
        const matchedVoice =
          voices.find((v) => {
            const name = v.name.toLowerCase();
            const langMatches = v.lang.toLowerCase().startsWith(langPrefix);
            if (!langMatches && langPrefix !== 'en') return false;
            if (isMale) {
              return (
                name.includes('male') ||
                name.includes('oliver') ||
                name.includes('george') ||
                name.includes('david') ||
                name.includes('daniel') ||
                name.includes('guy') ||
                name.includes('charles') ||
                name.includes('josh')
              );
            }
            return (
              name.includes('female') ||
              name.includes('anna') ||
              name.includes('samantha') ||
              name.includes('victoria') ||
              name.includes('amanda') ||
              name.includes('rachel') ||
              name.includes('natural')
            );
          }) ||
          voices.find((v) => v.lang.toLowerCase().startsWith(langPrefix)) ||
          voices.find(
            (v) =>
              v.lang === 'en-GB' ||
              (v.lang.startsWith('en') &&
                (v.name.includes('UK') ||
                  v.name.includes('British') ||
                  v.name.includes('Natural') ||
                  v.name.includes('Google') ||
                  v.name.includes('Samantha') ||
                  v.name.includes('Victoria')))
          );
        if (matchedVoice) {
          utterance.voice = matchedVoice;
        }
        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        let energyTimer: NodeJS.Timeout | null = null;
        utterance.onstart = () => {
          setVisualState('speaking');
          let frame = 0;
          energyTimer = setInterval(() => {
            frame++;
            const syllableWave = Math.sin(frame * 0.45) * 0.5 + 0.5;
            const sibilantNoise = Math.random() > 0.75 ? Math.random() * 0.55 : 0.05;
            const low = 0.25 + syllableWave * 0.45;
            const mid = 0.2 + Math.random() * 0.35;
            const high = sibilantNoise;
            const overall = low * 0.5 + mid * 0.3 + high * 0.2;
            setAudioBands({ low, mid, high, overall });
            setAudioEnergy(overall);
          }, 75);
        };

        const cleanup = () => {
          if (energyTimer) clearInterval(energyTimer);
          setVisualState('listening');
          setAudioEnergy(0.05);
          setAudioBands({ low: 0, mid: 0, high: 0, overall: 0.05 });
        };
        utterance.onend = cleanup;
        utterance.onerror = cleanup;

        window.speechSynthesis.speak(utterance);
      } catch {
        setVisualState('listening');
      }
    }
  }, []);

  const scheduleAgentPcmChunk = useCallback((base64Audio: string) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    const pcm16 = base64ToInt16Array(base64Audio);
    if (pcm16.length === 0) return;

    const float32 = new Float32Array(pcm16.length);
    let sumSq = 0;
    for (let i = 0; i < pcm16.length; i++) {
      const sample = pcm16[i] / 0x8000;
      float32[i] = sample;
      sumSq += sample * sample;
    }
    const rms = Math.min(1, Math.sqrt(sumSq / pcm16.length) * 3.8);
    setAudioEnergy((prev) => prev * 0.4 + rms * 0.6);

    const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
    audioBuffer.copyToChannel(float32, 0);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    if (analyserRef.current) {
      source.connect(analyserRef.current);
    }

    const startAt = Math.max(ctx.currentTime + 0.015, nextPlaybackTimeRef.current);
    source.start(startAt);
    nextPlaybackTimeRef.current = startAt + audioBuffer.duration;

    activeSourcesRef.current.add(source);
    source.onended = () => {
      activeSourcesRef.current.delete(source);
      if (activeSourcesRef.current.size === 0) {
        setAudioEnergy(0.05);
        setAudioBands({ low: 0, mid: 0, high: 0, overall: 0.05 });
      }
    };
  }, []);

  const disconnectVoiceSession = useCallback(() => {
    sessionReadyRef.current = false;
    stopPlaybackQueue();

    if (speechRecRef.current) {
      try {
        speechRecRef.current.abort();
      } catch {
        // ignore
      }
      speechRecRef.current = null;
    }

    if (workletNodeRef.current) {
      try {
        workletNodeRef.current.port.onmessage = null;
        workletNodeRef.current.disconnect();
      } catch {
        // ignore
      }
      workletNodeRef.current = null;
    }

    if (mediaStreamRef.current) {
      for (const track of mediaStreamRef.current.getTracks()) {
        track.stop();
      }
      mediaStreamRef.current = null;
    }

    if (wsRef.current) {
      const ws = wsRef.current;
      wsRef.current = null;
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'session.end' }));
        }
        ws.close();
      } catch {
        // ignore
      }
    }

    if (backchannelTimerRef.current) {
      clearTimeout(backchannelTimerRef.current);
      backchannelTimerRef.current = null;
    }
    analyserRef.current = null;
    setAudioBands({ low: 0, mid: 0, high: 0, overall: 0 });

    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close();
      } catch {
        // ignore
      }
      audioCtxRef.current = null;
    }

    setIsConnected(false);
    setAudioEnergy(0);
    setPartialUserTranscript('');
    setVisualState('idle');
  }, [stopPlaybackQueue]);

  const handleClientToolCall = useCallback(
    (callId: string, name: string, rawArgs: Record<string, unknown>) => {
      try {
        if (name === 'propose_coaching_plan') {
          const parsed = ProposeCoachingPlanToolArgsSchema.parse(rawArgs);
          const plan = buildDeterministicCoachPlan({
            taskText: parsed.taskText,
            barrierType: parsed.barrierType as BarrierType,
            preferredStrategy: parsed.strategyKey as StrategyKey,
            preferredMinutes: parsed.timerMinutes,
          });
          plan.firstStep = parsed.firstStep;
          optionsRef.current.onPlanProposed?.(plan);
          pendingToolResultsRef.current.push({
            call_id: callId,
            result: JSON.stringify({ status: 'displayed_on_screen', firstStep: plan.firstStep }),
            is_error: false,
          });
          return;
        }

        if (name === 'start_focus_timer') {
          const parsed = StartFocusTimerToolArgsSchema.parse(rawArgs);
          optionsRef.current.onStartTimerRequested?.(parsed.minutes, parsed.firstStep);
          pendingToolResultsRef.current.push({
            call_id: callId,
            result: JSON.stringify({ status: 'timer_started', minutes: parsed.minutes }),
            is_error: false,
          });
          return;
        }

        if (name === 'record_session_outcome') {
          const parsed = RecordSessionOutcomeToolArgsSchema.parse(rawArgs);
          optionsRef.current.onOutcomeRecorded?.(parsed.outcome, parsed.helpfulRating);
          pendingToolResultsRef.current.push({
            call_id: callId,
            result: JSON.stringify({ status: 'outcome_logged', outcome: parsed.outcome }),
            is_error: false,
          });
          return;
        }

        pendingToolResultsRef.current.push({
          call_id: callId,
          result: JSON.stringify({ error: `Unknown tool: ${name}` }),
          is_error: true,
        });
      } catch (err) {
        pendingToolResultsRef.current.push({
          call_id: callId,
          result: JSON.stringify({
            error: err instanceof Error ? err.message : 'Invalid tool arguments',
          }),
          is_error: true,
        });
      }
    },
    []
  );

  const sendUserTextMessage = useCallback(
    (text: string) => {
      const clean = text.trim();
      if (!clean) return false;

      // Extract long-term memory from typed/spoken text
      const { profile: updatedMemory, extractedFact } = extractMemoriesFromUtterance(clean);
      if (extractedFact) {
        setUserMemory(updatedMemory);
      }

      // Detect topic-reactive dynamic shape
      const topic = detectTopicShape(clean);
      setTopicShape(topic);

      // Check text-based voice command
      const cmd = detectVoiceCommand(clean);
      if (cmd) {
        optionsRef.current.onVoiceCommandDetected?.(cmd);
        if (cmd.type === 'pause_listening') {
          handsFreePausedRef.current = true;
          setIsHandsFreePaused(true);
          setVisualState('idle');
          playEarcon('pause');
        } else if (cmd.type === 'resume_listening') {
          handsFreePausedRef.current = false;
          setIsHandsFreePaused(false);
          setVisualState('listening');
          playEarcon('resume');
        } else if (cmd.type === 'start_timer') {
          optionsRef.current.onStartTimerRequested?.(cmd.minutes, clean);
          playEarcon('chime');
        } else if (cmd.type === 'record_outcome') {
          optionsRef.current.onOutcomeRecorded?.(cmd.outcome);
          playEarcon('chime');
        } else if (cmd.type === 'change_voice') {
          setSelectedVoice(cmd.voiceId);
          playEarcon('chime');
        } else if (cmd.type === 'open_voice_menu') {
          optionsRef.current.onChangeVoiceRequested?.();
        } else if (cmd.type === 'show_memory') {
          optionsRef.current.onShowMemoryRequested?.();
        } else if (cmd.type === 'show_history') {
          optionsRef.current.onShowHistoryRequested?.();
        } else if (cmd.type === 'open_grounding') {
          optionsRef.current.onGroundingRequested?.();
        } else if (cmd.type === 'toggle_quiet_mode') {
          optionsRef.current.onToggleQuietModeRequested?.();
        } else if (cmd.type === 'clear_chat') {
          optionsRef.current.onClearChatRequested?.();
        }
      }

      setTranscripts((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}`,
          role: 'user',
          text: clean,
          timestamp: new Date().toISOString(),
        },
      ]);

      const crisis = detectCrisisSignal(clean);
      if (crisis.triggered) {
        disconnectVoiceSession();
        optionsRef.current.onCrisisDetected?.(crisis.message);
        return true;
      }

      const medBoundary = detectMedicationAdviceRequest(clean);
      if (medBoundary.triggered) {
        medicationSuppressionRef.current = true;
        stopPlaybackQueue();
        optionsRef.current.onMedicalBoundaryDetected?.(medBoundary.message);
        setTranscripts((prev) => [
          ...prev,
          {
            id: `med-boundary-${Date.now()}`,
            role: 'agent',
            text: medBoundary.message,
            timestamp: new Date().toISOString(),
          },
        ]);
        speakDeterministicBoundary(medBoundary.message);
        return true;
      }

      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN && sessionReadyRef.current) {
        ws.send(JSON.stringify({ type: 'conversation.message', role: 'user', content: clean }));
        ws.send(JSON.stringify({ type: 'reply.create' }));
        return true;
      }

      // If WebSocket is not open, execute via server coaching plan and speak out loud
      setVisualState('thinking');
      fetch('/api/coach/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskText: clean,
          userMemoryPrompt: buildMemorySystemPrompt(loadUserMemory()),
        }),
      })
        .then(async (res) => {
          if (!res.ok) throw new Error('plan fetch error');
          return (await res.json()) as CoachPlanProposal;
        })
        .then((planProposal) => {
          if (planProposal.safetyFlag === 'crisis') {
            optionsRef.current.onCrisisDetected?.(planProposal.spokenResponse);
            setVisualState('idle');
            return;
          }
          if (planProposal.safetyFlag === 'medical_boundary') {
            optionsRef.current.onMedicalBoundaryDetected?.(planProposal.spokenResponse);
            setTranscripts((prev) => [
              ...prev,
              {
                id: `med-${Date.now()}`,
                role: 'agent',
                text: planProposal.spokenResponse,
                timestamp: new Date().toISOString(),
              },
            ]);
            speakDeterministicBoundary(planProposal.spokenResponse);
            return;
          }
          optionsRef.current.onPlanProposed?.(planProposal);
          setTranscripts((prev) => [
            ...prev,
            {
              id: `agent-${Date.now()}`,
              role: 'agent',
              text: planProposal.spokenResponse,
              timestamp: new Date().toISOString(),
            },
          ]);
          speakDeterministicBoundary(planProposal.spokenResponse);
        })
        .catch(() => {
          const local = buildDeterministicCoachPlan({ taskText: clean });
          optionsRef.current.onPlanProposed?.(local);
          setTranscripts((prev) => [
            ...prev,
            {
              id: `agent-${Date.now()}`,
              role: 'agent',
              text: local.spokenResponse,
              timestamp: new Date().toISOString(),
            },
          ]);
          speakDeterministicBoundary(local.spokenResponse);
        });

      return true;
    },
    [disconnectVoiceSession, stopPlaybackQueue, speakDeterministicBoundary, playEarcon]
  );

  const startNativeSpeechRecognition = useCallback(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any })
        .SpeechRecognition ||
      (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any })
        .webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setErrorMessage(
        'Live speech recognition is unavailable in this browser. You can type in the box below.'
      );
      setVisualState('error');
      return;
    }

    try {
      if (speechRecRef.current) {
        try {
          speechRecRef.current.abort();
        } catch {
          // ignore
        }
      }

      const rec = new SpeechRecognition();
      speechRecRef.current = rec;
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang =
        selectedLanguageRef.current && selectedLanguageRef.current !== 'auto'
          ? selectedLanguageRef.current
          : typeof navigator !== 'undefined' && navigator.language
          ? navigator.language
          : 'en-US';

      rec.onstart = () => {
        sessionReadyRef.current = true;
        setIsConnected(true);
        setVisualState('listening');
        playEarcon('resume');
      };

      rec.onresult = (event: any) => {
        if (handsFreePausedRef.current) return;
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        if (interim) {
          // Cancel any current assistant speech on barge-in
          if ('speechSynthesis' in window && window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
          }
          if (backchannelTimerRef.current) {
            clearTimeout(backchannelTimerRef.current);
            backchannelTimerRef.current = null;
          }
          setPartialUserTranscript(interim);
          const energy = 0.25 + Math.random() * 0.25;
          setAudioEnergy(energy);
          setAudioBands({
            low: energy * 0.95,
            mid: energy * 0.7,
            high: energy * 0.45,
            overall: energy,
          });
          setVisualState('listening');
          const analysis = analyzeStreamingUtterance(interim);
          setStreamingAnalysis(analysis);
          const topic = detectTopicShape(interim);
          if (topic > 0) setTopicShape(topic);

          // ChatGPT-style listening interjection if user pauses mid-sentence
          if (interim.length > 15 && !handsFreePausedRef.current) {
            backchannelTimerRef.current = setTimeout(() => {
              triggerConversationalBackchannel();
            }, 1400);
          }
        }

        if (final.trim()) {
          if (backchannelTimerRef.current) {
            clearTimeout(backchannelTimerRef.current);
            backchannelTimerRef.current = null;
          }
          setPartialUserTranscript('');
          setAudioEnergy(0.05);
          setAudioBands({ low: 0, mid: 0, high: 0, overall: 0.05 });
          sendUserTextMessage(final.trim());
        }
      };

      rec.onerror = (e: any) => {
        if (e.error === 'no-speech') return;
        if (e.error === 'not-allowed') {
          setErrorMessage('Microphone access was denied. Please allow microphone permissions.');
          setVisualState('error');
          setIsConnected(false);
          return;
        }
      };

      rec.onend = () => {
        if (sessionReadyRef.current && !handsFreePausedRef.current) {
          try {
            rec.start();
          } catch {
            // ignore
          }
        }
      };

      rec.start();
    } catch {
      setErrorMessage('Browser speech recognition unavailable. You can type in the box below.');
      setVisualState('error');
    }
  }, [playEarcon, sendUserTextMessage]);

  const startVoiceSession = useCallback(async () => {
    setErrorMessage(null);
    setVisualState('connecting');

    try {
      // 1. Request microphone with hardware echo cancellation, noise suppression, and auto gain
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      // 2. Initialize default-rate AudioContext & load AudioWorkletProcessor
      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      nextPlaybackTimeRef.current = audioCtx.currentTime;

      // Real-time 3-band FFT AnalyserNode for vocal visemes & lip-sync deformation
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.75;
      analyserRef.current = analyser;

      await audioCtx.audioWorklet.addModule('/pcm-processor.js');

      // 3. Mint ephemeral single-use AssemblyAI token from our server route
      const tokenRes = await fetch('/api/voice/token', {
        method: 'POST',
      });
      if (!tokenRes.ok) {
        const errBody = await tokenRes.json().catch(() => ({}));
        throw new Error(
          errBody.error ||
            'Voice session token unavailable. You can continue immediately in Quiet Text Mode.'
        );
      }
      const { token, agentId, wsUrl } = (await tokenRes.json()) as {
        token: string;
        agentId: string;
        wsUrl: string;
      };

      // 4. Connect to AssemblyAI Voice Agent WebSocket
      const socket = new WebSocket(`${wsUrl}?token=${encodeURIComponent(token)}`);
      wsRef.current = socket;

      socket.onopen = () => {
        const calibration = loadUserCalibration();
        const memory = loadUserMemory();
        const adaptivePrompt = buildAdaptiveSystemPrompt(calibration);
        const memoryPrompt = buildMemorySystemPrompt(memory);
        const warmHumanPrompt = `You are Stay, an authentic, warm, deeply human conversational body-double companion for adults with ADHD.
You sound and feel like ChatGPT Voice: natural conversational pacing, casual contractions ("yeah", "I'm", "totally", "let's"), warm emotional validation, and genuine empathy.
You are sitting right beside the user as a trusted friend helping them through task paralysis.
Rules:
- MULTILINGUAL CONVERSATION: You are fully multilingual. If the user speaks in Hindi, Spanish, French, German, Japanese, Chinese, Arabic, Portuguese, Hinglish, Spanglish, or any other language, seamlessly detect it and respond in THAT SAME LANGUAGE with natural conversational warmth and native authentic phrasing.
- Speak naturally, gently, and warmly. Use spontaneous conversational backchannels ("Yeah, I totally hear you", "Ugh, that sounds exhausting", "Let's take all the pressure off").
- Never sound robotic, preachy, or clinical. Never lecture on ADHD psychology or symptoms.
- Keep spoken replies under 30 words so the conversation flows back and forth quickly without long monologues.
- Default focus timer is ${calibration.preferredMinutes} minutes if the user asks for focus, or whatever duration they say (such as 20 or 25 minutes).
- When they mention what they are avoiding, acknowledge how they feel, propose ONE ridiculously small first move (<60 seconds), and ask warmly if that feels doable.
- Never diagnose ADHD or advise on medication or doses.
- You have native hands-free voice command awareness:
  • If the user says "start timer", "start 20 minutes", or "let's do 15 min", invoke start_focus_timer with that duration.
  • If the user says "break this down" or "make it smaller", invoke propose_coaching_plan with task_shrinking.
  • If the user says "I'm done" or "I started", invoke record_session_outcome.
  • If the user says "stay pause" or "hold on", gently acknowledge and pause.

${memoryPrompt}

${adaptivePrompt}`;

        const greeting = memory.name
          ? `Hey ${memory.name}! I'm right here with you. What's on your mind today? Let's make the first step ridiculously light.`
          : "Hey! I'm Stay, sitting right here with you. What's one thing hanging over your head right now? We'll make the first move ridiculously easy.";

        socket.send(
          JSON.stringify({
            type: 'session.update',
            session: {
              system_prompt: warmHumanPrompt,
              greeting,
              output: {
                type: 'audio',
                voice: selectedVoiceRef.current || 'anna',
                format: { encoding: 'audio/pcm', sample_rate: 24000 },
              },
            },
          })
        );
      };

      socket.onmessage = (event) => {
        if (typeof event.data !== 'string') return;
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }

        const type = msg.type as string;

        if (type === 'session.ready') {
          sessionReadyRef.current = true;
          setIsConnected(true);
          setVisualState('listening');

          // Start streaming microphone audio now that session.ready has fired
          const source = audioCtx.createMediaStreamSource(stream);
          const worklet = new AudioWorkletNode(audioCtx, 'pcm-processor');
          workletNodeRef.current = worklet;

          worklet.port.onmessage = (e) => {
            const payload = e.data;
            if (!payload) return;

            if (payload.type === 'energy') {
              setAudioEnergy((prev) => prev * 0.55 + payload.rms * 0.45);
              return;
            }

            if (
              payload.type === 'pcm' &&
              sessionReadyRef.current &&
              socket.readyState === WebSocket.OPEN
            ) {
              // Suppress mic audio chunks when hands-free listening is paused
              if (handsFreePausedRef.current) return;

              const b64 = arrayBufferToBase64(payload.buffer);
              socket.send(
                JSON.stringify({
                  type: 'input.audio',
                  audio: b64,
                })
              );
            }
          };

          source.connect(analyser);
          source.connect(worklet);
          return;
        }

        if (type === 'input.speech.started') {
          stopPlaybackQueue();
          if (backchannelTimerRef.current) {
            clearTimeout(backchannelTimerRef.current);
            backchannelTimerRef.current = null;
          }
          speechStartTimeRef.current = Date.now();
          medicationSuppressionRef.current = false;
          if (!handsFreePausedRef.current) {
            setVisualState('listening');
          }
          setStreamingAnalysis(null);
          return;
        }

        if (type === 'transcript.user.delta') {
          // Per AssemblyAI docs: text is the full partial transcript so far — replace, never append
          const text = String(msg.text || '');
          setPartialUserTranscript(text);

          if (text.length > 4) {
            const analysis = analyzeStreamingUtterance(text);
            setStreamingAnalysis(analysis);
            const topic = detectTopicShape(text);
            if (topic > 0) setTopicShape(topic);
          }

          if (backchannelTimerRef.current) {
            clearTimeout(backchannelTimerRef.current);
            backchannelTimerRef.current = null;
          }
          if (text.length > 15 && !handsFreePausedRef.current) {
            backchannelTimerRef.current = setTimeout(() => {
              triggerConversationalBackchannel();
            }, 1400);
          }

          // Hands-free voice command interception in streaming delta
          const cmd = detectVoiceCommand(text);
          if (cmd) {
            optionsRef.current.onVoiceCommandDetected?.(cmd);
            if (cmd.type === 'pause_listening' && !handsFreePausedRef.current) {
              handsFreePausedRef.current = true;
              setIsHandsFreePaused(true);
              setVisualState('idle');
              stopPlaybackQueue();
              playEarcon('pause');
              return;
            }
            if (cmd.type === 'resume_listening' && handsFreePausedRef.current) {
              handsFreePausedRef.current = false;
              setIsHandsFreePaused(false);
              setVisualState('listening');
              playEarcon('resume');
              return;
            }
            if (cmd.type === 'change_voice') {
              setSelectedVoice(cmd.voiceId);
              playEarcon('chime');
            } else if (cmd.type === 'open_voice_menu') {
              optionsRef.current.onChangeVoiceRequested?.();
            } else if (cmd.type === 'show_memory') {
              optionsRef.current.onShowMemoryRequested?.();
            } else if (cmd.type === 'show_history') {
              optionsRef.current.onShowHistoryRequested?.();
            } else if (cmd.type === 'open_grounding') {
              optionsRef.current.onGroundingRequested?.();
            } else if (cmd.type === 'toggle_quiet_mode') {
              optionsRef.current.onToggleQuietModeRequested?.();
            } else if (cmd.type === 'clear_chat') {
              optionsRef.current.onClearChatRequested?.();
            }
          }

          const crisis = detectCrisisSignal(text);
          if (crisis.triggered) {
            disconnectVoiceSession();
            optionsRef.current.onCrisisDetected?.(crisis.message);
            return;
          }

          const medBoundary = detectMedicationAdviceRequest(text);
          if (medBoundary.triggered) {
            medicationSuppressionRef.current = true;
            stopPlaybackQueue();
          }
          return;
        }

        if (type === 'input.speech.stopped') {
          if (backchannelTimerRef.current) {
            clearTimeout(backchannelTimerRef.current);
            backchannelTimerRef.current = null;
          }
          setVisualState('thinking');
          return;
        }

        if (type === 'transcript.user') {
          const text = String(msg.text || '').trim();
          setPartialUserTranscript('');
          if (text) {
            setTranscripts((prev) => [
              ...prev,
              {
                id: String(msg.item_id || `u-${Date.now()}`),
                role: 'user',
                text,
                timestamp: new Date().toISOString(),
              },
            ]);

            // Autonomous Long-term memory extraction from spoken utterance
            const { profile: updatedMemory, extractedFact } = extractMemoriesFromUtterance(text);
            if (extractedFact) {
              setUserMemory(updatedMemory);
            }

            // Topic shape detection on finalized turn
            const topic = detectTopicShape(text);
            setTopicShape(topic);

            // Hands-free voice command execution on finalized user turn
            const cmd = detectVoiceCommand(text);
            if (cmd) {
              optionsRef.current.onVoiceCommandDetected?.(cmd);
              if (cmd.type === 'pause_listening') {
                handsFreePausedRef.current = true;
                setIsHandsFreePaused(true);
                setVisualState('idle');
                stopPlaybackQueue();
                playEarcon('pause');
                return;
              }
              if (cmd.type === 'resume_listening') {
                handsFreePausedRef.current = false;
                setIsHandsFreePaused(false);
                setVisualState('listening');
                playEarcon('resume');
                return;
              }
              if (cmd.type === 'start_timer') {
                optionsRef.current.onStartTimerRequested?.(cmd.minutes, text);
                playEarcon('chime');
              } else if (cmd.type === 'record_outcome') {
                optionsRef.current.onOutcomeRecorded?.(cmd.outcome);
                playEarcon('chime');
              } else if (cmd.type === 'change_voice') {
                setSelectedVoice(cmd.voiceId);
                playEarcon('chime');
              } else if (cmd.type === 'open_voice_menu') {
                optionsRef.current.onChangeVoiceRequested?.();
              } else if (cmd.type === 'show_memory') {
                optionsRef.current.onShowMemoryRequested?.();
              } else if (cmd.type === 'show_history') {
                optionsRef.current.onShowHistoryRequested?.();
              } else if (cmd.type === 'open_grounding') {
                optionsRef.current.onGroundingRequested?.();
              } else if (cmd.type === 'toggle_quiet_mode') {
                optionsRef.current.onToggleQuietModeRequested?.();
              } else if (cmd.type === 'clear_chat') {
                optionsRef.current.onClearChatRequested?.();
              }
            }

            const crisis = detectCrisisSignal(text);
            if (crisis.triggered) {
              disconnectVoiceSession();
              optionsRef.current.onCrisisDetected?.(crisis.message);
              return;
            }

            const medBoundary = detectMedicationAdviceRequest(text);
            if (medBoundary.triggered) {
              // Explicit safety gate: suppress any agent speech/audio from model for this turn
              medicationSuppressionRef.current = true;
              stopPlaybackQueue();
              optionsRef.current.onMedicalBoundaryDetected?.(medBoundary.message);
              setTranscripts((prev) => [
                ...prev,
                {
                  id: `med-boundary-${Date.now()}`,
                  role: 'agent',
                  text: medBoundary.message,
                  timestamp: new Date().toISOString(),
                },
              ]);
              // Genuinely audible and deterministic speech path:
              // speak the exact clinical boundary without requesting an LLM reply
              speakDeterministicBoundary(medBoundary.message);
            }
          }
          return;
        }

        if (type === 'reply.started') {
          pendingToolResultsRef.current = [];
          if (!medicationSuppressionRef.current) {
            setVisualState('speaking');
          }
          return;
        }

        if (type === 'reply.audio') {
          if (medicationSuppressionRef.current) {
            // Drop raw audio chunks from model to prevent any spoken dosing advice
            return;
          }
          const b64 = String(msg.data || '');
          if (b64) {
            setVisualState('speaking');
            scheduleAgentPcmChunk(b64);
          }
          return;
        }

        if (type === 'transcript.agent') {
          if (medicationSuppressionRef.current) {
            // Drop model transcript turn in favor of deterministic medical boundary turn
            return;
          }
          const text = String(msg.text || '').trim();
          if (text) {
            setTranscripts((prev) => [
              ...prev,
              {
                id: String(msg.item_id || `a-${Date.now()}`),
                role: 'agent',
                text,
                timestamp: new Date().toISOString(),
              },
            ]);
          }
          return;
        }

        if (type === 'tool.call') {
          if (medicationSuppressionRef.current) {
            // Drop any tool call emitted by model during medication suppression
            return;
          }
          const callId = String(msg.call_id || '');
          const name = String(msg.name || '');
          const args = (msg.arguments as Record<string, unknown>) || {};
          if (callId && name) {
            handleClientToolCall(callId, name, args);
          }
          return;
        }

        if (type === 'reply.done') {
          medicationSuppressionRef.current = false;
          const status = String(msg.status || 'completed');
          if (status === 'interrupted') {
            pendingToolResultsRef.current = [];
            stopPlaybackQueue();
            setVisualState('interrupted');
            return;
          }

          if (
            pendingToolResultsRef.current.length > 0 &&
            socket.readyState === WebSocket.OPEN
          ) {
            for (const item of pendingToolResultsRef.current) {
              socket.send(
                JSON.stringify({
                  type: 'tool.result',
                  call_id: item.call_id,
                  result: item.result,
                  is_error: item.is_error,
                })
              );
            }
            pendingToolResultsRef.current = [];
          }

          setVisualState('listening');
          return;
        }

        if (type === 'session.error') {
          console.warn('AssemblyAI session error, falling back to browser speech recognition', msg);
          startNativeSpeechRecognition();
          return;
        }

        if (type === 'session.ended') {
          disconnectVoiceSession();
        }
      };

      socket.onerror = () => {
        console.warn('AssemblyAI WebSocket error, activating native speech recognition fallback');
        startNativeSpeechRecognition();
      };

      socket.onclose = () => {
        sessionReadyRef.current = false;
        setIsConnected(false);
      };
    } catch (err) {
      console.warn('AssemblyAI voice session startup failed, falling back to browser speech recognition', err);
      startNativeSpeechRecognition();
    }
  }, [
    disconnectVoiceSession,
    handleClientToolCall,
    scheduleAgentPcmChunk,
    stopPlaybackQueue,
    startNativeSpeechRecognition,
  ]);

  /** Make the agent speak without a user utterance (documented `reply.create`). */
  const speakProactively = useCallback(
    (instructions: string) => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN && sessionReadyRef.current) {
        ws.send(JSON.stringify({ type: 'reply.create', instructions }));
        return true;
      }
      speakDeterministicBoundary(instructions);
      return true;
    },
    [speakDeterministicBoundary]
  );

  /** Seed context without triggering a reply (documented `conversation.message`). */
  const injectContext = useCallback((content: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !sessionReadyRef.current) return false;
    ws.send(JSON.stringify({ type: 'conversation.message', role: 'system', content }));
    return true;
  }, []);

  // Continuous Web Audio 3-band FFT formant spectrum analyzer loop
  useEffect(() => {
    if (!isConnected) return;
    let rafId: number;
    const freqData = new Uint8Array(128);

    const sample = () => {
      const analyser = analyserRef.current;
      if (analyser) {
        analyser.getByteFrequencyData(freqData);

        // Bins 0-6 (~0-700 Hz): Low band (fundamental vowels, formants) -> core swell & mouth contour
        let lowSum = 0;
        for (let i = 0; i <= 6; i++) lowSum += freqData[i];
        const low = lowSum / (7 * 255);

        // Bins 7-16 (~700-1500 Hz): Mid band (consonants, transitions) -> fluid wave displacement & currents
        let midSum = 0;
        for (let i = 7; i <= 16; i++) midSum += freqData[i];
        const mid = midSum / (10 * 255);

        // Bins 17-64 (~1500+ Hz): High band (sibilants, plosives, fricatives) -> surface ripples & starlight glints
        let highSum = 0;
        for (let i = 17; i <= 64; i++) highSum += freqData[i];
        const high = highSum / (48 * 255);

        const overall = Math.min(1, (low * 0.5 + mid * 0.3 + high * 0.2) * 2.2);

        if (overall > 0.02) {
          setAudioBands({ low, mid, high, overall });
          setAudioEnergy((prev) => prev * 0.4 + overall * 0.6);
        } else {
          setAudioBands((prev) => ({
            low: prev.low * 0.85,
            mid: prev.mid * 0.85,
            high: prev.high * 0.85,
            overall: prev.overall * 0.85,
          }));
        }
      }
      rafId = requestAnimationFrame(sample);
    };

    rafId = requestAnimationFrame(sample);
    return () => cancelAnimationFrame(rafId);
  }, [isConnected]);

  useEffect(() => {
    const onPageHide = () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify({ type: 'session.end' }));
          wsRef.current.close();
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      disconnectVoiceSession();
    };
  }, [disconnectVoiceSession]);

  const setSelectedLanguage = useCallback((lang: string) => {
    setSelectedLanguageState(lang);
    selectedLanguageRef.current = lang;
    if (speechRecRef.current) {
      try {
        speechRecRef.current.lang =
          lang !== 'auto'
            ? lang
            : typeof navigator !== 'undefined' && navigator.language
            ? navigator.language
            : 'en-US';
      } catch {
        // ignore
      }
    }
  }, []);

  return {
    visualState,
    setVisualState,
    isConnected,
    audioEnergy,
    audioBands,
    partialUserTranscript,
    transcripts,
    errorMessage,
    streamingAnalysis,
    isHandsFreePaused,
    toggleHandsFreeMute,
    selectedLanguage,
    setSelectedLanguage,
    supportedLanguages: SUPPORTED_LANGUAGES,
    selectedVoice,
    setSelectedVoice,
    availableVoices: AVAILABLE_VOICES,
    topicShape,
    setTopicShape,
    userMemory,
    refreshUserMemory: () => setUserMemory(loadUserMemory()),
    playEarcon,
    startVoiceSession,
    disconnectVoiceSession,
    speakProactively,
    injectContext,
    sendUserTextMessage,
  };
}

export type UseVoiceAgentReturn = ReturnType<typeof useVoiceAgent>;
