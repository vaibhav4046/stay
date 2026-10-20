'use client';

import { byokHeaders } from '@/lib/byok/config';
import { FastSocket, FAST_TTS_LANGUAGE } from '@/lib/voice/fastSocket';
import { loadParked, parkThought } from '@/lib/coach/parkingLot';
import { addToday, loadToday, openToday } from '@/lib/coach/todayList';
import { findRoutine, loadRoutines } from '@/lib/routines/routines';
import { addReminder } from '@/lib/reminders';
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AudioSpectrumBands,
  BarrierType,
  CoachPlanProposal,
  SessionOutcome,
  StrategyKey,
  VoiceVisualState,
} from '@/types/domain';
import { NATIVE_PERSONA_FOR_LANG, PERSONAS, personaById, resolvePersona, type VoicePersona } from '@/lib/voice/personas';
import { agentVoiceFor, personaAfterLanguageChange, planSpeech } from '@/lib/voice/tts/plan';
import { cachedTtsCaps, refreshTtsCaps, voiceNeeds } from '@/lib/voice/tts/caps';
import { createTtsConnection } from '@/lib/voice/tts';
import { APP_TOOL, appKeyterms, buildGreeting, buildSystemPrompt, type AppActionArgs } from '@/lib/voice/agentTool';
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
import { lipSyncBus } from '@/lib/orb/lipSync';
import { loadUserCalibration, buildAdaptiveSystemPrompt } from '@/lib/coach/selfImprovement';
import {
  loadUserMemory,
  extractMemoriesFromUtterance,
  buildMemorySystemPrompt,
  addUserMemoryFact,
  removeUserMemoryFact,
  type UserMemoryProfile,
} from '@/lib/coach/userMemory';
import {
  detectVoiceCommand,
  parseMultiIntentUtterance,
  type VoiceCommandAction,
} from '@/lib/voice/voiceCommands';
import {
  synthesizeGenerativeShape,
  buildProceduralBillionShape,
  type GenerativeShapeSpec,
} from '@/lib/voice/generativeShapeEngine';

export type OrbColorTheme = 'default' | 'aurora' | 'sunset' | 'ocean' | 'cyber' | 'emerald';

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
  onShowParkingRequested?: () => void;
  onShowDumpRequested?: () => void;
  onRoutineRequested?: (routineId: string) => void;
  onRemindersChanged?: () => void;
  onTodayChanged?: () => void;
  onShowHistoryRequested?: () => void;
  onOpenTrainingRequested?: () => void;
  onCloseModalsRequested?: () => void;
  onSwitchViewRequested?: (mode: 'orb' | 'grid') => void;
  onNavigateRequested?: (path: string, label: string) => void;
  onGroundingRequested?: () => void;
  onChangeVoiceRequested?: (voiceId?: string) => void;
  onToggleQuietModeRequested?: () => void;
  onClearChatRequested?: () => void;
  onWebResearchRequested?: (query: string) => void;
  /** The agent asked the orb to take the shape of something (its show_shape tool). */
  onShapeRequested?: (concept: string) => void;
}

export interface AvailableVoice {
  id: string;
  name: string;
  gender: 'female' | 'male';
  accent: string;
  description: string;
}

/** One entry per persona; ids are the exact voice ids the AssemblyAI Voice Agent API accepts (see personas.ts for honesty notes). */
export const AVAILABLE_VOICES: AvailableVoice[] = PERSONAS.map((p) => ({
  id: p.id,
  name: p.name,
  gender: p.gender,
  accent: p.voiceLabel,
  description: `${p.voiceLabel}. ${p.style}`,
}));

/** Language -> the voice with that native accent. Voices cannot change mid-session, so switching restarts cleanly. */
export const NATIVE_VOICE_FOR_LANG: Record<string, string> = NATIVE_PERSONA_FOR_LANG;

/**
 * Languages verified end to end against the live AssemblyAI Voice Agent (scripts/voice-lang-probe): a spoken sentence
 * transcribed with <= 20% character error AND answered in the same language. The provider documents only six of
 * these (en es fr de it pt); the rest were measured. Pinning input.language_codes to one of them improves accuracy
 * (pt 13% -> 0%, hi 5% -> 0%). Other languages (pl el hu uk bn ta te th ...) were misheard on auto-detect and are
 * silent when pinned, so they use the browser's speech recognition instead.
 */
export const AGENT_VERIFIED_LANGS = ['en', 'es', 'fr', 'de', 'it', 'pt', 'hi', 'ja', 'zh', 'ko', 'nl', 'ru', 'tr', 'ar', 'sv', 'no', 'da', 'fi', 'ro', 'vi', 'id', 'ms', 'he'] as const;
export function isAgentVerifiedLanguage(code: string): boolean {
  return (AGENT_VERIFIED_LANGS as readonly string[]).includes(code.split('-')[0].toLowerCase());
}
/** Browser TTS fallback only: which ids sound male. */
const MALE_VOICE_IDS = ['charles', 'paul', 'george', 'michael'];

/** The documented session.tools shape is flat ({type,name,description,parameters}); the code builds OpenAI-style wrapped tools. */
function flattenTools(tools: Array<{ type: string; function?: Record<string, unknown> } & Record<string, unknown>>) {
  return tools.map((t) => (t.function ? { type: 'function', ...t.function } : t));
}

/** session.error codes that mean the agent session cannot continue; everything else is logged and ignored. */
const FATAL_SESSION_ERRORS = new Set([
  'UNAUTHORIZED', 'FORBIDDEN', 'server_error', 'INTERNAL_ERROR', 'agent_init_failed', 'agent_timeout',
  'session_expired', 'session_not_found', 'session_forbidden', 'at_capacity', 'concurrency_exceeded',
]);

export const TOPIC_SHAPE_LABELS: Record<number, { icon: string; label: string }> = {
  0: { icon: '🌊', label: 'Fluid Resonance' },
  1: { icon: '🍦', label: 'Reward Swirl' },
  2: { icon: '✒️', label: 'Crystalline Letterforms' },
  3: { icon: '🎨', label: 'Creative Ribbon' },
  4: { icon: '🪷', label: 'Therapeutic Lotus Calm' },
  5: { icon: '🎮', label: 'ADHD Game Arena' },
  6: { icon: '🌐', label: 'Knowledge & Research Globe' },
  7: { icon: '⏳', label: 'Focus Hourglass Vortex' },
  8: { icon: '✨', label: '1B AI Synthesized Morphology' },
};

export function detectTopicShape(text: string): number {
  const clean = text.toLowerCase();
  // 5. Interactive ADHD Cognitive Game Arena (Mode 5)
  if (
    /\b(?:play(?:\s+with\s+me)?\s+(?:a\s+|an\s+|the\s+|some\s+)?(?:orb\s+|memory\s+|puzzle\s+|cognitive\s+|adhd\s+|focus\s+)*(?:game|games|simon|pulse|impulse|word\s+rally)|let'?s\s+play\b|play\s+game\b|play\s+the\s+game\b|start\s+(?:the\s+)?game\b|orb\s+game|simon\s+pulse|impulse\s+shield|word\s+rally|game\s+mode|mujhe\s+game\s+khelna\s+hai|geim\s+hago\s+sipeo)\b/i.test(clean) ||
    /(?:गेम\s*खेल|게임\s*하)/.test(clean)
  ) {
    return 5;
  }
  // 6. Knowledge & Research Globe / Reading / Web Search (Mode 6)
  if (
    /\b(?:search\s+(?:the\s+)?(?:web|google|internet)|research\s+(?:topic|paper|article)|wikipedia|encyclopedia|read\s+aloud)\b/i.test(clean)
  ) {
    return 6;
  }
  // 7. Focus Hourglass Vortex (Mode 7)
  if (/\b(?:hourglass|pomodoro|countdown\s+vortex|time\s+vortex)\b/i.test(clean)) {
    return 7;
  }
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
  // 8. Check 1-Billion-Shape AI Semantic & Procedural Synthesizer (Rocket, Heart, Butterfly, Dragon, Lightning, DNA, Crown, Cat, Dog, Galaxy, etc.)
  const genSpec = synthesizeGenerativeShape(clean);
  if (genSpec && genSpec.legacyTopicShape === 8) {
    return 8;
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

const LATIN_REGION: Record<string, string> = { es: 'es-ES', pt: 'pt-PT', fr: 'fr-FR', de: 'de-DE', it: 'it-IT', nl: 'nl-NL', sv: 'sv-SE', pl: 'pl-PL', tr: 'tr-TR', ro: 'ro-RO', id: 'id-ID', fi: 'fi-FI', hu: 'hu-HU' };

/** A saved memory needs the person to ask for it (or state a fact about themselves); the model's own guesses are not stored. */
export const MEMORY_CUE = /\b(?:remember|note (?:that|this)|make a note|don'?t forget|do not forget|keep in mind|save (?:that|this)|my name is|call me|i prefer|i work best|i(?:'m| am) (?:allergic|diagnosed|on)|mera naam|recuerda|souviens|merke)\b/i;

/** Stop-words per Latin-script language, chosen to exclude words that are also ordinary English (on, come, he, for, an, die, per...). */
const LATIN_STOPWORDS: Record<string, Set<string>> = {
  en: new Set('the a an and or but is are was were be been am i me my you your we our they them he she it its this that these those of to in on at for with from by about as not no yes do does did have has had will would can could should just so if then than what which who how why when where want need like get got going really very too also okay'.split(' ')),
  es: new Set('el los las una unos unas por para con como tarea hacer empezar quiero puedo esta este que muy pero tengo estoy tambien porque donde cuando ahora necesito ayuda hola gracias soy eres somos'.split(' ')),
  pt: new Set('não uma uns umas fazer você voce isso estou começar comecar muito mas tenho também porque onde quando agora preciso ajuda olá obrigado são'.split(' ')),
  fr: new Set('je tu elle nous vous ils elles les une des du dans pour avec est sur veux faire mon ma mes pas que très mais suis bonjour merci aussi parce comment besoin aide'.split(' ')),
  de: new Set('ich du er sie wir ihr der die das und nicht ein eine mit für machen ist bin habe auch aber sehr wie wo wann jetzt brauche hilfe danke hallo'.split(' ')),
  it: new Set('il lo gli per non sono fare questo questa anche grazie ciao molto ma ho sto perché dove quando adesso bisogno aiuto cosa'.split(' ')),
  nl: new Set('het een niet voor zijn hebben maar doen ik jij wij ze mijn heel ook hoe waar wanneer nu nodig hulp dank hallo'.split(' ')),
  sv: new Set('jag och inte att som på är har vara också men mycket hur var när nu behöver hjälp tack hej'.split(' ')),
  pl: new Set('nie się jest jak ale dla mam chcę muszę bardzo też gdzie kiedy teraz pomoc dziękuję cześć'.split(' ')),
  tr: new Set('bir ve için çok değil ile bu ben sen biz ama evet hayır şimdi yardım teşekkürler merhaba istiyorum'.split(' ')),
  ro: new Set('este pentru sunt care cum și foarte dar nu eu tu noi ajutor mulțumesc bună vreau'.split(' ')),
  id: new Set('yang tidak ini itu untuk bisa saya ada akan dengan aku kamu kami tapi sangat bagaimana dimana kapan sekarang butuh bantuan terima kasih halo'.split(' ')),
  fi: new Set('ja ei hän oli ovat mutta kun että minä sinä hyvin myös miten missä milloin nyt tarvitsen apua kiitos hei'.split(' ')),
  hu: new Set('nem tudom ezt az ez és meg nincs kérem hogy egy van volt vagyok lesz én te mi nagyon hogyan hol mikor most kell segítség köszönöm szia'.split(' ')),
};

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

  // 1b. Romanized Hinglish & Romanized Korean (so speaking Hindi/Korean with Latin ASR also detects!)
  if (
    /\b(?:namaste|mujhe|mera|meri|kya|kaise|kahan|dimag|kaam|khelna|bolo|baat|bahut|nhi|nahi|karna|chahiye|yaar|bhai|theek|madad|shuru|thak|pareshaan)\b/i.test(
      text
    )
  ) {
    return 'hi-IN';
  }
  if (
    /\b(?:annyeong|annyeonghaseyo|geim|jipjung|dowajwo|jebal|eotteoke|sijak|himdeureo|gamsahamnida)\b/i.test(
      text
    )
  ) {
    return 'ko-KR';
  }

  // 2. Latin-script languages. English text must never be mistaken for another language: the old word lists contained
  // ordinary English words (on, come, he, for, ve from I've) and flipped English speakers into Turkish, Finnish or Italian.
  // So: distinctive letters first, then stop-words that are not English words, with a minimum count and share.
  const lower = text.replace(/[\u2018\u2019]/g, "'").toLowerCase();
  if (/[đăằắẳẵặơờớởỡợưừứửữựầấẩẫậềếểễệồốổỗộảạẻẹỉịỏọủụỳỷỹỵ]/.test(lower)) return 'vi-VN';
  if (/[¿¡ñ]/.test(lower)) return 'es-ES';
  if (/[ãõ]/.test(lower)) return 'pt-PT';
  if (/[œæ]/.test(lower)) return 'fr-FR';
  if (/[ß]/.test(lower)) return 'de-DE';
  if (/[ěščřžďťň]/.test(lower)) return 'cs-CZ';
  if (/[őű]/.test(lower)) return 'hu-HU';
  if (/[ąćęłśźż]/.test(lower)) return 'pl-PL';
  if (/[ğış]/.test(lower)) return 'tr-TR';
  if (/[șț]/.test(lower)) return 'ro-RO';

  const words = lower.match(/[a-zà-ÿ']+/g) ?? [];
  if (words.length < 2) return 'en-GB';
  const english = words.filter((w) => LATIN_STOPWORDS.en.has(w)).length;
  let best: { code: string; hits: number } | null = null;
  for (const [code, set] of Object.entries(LATIN_STOPWORDS)) {
    if (code === 'en') continue;
    const hits = words.filter((w) => set.has(w)).length;
    const enough = words.length <= 4 ? hits >= 2 && hits / words.length >= 0.5 : hits >= 3 && hits / words.length >= 0.25;
    if (enough && hits > english * 2 && (!best || hits > best.hits)) best = { code, hits };
  }
  if (best) return LATIN_REGION[best.code] ?? best.code;

  return 'en-GB';
}

export function buildLocalizedStayResponse(
  userText: string,
  langCode: string,
  basePlan: CoachPlanProposal
): string {
  if (langCode === 'hi-IN') {
    return `🇮🇳 नमस्ते! मैं समझ सकती हूँ कि जब दिमाग थका हो तो काम शुरू करना कितना भारी लगता है। चलिए सारा दबाव हटाते हैं — सिर्फ 60 सेकंड के लिए पहला छोटा कदम उठाते हैं: "${basePlan.firstStep}". मैं यहीं आपके साथ हूँ!`;
  }
  if (langCode === 'ko-KR') {
    return `🇰🇷 안녕하세요! 머리가 복잡하고 지칠 때 시작하는 게 얼마나 힘든지 잘 알아요. 부담을 완전히 내려놓고 딱 60초 동안만 첫 번째 작은 단계를 함께 해볼까요? "${basePlan.firstStep}" — 제가 바로 옆에서 함께할게요!`;
  }
  if (langCode === 'es-ES') {
    return `🇪🇸 ¡Hola! Te entiendo perfectamente. Vamos a quitar toda la presión y dar un solo micro-paso de 60 segundos: "${basePlan.firstStep}". ¡Estoy aquí contigo!`;
  }
  if (langCode === 'fr-FR') {
    return `🇫🇷 Salut ! Je comprends tout à fait. Enlevons toute la pression et commençons par une micro-étape de 60 secondes : "${basePlan.firstStep}". Je reste ici avec toi !`;
  }
  if (langCode === 'de-DE') {
    return `🇩🇪 Hallo! Ich verstehe dich total. Lass uns allen Druck wegnehmen und mit einem 60-Sekunden-Schritt starten: "${basePlan.firstStep}". Ich bin direkt bei dir!`;
  }
  if (langCode === 'ja-JP') {
    return `🇯🇵 こんにちは！頭が疲れている時に始めるのがどれほど大変かよく分かります。プレッシャーを手放して、まずは60秒だけ最初の小さな一歩「${basePlan.firstStep}」を一緒にやってみましょう！`;
  }
  return basePlan.spokenResponse;
}

export function useVoiceAgent(options: UseVoiceAgentOptions = {}) {
  const [visualState, setVisualState] = useState<VoiceVisualState>('idle');
  const [isConnected, setIsConnected] = useState(false);
  const [audioEnergy, setAudioEnergy] = useState(0);
  const lastAudioPushRef = useRef(0);
  const lastAudioOverallRef = useRef(0);
  const [audioBands, setAudioBands] = useState<AudioSpectrumBands>({
    low: 0,
    mid: 0,
    high: 0,
    overall: 0,
  });

  /** Hot audio path: at most ~20 React updates/s, and only when the level meaningfully changed.
   *  The orb scene smooths between updates with frame-rate independent easing. */
  const pushAudioLevels = useCallback((overall: number, bands?: { low: number; mid: number; high: number }) => {
    const now = performance.now();
    if (now - lastAudioPushRef.current < 50) return;
    if (Math.abs(overall - lastAudioOverallRef.current) < 0.012) return;
    lastAudioPushRef.current = now;
    lastAudioOverallRef.current = overall;
    setAudioEnergy(overall);
    if (bands) setAudioBands({ ...bands, overall });
  }, []);
  const [partialUserTranscript, setPartialUserTranscript] = useState('');
  const [transcripts, setTranscripts] = useState<VoiceTranscriptEntry[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [streamingAnalysis, setStreamingAnalysis] = useState<RealtimeStreamingAnalysis | null>(null);
  const [isHandsFreePaused, setIsHandsFreePaused] = useState(false);
  const [selectedLanguage, setSelectedLanguageState] = useState<string>('auto');
  const selectedLanguageRef = useRef<string>('auto');
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('stay_selected_language');
      if (saved && saved !== 'auto') {
        setSelectedLanguageState(saved);
        selectedLanguageRef.current = saved;
      }
    } catch {
      // private mode: auto
    }
  }, []);
  const [detectedLanguageCode, setDetectedLanguageCode] = useState<string>('en-GB');
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
  const [generativeShape, setGenerativeShape] = useState<GenerativeShapeSpec | null>(null);
  const [orbColorTheme, setOrbColorTheme] = useState<OrbColorTheme>('default');
  const [activeGame, setActiveGame] = useState<'simon' | 'gonogo' | 'wordrally'>('simon');
  const [gameDifficulty, setGameDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');

  const synthesizeShapeByConcept = useCallback((conceptOrSeed: string | number) => {
    if (typeof conceptOrSeed === 'number') {
      const spec = buildProceduralBillionShape(conceptOrSeed);
      setGenerativeShape(spec);
      setTopicShape(8);
      return spec;
    }
    const spec =
      synthesizeGenerativeShape(conceptOrSeed) ||
      buildProceduralBillionShape(conceptOrSeed, conceptOrSeed);
    setGenerativeShape(spec);
    setTopicShape(8);
    return spec;
  }, []);

  const setSelectedVoice = useCallback((query: string): VoicePersona | null => {
    const persona = resolvePersona(query, selectedVoiceRef.current);
    if (!persona) return null;
    if (voiceNeeds(persona)) return null; // needs an Azure key or a device voice: the caller says why (see voiceNeeds)
    setSelectedVoiceState(persona.id);
    selectedVoiceRef.current = persona.id;
    const convLang = (selectedLanguageRef.current === 'auto' ? (typeof navigator !== 'undefined' ? navigator.language : 'en') : selectedLanguageRef.current).split('-')[0].toLowerCase();
    if (persona.lang !== convLang) setSelectedLanguage(SUPPORTED_LANGUAGES.find((l) => l.code.startsWith(persona.lang))?.code ?? persona.lang);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('stay_selected_voice', persona.id);
      } catch {
        // ignore
      }
    }
    optionsRef.current.onShapeRequested?.(persona.shape);
    // output.voice is immutable once the session is ready (immutable_field), so restart cleanly to apply it.
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN && sessionReadyRef.current) {
      restartVoiceRef.current?.();
    }
    return persona;
  }, []);

  const setSelectedLanguage = useCallback((lang: string) => {
    setSelectedLanguageState(lang);
    selectedLanguageRef.current = lang;
    try {
      window.localStorage.setItem('stay_selected_language', lang);
    } catch {
      // private mode: not remembered
    }
    if (lang !== 'auto') {
      setDetectedLanguageCode(lang);
    }
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
    const nextVoice = personaAfterLanguageChange(selectedVoiceRef.current, lang === 'auto' ? (typeof navigator !== 'undefined' && navigator.language) || 'en' : lang);
    const voiceChanged = nextVoice !== selectedVoiceRef.current;
    if (voiceChanged) {
      selectedVoiceRef.current = nextVoice;
      setSelectedVoiceState(nextVoice);
    }
    const ws = wsRef.current;
    const wsLive = !!ws && ws.readyState === WebSocket.OPEN && sessionReadyRef.current;
    const onBrowserEngine = !wsLive && !!speechRecRef.current;
    const agentCanHear = lang === 'auto' || isAgentVerifiedLanguage(lang);
    if (wsLive && ws && !voiceChanged && agentCanHear) {
      {
        const langMatch = SUPPORTED_LANGUAGES.find((l) => l.code === lang);
        const label = langMatch ? langMatch.label : lang;
        ws.send(
          JSON.stringify({
            type: 'session.update',
            session: { input: { language_codes: lang !== 'auto' && isAgentVerifiedLanguage(lang) ? [lang.split('-')[0].toLowerCase()] : [] } },
          })
        );
        ws.send(
          JSON.stringify({
            type: 'conversation.message',
            role: 'system',
            content:
              lang === 'auto'
                ? 'Match whatever language the user speaks, including mid-conversation switches.'
                : `The user switched their spoken language to ${label}. Reply in ${label}.`,
          })
        );
      }
    } else if ((wsLive && (voiceChanged || !agentCanHear)) || (onBrowserEngine && agentCanHear)) {
      // route changes (agent <-> browser engine) and immutable voice changes need a clean restart
      restartVoiceRef.current?.();
    } else if (speechRecRef.current) {
      try {
        speechRecRef.current.abort(); // onend restarts recognition with the new lang tag
      } catch {
        // ignore
      }
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

  // which voices this device and these settings can speak with (browser voices load asynchronously)
  useEffect(() => {
    void refreshTtsCaps();
  }, []);

  const wsRef = useRef<WebSocket | null>(null);
  const restartVoiceRef = useRef<(() => void) | null>(null);
  // Reply time as this device experiences it: the server heard you stop -> the first reply audio arrives here.
  const speechStoppedAtRef = useRef(0);
  const lastLoudAtRef = useRef(0);
  /** What the person last said, so a saved memory can be checked against it (the model must not invent facts about them). */
  const lastUserSaidRef = useRef('');
  // Fast voice (beta): own speech-to-text + chat model + text-to-speech instead of the managed Voice Agent.
  const [fastVoice, setFastVoiceState] = useState(true);
  const fastVoiceRef = useRef(true);
  const fastDisabledRef = useRef(false); // set when fast voice failed this page session: the managed agent takes over
  const [voiceEngine, setVoiceEngine] = useState<'fast' | 'agent' | null>(null);
  useEffect(() => {
    try {
      const on = window.localStorage.getItem('stay_fast_voice') !== '0'; // fast voice is the default; '0' means the person turned it off
      fastVoiceRef.current = on;
      setFastVoiceState(on);
    } catch {
      fastVoiceRef.current = true;
      setFastVoiceState(true);
    }
  }, []);
  const [replyTimes, setReplyTimes] = useState<number[]>([]);
  // All-day companion: when a session ends on its own (3-hour cap, network drop), quietly start the next one.
  const [companionMode, setCompanionModeState] = useState(false);
  const companionRef = useRef(false);
  const renewingRef = useRef(false);
  const renewAttemptsRef = useRef(0);
  useEffect(() => {
    try {
      const on = window.localStorage.getItem('stay_companion') === '1';
      companionRef.current = on;
      setCompanionModeState(on);
    } catch {
      // private mode: off
    }
  }, []);
  const setFastVoice = useCallback((on: boolean) => {
    fastVoiceRef.current = on;
    setFastVoiceState(on);
    try {
      window.localStorage.setItem('stay_fast_voice', on ? '1' : '0');
    } catch {
      // not persisted
    }
    if (wsRef.current) restartVoiceRef.current?.(); // switch engines now if a session is live
  }, []);
  const setCompanionMode = useCallback((on: boolean) => {
    companionRef.current = on;
    setCompanionModeState(on);
    try {
      window.localStorage.setItem('stay_companion', on ? '1' : '0');
    } catch {
      // not persisted
    }
  }, []);
  const playbackGainRef = useRef<GainNode | null>(null);
  const duckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const isAssistantSpeakingRef = useRef(false);
  const speechAccumulatorRef = useRef('');
  const speechFinalizeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const assistantCooldownTimerRef = useRef<NodeJS.Timeout | null>(null);
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
    isAssistantSpeakingRef.current = false;
    if (assistantCooldownTimerRef.current) {
      clearTimeout(assistantCooldownTimerRef.current);
      assistantCooldownTimerRef.current = null;
    }
    if (speechFinalizeTimerRef.current) {
      clearTimeout(speechFinalizeTimerRef.current);
      speechFinalizeTimerRef.current = null;
    }
    speechAccumulatorRef.current = '';
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
    lipSyncBus.reset();
    if (audioCtxRef.current) {
      nextPlaybackTimeRef.current = audioCtxRef.current.currentTime;
    }
  }, []);

  const triggerConversationalBackchannel = useCallback(() => {
    if (handsFreePausedRef.current || !sessionReadyRef.current) return;
    // Silent visual pulse: attunes to user pause without playing audio tone that could feedback into microphone
    setVisualState('backchannel');
    setTimeout(() => {
      setVisualState((prev) => (prev === 'backchannel' ? 'listening' : prev));
    }, 750);
  }, []);

  const speakDeterministicBoundary = useCallback((text: string, explicitLangCode?: string, force = false) => {
    if (typeof window === 'undefined') return;
    // One voice at a time: while the live agent is connected, only the fixed safety boundary may use the browser voice.
    const liveWs = wsRef.current;
    if (!force && liveWs && liveWs.readyState === WebSocket.OPEN && sessionReadyRef.current) return;

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
        const detectedLang =
          explicitLangCode || detectTextLanguage(text, selectedLanguageRef.current);
        utterance.lang = detectedLang;
        const voices = window.speechSynthesis.getVoices();
        const langPrefix = detectedLang.split('-')[0].toLowerCase();
        const isMale = MALE_VOICE_IDS.includes(selectedVoiceRef.current);
        const matchedVoice =
          voices.find((v) => {
            const name = v.name.toLowerCase();
            const langMatches = v.lang.toLowerCase().startsWith(langPrefix);
            if (!langMatches && langPrefix !== 'en') return false;
            if (isMale) {
              return (
                name.includes('male') ||
                name.includes('paul') ||
                name.includes('george') ||
                name.includes('david') ||
                name.includes('daniel') ||
                name.includes('guy') ||
                name.includes('charles') ||
                name.includes('michael')
              );
            }
            return (
              name.includes('female') ||
              name.includes('anna') ||
              name.includes('samantha') ||
              name.includes('victoria') ||
              name.includes('eve') ||
              name.includes('vera') ||
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
        utterance.rate = 1.02;
        utterance.pitch = 1.0;

        let energyTimer: NodeJS.Timeout | null = null;
        utterance.onstart = () => {
          isAssistantSpeakingRef.current = true;
          if (assistantCooldownTimerRef.current) {
            clearTimeout(assistantCooldownTimerRef.current);
            assistantCooldownTimerRef.current = null;
          }
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
          // 400ms acoustic cooldown so mic doesn't capture trailing speaker room echo
          assistantCooldownTimerRef.current = setTimeout(() => {
            isAssistantSpeakingRef.current = false;
            assistantCooldownTimerRef.current = null;
          }, 400);
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
    pushAudioLevels(rms);

    const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
    audioBuffer.copyToChannel(float32, 0);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(playbackGainRef.current ?? ctx.destination);
    if (analyserRef.current) {
      source.connect(analyserRef.current);
    }

    const startAt = Math.max(ctx.currentTime + 0.015, nextPlaybackTimeRef.current);
    source.start(startAt);
    nextPlaybackTimeRef.current = startAt + audioBuffer.duration;
    // mouth sync for the orb's figure: after the audio is scheduled, so it can never delay playback
    lipSyncBus.attachClock(ctx);
    lipSyncBus.pushChunk(startAt, float32, 24000);

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
    lipSyncBus.reset(); // a closed AudioContext's clock stops, so nothing may stay "audible"
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

  /** Runs one action requested by the agent's single app tool. Never deletes data: delete_data only opens the confirm screen. */
  const runAppAction = useCallback(
    (args: AppActionArgs): Record<string, unknown> => {
      const o = optionsRef.current;
      const value = String(args.value ?? '').trim();
      const lower = value.toLowerCase();
      switch (args.action) {
        case 'open': {
          const screens: Record<string, [string, string]> = {
            today: ['/app/today', 'Today'], home: ['/app/today', 'Today'], history: ['/app/history', 'History'],
            report: ['/app/reports', 'Report'], reports: ['/app/reports', 'Report'], checkin: ['/app/treatment', 'Check-in'],
            'check-in': ['/app/treatment', 'Check-in'], settings: ['/app/settings', 'Settings'], privacy: ['/privacy', 'Privacy'],
          };
          if (lower === 'memory') { o.onShowMemoryRequested?.(); return { ok: true, opened: 'memory' }; }
          if (lower === 'voice' || lower === 'voices') { o.onChangeVoiceRequested?.(); return { ok: true, opened: 'voices' }; }
          const hit = Object.entries(screens).find(([k]) => lower.includes(k));
          if (!hit) return { ok: false, error: 'unknown screen' };
          o.onNavigateRequested?.(hit[1][0], hit[1][1]);
          return { ok: true, opened: hit[1][1] };
        }
        case 'ground': o.onGroundingRequested?.(); return { ok: true };
        case 'timer_start': {
          const m = Math.max(1, Math.min(60, Math.round(Number(args.minutes) || 20)));
          o.onStartTimerRequested?.(m, args.step || value || '');
          return { ok: true, minutes: m };
        }
        case 'timer_stop': o.onVoiceCommandDetected?.({ type: 'stop_timer' } as VoiceCommandAction); return { ok: true };
        case 'outcome': {
          const map: Array<[RegExp, SessionOutcome]> = [[/partly|part/, 'partly_started'], [/not|didn|no/, 'not_started'], [/paus|stop/, 'paused_or_stopped'], [/start|did|done|yes/, 'started']];
          const hit = map.find(([re]) => re.test(lower));
          if (!hit) return { ok: false, error: 'unknown outcome' };
          o.onOutcomeRecorded?.(hit[1]);
          return { ok: true, outcome: hit[1] };
        }
        case 'plan': {
          const plan = buildDeterministicCoachPlan({ taskText: value || args.step || 'this task', preferredMinutes: args.minutes });
          if (args.step) plan.firstStep = args.step;
          o.onPlanProposed?.(plan);
          return { ok: true, firstStep: plan.firstStep };
        }
        case 'shape': if (!value) return { ok: false }; o.onShapeRequested?.(value); return { ok: true };
        case 'color': {
          const themes = ['aurora', 'sunset', 'ocean', 'cyber', 'emerald', 'default'] as const;
          const t = themes.find((x) => lower.includes(x));
          if (!t) return { ok: false, error: 'unknown colour', options: themes };
          setOrbColorTheme(t);
          return { ok: true, colour: t };
        }
        case 'language': {
          if (/auto/.test(lower)) { setSelectedLanguage('auto'); return { ok: true, language: 'auto' }; }
          const l = SUPPORTED_LANGUAGES.find((x) => x.code !== 'auto' && (lower.includes(x.label.toLowerCase()) || lower.includes(x.nativeName.toLowerCase()) || lower === x.code.toLowerCase() || lower === x.code.split('-')[0]));
          if (!l) return { ok: false, error: 'unknown language' };
          setSelectedLanguage(l.code);
          return { ok: true, language: l.label };
        }
        case 'voice': {
          const want = resolvePersona(value, selectedVoiceRef.current);
          const needs = want ? voiceNeeds(want) : null;
          if (needs) return { ok: false, error: needs };
          const p = setSelectedVoice(value);
          return p ? { ok: true, voice: p.name, note: p.voiceLabel } : { ok: false, error: 'no such voice', options: PERSONAS.map((x) => x.name) };
        }
        case 'memory_add': {
          if (!value) return { ok: false };
          if (!MEMORY_CUE.test(lastUserSaidRef.current)) return { ok: false, error: 'not saved: the person did not ask to remember anything' };
          setUserMemory(addUserMemoryFact(value.slice(0, 160)));
          return { ok: true, saved: value.slice(0, 160) };
        }
        case 'memory_forget': {
          if (!value || /^(all|everything)$/.test(lower)) { o.onShowMemoryRequested?.(); return { ok: true, note: 'Opened memory; the user confirms clearing it there.' }; }
          const mem = loadUserMemory();
          const idx = mem.facts.findIndex((f) => f.toLowerCase().includes(lower) || lower.split(/\s+/).some((w) => w.length > 3 && f.toLowerCase().includes(w)));
          if (idx < 0) return { ok: false, error: 'nothing matched' };
          const removed = mem.facts[idx];
          setUserMemory(removeUserMemoryFact(idx));
          return { ok: true, forgot: removed };
        }
        case 'memory_show': {
          o.onShowMemoryRequested?.();
          const m = loadUserMemory();
          return { ok: true, facts: m.facts.slice(-6), name: m.name };
        }
        case 'park': {
          if (!value) return { ok: false, error: 'value must be the thought to park, e.g. call the dentist' };
          const list = parkThought(value);
          return { ok: true, parked: value.slice(0, 140), total: list.length };
        }
        case 'park_show': {
          o.onShowParkingRequested?.();
          return { ok: true, items: loadParked().slice(0, 6).map((i) => i.text) };
        }
        case 'dump': {
          o.onShowDumpRequested?.();
          return { ok: true, note: 'Opened the brain dump. The person says or types everything on their mind there.' };
        }
        case 'list_add': {
          if (!value) return { ok: false, error: 'value must be the item to add, e.g. buy milk' };
          addToday([{ text: value, bucket: 'today' }]);
          o.onTodayChanged?.();
          return { ok: true, added: value.slice(0, 80) };
        }
        case 'list_show': {
          o.onTodayChanged?.();
          return { ok: true, open: openToday(loadToday()).slice(0, 5).map((i) => i.text) };
        }
        case 'routine': {
          const r = findRoutine(value || '');
          if (!r) return { ok: false, error: 'no such routine', options: loadRoutines().map((x) => x.name) };
          o.onRoutineRequested?.(r.id);
          return { ok: true, routine: r.name, steps: r.steps.length, firstStep: r.steps[0].text };
        }
        case 'remind': {
          const mins = args.minutes ?? Number((value || '').match(/\d+/)?.[0]);
          if (!mins || mins < 1) return { ok: false, error: 'say after how many minutes' };
          addReminder(mins, (value || '').replace(/\d+\s*(?:min(?:ute)?s?)?/i, '').trim() || 'Check in', Date.now());
          o.onRemindersChanged?.();
          return { ok: true, minutes: Math.round(mins) };
        }
        case 'quiet': o.onToggleQuietModeRequested?.(); return { ok: true };
        case 'game': {
          const g = /word/.test(lower) ? 'wordrally' : /focus|go|stop|react/.test(lower) ? 'gonogo' : 'simon';
          const d = /hard/.test(lower) ? 'hard' : /easy/.test(lower) ? 'easy' : /medium/.test(lower) ? 'medium' : null;
          setTopicShape(5);
          setActiveGame(g);
          if (d) setGameDifficulty(d);
          return { ok: true, game: g, difficulty: d };
        }
        case 'pause': {
          handsFreePausedRef.current = true;
          setIsHandsFreePaused(true);
          setVisualState('idle');
          return { ok: true };
        }
        case 'export_data':
        case 'delete_data':
          o.onNavigateRequested?.('/app/settings', 'Settings');
          return { ok: true, note: 'Opened Settings. Data is only downloaded or deleted by the user pressing the button there.' };
        default: return { ok: false, error: 'unknown action' };
      }
    },
    [setSelectedVoice, setSelectedLanguage]
  );

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

        if (name === 'app') {
          const result = runAppAction(rawArgs as unknown as AppActionArgs);
          const ws = wsRef.current;
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'tool.result', call_id: callId, result: JSON.stringify(result) }));
          }
          return;
        }

        if (name === 'show_shape') {
          const concept = String((rawArgs as { object?: unknown }).object ?? '').trim().slice(0, 40);
          if (concept) optionsRef.current.onShapeRequested?.(concept);
          pendingToolResultsRef.current.push({
            call_id: callId,
            result: JSON.stringify({ status: concept ? 'shape_shown' : 'ignored' }),
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
    [runAppAction]
  );

  const sendUserTextMessage = useCallback(
    (text: string, opts?: { skipLocalPlan?: boolean }) => {
      const clean = text.trim();
      if (!clean) return false;

      // 1. Real-time multilingual auto-detection (Devanagari, Hangul, Romanized Hinglish/Korean, 32 languages)
      const autoDetectedLang = detectTextLanguage(clean, 'auto');
      const effectiveLang =
        selectedLanguageRef.current && selectedLanguageRef.current !== 'auto'
          ? selectedLanguageRef.current
          : autoDetectedLang;
      setDetectedLanguageCode(effectiveLang);
      if (selectedLanguageRef.current === 'auto' && autoDetectedLang !== 'en-GB' && speechRecRef.current) {
        try {
          speechRecRef.current.lang = autoDetectedLang;
        } catch {
          // ignore
        }
      }

      // 2. Extract long-term memory from typed/spoken text
      lastUserSaidRef.current = clean;
      const { profile: updatedMemory, extractedFact } = extractMemoriesFromUtterance(clean);
      if (extractedFact) {
        setUserMemory(updatedMemory);
      }

      // 3. Detect topic-reactive dynamic shape & 1-Billion-Shape AI synthesis
      const genSpec = synthesizeGenerativeShape(clean);
      const topic = detectTopicShape(clean);
      if (genSpec && topic === 8) {
        setGenerativeShape(genSpec);
        setTopicShape(8);
      } else if (topic > 0) {
        setTopicShape(topic);
      }

      // 4. Multi-Intent Human Conversational Parser (executes simultaneous commands + task context)
      const multi = parseMultiIntentUtterance(clean);
      const liveNow = !!wsRef.current && wsRef.current.readyState === WebSocket.OPEN && sessionReadyRef.current;
      if (multi.commands.length > 0 && (!liveNow || multi.commands.some((c) => c.type === 'pause_listening' || c.type === 'resume_listening'))) {
        setTranscripts((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}`,
            role: 'user',
            text: clean,
            timestamp: new Date().toISOString(),
          },
        ]);

        const executedReplies: string[] = [];
        let shouldReturnEarly = !multi.conversationalContext;

        for (const cmd of multi.commands) {
          optionsRef.current.onVoiceCommandDetected?.(cmd);

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
            executedReplies.push(`⏱️ Started your ${cmd.minutes}-minute focus sprint.`);
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
            executedReplies.push(`🎙️ Switched voice persona to ${cmd.voiceId}.`);
          } else if (cmd.type === 'change_language') {
            setSelectedLanguage(cmd.langCode);
            playEarcon('chime');
            executedReplies.push(`🌐 Switched language to ${cmd.langName}.`);
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
          } else if (cmd.type === 'start_game') {
            playEarcon('chime');
            setTopicShape(5);
            setActiveGame(cmd.game);
            if (cmd.difficulty) setGameDifficulty(cmd.difficulty);
            const gameTitle =
              cmd.game === 'gonogo'
                ? 'Prefrontal Impulse Shield'
                : cmd.game === 'wordrally'
                ? 'Dopamine Word Rally'
                : 'Harmonic Simon Pulse';
            executedReplies.push(
              cmd.difficulty
                ? `🎮 Orb morphed into ${gameTitle} on ${cmd.difficulty.toUpperCase()} difficulty! Watch the Orb and let's play together.`
                : `🎮 Orb transformed into our ADHD Cognitive Game Arena (${gameTitle})! What difficulty would you like — Easy, Medium, or Hard?`
            );
          } else if (cmd.type === 'set_game_difficulty') {
            playEarcon('chime');
            setTopicShape(5);
            setGameDifficulty(cmd.difficulty);
            executedReplies.push(
              `🎯 Game difficulty locked to ${cmd.difficulty.toUpperCase()}! Let's play together right inside the Orb.`
            );
          } else if (cmd.type === 'game_action') {
            optionsRef.current.onVoiceCommandDetected?.(cmd);
            playEarcon('chime');
            executedReplies.push('🎮 Executed hands-free game move.');
            shouldReturnEarly = true;
          } else if (cmd.type === 'change_orb_color') {
            playEarcon('chime');
            setOrbColorTheme(cmd.colorTheme);
            executedReplies.push(`🎨 Orb color gradient transformed to ${cmd.colorTheme.toUpperCase()} theme.`);
          } else if (cmd.type === 'change_orb_shape') {
            playEarcon('chime');
            setTopicShape(cmd.shapeId);
            executedReplies.push(`✨ Orb smoothly morphed into ${cmd.shapeLabel}!`);
          } else if (cmd.type === 'synthesize_billion_shape') {
            playEarcon('chime');
            const synthesized =
              synthesizeGenerativeShape(cmd.concept) ||
              buildProceduralBillionShape(cmd.concept, cmd.concept);
            setGenerativeShape(synthesized);
            // Keep topicShape 5 if start_game was also triggered in the same sentence, otherwise set 8
            if (!multi.commands.some((c) => c.type === 'start_game')) {
              setTopicShape(8);
            }
            executedReplies.push(
              `${synthesized.icon} Synthesized ${synthesized.label} (${synthesized.formulaSignature})!`
            );
          } else if (cmd.type === 'web_research') {
            playEarcon('chime');
            setTopicShape(6);
            optionsRef.current.onWebResearchRequested?.(cmd.query);
            executedReplies.push(
              `🌐 Researching "${cmd.query}" across live encyclopedic and clinical sources now...`
            );
          } else if (cmd.type === 'calculate_time') {
            playEarcon('chime');
            const calculation = calculateTaskReality(clean);
            executedReplies.push(
              `⏱️ ${calculation.spokenSummary}\n\n• Perceived time: ~${calculation.perceivedMinutes} min\n• Micro-entry move: ${calculation.microEntrySeconds}s\n• Recommended block: ${calculation.recommendedSprintMinutes} min\n• Momentum rate: ${calculation.inertiaBreakRate}%`
            );
            shouldReturnEarly = true;
          } else if (cmd.type === 'brainstorm_angles') {
            playEarcon('chime');
            const brainstorm = brainstormStarterAngles(clean);
            executedReplies.push(
              `💡 3 Starter Angles for "${clean}":\n\n` +
                brainstorm.angles
                  .map((a, i) => `${i + 1}. **${a.name}** (~${a.timeSeconds}s)\n${a.prompt}`)
                  .join('\n\n')
            );
            shouldReturnEarly = true;
          } else if (cmd.type === 'synthesize_path') {
            playEarcon('chime');
            const path = synthesizeTaskPath(clean);
            executedReplies.push(
              `🧭 3-Phase Action Path for "${clean}" (${path.totalSprintMinutes}m total):\n\n` +
                path.phases
                  .map((p) => `Phase ${p.phase} · **${p.name}** (${p.durationMinutes}m)\n${p.action}`)
                  .join('\n\n')
            );
            shouldReturnEarly = true;
          } else if (cmd.type === 'clear_chat') {
            optionsRef.current.onClearChatRequested?.();
            setTranscripts([]);
            return true;
          }
        }

        // If the user ALSO spoke about a real-world task/context in the same breath, address both like a human!
        if (!shouldReturnEarly && multi.conversationalContext && !opts?.skipLocalPlan) {
          const instantLocalPlan = buildDeterministicCoachPlan({ taskText: clean });
          const localizedSpoken = buildLocalizedStayResponse(clean, effectiveLang, instantLocalPlan);
          const combinedReply =
            executedReplies.length > 0
              ? `${executedReplies.join(' ')} — And I hear you on your task too: ${localizedSpoken}`
              : localizedSpoken;
          const optimisticPlan: CoachPlanProposal = {
            ...instantLocalPlan,
            spokenResponse: combinedReply,
          };
          optionsRef.current.onPlanProposed?.(optimisticPlan);
          setTranscripts((prev) => [
            ...prev,
            {
              id: `multi-${Date.now()}`,
              role: 'agent',
              text: combinedReply,
              timestamp: new Date().toISOString(),
            },
          ]);
          speakDeterministicBoundary(combinedReply, effectiveLang);
          return true;
        }

        if (executedReplies.length > 0) {
          const combined = executedReplies.join(' ');
          setTranscripts((prev) => [
            ...prev,
            {
              id: `cmd-${Date.now()}`,
              role: 'agent',
              text: combined,
              timestamp: new Date().toISOString(),
            },
          ]);
          speakDeterministicBoundary(combined, effectiveLang);
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
        speakDeterministicBoundary(medBoundary.message, effectiveLang, true);
        return true;
      }

      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN && sessionReadyRef.current) {
        ws.send(JSON.stringify({ type: 'conversation.message', role: 'user', content: clean }));
        ws.send(JSON.stringify({ type: 'reply.create' }));
        return true;
      }

      // The caller (the app screen) already requests the plan for typed text: a second plan, a second voice and a second
      // model call would race the first and pull the person back to the plan card after they have started.
      if (opts?.skipLocalPlan) return true;

      // SUB-15MS INSTANT OPTIMISTIC LOCAL-FIRST ADHD REFLEX:
      // Render plan, localized reply (Hindi/Korean/32L), and voice output immediately with zero network wait!
      const instantLocalPlan = buildDeterministicCoachPlan({ taskText: clean });
      const localizedSpoken = buildLocalizedStayResponse(clean, effectiveLang, instantLocalPlan);
      const optimisticPlan: CoachPlanProposal = {
        ...instantLocalPlan,
        spokenResponse: localizedSpoken,
      };
      optionsRef.current.onPlanProposed?.(optimisticPlan);
      setTranscripts((prev) => [
        ...prev,
        {
          id: `agent-${Date.now()}`,
          role: 'agent',
          text: localizedSpoken,
          timestamp: new Date().toISOString(),
        },
      ]);
      speakDeterministicBoundary(localizedSpoken, effectiveLang);

      // Background non-blocking cache warm / LLM refinement
      fetch('/api/coach/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskText: clean,
          userMemoryPrompt: buildMemorySystemPrompt(loadUserMemory()),
        }),
      })
        .then(async (res) => {
          if (!res.ok) return null;
          return (await res.json()) as CoachPlanProposal;
        })
        .then((planProposal) => {
          if (!planProposal) return;
          if (planProposal.safetyFlag === 'crisis') {
            optionsRef.current.onCrisisDetected?.(planProposal.spokenResponse);
            setVisualState('idle');
            return;
          }
          if (planProposal.safetyFlag === 'medical_boundary') {
            optionsRef.current.onMedicalBoundaryDetected?.(planProposal.spokenResponse);
            return;
          }
        })
        .catch(() => {
          // Instant local reflex already succeeded
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

        const cleanInterim = interim.trim();
        const cleanFinal = final.trim();

        // 1. ACOUSTIC ECHO SUPPRESSION: If assistant is actively speaking, ignore mic capture of speaker output
        // UNLESS the user explicitly utters a deliberate barge-in command (e.g. "stop", "wait", "hold on", "pause", "quiet", "stay")
        if (isAssistantSpeakingRef.current) {
          const isExplicitBargeIn = /\b(?:stop|pause|wait|quiet|shh|hold\s+on|shut\s+up|stay|chup|ruko)\b/i.test(
            cleanInterim || cleanFinal
          );
          if (!isExplicitBargeIn) {
            // Echo bleed from Stay's own voice: silently drop to prevent self-interruption!
            return;
          }
          // Explicit barge-in requested by user
          if ('speechSynthesis' in window && window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
          }
          isAssistantSpeakingRef.current = false;
        }

        if (interim) {
          if (backchannelTimerRef.current) {
            clearTimeout(backchannelTimerRef.current);
            backchannelTimerRef.current = null;
          }
          setPartialUserTranscript(interim);
          // No mic metering in browser-engine mode: derive a deterministic pulse from words recognised so far.
          const energy = 0.22 + (interim.trim().split(/\s+/).length % 5) * 0.05;
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

          // ChatGPT-style listening interjection if user pauses mid-sentence (visual only)
          if (interim.length > 15 && !handsFreePausedRef.current) {
            backchannelTimerRef.current = setTimeout(() => {
              triggerConversationalBackchannel();
            }, 1400);
          }
        }

        if (cleanFinal) {
          if (backchannelTimerRef.current) {
            clearTimeout(backchannelTimerRef.current);
            backchannelTimerRef.current = null;
          }

          // ADHD Conversational Turn Debouncing:
          // Adults with ADHD pause mid-sentence, trail off with conjunctions ("and", "um", "also"),
          // or deliver thoughts in bursts. Accumulate and debounce before dispatching to prevent premature cutoffs!
          const accumulated = (speechAccumulatorRef.current + ' ' + cleanFinal).trim();
          speechAccumulatorRef.current = accumulated;

          if (speechFinalizeTimerRef.current) {
            clearTimeout(speechFinalizeTimerRef.current);
          }

          const hasHesitation = /\b(?:and|or|um|uh|like|also|with|to|because|so|but|wait|मतलब|और)$/i.test(
            accumulated
          );
          const delayMs = hasHesitation ? 1100 : 650;

          speechFinalizeTimerRef.current = setTimeout(() => {
            const dispatchText = speechAccumulatorRef.current.trim();
            speechAccumulatorRef.current = '';
            speechFinalizeTimerRef.current = null;

            if (dispatchText) {
              setPartialUserTranscript('');
              setAudioEnergy(0.05);
              setAudioBands({ low: 0, mid: 0, high: 0, overall: 0.05 });
              sendUserTextMessage(dispatchText);
            }
          }, delayMs);
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

    const chosenLang = selectedLanguageRef.current;
    if (chosenLang !== 'auto' && !isAgentVerifiedLanguage(chosenLang)) {
      // The live agent misheard or ignored this language in testing: use the browser's speech recognition.
      startNativeSpeechRecognition();
      return;
    }

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
      const outGain = audioCtx.createGain();
      outGain.connect(audioCtx.destination);
      playbackGainRef.current = outGain;
      nextPlaybackTimeRef.current = audioCtx.currentTime;

      // Real-time 3-band FFT AnalyserNode for vocal visemes & lip-sync deformation
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.75;
      analyserRef.current = analyser;

      await audioCtx.audioWorklet.addModule('/pcm-processor.js');

      // 3. Mint ephemeral AssemblyAI tokens from our server routes
      // Fast voice understands six languages. On auto, the browser's language decides; anything else uses the managed agent,
      // which detects the spoken language itself.
      const uiLang = selectedLanguageRef.current === 'auto' ? (typeof navigator !== 'undefined' ? navigator.language : 'en') : selectedLanguageRef.current;
      const fastLangBase = (uiLang || 'en').split('-')[0].toLowerCase();
      let useFast = fastVoiceRef.current && !fastDisabledRef.current && Boolean(FAST_TTS_LANGUAGE[fastLangBase]);
      const speech = planSpeech(selectedVoiceRef.current, fastLangBase, cachedTtsCaps());
      const longQuery = companionRef.current ? '?long=1' : '';
      let tokenRes = await fetch(`/api/voice/${useFast ? 'fast-token' : 'token'}${longQuery}`, {
        method: 'POST',
        headers: byokHeaders(),
      });
      if (useFast && !tokenRes.ok) {
        const code = String(((await tokenRes.clone().json().catch(() => ({}))) as { code?: string }).code || '');
        // out of allowance or a bad own key: say so. Anything else (provider down): quietly use the managed agent instead.
        if (!['quota', 'invalid_user_key', 'rate_limited'].includes(code)) {
          useFast = false;
          tokenRes = await fetch(`/api/voice/token${longQuery}`, { method: 'POST', headers: byokHeaders() });
        }
      }
      if (!tokenRes.ok) {
        const errBody = await tokenRes.json().catch(() => ({}));
        throw new Error(
          errBody.error ||
            'Voice session token unavailable. You can continue immediately in Quiet Text Mode.'
        );
      }
      const tokenJson = (await tokenRes.json()) as { token?: string; agentId?: string; wsUrl?: string; sttToken?: string; ttsToken?: string };

      // 4. Connect: either the managed Voice Agent socket, or fast voice (same events, built from STT + chat model + TTS)
      const socket: WebSocket = useFast
        ? (new FastSocket({ sttToken: tokenJson.sttToken || '', ttsToken: tokenJson.ttsToken || '', keyterms: appKeyterms(), ttsConnect: speech.ref.engine === 'assemblyai' ? undefined : () => createTtsConnection(speech.ref, speech.browserVoiceName)! }) as unknown as WebSocket)
        : new WebSocket(`${tokenJson.wsUrl}?token=${encodeURIComponent(tokenJson.token || '')}`);
      setVoiceEngine(useFast ? 'fast' : 'agent');
      wsRef.current = socket;

      socket.onopen = () => {
        const memory = loadUserMemory();
        const persona = personaById(selectedVoiceRef.current);
        const warmHumanPrompt = buildSystemPrompt(persona, memory);
        const greeting = buildGreeting(persona, memory, renewingRef.current, useFast ? fastLangBase : 'en');
        renewingRef.current = false;

        const langBase = selectedLanguageRef.current !== 'auto' && isAgentVerifiedLanguage(selectedLanguageRef.current) ? selectedLanguageRef.current.split('-')[0].toLowerCase() : null;
        socket.send(
          JSON.stringify({
            type: 'session.update',
            session: {
              system_prompt: warmHumanPrompt,
              greeting,
              // No turn_detection block: sending any turn_detection object overrides the provider's tuned defaults and
              // measurably doubled reply lag (about 1.4 s to 3.5 s). Voice agent sessions use the defaults.
              input: {
                keyterms: appKeyterms(),
                voice_focus: 'near-field',
                ...(langBase ? { language_codes: [langBase] } : {}),
              },
              tools: [APP_TOOL],
              output: {
                voice: useFast ? speech.assemblyVoice : agentVoiceFor(selectedVoiceRef.current),
              },
              ...(socket instanceof FastSocket ? { tts_language: FAST_TTS_LANGUAGE[fastLangBase] || 'english' } : {}),
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
          renewAttemptsRef.current = 0;
          setIsConnected(true);
          setVisualState('listening');

          // Start streaming microphone audio now that session.ready has fired
          const source = audioCtx.createMediaStreamSource(stream);
          const worklet = new AudioWorkletNode(audioCtx, 'pcm-processor');
          workletNodeRef.current = worklet;

          let duckHits = 0;
          worklet.port.onmessage = (e) => {
            const payload = e.data;
            if (!payload) return;

            if (payload.type === 'energy') {
              if (payload.rms > 0.08) lastLoudAtRef.current = performance.now();
              pushAudioLevels(payload.rms);
              // Barge-in without waiting ~1 s for the server: sustained loud mic input while the agent is audible ducks it.
              // (Echo cancellation is on; a stray blip never hard-stops anything, only quiets it briefly.)
              if (activeSourcesRef.current.size > 0 && payload.rms > 0.3) {
                duckHits += 1;
                if (duckHits >= 2 && playbackGainRef.current) {
                  playbackGainRef.current.gain.setTargetAtTime(0.18, audioCtx.currentTime, 0.02);
                  if (duckTimerRef.current) clearTimeout(duckTimerRef.current);
                  duckTimerRef.current = setTimeout(() => playbackGainRef.current?.gain.setTargetAtTime(1, audioCtx.currentTime, 0.08), 900);
                }
              } else {
                duckHits = 0;
              }
              return;
            }

            if (
              payload.type === 'pcm' &&
              sessionReadyRef.current &&
              socket.readyState === WebSocket.OPEN
            ) {
              // Suppress mic audio chunks when hands-free listening is paused or gated by VAD silence saver
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
          if (duckTimerRef.current) clearTimeout(duckTimerRef.current);
          playbackGainRef.current?.gain.setTargetAtTime(1, audioCtxRef.current?.currentTime ?? 0, 0.01);
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
            const genSpec = synthesizeGenerativeShape(text);
            const topic = detectTopicShape(text);
            if (genSpec && topic === 8) {
              setGenerativeShape(genSpec);
              setTopicShape(8);
            } else if (topic > 0) {
              setTopicShape(topic);
            }
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
          speechStoppedAtRef.current = lastLoudAtRef.current || performance.now(); // the last moment the mic heard you, not when the server noticed
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
            lastUserSaidRef.current = text;
            const { profile: updatedMemory, extractedFact } = extractMemoriesFromUtterance(text);
            if (extractedFact) {
              setUserMemory(updatedMemory);
            }

            // Topic shape & 1-Billion-Shape AI detection on finalized turn
            const genSpec = synthesizeGenerativeShape(text);
            const topic = detectTopicShape(text);
            if (genSpec && topic === 8) {
              setGenerativeShape(genSpec);
              setTopicShape(8);
            } else if (topic > 0) {
              setTopicShape(topic);
            }

            // Only pause/resume are local and instant. Everything else is done by the agent with its single app tool,
            // so there is exactly one executor and one voice per turn.
            const localCmd = detectVoiceCommand(text);
            if (localCmd?.type === 'pause_listening') {
              handsFreePausedRef.current = true;
              setIsHandsFreePaused(true);
              setVisualState('idle');
              stopPlaybackQueue();
              playEarcon('pause');
              return;
            }
            if (localCmd?.type === 'resume_listening') {
              handsFreePausedRef.current = false;
              setIsHandsFreePaused(false);
              setVisualState('listening');
              playEarcon('resume');
              return;
            }
            if (selectedLanguageRef.current === 'auto' && text.length > 3) {
              const autoLang = detectTextLanguage(text, 'auto');
              if (autoLang !== 'en-GB') {
                const langMatch = SUPPORTED_LANGUAGES.find((l) => l.code === autoLang);
                const label = langMatch ? langMatch.label : autoLang;
                const ws = wsRef.current;
                if (ws && ws.readyState === WebSocket.OPEN && sessionReadyRef.current) {
                  ws.send(JSON.stringify({ type: 'conversation.message', role: 'system', content: `User is speaking ${label}. Reply in ${label}.` }));
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
              speakDeterministicBoundary(medBoundary.message, undefined, true);
            }
          }
          return;
        }

        if (type === 'reply.text') {
          // the sentence about to be spoken (fast voice only): vowel shapes for the figure's mouth
          if (!medicationSuppressionRef.current) lipSyncBus.pushText(String(msg.text || ''));
          return;
        }

        if (type === 'reply.started') {
          lipSyncBus.clearText();
          pendingToolResultsRef.current = [];
          if (!medicationSuppressionRef.current) {
            setVisualState('speaking');
          }
          return;
        }

        if (type === 'reply.audio') {
          if (speechStoppedAtRef.current) {
            const ms = Math.round(performance.now() - speechStoppedAtRef.current);
            speechStoppedAtRef.current = 0;
            setReplyTimes((prev) => [...prev.slice(-19), ms]);
          }
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

        if (type === 'session.error' && socket instanceof FastSocket) {
          console.warn('fast voice failed, switching to the managed voice agent', msg.code);
          fastDisabledRef.current = true;
          disconnectVoiceSession();
          window.setTimeout(() => restartVoiceRef.current?.(), 200);
          return;
        }

        if (type === 'session.error') {
          const code = String(msg.code || msg.error_code || '');
          if (FATAL_SESSION_ERRORS.has(code) || !sessionReadyRef.current) {
            console.warn('AssemblyAI session cannot continue; using browser speech recognition', code);
            if (!speechRecRef.current) startNativeSpeechRecognition();
          } else {
            console.warn('AssemblyAI non-fatal session error ignored', code, msg.message);
          }
          return;
        }

        if (type === 'session.ended') {
          const renew = wsRef.current === socket && companionRef.current && renewAttemptsRef.current < 4;
          disconnectVoiceSession();
          if (renew) {
            renewAttemptsRef.current += 1;
            renewingRef.current = true;
            window.setTimeout(() => restartVoiceRef.current?.(), 600);
          }
        }
      };

      socket.onerror = () => {
        console.warn('AssemblyAI WebSocket error, activating native speech recognition fallback');
        if (!speechRecRef.current) startNativeSpeechRecognition();
      };

      socket.onclose = () => {
        const unexpected = wsRef.current === socket; // we set wsRef to null before closing on purpose
        sessionReadyRef.current = false;
        setIsConnected(false);
        if (unexpected && companionRef.current && renewAttemptsRef.current < 4) {
          renewAttemptsRef.current += 1;
          renewingRef.current = true;
          disconnectVoiceSession();
          window.setTimeout(() => restartVoiceRef.current?.(), 1500);
        }
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

  // Restart cleanly (used when something immutable changes mid-session, like the voice).
  useEffect(() => {
    restartVoiceRef.current = () => {
      disconnectVoiceSession();
      window.setTimeout(() => {
        void startVoiceSession();
      }, 450);
    };
    return () => {
      restartVoiceRef.current = null;
    };
  }, [disconnectVoiceSession, startVoiceSession]);

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
          pushAudioLevels(overall, { low, mid, high });
        } else {
          pushAudioLevels(0, { low: 0, mid: 0, high: 0 }); // scene release-easing handles the decay
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
    detectedLanguageCode,
    supportedLanguages: SUPPORTED_LANGUAGES,
    selectedVoice,
    setSelectedVoice,
    companionMode,
    setCompanionMode,
    replyTimes,
    fastVoice,
    setFastVoice,
    voiceEngine,
    availableVoices: AVAILABLE_VOICES,
    topicShape,
    setTopicShape,
    generativeShape,
    setGenerativeShape,
    synthesizeShapeByConcept,
    orbColorTheme,
    setOrbColorTheme,
    activeGame,
    setActiveGame,
    gameDifficulty,
    setGameDifficulty,
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

