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
  PredictTaskRealityToolArgsSchema,
  BrainstormStarterAnglesToolArgsSchema,
  SynthesizeTaskPathToolArgsSchema,
} from '@/lib/coach/schema';
import {
  calculateTaskReality,
  brainstormStarterAngles,
  synthesizeTaskPath,
} from '@/lib/coach/executiveEngine';
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
  onOpenTrainingRequested?: () => void;
  onCloseModalsRequested?: () => void;
  onSwitchViewRequested?: (mode: 'orb' | 'grid') => void;
  onNavigateRequested?: (path: string, label: string) => void;
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

export const TOPIC_SHAPE_LABELS: Record<number, { icon: string; label: string }> = {
  0: { icon: '🌊', label: 'Fluid Resonance' },
  1: { icon: '🍦', label: 'Reward Swirl' },
  2: { icon: '✒️', label: 'Crystalline Letterforms' },
  3: { icon: '🎨', label: 'Creative Ribbon' },
  4: { icon: '🪷', label: 'Therapeutic Lotus Calm' },
};

export function detectTopicShape(text: string): number {
  const clean = text.toLowerCase();
  // 1. Conical Swell / Sweet Treats / Food / Rewards / Dopamine Boost (Mode 1)
  if (/\b(?:ice\s*cream|sweet|treat|cake|coffee|snack|dessert|reward|sugar|fruit|cookie|eat|eating|chocolate|boba|pizza|dopamine\s+treat)\b/i.test(clean)) {
    return 1;
  }
  // 2. Dual Fluid Spiral Ribbons / Creative / Music / Brainstorming / Art (Mode 3)
  if (/\b(?:music|song|art|draw|drawing|paint|painting|creative|creativity|design|brainstorm|idea|sketch|dance|guitar|canvas|create|build)\b/i.test(clean)) {
    return 3;
  }
  // 3. Calming Concentric Ripples / Somatic Grounding / Chaotic Brain Fog / Frozen / Overwhelm (Mode 4)
  if (/\b(?:breath|breathe|breathing|calm|calming|therapeutic|therapy|soothe|soothing|gentle|zen|mindful|mindfulness|serene|ground|grounding|overwhelm(?:ed|ing)?|anxious|anxiety|panic|relax|slow|meditate|meditation|peace|rest|frozen|stuck|paralyzed|brain\s*fog|spiraling|scrolling|can'?t\s+think|mess|drowning|burnt?\s+out|exhausted)\b/i.test(clean)) {
    return 4;
  }
  // 4. Structured Geometric Facets / Letters / Writing / Docs / Taxes / Code / Paperwork (Mode 2)
  if (/\b(?:letter|letters|alphabet|word|words|email|emails|inbox|write|writing|doc|document|form|forms|tax|taxes|vat|hmrc|irs|bill|bills|rent|landlord|paper|paperwork|report|text|code|coding|draft|essay|spreadsheet|work|file)\b/i.test(clean)) {
    return 2;
  }
  return 0; // Standard organic liquid wave
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const CHUNK_SZ = 0x8000;
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK_SZ) {
    chunks.push(
      String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK_SZ) as unknown as number[])
    );
  }
  return window.btoa(chunks.join(''));
}

function base64ToInt16Array(base64: string): Int16Array {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Int16Array(bytes.buffer);
}

export interface SupportedLanguage {
  code: string;
  label: string;
  flag: string;
  nativeName: string;
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: 'auto', label: 'Auto Detect', flag: '🌐', nativeName: 'Universal Auto' },
  { code: 'en-GB', label: 'English', flag: '🇬🇧', nativeName: 'English' },
  { code: 'hi-IN', label: 'Hindi', flag: '🇮🇳', nativeName: 'हिन्दी' },
  { code: 'es-ES', label: 'Spanish', flag: '🇪🇸', nativeName: 'Español' },
  { code: 'fr-FR', label: 'French', flag: '🇫🇷', nativeName: 'Français' },
  { code: 'de-DE', label: 'German', flag: '🇩🇪', nativeName: 'Deutsch' },
  { code: 'it-IT', label: 'Italian', flag: '🇮🇹', nativeName: 'Italiano' },
  { code: 'pt-PT', label: 'Portuguese', flag: '🇵🇹', nativeName: 'Português' },
  { code: 'ja-JP', label: 'Japanese', flag: '🇯🇵', nativeName: '日本語' },
  { code: 'zh-CN', label: 'Chinese', flag: '🇨🇳', nativeName: '中文' },
  { code: 'ko-KR', label: 'Korean', flag: '🇰🇷', nativeName: '한국어' },
  { code: 'nl-NL', label: 'Dutch', flag: '🇳🇱', nativeName: 'Nederlands' },
  { code: 'ru-RU', label: 'Russian', flag: '🇷🇺', nativeName: 'Русский' },
  { code: 'tr-TR', label: 'Turkish', flag: '🇹🇷', nativeName: 'Türkçe' },
  { code: 'pl-PL', label: 'Polish', flag: '🇵🇱', nativeName: 'Polski' },
  { code: 'ar-SA', label: 'Arabic', flag: '🇸🇦', nativeName: 'العربية' },
  { code: 'sv-SE', label: 'Swedish', flag: '🇸🇪', nativeName: 'Svenska' },
  { code: 'no-NO', label: 'Norwegian', flag: '🇳🇴', nativeName: 'Norsk' },
  { code: 'da-DK', label: 'Danish', flag: '🇩🇰', nativeName: 'Dansk' },
  { code: 'fi-FI', label: 'Finnish', flag: '🇫🇮', nativeName: 'Suomi' },
  { code: 'el-GR', label: 'Greek', flag: '🇬🇷', nativeName: 'Ελληνικά' },
  { code: 'cs-CZ', label: 'Czech', flag: '🇨🇿', nativeName: 'Čeština' },
  { code: 'ro-RO', label: 'Romanian', flag: '🇷🇴', nativeName: 'Română' },
  { code: 'hu-HU', label: 'Hungarian', flag: '🇭🇺', nativeName: 'Magyar' },
  { code: 'uk-UA', label: 'Ukrainian', flag: '🇺🇦', nativeName: 'Українська' },
  { code: 'vi-VN', label: 'Vietnamese', flag: '🇻🇳', nativeName: 'Tiếng Việt' },
  { code: 'th-TH', label: 'Thai', flag: '🇹🇭', nativeName: 'ไทย' },
  { code: 'id-ID', label: 'Indonesian', flag: '🇮🇩', nativeName: 'Bahasa Indonesia' },
  { code: 'ms-MY', label: 'Malay', flag: '🇲🇾', nativeName: 'Bahasa Melayu' },
  { code: 'he-IL', label: 'Hebrew', flag: '🇮🇱', nativeName: 'עברית' },
  { code: 'bn-BD', label: 'Bengali', flag: '🇧🇩', nativeName: 'বাংলা' },
  { code: 'ta-IN', label: 'Tamil', flag: '🇮🇳', nativeName: 'தமிழ்' },
  { code: 'te-IN', label: 'Telugu', flag: '🇮🇳', nativeName: 'తెలుగు' },
];

export function detectTextLanguage(text: string, manualPreference?: string): string {
  if (manualPreference && manualPreference !== 'auto') {
    return manualPreference;
  }
  // 1. Non-Latin Unicode script classification
  if (/[\u0900-\u097F]/.test(text)) return 'hi-IN'; // Devanagari (Hindi)
  if (/[\u0980-\u09FF]/.test(text)) return 'bn-BD'; // Bengali
  if (/[\u0B80-\u0BFF]/.test(text)) return 'ta-IN'; // Tamil
  if (/[\u0C00-\u0C7F]/.test(text)) return 'te-IN'; // Telugu
  if (/[\u0600-\u06FF]/.test(text)) return 'ar-SA'; // Arabic
  if (/[\u0590-\u05FF]/.test(text)) return 'he-IL'; // Hebrew
  if (/[\u3040-\u30FF]/.test(text)) return 'ja-JP'; // Japanese Kana
  if (/[\uAC00-\uD7AF\u1100-\u11FF]/.test(text)) return 'ko-KR'; // Korean Hangul
  if (/[\u4E00-\u9FFF]/.test(text)) return 'zh-CN'; // CJK Unified Ideographs (Chinese)
  if (/[\u0370-\u03FF]/.test(text)) return 'el-GR'; // Greek
  if (/[\u0E00-\u0E7F]/.test(text)) return 'th-TH'; // Thai
  if (/[\u0400-\u04FF]/.test(text)) {
    return /[іїєґIЇЄҐ]/.test(text) ? 'uk-UA' : 'ru-RU'; // Cyrillic (Ukrainian vs Russian)
  }

  // 2. High-confidence Western Latin & unique phonetic scripts
  if (/[đĐăằắẳẵặơờớởỡợưừứửữựầấẩẫậềếểễệồốổỗộảạẻẹỉịỏọủụỳỷỹỵ]/i.test(text)) {
    return 'vi-VN'; // Vietnamese unique characters
  }
  if (/[¿¡ñ]/i.test(text) || /\b(?:el|la|los|las|un|una|de|en|por|para|con|como|tarea|hacer|empezar|quiero|puedo|esta)\b/i.test(text)) {
    return 'es-ES'; // Spanish
  }
  if (/[ãõ]/i.test(text) || /\b(?:para|com|não|uma|fazer|como|você|isso|estou|começar)\b/i.test(text)) {
    return 'pt-PT'; // Portuguese
  }
  if (/[œæ]/i.test(text) || /\b(?:je|tu|il|elle|nous|vous|ils|le|la|les|un|une|des|du|dans|pour|avec|est|sur|veux|faire|mon|mémoire)\b/i.test(text)) {
    return 'fr-FR'; // French
  }
  if (/[äöüß]/i.test(text) || /\b(?:ich|du|er|sie|es|wir|ihr|der|die|das|und|nicht|ein|eine|mit|für|machen)\b/i.test(text)) {
    return 'de-DE'; // German
  }
  if (/\b(?:il|lo|la|gli|le|per|con|non|sono|fare|questo|come|ciao|anche|grazie)\b/i.test(text)) {
    return 'it-IT'; // Italian
  }
  if (/[ěščřžďťň]/i.test(text)) {
    return 'cs-CZ'; // Czech
  }
  if (/[őű]/i.test(text) || /\b(?:nem|hogy|egy|van|volt|vagyok|lesz)\b/i.test(text)) {
    return 'hu-HU'; // Hungarian
  }
  if (/[ąćęłńóśźż]/i.test(text) || /\b(?:nie|się|jest|jak|ale|dla)\b/i.test(text)) {
    return 'pl-PL'; // Polish
  }
  if (/[çğıöşü]/i.test(text) || /\b(?:bir|ve|için|çok|değil|ile)\b/i.test(text)) {
    return 'tr-TR'; // Turkish
  }
  if (/[ăâîșț]/i.test(text) || /\b(?:este|pentru|sunt|care|cum)\b/i.test(text)) {
    return 'ro-RO'; // Romanian
  }
  if (/\b(?:het|een|niet|voor|zijn|hebben|over|maar|doen)\b/i.test(text)) {
    return 'nl-NL'; // Dutch
  }
  if (/[å]/i.test(text) || /\b(?:jag|och|inte|att|som|på)\b/i.test(text)) {
    return 'sv-SE'; // Swedish
  }
  if (/[æø]/i.test(text)) {
    return 'no-NO'; // Norwegian / Danish
  }
  if (/\b(?:ja|on|ei|hän|oli|ovat|mutta|kun|että)\b/i.test(text)) {
    return 'fi-FI'; // Finnish
  }
  if (/\b(?:yang|tidak|ini|itu|untuk|bisa|saya|ada|akan|dengan)\b/i.test(text)) {
    return 'id-ID'; // Indonesian / Malay
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
            : 'en-GB';
      } catch {
        // ignore
      }
    }
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN && sessionReadyRef.current) {
      const langMatch = SUPPORTED_LANGUAGES.find((l) => l.code === lang);
      const label = langMatch ? langMatch.label : lang;
      const instruction =
        lang === 'auto'
          ? 'Universal auto language detection active. Seamlessly match whatever language or mix the user speaks in real-time.'
          : `User has switched primary spoken language to ${label} (${lang}). Respond immediately and naturally in ${label}.`;
      ws.send(
        JSON.stringify({
          type: 'session.update',
          session: {
            instructions: instruction,
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

        if (name === 'predict_task_reality') {
          const parsed = PredictTaskRealityToolArgsSchema.parse(rawArgs);
          const calculation = calculateTaskReality(parsed.taskText);
          pendingToolResultsRef.current.push({
            call_id: callId,
            result: JSON.stringify(calculation),
            is_error: false,
          });
          return;
        }

        if (name === 'brainstorm_starter_angles') {
          const parsed = BrainstormStarterAnglesToolArgsSchema.parse(rawArgs);
          const brainstorm = brainstormStarterAngles(parsed.taskText);
          pendingToolResultsRef.current.push({
            call_id: callId,
            result: JSON.stringify(brainstorm),
            is_error: false,
          });
          return;
        }

        if (name === 'synthesize_task_path') {
          const parsed = SynthesizeTaskPathToolArgsSchema.parse(rawArgs);
          const path = synthesizeTaskPath(parsed.taskText);
          pendingToolResultsRef.current.push({
            call_id: callId,
            result: JSON.stringify(path),
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
        setTranscripts((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}`,
            role: 'user',
            text: clean,
            timestamp: new Date().toISOString(),
          },
        ]);
        if (cmd.type === 'pause_listening') {
          handsFreePausedRef.current = true;
          setIsHandsFreePaused(true);
          setVisualState('idle');
          playEarcon('pause');
          return true;
        } else if (cmd.type === 'resume_listening') {
          handsFreePausedRef.current = false;
          setIsHandsFreePaused(false);
          setVisualState('listening');
          playEarcon('resume');
          return true;
        } else if (cmd.type === 'start_timer') {
          optionsRef.current.onStartTimerRequested?.(cmd.minutes, clean);
          playEarcon('chime');
          return true;
        } else if (cmd.type === 'stop_timer') {
          playEarcon('pause');
          return true;
        } else if (cmd.type === 'record_outcome') {
          optionsRef.current.onOutcomeRecorded?.(cmd.outcome);
          playEarcon('chime');
          return true;
        } else if (cmd.type === 'change_voice') {
          setSelectedVoice(cmd.voiceId);
          playEarcon('chime');
          return true;
        } else if (cmd.type === 'change_language') {
          setSelectedLanguage(cmd.langCode);
          playEarcon('chime');
          return true;
        } else if (cmd.type === 'open_voice_menu') {
          optionsRef.current.onChangeVoiceRequested?.();
          playEarcon('chime');
          return true;
        } else if (cmd.type === 'show_memory') {
          optionsRef.current.onShowMemoryRequested?.();
          playEarcon('chime');
          return true;
        } else if (cmd.type === 'show_history') {
          optionsRef.current.onShowHistoryRequested?.();
          playEarcon('chime');
          return true;
        } else if (cmd.type === 'open_training') {
          optionsRef.current.onOpenTrainingRequested?.();
          playEarcon('chime');
          return true;
        } else if (cmd.type === 'close_modals') {
          optionsRef.current.onCloseModalsRequested?.();
          playEarcon('pause');
          return true;
        } else if (cmd.type === 'switch_view') {
          optionsRef.current.onSwitchViewRequested?.(cmd.mode);
          playEarcon('chime');
          return true;
        } else if (cmd.type === 'navigate') {
          optionsRef.current.onNavigateRequested?.(cmd.path, cmd.label);
          playEarcon('chime');
          return true;
        } else if (cmd.type === 'open_grounding') {
          optionsRef.current.onGroundingRequested?.();
          playEarcon('chime');
          return true;
        } else if (cmd.type === 'toggle_quiet_mode') {
          optionsRef.current.onToggleQuietModeRequested?.();
          playEarcon('chime');
          return true;
        } else if (cmd.type === 'calculate_time') {
          playEarcon('chime');
          const calculation = calculateTaskReality(clean);
          setTranscripts((prev) => [
            ...prev,
            {
              id: `reality-${Date.now()}`,
              role: 'agent',
              text: `⏱️ ${calculation.spokenSummary}\n\n• Perceived time: ~${calculation.perceivedMinutes} min\n• Micro-entry move: ${calculation.microEntrySeconds}s\n• Recommended block: ${calculation.recommendedSprintMinutes} min\n• Momentum rate: ${calculation.inertiaBreakRate}%`,
              timestamp: new Date().toISOString(),
            },
          ]);
          speakDeterministicBoundary(calculation.spokenSummary);
          return true;
        } else if (cmd.type === 'brainstorm_angles') {
          playEarcon('chime');
          const brainstorm = brainstormStarterAngles(clean);
          const formatted = `💡 3 Starter Angles for "${clean}":\n\n` +
            brainstorm.angles.map((a, i) => `${i + 1}. **${a.name}** (~${a.timeSeconds}s)\n${a.prompt}`).join('\n\n');
          setTranscripts((prev) => [
            ...prev,
            {
              id: `brainstorm-${Date.now()}`,
              role: 'agent',
              text: formatted,
              timestamp: new Date().toISOString(),
            },
          ]);
          speakDeterministicBoundary(brainstorm.spokenSummary);
          return true;
        } else if (cmd.type === 'synthesize_path') {
          playEarcon('chime');
          const path = synthesizeTaskPath(clean);
          const formatted = `🧭 3-Phase Action Path for "${clean}" (${path.totalSprintMinutes}m total):\n\n` +
            path.phases.map((p) => `Phase ${p.phase} · **${p.name}** (${p.durationMinutes}m)\n${p.action}`).join('\n\n');
          setTranscripts((prev) => [
            ...prev,
            {
              id: `path-${Date.now()}`,
              role: 'agent',
              text: formatted,
              timestamp: new Date().toISOString(),
            },
          ]);
          speakDeterministicBoundary(path.spokenSummary);
          return true;
        } else if (cmd.type === 'clear_chat') {
          optionsRef.current.onClearChatRequested?.();
          setTranscripts([]);
          return true;
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
      // 1. Request microphone with hardware echo cancellation, noise suppression, single-channel isolation, and auto gain
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: { ideal: 24000 },
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
- MULTILINGUAL CONVERSATION: You are fully multilingual across 32 languages. If the user speaks in Hindi, Spanish, French, German, Japanese, Chinese, Arabic, Portuguese, Hinglish, Spanglish, or any other language, seamlessly detect it and respond in THAT SAME LANGUAGE with natural conversational warmth and native authentic phrasing.
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

        const lastSession = memory.recentSessionsSummary && memory.recentSessionsSummary[0];
        let greeting = '';
        if (memory.name && lastSession?.task) {
          greeting = `Hey ${memory.name}! Welcome back. Last time we worked on "${lastSession.task}". How did that go, or what's one tiny thing we should tackle today?`;
        } else if (memory.name) {
          greeting = `Hey ${memory.name}! I'm right here with you. What's on your mind today? Let's make the first step ridiculously light.`;
        } else if (lastSession?.task) {
          greeting = `Welcome back! Last time we were working on "${lastSession.task}". Want to keep that momentum going, or pick something fresh?`;
        } else {
          greeting = "Hey! I'm Stay, sitting right here with you. What's one thing hanging over your head right now? We'll make the first move ridiculously easy.";
        }

        // Native keyterms vocabulary boosting for low-latency ADHD terminology recognition
        try {
          socket.send(
            JSON.stringify({
              type: 'UpdateConfiguration',
              keyterms: [
                'ADHD',
                'executive dysfunction',
                'body double',
                'timebox',
                'reframing',
                'Stay',
                'Oliver',
                'Anna',
                'Amanda',
                'Charles',
                'Rachel',
                'Josh',
                'grounding',
                'dopamine',
                'paralysis',
                'procrastination',
              ],
            })
          );
        } catch {
          // ignore if provider does not support frame
        }

        socket.send(
          JSON.stringify({
            type: 'session.update',
            session: {
              system_prompt: warmHumanPrompt,
              greeting,
              keyterms: [
                'ADHD',
                'Stay',
                'body double',
                'timebox',
                'grounding',
                'dopamine',
                'paralysis',
                'procrastination',
              ],
              tools: [
                {
                  type: 'function',
                  function: {
                    name: 'propose_coaching_plan',
                    description:
                      'Decompose an overwhelming task into ONE ridiculous micro-step (<60s) with a personalized CBT strategy.',
                    parameters: {
                      type: 'object',
                      properties: {
                        taskText: { type: 'string' },
                        barrierType: { type: 'string' },
                        strategyKey: { type: 'string' },
                        firstStep: { type: 'string' },
                        timerMinutes: { type: 'number' },
                      },
                      required: ['taskText', 'firstStep'],
                    },
                  },
                },
                {
                  type: 'function',
                  function: {
                    name: 'start_focus_timer',
                    description:
                      'Start a bounded focus timer sprint (e.g. 5, 10, 15, 20 minutes) with zero pressure.',
                    parameters: {
                      type: 'object',
                      properties: {
                        minutes: { type: 'number' },
                        firstStep: { type: 'string' },
                      },
                      required: ['minutes', 'firstStep'],
                    },
                  },
                },
                {
                  type: 'function',
                  function: {
                    name: 'record_session_outcome',
                    description: 'Log whether the user started, partly started, or did not start.',
                    parameters: {
                      type: 'object',
                      properties: {
                        outcome: { type: 'string' },
                      },
                      required: ['outcome'],
                    },
                  },
                },
                {
                  type: 'function',
                  function: {
                    name: 'predict_task_reality',
                    description:
                      'Calculate realistic initiation duration vs ADHD perceived time blindness.',
                    parameters: {
                      type: 'object',
                      properties: {
                        taskText: { type: 'string' },
                      },
                      required: ['taskText'],
                    },
                  },
                },
                {
                  type: 'function',
                  function: {
                    name: 'brainstorm_starter_angles',
                    description:
                      'Brainstorm 3 zero-friction starter angles to bypass executive freeze.',
                    parameters: {
                      type: 'object',
                      properties: {
                        taskText: { type: 'string' },
                      },
                      required: ['taskText'],
                    },
                  },
                },
                {
                  type: 'function',
                  function: {
                    name: 'synthesize_task_path',
                    description:
                      'Synthesize a structured 3-phase execution path for complex tasks.',
                    parameters: {
                      type: 'object',
                      properties: {
                        taskText: { type: 'string' },
                      },
                      required: ['taskText'],
                    },
                  },
                },
              ],
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
            } else if (cmd.type === 'change_language') {
              setSelectedLanguage(cmd.langCode);
              playEarcon('chime');
            } else if (cmd.type === 'open_voice_menu') {
              optionsRef.current.onChangeVoiceRequested?.();
            } else if (cmd.type === 'show_memory') {
              optionsRef.current.onShowMemoryRequested?.();
            } else if (cmd.type === 'show_history') {
              optionsRef.current.onShowHistoryRequested?.();
            } else if (cmd.type === 'open_training') {
              optionsRef.current.onOpenTrainingRequested?.();
            } else if (cmd.type === 'close_modals') {
              optionsRef.current.onCloseModalsRequested?.();
            } else if (cmd.type === 'switch_view') {
              optionsRef.current.onSwitchViewRequested?.(cmd.mode);
            } else if (cmd.type === 'navigate') {
              optionsRef.current.onNavigateRequested?.(cmd.path, cmd.label);
            } else if (cmd.type === 'open_grounding') {
              optionsRef.current.onGroundingRequested?.();
            } else if (cmd.type === 'toggle_quiet_mode') {
              optionsRef.current.onToggleQuietModeRequested?.();
            } else if (cmd.type === 'clear_chat') {
              optionsRef.current.onClearChatRequested?.();
              setTranscripts([]);
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
                return;
              } else if (cmd.type === 'stop_timer') {
                playEarcon('pause');
                return;
              } else if (cmd.type === 'record_outcome') {
                optionsRef.current.onOutcomeRecorded?.(cmd.outcome);
                playEarcon('chime');
                return;
              } else if (cmd.type === 'change_voice') {
                setSelectedVoice(cmd.voiceId);
                playEarcon('chime');
                return;
              } else if (cmd.type === 'change_language') {
                setSelectedLanguage(cmd.langCode);
                playEarcon('chime');
                return;
              } else if (cmd.type === 'open_voice_menu') {
                optionsRef.current.onChangeVoiceRequested?.();
                playEarcon('chime');
                return;
              } else if (cmd.type === 'show_memory') {
                optionsRef.current.onShowMemoryRequested?.();
                playEarcon('chime');
                return;
              } else if (cmd.type === 'show_history') {
                optionsRef.current.onShowHistoryRequested?.();
                playEarcon('chime');
                return;
              } else if (cmd.type === 'open_training') {
                optionsRef.current.onOpenTrainingRequested?.();
                playEarcon('chime');
                return;
              } else if (cmd.type === 'close_modals') {
                optionsRef.current.onCloseModalsRequested?.();
                playEarcon('pause');
                return;
              } else if (cmd.type === 'switch_view') {
                optionsRef.current.onSwitchViewRequested?.(cmd.mode);
                playEarcon('chime');
                return;
              } else if (cmd.type === 'navigate') {
                optionsRef.current.onNavigateRequested?.(cmd.path, cmd.label);
                playEarcon('chime');
                return;
              } else if (cmd.type === 'open_grounding') {
                optionsRef.current.onGroundingRequested?.();
                playEarcon('chime');
                return;
              } else if (cmd.type === 'toggle_quiet_mode') {
                optionsRef.current.onToggleQuietModeRequested?.();
                playEarcon('chime');
                return;
              } else if (cmd.type === 'calculate_time') {
                playEarcon('chime');
                const calculation = calculateTaskReality(text);
                setTranscripts((prev) => [
                  ...prev,
                  {
                    id: `reality-${Date.now()}`,
                    role: 'agent',
                    text: `⏱️ ${calculation.spokenSummary}\n\n• Perceived time: ~${calculation.perceivedMinutes} min\n• Micro-entry move: ${calculation.microEntrySeconds}s\n• Recommended block: ${calculation.recommendedSprintMinutes} min\n• Momentum rate: ${calculation.inertiaBreakRate}%`,
                    timestamp: new Date().toISOString(),
                  },
                ]);
                speakDeterministicBoundary(calculation.spokenSummary);
                return;
              } else if (cmd.type === 'brainstorm_angles') {
                playEarcon('chime');
                const brainstorm = brainstormStarterAngles(text);
                const formatted = `💡 3 Starter Angles for "${text}":\n\n` +
                  brainstorm.angles.map((a, i) => `${i + 1}. **${a.name}** (~${a.timeSeconds}s)\n${a.prompt}`).join('\n\n');
                setTranscripts((prev) => [
                  ...prev,
                  {
                    id: `brainstorm-${Date.now()}`,
                    role: 'agent',
                    text: formatted,
                    timestamp: new Date().toISOString(),
                  },
                ]);
                speakDeterministicBoundary(brainstorm.spokenSummary);
                return;
              } else if (cmd.type === 'synthesize_path') {
                playEarcon('chime');
                const path = synthesizeTaskPath(text);
                const formatted = `🧭 3-Phase Action Path for "${text}" (${path.totalSprintMinutes}m total):\n\n` +
                  path.phases.map((p) => `Phase ${p.phase} · **${p.name}** (${p.durationMinutes}m)\n${p.action}`).join('\n\n');
                setTranscripts((prev) => [
                  ...prev,
                  {
                    id: `path-${Date.now()}`,
                    role: 'agent',
                    text: formatted,
                    timestamp: new Date().toISOString(),
                  },
                ]);
                speakDeterministicBoundary(path.spokenSummary);
                return;
              } else if (cmd.type === 'clear_chat') {
                optionsRef.current.onClearChatRequested?.();
                setTranscripts([]);
                return;
              }
            } else if (selectedLanguageRef.current === 'auto' && text.length > 3) {
              // Real-time multilingual adaptation: If user naturally speaks another language, adapt provider instructions on the fly
              const autoLang = detectTextLanguage(text, 'auto');
              if (autoLang !== 'en-GB') {
                const langMatch = SUPPORTED_LANGUAGES.find((l) => l.code === autoLang);
                const label = langMatch ? langMatch.label : autoLang;
                const ws = wsRef.current;
                if (ws && ws.readyState === WebSocket.OPEN && sessionReadyRef.current) {
                  ws.send(
                    JSON.stringify({
                      type: 'session.update',
                      session: {
                        instructions: `User is speaking in ${label} (${autoLang}). Seamlessly respond in ${label} with warm ADHD body-doubling support.`,
                      },
                    })
                  );
                }
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
