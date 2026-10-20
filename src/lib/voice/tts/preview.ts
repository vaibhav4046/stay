'use client';
import { ttsHeaders } from '@/lib/byok/config';
import { chooseVoice, type VoicePersona } from '../personas';
import { previewClipUrl, previewText } from './previewText';
import type { TtsCaps } from './types';

export interface PreviewHandle {
  stop(): void;
}

let current: PreviewHandle | null = null;

/** Stop whatever preview is playing. */
export function stopPreview(): void {
  current?.stop();
  current = null;
}

/**
 * Play a ~20 s sample of a persona in the voice that would really speak:
 *  - AssemblyAI: a pre-rendered clip shipped with the app (no key, no rate limit, same voice);
 *  - browser: the device's voice, live;
 *  - Azure: synthesized live through the person's own key.
 * Resolves when playback has started; `onEnd` runs when it stops for any reason. Rejects with a readable message.
 */
export async function startPreview(persona: VoicePersona, caps: TtsCaps, onEnd: () => void): Promise<PreviewHandle> {
  stopPreview();
  const choice = chooseVoice(persona, caps);
  if (!choice.ref) throw new Error(choice.needs ?? 'This voice is not available here.');
  const text = previewText(persona.lang, persona.name);
  let handle: PreviewHandle;

  if (choice.ref.engine === 'assemblyai') {
    const audio = new Audio(previewClipUrl(persona.id));
    audio.onended = onEnd;
    audio.onerror = onEnd;
    await audio.play();
    handle = { stop: () => { audio.pause(); onEnd(); } };
  } else if (choice.ref.engine === 'browser') {
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = choice.ref.locale;
    const v = synth.getVoices().find((x) => x.name === choice.browserVoiceName);
    if (v) u.voice = v;
    u.onend = onEnd;
    u.onerror = onEnd;
    synth.speak(u);
    handle = { stop: () => { synth.cancel(); onEnd(); } };
  } else {
    const res = await fetch('/api/voice/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...ttsHeaders() },
      body: JSON.stringify({ text, voice: choice.ref.voice, locale: choice.ref.locale }),
    });
    if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error || `Azure Speech answered ${res.status}`);
    const ab = await res.arrayBuffer();
    const bytes = new Int16Array(ab, 0, ab.byteLength >> 1);
    const ctx = new AudioContext({ sampleRate: 24000 });
    const buf = ctx.createBuffer(1, bytes.length, 24000);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < bytes.length; i++) ch[i] = bytes[i] / 0x8000;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.onended = () => { void ctx.close(); onEnd(); };
    src.start();
    handle = { stop: () => { try { src.stop(); } catch { /* already ended */ } } };
  }
  current = handle;
  return handle;
}

/** One short sentence through the relay: tells the person at once whether their Azure key and region work. */
export async function testAzureKey(): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch('/api/voice/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...ttsHeaders() },
      body: JSON.stringify({ text: 'Hello.', voice: 'en-IN-NeerjaNeural', locale: 'en-IN' }),
    });
    if (res.ok) {
      const n = (await res.arrayBuffer()).byteLength;
      return n > 1000 ? { ok: true, message: 'Azure answered with audio. Your key works.' } : { ok: false, message: 'Azure answered, but with almost no audio.' };
    }
    return { ok: false, message: ((await res.json().catch(() => ({}))) as { error?: string }).error || `Azure Speech answered ${res.status}` };
  } catch {
    return { ok: false, message: 'Could not reach Stay or Azure. Check your connection.' };
  }
}
