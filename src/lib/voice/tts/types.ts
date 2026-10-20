/**
 * Pluggable text-to-speech. Stay has three speech engines:
 *  - assemblyai: streaming TTS from AssemblyAI. The default: lowest latency, keeps the AssemblyAI integration. Voices are tied to one language each.
 *  - browser:    the device's own speechSynthesis voices. Free, no key, no network, but quality and voice list depend on the device.
 *  - azure:      Azure AI Speech neural voices, with the person's own key (bring-your-own-key). Real en-IN and es-MX voices.
 *
 * The two non-default engines plug into FastSocket as a `TtsConnection`: an object that speaks the same small protocol as
 * the AssemblyAI TTS socket (Generate / Flush / Cancel in; Begin / Audio / FlushDone / Cancelled / Error out), so the rest
 * of the voice stack (barge-in, lip sync, the orb) does not know which engine is talking.
 */
export type TtsEngineId = 'assemblyai' | 'browser' | 'azure';
export type SpeechLang = 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt';

/** How much we can honestly say about an engine's integration in this repo. */
export type Verification = 'verified' | 'untested';

export interface VoiceRef {
  engine: TtsEngineId;
  /** assemblyai: the voice id. azure: the voice ShortName. browser: unused (the device decides). */
  voice: string;
  lang: SpeechLang;
  /** BCP-47 locale the voice speaks, e.g. en-GB, en-IN, es-MX. */
  locale: string;
  /** Human label of the accent, shown to the person. Only claims what the provider or the locale guarantees. */
  accent: string;
}

/** The slice of the WebSocket surface that FastSocket uses for its text-to-speech leg. */
export interface TtsConnection {
  /** 1 = open, like WebSocket.OPEN. */
  readyState: number;
  onmessage: ((e: { data: string }) => void) | null;
  onerror: (() => void) | null;
  onclose: (() => void) | null;
  send(raw: string): void;
  close(): void;
  /** True while the engine's own sound is playing where the microphone can hear it and the engine cannot tell the app (speechSynthesis). FastSocket drops microphone audio meanwhile, so Stay does not answer itself. */
  readonly muteMic?: boolean;
}

export const TTS_OPEN = 1;
export const TTS_CLOSED = 3;

export interface EngineInfo {
  id: TtsEngineId;
  label: string;
  /** Needs the person's own key. */
  needsKey: boolean;
  verification: Verification;
  /** One honest line for the picker. */
  note: string;
}

export const ENGINES: Record<TtsEngineId, EngineInfo> = {
  assemblyai: { id: 'assemblyai', label: 'AssemblyAI', needsKey: false, verification: 'verified', note: 'Default. About 0.2 s to first sound. British, American and five native-language voices.' },
  browser: { id: 'browser', label: 'Browser voice', needsKey: false, verification: 'verified', note: 'Free, uses voices already on this device. Quality depends on the device. You cannot interrupt it by talking.' },
  azure: { id: 'azure', label: 'Azure Neural', needsKey: true, verification: 'untested', note: 'Your own Azure Speech key. Real Indian English and Mexican Spanish neural voices. Written to the documented API; not yet run against a live key.' },
};

/** What this device and this person's settings can use right now. */
export interface TtsCaps {
  azure: boolean;
  /** Installed speechSynthesis voices (empty on the server or before the browser has loaded them). */
  browserVoices: BrowserVoiceInfo[];
}

export interface BrowserVoiceInfo {
  name: string;
  lang: string;
  localService: boolean;
}
