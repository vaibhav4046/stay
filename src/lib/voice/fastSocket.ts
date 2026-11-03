/**
 * Fast voice: a WebSocket-shaped object that speaks the same server events as the AssemblyAI Voice Agent, but is built
 * from three parts: AssemblyAI streaming speech-to-text, a chat model of the person's choice (through /api/voice/chat),
 * and AssemblyAI streaming text-to-speech. Because it emits the Voice Agent's events (input.speech.started,
 * transcript.user, reply.audio, tool.call, ...), the rest of the voice hook is unchanged.
 *
 * Why: measured from the true end of speech, the Voice Agent took about 2.5 s; speech-to-text 0.9 s + first model token
 * 0.3 s + first synthesized audio 0.2 s add up to about 1.4 s. This class is how that sum is realised and checked.
 */
import { toSpeech } from '@/lib/voice/speechText';
import { isImageDataUrl, looksVisual } from '@/lib/vision/image';
import { honestFailureMessage } from '@/lib/conversation/response';
import { mayChangeLook, mayStartTimer } from '@/lib/conversation/capabilities';
import { GATED_ACTIONS, mayDoAction } from '@/lib/conversation/actionGates';
import { MEDICAL_BOUNDARY_FIXED_MESSAGE } from '@/lib/safety/crisis';
import { byokHeaders } from '@/lib/byok/config';
import { makeThinkFilter } from '@/lib/voice/thinkFilter';
import type { TtsConnection } from '@/lib/voice/tts/types';

export type EndpointingMode = 'coaching' | 'reflective' | 'crisis';

export const ENDPOINTING_PRESETS: Record<
  EndpointingMode,
  { end_of_turn_confidence_threshold: number; min_turn_silence: number; max_turn_silence: number }
> = {
  coaching: { end_of_turn_confidence_threshold: 0.4, min_turn_silence: 128, max_turn_silence: 1280 },
  reflective: { end_of_turn_confidence_threshold: 0.6, min_turn_silence: 700, max_turn_silence: 2400 },
  crisis: { end_of_turn_confidence_threshold: 0.7, min_turn_silence: 800, max_turn_silence: 3000 },
};

/** True when a short utterance during agent speech is a conversational backchannel ("yeah", "mm-hmm", "got it") that should NOT interrupt Stay. Note: "sure" is excluded per §6.3.4. */
export function isBackchannelOnly(text: string): boolean {
  const clean = text.toLowerCase().replace(/[^\p{L}\p{N}\s-]+/gu, '').trim();
  if (!clean || clean.split(/\s+/).length > 3) return false;
  return /^(?:yeah|yep|yup|mm[- ]?hm+|mhm|uh[- ]?huh|mm|hm+|hmm+|okay|ok|right|got it|i see|ah|oh|true|fair)(?:\s+(?:yeah|okay|ok|right|got it|i see))?$/i.test(clean);
}

/** True when the user utters an explicit interruption keyword ("stop", "wait", "pause", "hold on") that should barge in immediately even on a single word. */
export function isExplicitInterruption(text: string): boolean {
  const clean = text.toLowerCase().replace(/[^\p{L}\p{N}\s]+/gu, '').trim();
  return /^(?:stop|wait|pause|hold(?:\s+on)?|cancel|enough|quiet|shh+|no\s+wait|actually\s+wait|hang\s+on)\b/i.test(clean);
}

export interface FastSocketConfig {
  sttToken: string;
  /** Opens the first voice session only: it expires 60 s after it was minted. */
  ttsToken: string;
  /** Mints a new TTS token for every later voice session (language switch, reconnect, hourly rotation). */
  freshTtsToken?: () => Promise<string>;
  /** The few lines from the person's own notes that match what they just said (found on their device, sent as data). */
  recall?: (text: string) => string[];
  /** Mic format: 24 kHz mono 16-bit little-endian (what pcm-processor.js produces). */
  sampleRate?: number;
  /** How long to wait after a turn that trails off ("and, uh,") before answering. Default 2200 ms. */
  holdMs?: number;
  /** Auto-detect mode: move the TTS session to the language the person switches to (when AssemblyAI TTS speaks it). */
  autoLanguage?: boolean;
  /** After an interruption, a short fragment ("Wait, stop.") is held this long in case the sentence continues. Default 900 ms. */
  interruptHoldMs?: number;
  /** Words the speech-to-text should favour (names, product terms). Up to 100, each under 50 characters. */
  keyterms?: string[];
  /** Ping the chat route when the session starts so the first reply is not slowed by a cold function. Default true. */
  warmUp?: boolean;
  /** Optional AssemblyAI v3 turn-detection endpointing preset (coaching, reflective, crisis). */
  endpointingMode?: EndpointingMode;
  /** Speak through another engine (browser or Azure voice) instead of AssemblyAI's TTS socket. See src/lib/voice/tts. */
  ttsConnect?: () => TtsConnection;
}

export interface FastSession {
  systemPrompt: string;
  /** what Stay learned about this person and their memory line (from their device); sent with every turn as data */
  personal: string;
  /** the evidence-based offer Stay ends a "task I'm avoiding" reply with (from the person's own blocks), or '' */
  offer: string;
  greeting: string;
  voice: string;
  /** the persona's own voice key, kept so the voice can follow a language switch */
  rawVoice: string;
  /** AssemblyAI TTS language name: english, spanish, french, german, italian, portuguese */
  ttsLanguage: string;
  tools: boolean;
}

type Json = Record<string, unknown>;
type ChatMessage = { role: 'system' | 'user' | 'assistant' | 'tool'; content: string | null; tool_calls?: unknown[]; tool_call_id?: string };

/** voice_id values accepted by the live TTS API (checked by scripts/verify-voices.mjs). Add new ones only after that check passes. */
export const VALID_ASSEMBLY_VOICE_IDS = new Set([
  'aai-jane',
  'aai-anna',
  '478badc1-a7eb-5bef-b916-c6e51bd2771e', // Adrienne (en-GB)
  '1edcb3f4-d874-5c38-8839-8a29b854d294', // Aaron (en-GB)
  'd9e70892-1ace-5638-b749-dd6a0ba44686', // Andrew (en-IN)
  '2aadec9a-80cc-5181-a9fc-f2a9fda0cf50', // Constanza (es-MX)
  'bff56a11-dc95-552e-a93a-59f68ca60b64', // Antonio Luis (es-MX)
  'aai-john',
  'aai-nicole',
  'aai-emily',
  'aai-daniel',
  'aai-michael',
  'aai-sarah',
  'aai-david',
  'aai-emma',
  'aai-james',
  'aai-olivia',
  'aai-sophia',
  'aai-liam',
  'aai-noah',
  'aai-ava',
  'aai-isabella',
  'aai-mia',
  'aai-charlotte',
  'aai-amelia',
  'aai-evelyn',
  'aai-abigail',
  '49c443a4-8a1d-5f7e-b70b-98bdbd9823c3', // Audrey (en-US)
  'bf7d036b-b18a-5b6b-94d3-d6a6bdd6febe', // Elvia (en-AU)
  '1a48e481-7f02-5e96-bb84-68fcac65c2b2', // Aday (es)
  '5db34b17-ccd6-542f-bb62-8b947a04947b', // Aixa (es)
  '04e17f09-99f7-5cac-8903-30d6b3de48fc', // Agathe (fr)
  '94806d12-dfd6-5155-b951-2c60263fc3c2', // Abdelaziz (fr)
  '8659d94f-872e-554f-8152-71a535ec0da5', // Amelie (de)
  '36f3b07c-dd5b-5baa-8e6e-45745e3018fa', // Günther (de)
  '590f46de-c993-5cdf-9aae-1bc70a45a485', // Agnese (it)
  '52da0768-d49b-5624-a0e7-1ea762147195', // Adamo (it)
  '0739ceb4-e8f2-5b54-bed4-7fe534aa9b95', // Aline (pt)
  'd7aada97-72e8-520d-b253-0e7ec0bb79c2', // Abraão (pt)
]);

/** AssemblyAI TTS voices are tied to one language: an English voice on a Spanish connection is rejected. One native voice_id per language. */
export const FAST_NATIVE_VOICE: Record<string, string> = {
  es: '1a48e481-7f02-5e96-bb84-68fcac65c2b2', // Aday (es)
  fr: '04e17f09-99f7-5cac-8903-30d6b3de48fc', // Agathe (fr)
  de: '8659d94f-872e-554f-8152-71a535ec0da5', // Amelie (de)
  it: '590f46de-c993-5cdf-9aae-1bc70a45a485', // Agnese (it)
  pt: 'd7aada97-72e8-520d-b253-0e7ec0bb79c2', // Abraão (pt)
};

const NON_ENGLISH_VOICE_KEYS = new Set([
  'lola', 'mateo', 'carlos', 'elena',
  'estelle', 'claire', 'henri',
  'juergen', 'greta', 'lukas',
  'giovanni', 'giulia', 'marco',
  'rafael', 'camila', 'lucas', 'taco', 'mariachi',
  ...Object.values(FAST_NATIVE_VOICE),
  '5db34b17-ccd6-542f-bb62-8b947a04947b',
  '94806d12-dfd6-5155-b951-2c60263fc3c2',
  '36f3b07c-dd5b-5baa-8e6e-45745e3018fa',
  '52da0768-d49b-5624-a0e7-1ea762147195',
  '0739ceb4-e8f2-5b54-bed4-7fe534aa9b95',
]);

const VOICE_NAME_TO_ID: Record<string, string> = {
  jane: 'aai-jane',
  chaiwala: 'd9e70892-1ace-5638-b749-dd6a0ba44686', // Andrew (en-IN)
  taco: '2aadec9a-80cc-5181-a9fc-f2a9fda0cf50', // Constanza (es-MX)
  mariachi: 'bff56a11-dc95-552e-a93a-59f68ca60b64', // Antonio Luis (es-MX)
  anna: '478badc1-a7eb-5bef-b916-c6e51bd2771e', // Adrienne (en-GB)
  john: 'aai-john',
  george: 'aai-john',
  reid: 'aai-john',
  callum: '1edcb3f4-d874-5c38-8839-8a29b854d294', // Aaron (en-GB)
  charles: '1edcb3f4-d874-5c38-8839-8a29b854d294', // Aaron (en-GB)
  paul: '1edcb3f4-d874-5c38-8839-8a29b854d294', // Aaron (en-GB)
  harper: 'bf7d036b-b18a-5b6b-94d3-d6a6bdd6febe',
  nicole: 'aai-nicole',
  vera: 'aai-nicole',
  emily: 'aai-emily',
  eve: '49c443a4-8a1d-5f7e-b70b-98bdbd9823c3', // Audrey (en-US)
  daniel: 'aai-daniel',
  michael: 'aai-michael',
  sarah: 'aai-sarah',
  alba: 'aai-sarah',
  david: 'aai-david',
  emma: 'aai-emma',
  mary: 'aai-emma',
  james: 'aai-james',
  olivia: 'aai-olivia',
  jean: 'aai-olivia',
  sophia: 'aai-sophia',
  iris: 'aai-sophia',
  liam: 'aai-liam',
  noah: 'aai-noah',
  ava: 'aai-ava',
  isabella: 'aai-isabella',
  mia: 'aai-mia',
  charlotte: 'aai-charlotte',
  amelia: 'aai-amelia',
  evelyn: 'aai-evelyn',
  abigail: 'aai-abigail',
  // Spanish
  mateo: '1a48e481-7f02-5e96-bb84-68fcac65c2b2',
  lola: '1a48e481-7f02-5e96-bb84-68fcac65c2b2',
  carlos: '1a48e481-7f02-5e96-bb84-68fcac65c2b2',
  elena: '5db34b17-ccd6-542f-bb62-8b947a04947b',
  // French
  claire: '04e17f09-99f7-5cac-8903-30d6b3de48fc',
  estelle: '04e17f09-99f7-5cac-8903-30d6b3de48fc',
  henri: '94806d12-dfd6-5155-b951-2c60263fc3c2',
  // German
  greta: '8659d94f-872e-554f-8152-71a535ec0da5',
  juergen: '8659d94f-872e-554f-8152-71a535ec0da5',
  lukas: '36f3b07c-dd5b-5baa-8e6e-45745e3018fa',
  // Italian
  giulia: '590f46de-c993-5cdf-9aae-1bc70a45a485',
  marco: '52da0768-d49b-5624-a0e7-1ea762147195',
  giovanni: '52da0768-d49b-5624-a0e7-1ea762147195',
  // Portuguese
  camila: '0739ceb4-e8f2-5b54-bed4-7fe534aa9b95',
  lucas: 'd7aada97-72e8-520d-b253-0e7ec0bb79c2',
  rafael: 'd7aada97-72e8-520d-b253-0e7ec0bb79c2',
};

const LANG_NAME_TO_ISO: Record<string, string> = {
  english: 'en', en: 'en',
  spanish: 'es', es: 'es',
  french: 'fr', fr: 'fr',
  german: 'de', de: 'de',
  italian: 'it', it: 'it',
  portuguese: 'pt', pt: 'pt',
};

/** Maps any persona voice name, slug, or UUID to a verified §2.4 AssemblyAI voice_id. */
export function toAssemblyVoiceId(selected: string, lang?: string): string {
  const raw = (selected || '').trim();
  const iso = lang ? (LANG_NAME_TO_ISO[lang.toLowerCase().split('-')[0]] ?? lang.toLowerCase().split('-')[0]) : '';
  if (iso && iso !== 'en' && FAST_NATIVE_VOICE[iso]) {
    const mapped = VOICE_NAME_TO_ID[raw.toLowerCase()] ?? raw;
    if (NON_ENGLISH_VOICE_KEYS.has(raw.toLowerCase()) && VALID_ASSEMBLY_VOICE_IDS.has(mapped)) {
      return mapped;
    }
    return FAST_NATIVE_VOICE[iso];
  }
  if (VALID_ASSEMBLY_VOICE_IDS.has(raw)) return raw;
  const lower = raw.toLowerCase();
  if (VOICE_NAME_TO_ID[lower]) return VOICE_NAME_TO_ID[lower];
  if (VALID_ASSEMBLY_VOICE_IDS.has(`aai-${lower}`)) return `aai-${lower}`;
  return 'aai-anna';
}

/** The voice_id to open the TTS connection with: the person's pick when it speaks that language, else the language's native voice_id. */
export function fastVoiceFor(selected: string, lang: string): string {
  const iso = LANG_NAME_TO_ISO[(lang || 'en').toLowerCase().split('-')[0]] ?? 'en';
  const native = FAST_NATIVE_VOICE[iso];
  if (native) return toAssemblyVoiceId(selected, iso);
  const raw = (selected || '').trim().toLowerCase();
  if (!raw || NON_ENGLISH_VOICE_KEYS.has(raw)) return 'aai-anna';
  return toAssemblyVoiceId(raw, 'en');
}
export const FAST_TTS_LANGUAGE: Record<string, string> = { en: 'english', es: 'spanish', fr: 'french', de: 'german', it: 'italian', pt: 'portuguese' };
/**
 * Actions whose result needs no explaining: after the app confirms it did them, Stay says one short line straight away
 * instead of waiting for a second model call (about 1.3 s saved on every spoken command).
 */
const QUICK_KIND: Record<string, 'done' | 'parked' | 'saved' | 'added'> = {
  list_add: 'added', dump: 'done', remind: 'done', park: 'parked', memory_add: 'saved', timer_start: 'done', timer_stop: 'done', color: 'done', shape: 'done', open: 'done', quiet: 'done', pause: 'done', ground: 'done', game: 'done',
};
const QUICK_PHRASE: Record<string, Record<'done' | 'parked' | 'saved' | 'added', string>> = {
  english: { done: 'Done.', parked: 'Parked.', saved: 'Got it, I will remember.', added: 'Added.' },
  spanish: { done: 'Hecho.', parked: 'Guardado para después.', saved: 'Entendido, lo recordaré.', added: 'Añadido.' },
  french: { done: "C'est fait.", parked: 'Mis de côté.', saved: "Compris, je m'en souviendrai.", added: 'Ajouté.' },
  german: { done: 'Erledigt.', parked: 'Zurückgestellt.', saved: 'Verstanden, ich merke es mir.', added: 'Hinzugefügt.' },
  italian: { done: 'Fatto.', parked: 'Messo da parte.', saved: 'Capito, me lo ricordo.', added: 'Aggiunto.' },
  portuguese: { done: 'Feito.', parked: 'Guardado para depois.', saved: 'Entendi, vou lembrar.', added: 'Adicionado.' },
};
export function quickConfirmation(action: unknown, resultJson: string, ttsLanguage: string): string | null {
  const kind = typeof action === 'string' ? QUICK_KIND[action] : undefined;
  let r: { ok?: boolean; say?: unknown; quick?: unknown };
  try {
    r = JSON.parse(resultJson) as typeof r;
  } catch {
    return null;
  }
  if (r.ok !== true) return null;
  // a result may carry its own truthful line, built from what happened (English only; other languages use the fixed phrases)
  if (r.quick === true && typeof r.say === 'string' && r.say.trim() && ttsLanguage === 'english') return r.say.trim().slice(0, 240);
  if (!kind) return null;
  return (QUICK_PHRASE[ttsLanguage] ?? QUICK_PHRASE.english)[kind];
}

/** What a prepared-but-not-yet-confirmed reply must not show the app. */
const GATED_EVENTS = new Set(['reply.started', 'reply.text', 'reply.audio', 'transcript.agent', 'reply.done', 'tool.call']);

const STT_URL ='wss://streaming.assemblyai.com/v3/ws';
const TTS_URL = process.env.NEXT_PUBLIC_ASSEMBLYAI_TTS_URL || 'wss://tts.us.assemblyai.com/v1/ws';
const MAX_HISTORY = 14;
/** Characters of a reply held back before speech starts, so the voice begins as one continuous synthesis (about two sentences). */
const FIRST_BLOCK_CHARS = 90;
/** The reply is fully written but the voice has sent no sound and no "done" for this long: end it here, never stay on "Speaking". */
const REPLY_STALL_MS = 8000;
/** With no voice connection nothing will confirm the speech, so a reply ends this long after its words were shown. */
const VOICELESS_FINISH_MS = 600;
/** After three quick tries the voice connection is tried again this often, for as long as the call lasts. */
const TTS_RETRY_MS = 15_000;
/** After a lone greeting or filler turn, how long to wait for the rest of the sentence before answering it. */
const OPENER_HOLD_MS = 700;

/** Splits streamed text into speakable chunks: a sentence end followed by space, once there is enough to say. */
export function takeSpeakable(buffer: string, first = false): { chunk: string; rest: string } | null {
  // the first chunk of a reply may end at a comma or dash so speech starts a beat sooner; later chunks wait for a sentence end
  const m = (first ? /^([\s\S]{14,}?[.!?…。！？,;:—])(\s+|$)/ : /^([\s\S]{18,}?[.!?…。！？])(\s+|$)/).exec(buffer);
  if (!m) return null;
  return { chunk: m[1].trim(), rest: buffer.slice(m[0].length) };
}

/**
 * True when a finished turn sounds unfinished: it ends on a filler ("um", "uh"), a connector ("and", "but", "because"), an
 * article or preposition, or trailing punctuation like a comma or an ellipsis. A full stop, question mark or exclamation
 * mark means the person is done. People with ADHD pause mid-thought; Stay waits instead of talking into the pause.
 */
export function soundsUnfinished(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/[.?!。！？]["')\]]?$/.test(t) && !/\.{2,}$|…$/.test(t)) return false;
  if (/[,;:…-]$/.test(t) || /\.{2,}$/.test(t)) return true;
  return /\b(?:um+|uh+|er+m?|ah+|hmm+|mm+|like|and|but|so|because|cause|or|then|if|that|which|to|the|a|an|my|of|for|with|about|maybe|just|i|i'm|i've|it's)$/i.test(t);
}

/** A single word that only opens a sentence: a greeting or a filler. ("Hi hello." is two words and is answered at once.) */
export function isOpenerOnly(text: string): boolean {
  const words = text.trim().toLowerCase().replace(/[.,!?¿¡…]+/g, ' ').split(/\s+/).filter(Boolean);
  return words.length === 1 && words.every((w) => /^(?:hi|hello|hey|hiya|hola|buenas|bonjour|salut|ciao|hallo|ola|olá|okay|ok|so|well|right|alright|um+|uh+|er+m?)$/.test(w));
}

/** Two transcripts of the same words (capitals and punctuation aside) share a key. */
function specKey(t: string): string {
  return t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export class FastSocket {
  private lastToolOk = true;
  private lastToolSay?: string;
  static readonly OPEN = 1;
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;

  private cfg: Required<Omit<FastSocketConfig, "keyterms" | "ttsConnect" | "endpointingMode" | "freshTtsToken" | "recall">> & Pick<FastSocketConfig, "keyterms" | "ttsConnect" | "endpointingMode" | "freshTtsToken" | "recall">;
  private session: FastSession | null = null;
  private notes: string[] = [];
  private history: ChatMessage[] = [];
  private stt: WebSocket | null = null;
  private tts: WebSocket | TtsConnection | null = null;
  private inUserTurn = false;
  private lastTurnOrder = -1;
  private genId = 0;
  private abort: AbortController | null = null;
  // The server numbers flushes itself and may report several as one FlushDone, so completion is tracked by id range,
  // and audio from a cancelled reply is recognised by the server's Cancelled acknowledgement, not by counting.
  private sentFlushes = 0;
  /** text has been streamed to TTS that no Flush has closed yet */
  private unflushed = false;
  private replyBaseId: number | null = null;
  private lastDoneId = -1;
  private staleCancels = 0;
  private wordBoundaryOffsetMs = 0;
  private lastWordEndMs = 0;
  private llmDone = false;
  private spoken = '';
  private toolWaiters = new Map<string, (r: string) => void>();
  private closed = false;
  private agentSpeaking = false;
  private carry = ''; // an unfinished thought, held while the person hesitates
  private holdTimer: ReturnType<typeof setTimeout> | undefined;
  private holds = 0;
  private playEndAt = 0; // when the browser will have finished playing what it has received
  private interrupted = false; // the current user turn began while Stay was speaking or about to
  // A reply prepared early, on a finished-looking partial transcript. Everything it produces is held back (gated) and released only
  // if the end of turn confirms the same words; otherwise it is cancelled and the history put back.
  private spec: { key: string; base: ChatMessage[] } | null = null;
  private specStarts = 0;
  private gated = false;
  private held: Json[] = [];
  private captureOnly = false; // brain dump: hear and transcribe, but never answer
  private keepAliveTimer: ReturnType<typeof setInterval> | undefined;
  private ttsRotationTimer: ReturnType<typeof setTimeout> | undefined;
  private ttsRetryTimer: ReturnType<typeof setTimeout> | undefined;
  private ttsReconnecting = false; // one reconnect chain at a time
  private ttsSwitch: Promise<void> | null = null;
  private detectedLang = '';
  private ttsNeedsRotation = false;
  private ttsReconnectAttempts = 0;
  private ttsOpened = false;
  private sttTermResolve: (() => void) | null = null;
  private ttsTermResolve: (() => void) | null = null;
  private ttsAudioStartedAt = 0;
  private unduckTimer: ReturnType<typeof setTimeout> | undefined;
  /** the newest frame of a shared screen or camera (the app keeps it fresh); used only for turns that point at it */
  private latestImage: { data: string; at: number } | null = null;
  /** a picture sent with one typed message: used for the next reply, then dropped */
  private nextImage: string | null = null;
  private cancelFallbackTimer: ReturnType<typeof setTimeout> | undefined;
  private replyWatchdog: ReturnType<typeof setTimeout> | undefined;

  constructor(cfg: FastSocketConfig) {
    this.cfg = { sampleRate: 16000, holdMs: 2200, interruptHoldMs: 900, warmUp: true, autoLanguage: false, ...cfg };
    queueMicrotask(() => {
      this.readyState = FastSocket.OPEN;
      this.onopen?.();
    });
  }

  // ---- WebSocket-like surface -------------------------------------------------------------------------------------

  /** Stream a raw text chunk into TTS preserving leading/trailing spaces, optionally followed by Flush. */
  sendTtsChunk(text: string, flush = false): void {
    if (this.ttsSwitch) {
      void this.ttsSwitch.then(() => this.sendTtsChunk(text, flush));
      return;
    }
    if (!text || this.tts?.readyState !== WebSocket.OPEN) return;
    this.resetKeepAliveTimer();
    this.tts.send(JSON.stringify({ type: 'Generate', text }));
    if (flush) {
      this.sentFlushes++;
      this.tts.send(JSON.stringify({ type: 'Flush' }));
    }
  }

  /** Gracefully send Terminate on both sockets and wait up to 5 s for server Termination frames before closing. */
  async terminateGracefully(timeoutMs = 5000): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.clearTtsTimers();
    if (this.holdTimer) clearTimeout(this.holdTimer);
    this.cancel();

    const waitSocket = (s: WebSocket | TtsConnection | null, isTts: boolean): Promise<void> => {
      if (!s || s.readyState !== WebSocket.OPEN) return Promise.resolve();
      return new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          resolve();
        }, timeoutMs);
        const done = () => {
          clearTimeout(timer);
          resolve();
        };
        if (isTts) this.ttsTermResolve = done;
        else this.sttTermResolve = done;
        try {
          s.send(JSON.stringify({ type: 'Terminate' }));
        } catch {
          done();
        }
      });
    };

    await Promise.all([waitSocket(this.stt, false), waitSocket(this.tts, true)]);
    for (const s of [this.stt, this.tts]) {
      try {
        s?.close();
      } catch {
        // already gone
      }
    }
    this.readyState = 3;
    this.onclose?.();
  }

  send(raw: string): void {
    let m: Json;
    try {
      m = JSON.parse(raw) as Json;
    } catch {
      return;
    }
    switch (m.type) {
      case 'session.update':
        void this.start((m.session || {}) as Json);
        break;
      case 'session.clear':
      case 'conversation.clear':
        this.clear();
        break;
      case 'input.audio':
        if (this.stt?.readyState === WebSocket.OPEN && typeof m.audio === 'string' && !(this.tts as TtsConnection | null)?.muteMic) this.stt.send(b64ToBytes(m.audio)); // muteMic: a browser voice cannot be heard around, so the mic is closed while it talks
        break;
      case 'input.image':
        this.latestImage = isImageDataUrl(m.image) ? { data: m.image, at: Date.now() } : null;
        break;
      case 'conversation.message':
        if (typeof m.content === 'string') {
          if (m.role === 'user') {
            // a typed message is a real turn, not a side note
            this.history = [...this.history, { role: 'user' as const, content: m.content.slice(0, 1000) }].slice(-MAX_HISTORY);
            if (isImageDataUrl(m.image)) this.nextImage = m.image;
          } else this.notes = [...this.notes.slice(-4), m.content.slice(0, 300)];
        }
        break;
      case 'capture.mode':
        this.captureOnly = m.on === true;
        break;
      case 'reply.say':
        if (typeof m.text === 'string' && m.text.trim()) this.speakOnly(m.text.trim().slice(0, 600)); // exact words, no model
        break;
      case 'reply.create':
        void this.generate(typeof m.instructions === 'string' ? m.instructions : undefined);
        break;
      case 'tool.result': {
        const w = this.toolWaiters.get(String(m.call_id));
        if (w) {
          this.toolWaiters.delete(String(m.call_id));
          w(typeof m.result === 'string' ? m.result : JSON.stringify(m.result ?? {}));
        }
        break;
      }
      case 'session.end':
        this.close();
        break;
    }
  }

  clear(): void {
    this.cancel();
    this.history = [];
    this.notes = [];
    this.spoken = '';
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.clearTtsTimers();
    if (this.holdTimer) clearTimeout(this.holdTimer);
    this.cancel();
    for (const s of [this.stt, this.tts]) {
      try {
        if (s?.readyState === WebSocket.OPEN) s.send(JSON.stringify({ type: 'Terminate' }));
        s?.close();
      } catch {
        // already gone
      }
    }
    this.readyState = 3;
    this.onclose?.();
  }

  private clearTtsTimers(): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = undefined;
    }
    if (this.ttsRotationTimer) {
      clearTimeout(this.ttsRotationTimer);
      this.ttsRotationTimer = undefined;
    }
    if (this.ttsRetryTimer) {
      clearTimeout(this.ttsRetryTimer);
      this.ttsRetryTimer = undefined;
    }
  }

  private resetKeepAliveTimer(): void {
    if (this.keepAliveTimer) clearInterval(this.keepAliveTimer);
    this.keepAliveTimer = setInterval(() => {
      if (this.closed || !this.tts || this.tts.readyState !== WebSocket.OPEN) return;
      try {
        this.tts.send(JSON.stringify({ type: 'KeepAlive' }));
      } catch {
        // socket closing
      }
    }, 30_000);
  }

  private startTtsRotationTimer(): void {
    if (this.ttsRotationTimer) clearTimeout(this.ttsRotationTimer);
    this.ttsNeedsRotation = false;
    this.ttsRotationTimer = setTimeout(() => {
      this.ttsNeedsRotation = true;
      if (!this.agentSpeaking && this.spoken === '') {
        void this.rotateTtsSession();
      }
    }, 55 * 60 * 1000);
  }

  private async rotateTtsSession(): Promise<void> {
    if (this.closed || !this.session) return;
    this.ttsNeedsRotation = false;
    const oldTts = this.tts;
    this.clearTtsTimers();
    try {
      if (oldTts) {
        // detach first: closing the old socket on purpose must not look like an unexpected close and reopen a second one
        (oldTts as { onclose: unknown }).onclose = null;
        (oldTts as { onmessage: unknown }).onmessage = null;
      }
      if (oldTts?.readyState === WebSocket.OPEN) {
        oldTts.send(JSON.stringify({ type: 'Terminate' }));
      }
      oldTts?.close();
    } catch {
      // ignore
    }
    try {
      await this.openTts();
    } catch {
      this.handleTtsUnexpectedClose(1006);
    }
  }

  private handleTtsUnexpectedClose(code = 1006, detail = ''): void {
    if (this.closed || !this.session) return;
    // The service's Error message and the close that follows it are one failure, not two: a second chain opened a second session at the
    // same moment and the service's session limit then refused both (pipeline soak, 3 Nov 2026: reconnects in pairs, then "unavailable").
    if (this.ttsReconnecting) return;
    this.clearTtsTimers();
    if (this.ttsReconnectAttempts < 3) {
      const attempt = ++this.ttsReconnectAttempts;
      const delayMs = 200 * Math.pow(2, attempt - 1);
      this.ttsReconnecting = true;
      this.emit({ type: 'tts.reconnecting', attempt, code, detail });
      setTimeout(() => {
        if (this.closed) return;
        this.openTts()
          .then(() => {
            this.ttsReconnecting = false;
            this.ttsReconnectAttempts = 0;
            this.emit({ type: 'tts.reconnected' });
          })
          .catch((e: unknown) => {
            this.ttsReconnecting = false;
            this.handleTtsUnexpectedClose(code, e instanceof Error ? e.message : detail);
          });
      }, delayMs);
      return;
    }
    this.emit({ type: 'tts.unavailable', code, detail, message: 'AssemblyAI TTS connection lost after 3 retries; STT remains active.' });
    // not for good: the next reply, or this timer, tries again (a refused session or a rate limit passes)
    this.ttsRetryTimer = setTimeout(() => {
      this.ttsRetryTimer = undefined;
      this.ttsReconnectAttempts = 0;
      this.handleTtsUnexpectedClose(code);
    }, TTS_RETRY_MS);
  }

  /** A reply needs the voice and it is down: skip the wait and try to reconnect now, once. */
  private retryVoiceNow(): void {
    if (!this.ttsRetryTimer) return;
    clearTimeout(this.ttsRetryTimer);
    this.ttsRetryTimer = undefined;
    this.ttsReconnectAttempts = 0;
    this.handleTtsUnexpectedClose();
  }

  // ---- internals --------------------------------------------------------------------------------------------------

  /** Stage timestamps (epoch ms, same clock as the benchmark rig) for per-stage latency reports. Debug flag only; free otherwise. */
  private mark(name: string): void {
    const g = globalThis as { __stayFastDebug?: boolean; __stayFastMarks?: Array<[string, number]> };
    if (g.__stayFastDebug) (g.__stayFastMarks ??= []).push([name, Date.now()]);
  }

  private emit(m: Json): void {
    if (this.gated && GATED_EVENTS.has(String(m.type))) {
      this.held.push(m);
      return;
    }
    if ((globalThis as { __stayFastDebug?: boolean }).__stayFastDebug && m.type !== 'reply.audio') console.debug('[fast]', Math.round(performance.now()), m.type, typeof m.text === 'string' ? m.text.slice(0, 60) : typeof m.code === 'number' ? `code=${m.code} ${String(m.detail ?? '').slice(0, 80)}` : m.type === 'tool.call' ? JSON.stringify(m.arguments).slice(0, 80) : '');
    if (!this.closed) this.onmessage?.({ data: JSON.stringify(m) });
  }

  private fail(code: string, detail = ''): void {
    this.emit({ type: 'session.error', code, message: detail ? `fast voice connection failed: ${detail}` : 'fast voice connection failed' });
    this.close();
  }

  private async start(session: Json): Promise<void> {
    const rawLang = String((session as Json).tts_language || 'english').toLowerCase();
    const ttsLanguage = FAST_TTS_LANGUAGE[rawLang] ?? (Object.values(FAST_TTS_LANGUAGE).includes(rawLang) ? rawLang : 'english');
    const rawVoice = String((session.output as Json | undefined)?.voice || 'anna');
    this.session = {
      systemPrompt: String(session.system_prompt || ''),
      personal: String(session.personal || '').slice(0, 600),
      offer: String(session.offer || '').slice(0, 200),
      greeting: String(session.greeting || ''),
      voice: toAssemblyVoiceId(rawVoice, ttsLanguage),
      rawVoice,
      ttsLanguage,
      tools: Array.isArray(session.tools) && session.tools.length > 0,
    };
    try {
      await Promise.all([this.openStt(), this.openTts()]);
    } catch (err) {
      return this.fail('connection_failed', String((err as Error)?.message || err));
    }
    this.emit({ type: 'session.ready' });
    if (this.cfg.warmUp) void fetch('/api/voice/chat', { method: 'GET' }).catch(() => undefined); // warm the function while the greeting plays
    if (this.session.greeting) void this.speakOnly(this.session.greeting);
  }

  private openStt(): Promise<void> {
    return new Promise((resolve, reject) => {
      const preset = this.cfg.endpointingMode ? ENDPOINTING_PRESETS[this.cfg.endpointingMode] : ENDPOINTING_PRESETS.coaching;
      const q = new URLSearchParams({
        sample_rate: String(this.cfg.sampleRate),
        encoding: 'pcm_s16le',
        speech_model: 'universal-3-6-pro',
        min_turn_silence: String(preset?.min_turn_silence ?? 128),
        max_turn_silence: String(preset?.max_turn_silence ?? 1280),
        vad_threshold: '0.2',
        language_detection: 'true',
        token: this.cfg.sttToken,
      });
      const terms = (this.cfg.keyterms ?? []).filter((t) => t.length > 2 && t.length <= 50).slice(0, 100);
      if (terms.length > 0) q.set('keyterms_prompt', JSON.stringify(terms));
      // benchmark hook: extra turn-detection query parameters, e.g. 'min_turn_silence=50' (debug flag only)
      const g = globalThis as { __stayFastDebug?: boolean; __stayFastSttExtra?: string };
      if (g.__stayFastDebug && g.__stayFastSttExtra) {
        for (const [k, v] of new URLSearchParams(g.__stayFastSttExtra)) {
          if (k !== 'end_of_turn_confidence_threshold' && k !== 'format_turns' && k !== 'prompt') {
            q.set(k, v);
          }
        }
      }
      const ws = new WebSocket(`${STT_URL}?${q}`);
      this.stt = ws;
      let begun = false;
      const beginTimer = setTimeout(() => {
        if (!begun) reject(new Error('stt_begin_timeout'));
      }, 5000);
      ws.onmessage = (e) => {
        if (typeof e.data !== 'string') return;
        let m: Json;
        try {
          m = JSON.parse(e.data) as Json;
        } catch {
          return;
        }
        if (m.type === 'Begin') {
          begun = true;
          clearTimeout(beginTimer);
          resolve();
        } else if (m.type === 'SpeechStarted') {
          const speakingNow = this.agentSpeaking || Date.now() < this.playEndAt;
          const sinceAudioStartMs = Date.now() - this.ttsAudioStartedAt;
          if (speakingNow && this.ttsAudioStartedAt > 0 && sinceAudioStartMs >= 0 && sinceAudioStartMs < 250) {
            this.emit({ type: 'barge_in.echo_ignored', sinceAudioStartMs });
            return;
          }
          if (speakingNow) {
            this.emit({ type: 'playback.duck', ducked: true, db: -18 });
            if (this.unduckTimer) clearTimeout(this.unduckTimer);
            this.unduckTimer = setTimeout(() => {
              this.unduckTimer = undefined;
              this.emit({ type: 'playback.duck', ducked: false });
            }, 600);
          }
          this.emit({ type: 'input.speech.started', timestamp: m.timestamp, source: 'vad' });
        } else if (m.type === 'Turn') {
          this.onTurn(m);
        } else if (m.type === 'Termination') {
          this.sttTermResolve?.();
          this.sttTermResolve = null;
        } else if (m.type === 'Error') {
          clearTimeout(beginTimer);
          this.fail('stt_error');
        }
      };
      ws.onerror = () => {
        clearTimeout(beginTimer);
        reject(new Error('stt'));
      };
      ws.onclose = () => {
        clearTimeout(beginTimer);
        this.sttTermResolve?.();
        this.sttTermResolve = null;
        if (!this.closed) this.fail('stt_closed');
      };
    });
  }

  private async openTts(): Promise<void> {
    // the call-start token is dead 60 s after it was minted (live, 3 Nov 2026: a switch to Spanish 100 s in got "Unauthorized: Signature
    // has expired" on every retry), so every session after the first opens with a new one
    const later = this.ttsOpened && !this.cfg.ttsConnect && this.cfg.freshTtsToken;
    this.ttsOpened = true;
    const token = later ? await this.cfg.freshTtsToken!().catch(() => this.cfg.ttsToken) : this.cfg.ttsToken;
    if (this.closed) return;
    return new Promise((resolve, reject) => {
      const s = this.session as FastSession;
      const voiceId = toAssemblyVoiceId(s.voice, s.ttsLanguage);
      const q = new URLSearchParams({
        token,
        model_id: 'assemblyai-tts-1',
        voice_id: voiceId,
        language: s.ttsLanguage,
        encoding: 'pcm_s16le',
        sample_rate: '24000',
      });
      const ws: WebSocket | TtsConnection = this.cfg.ttsConnect ? this.cfg.ttsConnect() : new WebSocket(`${TTS_URL}?${q}`);
      this.tts = ws;
      let begun = false;
      const beginTimer = setTimeout(() => {
        if (!begun) reject(new Error('tts_begin_timeout'));
      }, 5000);
      ws.onmessage = (e: { data: unknown }) => {
        if (typeof e.data !== 'string') return;
        let m: Json;
        try {
          m = JSON.parse(e.data) as Json;
        } catch {
          return;
        }
        if (m.type === 'Begin') {
          begun = true;
          clearTimeout(beginTimer);
          // a fresh session cannot send audio of a reply cancelled on the one it replaces; counting those acks would mute every later reply
          this.staleCancels = 0;
          if (this.cancelFallbackTimer) {
            clearTimeout(this.cancelFallbackTimer);
            this.cancelFallbackTimer = undefined;
          }
          const cfg = m.configuration as { unknown_params?: unknown[] } | undefined;
          if (cfg && Array.isArray(cfg.unknown_params) && cfg.unknown_params.length > 0) {
            this.emit({ type: 'tts.warning', unknown_params: cfg.unknown_params });
          }
          this.resetKeepAliveTimer();
          this.startTtsRotationTimer();
          resolve();
        } else if (m.type === 'Audio' && typeof m.audio === 'string') {
          this.onTtsAudio(m);
        } else if (m.type === 'FlushDone') {
          this.onFlushDone(Number(m.flush_id));
        } else if (m.type === 'WordBoundaries' && Array.isArray(m.words)) {
          this.onWordBoundaries(m);
        } else if (m.type === 'Cancelled') {
          if (this.cancelFallbackTimer) {
            clearTimeout(this.cancelFallbackTimer);
            this.cancelFallbackTimer = undefined;
          }
          this.staleCancels = Math.max(0, this.staleCancels - 1);
          this.emit({ type: 'barge_in.ready_listening', source: 'cancelled_ack' });
        } else if (m.type === 'Termination') {
          this.ttsTermResolve?.();
          this.ttsTermResolve = null;
        } else if (m.type === 'Error') {
          clearTimeout(beginTimer);
          if (!begun) reject(new Error(String(m.error || 'tts_error')));
          else if (this.tts === ws) this.handleTtsUnexpectedClose(Number(m.error_code ?? 3006), String(m.error ?? ''));
        }
      };
      ws.onerror = () => {
        clearTimeout(beginTimer);
        if (!begun) reject(new Error('tts'));
      };
      ws.onclose = (ev?: { code?: number }) => {
        clearTimeout(beginTimer);
        this.ttsTermResolve?.();
        this.ttsTermResolve = null;
        if (this.closed) return;
        if (!begun) {
          reject(new Error('tts_closed'));
          return;
        }
        // a session that was already replaced (language switch, reconnect, rotation) closing late says nothing about the current one:
        // reacting to it opened yet another session and threw away a working voice
        if (this.tts === ws) this.handleTtsUnexpectedClose(ev?.code ?? 1006);
      };
    });
  }

  private onWordBoundaries(m: Json): void {
    const rawWords = Array.isArray(m.words) ? (m.words as Array<Record<string, unknown>>) : [];
    if (this.staleCancels > 0 || rawWords.length === 0) return;
    const audioStartMs = typeof m.audio_start_ms === 'number' ? m.audio_start_ms : 0;
    const usesStartMs = rawWords[0]?.start_ms !== undefined;
    const firstRawStart = usesStartMs
      ? Number(rawWords[0]?.start_ms ?? 0) - audioStartMs
      : Number(rawWords[0]?.start ?? 0);
    const lastRawEnd = usesStartMs
      ? Number(rawWords[rawWords.length - 1]?.end_ms ?? 0) - audioStartMs
      : Number(rawWords[rawWords.length - 1]?.end ?? 0);
    const isSeconds =
      !usesStartMs &&
      rawWords.some((w) => !Number.isInteger(Number(w.start ?? 0)) || !Number.isInteger(Number(w.end ?? 0))) &&
      lastRawEnd < 120;
    const scale = isSeconds ? 1000 : 1;
    if (firstRawStart * scale < this.lastWordEndMs && this.lastWordEndMs > 0) {
      this.wordBoundaryOffsetMs = this.lastWordEndMs + 60;
    }
    const aligned = rawWords.map((w) => {
      const rStart = usesStartMs ? Number(w.start_ms ?? 0) - audioStartMs : Number(w.start ?? 0);
      const rEnd = usesStartMs ? Number(w.end_ms ?? rStart) - audioStartMs : Number(w.end ?? rStart);
      const start = Math.max(0, Math.round(rStart * scale) + this.wordBoundaryOffsetMs);
      const end = Math.max(start + 40, Math.round(rEnd * scale) + this.wordBoundaryOffsetMs);
      this.lastWordEndMs = Math.max(this.lastWordEndMs, end);
      const wordText = String(w.word ?? w.text ?? '');
      return { word: wordText, text: wordText, start, end, start_ms: start, end_ms: end };
    });
    this.emit({ type: 'word.boundaries', words: aligned, reply_id: this.genId });
  }

  /**
   * True when what the mic just transcribed is mostly words Stay is saying (or just said): that is Stay's own voice coming back
   * through the speakers, not the person. Needs 3+ words and 75% overlap so a genuine "wait, the folder" is never swallowed.
   */
  private isEchoOfOwnSpeech(text: string): boolean {
    const words = specKey(text).split(' ').filter(Boolean);
    if (words.length < 3) return false;
    const lastReply = [...this.history].reverse().find((h) => h.role === 'assistant' && typeof h.content === 'string')?.content ?? '';
    const known = new Set(specKey(`${this.spoken} ${lastReply}`).split(' ').filter(Boolean));
    const hits = words.filter((w) => known.has(w)).length;
    return hits / words.length >= 0.75;
  }

  /** Streaming transcript -> the Voice Agent's user events. */
  private onTurn(m: Json): void {
    const text = String(m.transcript || '').trim();
    const order = Number(m.turn_order ?? -1);
    if (order >= 0 && order <= this.lastTurnOrder) return; // a late or formatted re-send of a turn already handled
    const speakingNow = this.agentSpeaking || Date.now() < this.playEndAt;
    if (!m.end_of_turn) {
      if (!text) return;
      // Someone starting to talk over Stay: ignore 1-3 word backchannels ("yeah", "mm-hmm", "got it") and single-word coughs,
      // unless they uttered an explicit interruption ("stop", "wait", "pause") or a multi-word barge-in sentence.
      if (!this.inUserTurn) {
        if (speakingNow) {
          if (isBackchannelOnly(text)) return;
          if (!isExplicitInterruption(text) && text.split(/\s+/).length < 2) return;
          if (!isExplicitInterruption(text) && this.isEchoOfOwnSpeech(text)) {
            this.emit({ type: 'barge_in.echo_ignored', reason: 'transcript matches what Stay is saying' });
            return; // the mic heard Stay's own voice, not the person: do not cut the reply off
          }
        }
        this.inUserTurn = true;
        this.interrupted = speakingNow || this.spoken !== '';
        if (this.unduckTimer) {
          clearTimeout(this.unduckTimer);
          this.unduckTimer = undefined;
          this.emit({ type: 'playback.duck', ducked: false });
        }
        this.playEndAt = 0;
        this.cancel();
        if (this.interrupted) {
          this.emit({ type: 'barge_in.committed', replyEpoch: this.genId });
        }
        this.emit({ type: 'input.speech.started' });
      }
      if (this.holdTimer) {
        clearTimeout(this.holdTimer);
        this.holdTimer = undefined; // they carried on: it was a pause, not the end
      }
      this.emit({ type: 'transcript.user.delta', text: this.carry ? `${this.carry} ${text}` : text });
      const hasUtterance = typeof m.utterance === 'string' && m.utterance.trim().length > 0;
      this.speculate(text, hasUtterance);
      return;
    }
    if (order === this.lastTurnOrder || !text) return; // the formatted re-send of a turn we already handled
    if (!this.inUserTurn && speakingNow && (isBackchannelOnly(text) || (!isExplicitInterruption(text) && this.isEchoOfOwnSpeech(text)))) {
      this.lastTurnOrder = order;
      return; // a backchannel, or Stay's own voice picked up by the mic: do not interrupt and do not answer it
    }
    this.lastTurnOrder = order;
    this.mark('eot');
    this.followLanguage(m);
    const full = this.carry ? `${this.carry} ${text}` : text;
    const unfinished = soundsUnfinished(full);
    if (this.spec && this.spec.key !== specKey(full)) this.dropSpec(); // they said more than the partial: start over
    // someone who cuts in with "Wait, stop." usually has more to say: give the rest of the sentence a moment
    const interruptHold = this.interrupted && !unfinished && full.split(/\s+/).length <= 5 && this.holds < 2;
    // a lone "Hola." / "Hi," / "Um." is an opening, not a finished thought: wait a beat for the rest instead of answering the greeting
    const opener = !unfinished && this.holds < 1 && isOpenerOnly(full);
    if ((unfinished && this.holds < 3) || interruptHold || opener) {
      // trailing off: keep the turn open and give them time to finish the thought
      this.holds++;
      this.dropSpec();
      this.carry = full;
      this.inUserTurn = true;
      if (this.holdTimer) clearTimeout(this.holdTimer);
      this.holdTimer = setTimeout(() => this.finishTurn(order), unfinished ? this.cfg.holdMs : opener ? OPENER_HOLD_MS : this.cfg.interruptHoldMs);
      return;
    }
    this.carry = full;
    this.finishTurn(order);
  }

  /**
   * Auto-detect: AssemblyAI tells us each turn's language. When the person moves to a language that AssemblyAI TTS speaks,
   * reopen the TTS session in it (with that language's native voice) before replying, so Spanish is spoken as Spanish.
   * Languages TTS cannot speak (Hindi, Japanese, ...) leave the voice alone; the app tells the model how to answer.
   */
  private followLanguage(m: Json): void {
    const base = String(m.language_code || '').toLowerCase().split(/[-_]/)[0];
    if (!base) return;
    this.detectedLang = base;
    const next = FAST_TTS_LANGUAGE[base];
    const confidence = typeof m.language_confidence === 'number' ? m.language_confidence : 1;
    // measured on 1 Nov 2026: correct detections ranged from 0.65 to 0.999 on one-sentence clips, so 0.6; and a one- or two-word
    // turn ("ok", "si") is too short to move the voice on
    const words = String(m.transcript || '').trim().split(/\s+/).filter(Boolean).length;
    if (!this.cfg.autoLanguage || !this.session || !next || next === this.session.ttsLanguage || confidence < 0.6 || words < 3) return;
    this.dropSpec(); // a reply prepared in the old language must not be adopted
    this.session = { ...this.session, ttsLanguage: next, voice: fastVoiceFor(this.session.rawVoice, base) };
    this.emit({ type: 'tts.language', language: next, voice: this.session.voice });
    this.ttsSwitch = this.rotateTtsSession().finally(() => {
      this.ttsSwitch = null;
    });
  }

  private finishTurn(order: number): void {
    if (this.closed) return;
    const text = this.carry;
    this.carry = '';
    this.holds = 0;
    this.specStarts = 0;
    this.interrupted = false;
    this.holdTimer = undefined;
    if (!text) return;
    const adopt = this.spec !== null && this.spec.key === specKey(text);
    if (!adopt) this.dropSpec();
    if (!this.inUserTurn) this.emit({ type: 'input.speech.started' });
    this.inUserTurn = false;
    this.emit({ type: 'input.speech.stopped' });
    this.emit({ type: 'transcript.user', text, item_id: `u-${order}`, language: this.detectedLang || undefined });
    if (this.captureOnly) {
      this.dropSpec();
      return; // capture mode: the person is rambling on purpose, so no reply and no history
    }
    if (adopt) {
      // the reply was prepared while the end of turn was being decided: let it through now
      this.mark('adopt');
      this.spec = null;
      this.releaseHeld();
      return;
    }
    this.history = [...this.history, { role: 'user' as const, content: text }].slice(-MAX_HISTORY);
    void this.generate();
  }

  private releaseHeld(): void {
    this.gated = false;
    const queued = this.held;
    this.held = [];
    let audioMs = 0;
    for (const m of queued) {
      if (m.type === 'reply.audio') audioMs += (String(m.data).length * 0.75) / 48;
      this.emit(m);
    }
    if (audioMs > 0) this.playEndAt = Date.now() + audioMs; // it starts playing now, not when it was synthesized
  }

  private dropSpec(): void {
    if (!this.spec) return;
    const { base } = this.spec;
    const starts = this.specStarts;
    this.spec = null;
    this.gated = false;
    this.held = [];
    this.history = base;
    this.cancel(); // stop the early request and silence anything already synthesized for it
    this.specStarts = starts;
  }

  /**
   * The speech-to-text usually has the finished sentence, with its full stop, a few hundred ms before it declares the turn over
   * (measured: the full text 60 to 250 ms after the last word, the end of turn 440 to 650 ms). Prepare the reply now, held back:
   * if the end of turn confirms the same words it is released at once, if they said more it is cancelled and nothing was heard.
   * At most two early replies per turn, and none for a turn that sounds unfinished or follows an interruption.
   */
  private speculate(partial: string, hasUtterance = false): void {
    if (this.closed || !this.session || this.interrupted || this.carry || this.holds > 0) return;
    const text = partial.trim();
    const key = specKey(text);
    if (this.spec) {
      if (this.spec.key === key) return;
      this.dropSpec(); // they kept talking: the early reply is for a sentence that is no longer the whole turn
    }
    const isPunct = /[.?!。！？]["')\]]?$/.test(text) && !/\.{2,}$/.test(text);
    const isGreetingOrShortComplete =
      /^(?:hi|hello|hey|hey stay|good (?:morning|afternoon|evening)|yo|sup|namaste|hola|bonjour|hallo|ciao|yes|no|yep|nope|sure|okay|ok|done|stop|thanks|thank you)\b/i.test(
        text
      ) && text.split(/\s+/).length <= 5;
    if (!key || this.specStarts >= 2 || (!isPunct && !isGreetingOrShortComplete && !hasUtterance) || /\.{2,}$/.test(text) || soundsUnfinished(text)) return;
    this.specStarts++;
    this.mark('spec');
    this.spec = { key, base: this.history };
    this.history = [...this.history, { role: 'user' as const, content: text }].slice(-MAX_HISTORY);
    this.gated = true;
    this.held = [];
    void this.generate();
  }

  private systemText(): string {
    return [this.session?.systemPrompt, ...this.notes].filter(Boolean).join('\n');
  }

  private cancel(): void {
    this.dropSpec();
    this.specStarts = 0;
    this.genId++;
    this.abort?.abort();
    this.abort = null;
    this.unflushed = false;
    this.sentFlushes = 0;
    this.replyBaseId = null;
    this.lastDoneId = -1;
    this.wordBoundaryOffsetMs = 0;
    this.lastWordEndMs = 0;
    this.agentSpeaking = false;
    this.toolWaiters.clear();
    clearTimeout(this.replyWatchdog);
    try {
      if (this.tts?.readyState === WebSocket.OPEN) {
        this.tts.send(JSON.stringify({ type: 'Cancel' }));
        this.staleCancels++;
        if (this.cancelFallbackTimer) clearTimeout(this.cancelFallbackTimer);
        this.cancelFallbackTimer = setTimeout(() => {
          this.cancelFallbackTimer = undefined;
          this.staleCancels = 0; // one timer covers every cancel sent in the last 800 ms: if no ack came, none will
          this.emit({ type: 'barge_in.ready_listening', source: 'timeout_800ms' });
        }, 800);
      }
    } catch {
      // closing
    }
  }

  private onTtsAudio(m: Json): void {
    if (this.staleCancels > 0) return; // audio of a reply that was cancelled, still in flight
    if (this.replyBaseId === null) {
      this.replyBaseId = Number(m.flush_id);
      this.ttsAudioStartedAt = Date.now();
      this.mark('aud1');
    }
    this.agentSpeaking = true;
    if (this.llmDone && this.spoken !== '') this.armReplyWatchdog();
    this.playEndAt = Math.max(this.playEndAt, Date.now()) + (String(m.audio).length * 0.75) / 48; // 24 kHz 16-bit mono = 48 bytes per ms
    this.emit({ type: 'reply.audio', data: m.audio });
  }

  private onFlushDone(flushId: number): void {
    if (this.staleCancels > 0) return;
    this.lastDoneId = Math.max(this.lastDoneId, flushId);
    this.maybeFinish();
  }

  /**
   * Send text to the voice. Measured on the live API (scripts/measure-tts-chunking.mjs): every Flush is its own synthesis and adds
   * about 0.5 to 0.6 s of silence at the join, so a reply is sent as ONE synthesis: `flush=false` streams text in, and one
   * `flushSpeech` ends the reply. Texts are concatenated with no separator by the API, so a space is added.
   */
  private say(text: string, gen: number, flush = true): void {
    if (this.ttsSwitch) {
      void this.ttsSwitch.then(() => this.say(text, gen, flush)); // the voice is moving to the person's language: speak once it is open
      return;
    }
    if (!text || gen !== this.genId) return;
    const voiced = toSpeech(text, this.session?.ttsLanguage); // what the voice is given: no markdown, emoji, quote marks or line breaks; English also gets numbers and units written out
    if (!voiced) return;
    if (this.spoken === '') this.emit({ type: 'reply.started' });
    this.emit({ type: 'reply.text', text });
    this.spoken += (this.spoken ? ' ' : '') + text;
    if (this.tts?.readyState !== WebSocket.OPEN) {
      // Soak, 3 Nov 2026: after the voice connection dropped, twelve turns were heard and answered by the model, and every answer was
      // thrown away here: no words, no sound, and the orb listening as if nothing was wrong. The words reach the screen, the turn ends,
      // and the voice is asked to reconnect now rather than at the next timer.
      this.mark('novoice');
      this.retryVoiceNow();
      if (this.llmDone) this.armReplyWatchdog(VOICELESS_FINISH_MS);
      return;
    }
    this.mark('gen');
    this.resetKeepAliveTimer();
    this.tts.send(JSON.stringify({ type: 'Generate', text: flush ? voiced : `${voiced} ` }));
    if (flush) {
      this.sentFlushes++;
      this.unflushed = false;
      this.tts.send(JSON.stringify({ type: 'Flush' }));
      if (this.llmDone) this.armReplyWatchdog();
    } else {
      this.unflushed = true;
    }
  }

  /** Ends the synthesis for text streamed in with say(..., false). */
  private flushSpeech(gen: number): void {
    if (this.ttsSwitch) {
      void this.ttsSwitch.then(() => this.flushSpeech(gen)); // after the say() calls that are waiting on the same switch
      return;
    }
    if (!this.unflushed) return;
    if (gen !== this.genId || this.tts?.readyState !== WebSocket.OPEN) return;
    this.unflushed = false;
    this.sentFlushes++;
    this.tts.send(JSON.stringify({ type: 'Flush' }));
    if (this.llmDone) this.armReplyWatchdog();
  }

  private maybeFinish(): void {
    if (!this.llmDone || this.spoken === '') return;
    if (this.tts?.readyState !== WebSocket.OPEN) return this.armReplyWatchdog(VOICELESS_FINISH_MS); // no voice: nothing will confirm the speech
    const allDone = this.replyBaseId === null ? this.lastDoneId >= 0 : this.lastDoneId >= this.replyBaseId + this.sentFlushes - 1;
    if (!allDone) return this.armReplyWatchdog();
    this.finishReply();
  }

  private armReplyWatchdog(ms = REPLY_STALL_MS): void {
    clearTimeout(this.replyWatchdog);
    if (this.closed) return;
    this.replyWatchdog = setTimeout(() => {
      this.replyWatchdog = undefined;
      if (this.closed || !this.llmDone || this.spoken === '') return;
      this.mark('stall');
      this.finishReply();
    }, ms);
  }

  private finishReply(): void {
    clearTimeout(this.replyWatchdog);
    this.replyWatchdog = undefined;
    const text = this.spoken;
    this.spoken = '';
    this.sentFlushes = 0;
    this.replyBaseId = null;
    this.lastDoneId = -1;
    this.wordBoundaryOffsetMs = 0;
    this.lastWordEndMs = 0;
    this.agentSpeaking = false;
    this.history = [...this.history, { role: 'assistant' as const, content: text }].slice(-MAX_HISTORY);
    if (this.stt?.readyState === WebSocket.OPEN) {
      try {
        this.stt.send(JSON.stringify({ type: 'UpdateConfiguration', agent_context: text.slice(0, 1750) }));
      } catch {
        // ignore if closing
      }
    }
    this.emit({ type: 'transcript.agent', text, item_id: `a-${Date.now()}` });
    this.emit({ type: 'reply.done' });
    if (this.ttsNeedsRotation) {
      void this.rotateTtsSession();
    }
  }

  private speakOnly(text: string): void {
    const gen = ++this.genId;
    this.llmDone = true;
    this.spoken = '';
    this.sentFlushes = 0;
    this.replyBaseId = null;
    this.lastDoneId = -1;
    this.wordBoundaryOffsetMs = 0;
    this.lastWordEndMs = 0;
    this.say(text, gen);
  }

  /** One model turn: stream the reply into speech, run at most one app tool, then speak the confirmation. */
  private async generate(extraInstruction?: string, toolFollowUp = false): Promise<void> {
    const gen = ++this.genId;
    this.abort?.abort();
    const ctl = new AbortController();
    this.abort = ctl;
    this.llmDone = false;
    if (!toolFollowUp) {
      this.spoken = '';
      this.wordBoundaryOffsetMs = 0;
      this.lastWordEndMs = 0;
    }
    const s = this.session as FastSession;
    const messages: ChatMessage[] = [...this.history];

    // a picture for this turn: one sent with the typed message, or the latest shared frame when the person points at it
    const lastUser = [...messages].reverse().find((x) => x.role === 'user');
    const asked = typeof lastUser?.content === 'string' ? lastUser.content : '';
    const fresh = this.latestImage && Date.now() - this.latestImage.at < 20_000 ? this.latestImage.data : null;
    const image = toolFollowUp ? null : this.nextImage ?? (fresh && looksVisual(asked) ? fresh : null);
    if (!toolFollowUp) this.nextImage = null;
    // the few lines of the person's own notes that match this turn (found on their device; the vault is never sent whole)
    let recalled: string[] = [];
    try {
      recalled = !toolFollowUp && asked ? (this.cfg.recall?.(asked) ?? []).slice(0, 3) : [];
    } catch {
      recalled = []; // a note lookup must never stop a reply
    }

    let res: Response;
    this.mark('req');
    try {
      res = await fetch('/api/voice/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...byokHeaders(), ...(image ? { 'x-stay-image': '1' } : {}) },
        body: JSON.stringify({
          messages,
          withTools: s.tools && !toolFollowUp && !image,
          ...(image ? { image } : {}),
          context: {
            language: s.ttsLanguage,
            notes: this.notes.slice(-4),
            ...(this.session?.personal ? { personal: this.session.personal } : {}),
            ...(recalled.length ? { recall: recalled } : {}),
            ...(this.session?.offer ? { offer: this.session.offer } : {}),
          },
        }),
        signal: ctl.signal,
      });
    } catch {
      // the request never got an answer (offline, or the function timed out): the person is told, not left in silence
      if (gen === this.genId) this.speakOnly(honestFailureMessage('timeout'));
      return;
    }
    if (gen !== this.genId) return;
    this.mark('hdr');
    this.mark(`srv ${res.headers.get('server-timing') ?? ''}`);
    if (!res.ok || !res.body || (res.headers.get('content-type') || '').includes('application/json')) {
      // a safety gate answered instead of the model (the hook already shows the right screen), or the model failed:
      // when the server sent a plain-words message, say it; never leave the person in silence
      let message = '';
      let safety = '';
      try {
        const j = (await res.clone().json()) as { message?: unknown; safety?: unknown };
        if (typeof j.message === 'string') message = j.message.slice(0, 300);
        if (typeof j.safety === 'string') safety = j.safety;
      } catch {
        // not JSON: nothing to say
      }
      // The person's own words are checked by the app before they get here. What can arrive here is the picture path: the server
      // read the model's reply to a picture and stopped it (crisis wording in the picture, or an instruction about medication).
      if (image && safety === 'medication' && gen === this.genId) return this.speakOnly(MEDICAL_BOUNDARY_FIXED_MESSAGE);
      if (image && safety === 'crisis' && gen === this.genId) {
        this.emit({ type: 'safety.blocked', safety });
        return this.finishSilently();
      }
      if (message && gen === this.genId) return this.speakOnly(message);
      return this.finishSilently();
    }

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    let line = '';
    let pendingText = '';
    const think = makeThinkFilter(); // a model's <think> block is never shown or spoken
    let sawToken = false;
    const calls = new Map<number, { id: string; name: string; args: string }>();
    // Hold the first words until about two sentences have arrived (the model's first ~90 characters take a fraction of a second),
    // so speech starts as one continuous synthesis; everything after that streams into the same synthesis.
    let held: string[] = [];
    let heldChars = 0;
    let started = false;
    const queueSpeech = (chunk: string) => {
      if (started) return this.say(chunk, gen, false);
      held.push(chunk);
      heldChars += chunk.length;
      if (heldChars >= FIRST_BLOCK_CHARS) {
        started = true;
        this.say(held.join(' '), gen, false);
        held = [];
      }
    };
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (gen !== this.genId) return void reader.cancel();
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (line of lines) {
          if (!line.startsWith('data: ') || line.includes('[DONE]')) continue;
          let delta: { content?: string; tool_calls?: Array<{ index: number; id?: string; function?: { name?: string; arguments?: string } }> } | undefined;
          try {
            delta = JSON.parse(line.slice(6)).choices?.[0]?.delta;
          } catch {
            continue;
          }
          const shown = delta?.content ? think.push(delta.content) : '';
          if (shown) {
            if (!sawToken) {
              sawToken = true;
              this.mark('tok1');
            }
            pendingText += shown;
            for (let part = takeSpeakable(pendingText); part; part = takeSpeakable(pendingText)) {
              pendingText = part.rest;
              queueSpeech(part.chunk);
            }
          }
          for (const tc of delta?.tool_calls || []) {
            const cur = calls.get(tc.index) || { id: '', name: '', args: '' };
            calls.set(tc.index, { id: tc.id || cur.id, name: tc.function?.name || cur.name, args: cur.args + (tc.function?.arguments || '') });
          }
        }
      }
    } catch {
      if (gen !== this.genId) return;
    }
    if (gen !== this.genId) return;
    pendingText += think.end();
    if (pendingText.trim()) queueSpeech(pendingText.trim());
    if (held.length > 0) {
      started = true;
      this.say(held.join(' '), gen, false);
      held = [];
    }
    // The model can finish before the voice has been reopened in the person's language. Speech is queued behind that switch, so
    // wait for it: otherwise "nothing was said" is decided too early and the reply is announced done before it has started.
    if (this.ttsSwitch) await this.ttsSwitch;
    if (gen !== this.genId) return;
    this.flushSpeech(gen); // end of the reply (or before a tool call): the one flush

    let call = [...calls.values()].find((c) => c.name);
    // Defence in depth: the server already withholds the timer unless asked for. If a timer call still arrives for words that did not
    // ask for one (field test: "open Netflix" started a 5-minute timer), it is not run: Stay offers it instead.
    if (call && !toolFollowUp && /"action"\s*:\s*"timer_start"/.test(call.args)) {
      const lastAssistant = [...this.history].reverse().find((m) => m.role === 'assistant' && typeof m.content === 'string');
      if (!mayStartTimer(asked, [typeof lastAssistant?.content === 'string' ? lastAssistant.content : ''])) {
        call = undefined;
        this.llmDone = true;
        this.say(this.spoken === '' ? 'Want me to start a timer?' : '', gen);
        return;
      }
    }
    // Same for the orb's look (persona run: "show me exactly how..." set the shape to "exactly" and Stay said Done to a question). The call
    // is not run; the model is told so and answers the person's words, without tools.
    const calledAction = /"action"\s*:\s*"([a-z_]+)"/.exec(call?.args ?? '')?.[1] ?? '';
    if (call && !toolFollowUp && ((/^(?:shape|color)$/.test(calledAction) && !mayChangeLook(asked)) || (GATED_ACTIONS.includes(calledAction) && !mayDoAction(calledAction, asked)))) {
      const id = call.id || `call-${Date.now()}`;
      this.history = [
        ...this.history,
        { role: 'assistant' as const, content: null, tool_calls: [{ id, type: 'function', function: { name: call.name, arguments: call.args || '{}' } }] },
        { role: 'tool' as const, tool_call_id: id, content: '{"ok":false,"error":"They did not ask to change the orb. Answer what they said, in words."}' },
      ].slice(-MAX_HISTORY);
      this.lastToolOk = false;
      this.lastToolSay = undefined;
      return void this.generate(undefined, true);
    }
    if (call) {
      const id = call.id || `call-${Date.now()}`;
      let args: Json = {};
      try {
        args = call.args ? (JSON.parse(call.args) as Json) : {};
      } catch {
        // malformed arguments: run with none, the handler reports what is missing
      }
      this.history = [...this.history, { role: 'assistant' as const, content: null, tool_calls: [{ id, type: 'function', function: { name: call.name, arguments: call.args || '{}' } }] }].slice(-MAX_HISTORY);
      const result = new Promise<string>((resolve) => this.toolWaiters.set(id, resolve));
      this.emit({ type: 'tool.call', call_id: id, name: call.name, arguments: args });
      const out = await Promise.race([result, new Promise<string>((r) => setTimeout(() => r('{"ok":false,"error":"the app did not answer"}'), 4000))]);
      if (gen !== this.genId) return;
      this.history = [...this.history, { role: 'tool' as const, tool_call_id: id, content: out.slice(0, 1500) }].slice(-MAX_HISTORY);
      let parsedOut: { ok?: boolean; say?: string; error?: string; quick?: boolean } = {};
      try { parsedOut = JSON.parse(out); } catch {}
      this.lastToolOk = parsedOut.ok !== false;
      this.lastToolSay = typeof parsedOut.say === 'string' ? parsedOut.say : parsedOut.error;
      const quick = quickConfirmation(args.action, out, s.ttsLanguage);
      if (quick) {
        this.llmDone = true;
        // Soak, 3 Nov 2026: the model said "Parking that thought. Got it." before the call and the fixed "Parked." followed it. A stock
        // phrase is not added to words already spoken; a line built from what really happened (quick: true) still is.
        if (this.spoken.trim() && parsedOut.quick !== true) {
          this.maybeFinish();
          return;
        }
        this.say(quick, gen);
        return;
      }
      return void this.generate(undefined, true);
    }

    this.llmDone = true;
    if (this.spoken === '' && toolFollowUp) {
      // the action ran but the model had nothing to add: never leave the person in silence after a command
      const fallback = this.lastToolOk === false ? (this.lastToolSay || "I could not do that.") : (QUICK_PHRASE[s.ttsLanguage] ?? QUICK_PHRASE.english).done;
      this.say(fallback, gen);
      return;
    }
    if (this.spoken === '') return this.finishSilently();
    this.maybeFinish();
  }

  private finishSilently(): void {
    this.llmDone = true;
    this.spoken = '';
    this.agentSpeaking = false;
    this.emit({ type: 'reply.done' });
  }
}
