import { AzureTts } from './azure';
import { BrowserTts } from './browser';
import type { TtsConnection, VoiceRef } from './types';

export * from './types';
export { pickBrowserVoice, loadBrowserVoices, voiceGender } from './browserVoices';

/** Build the connection for a non-default engine. AssemblyAI voices stay on FastSocket's own WebSocket and never come here. */
export function createTtsConnection(ref: VoiceRef, browserVoiceName?: string): TtsConnection | null {
  if (ref.engine === 'azure') return new AzureTts({ voice: ref.voice, locale: ref.locale });
  if (ref.engine === 'browser') return new BrowserTts({ locale: ref.locale, voiceName: browserVoiceName });
  return null;
}
