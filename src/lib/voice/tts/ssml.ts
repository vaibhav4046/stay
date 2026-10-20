/** Azure Speech request building, shared by the server route and its tests. Pure. */

const xmlEscape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

// ShortName like en-IN-NeerjaNeural, es-MX-DaliaNeural, or en-IN-Neerja:DragonHDLatestNeural
export const AZURE_VOICE_RE = /^[a-z]{2,3}-[A-Z]{2,4}-[A-Za-z0-9]{2,40}(?::[A-Za-z0-9-]{2,40})?$/;
export const AZURE_LOCALE_RE = /^[a-z]{2,3}-[A-Z]{2,4}$/;
/** Region goes into a hostname, so it is allow-listed hard: lowercase letters and digits only (eastus, centralindia, uksouth). */
export const AZURE_REGION_RE = /^[a-z0-9]{3,32}$/;
/** One spoken chunk is a sentence or two; this is a ceiling, not a target. */
export const MAX_TTS_CHARS = 800;

export interface AzureSpeakRequest {
  text: string;
  voice: string;
  locale: string;
}

export function azureEndpoint(region: string): string {
  if (!AZURE_REGION_RE.test(region)) throw new Error('bad region');
  return `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
}

export function buildSsml({ text, voice, locale }: AzureSpeakRequest): string {
  if (!AZURE_VOICE_RE.test(voice)) throw new Error('bad voice');
  if (!AZURE_LOCALE_RE.test(locale)) throw new Error('bad locale');
  return `<speak version='1.0' xml:lang='${locale}'><voice xml:lang='${locale}' name='${voice}'>${xmlEscape(text)}</voice></speak>`;
}

/** Output the speech pipeline expects: 24 kHz 16-bit mono little-endian PCM, streamed raw (no WAV header). */
export const AZURE_OUTPUT_FORMAT = 'raw-24khz-16bit-mono-pcm';
