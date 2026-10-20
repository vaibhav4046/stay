import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { PERSONAS, chooseVoice, personaById, resolvePersona } from '@/lib/voice/personas';
import { agentVoiceFor, personaAfterLanguageChange, planSpeech } from '@/lib/voice/tts/plan';
import { pickBrowserVoice, voiceGender } from '@/lib/voice/tts/browserVoices';
import { AZURE_REGION_RE, azureEndpoint, buildSsml } from '@/lib/voice/tts/ssml';
import { AzureTts } from '@/lib/voice/tts/azure';
import { BrowserTts } from '@/lib/voice/tts/browser';
import { FastSocket } from '@/lib/voice/fastSocket';
import { POST as ttsRoute } from '@/app/api/voice/tts/route';
import { EMPTY_BYOK, byokHeaders, ttsHeaders } from '@/lib/byok/config';
import { previewText } from '@/lib/voice/tts/previewText';
import { detectVoiceCommand } from '@/lib/voice/voiceCommands';
import type { BrowserVoiceInfo, TtsCaps } from '@/lib/voice/tts/types';

// what this Windows machine really reports (see docs/VOICES.md): two Indian English voices, no Mexican Spanish
const WIN_VOICES: BrowserVoiceInfo[] = [
  { name: 'Microsoft David - English (United States)', lang: 'en-US', localService: true },
  { name: 'Microsoft Ravi - English (India)', lang: 'en-IN', localService: true },
  { name: 'Microsoft Heera - English (India)', lang: 'en-IN', localService: true },
  { name: 'Microsoft Zira - English (United States)', lang: 'en-US', localService: true },
];
const NONE: TtsCaps = { azure: false, browserVoices: [] };
const WIN: TtsCaps = { azure: false, browserVoices: WIN_VOICES };
const AZ: TtsCaps = { azure: true, browserVoices: [] };

describe('browser voice choice', () => {
  it('knows gender only when the name says so', () => {
    expect(voiceGender('Microsoft Heera - English (India)')).toBe('female');
    expect(voiceGender('Microsoft Ravi - English (India)')).toBe('male');
    expect(voiceGender('Google UK English Female')).toBe('female');
    expect(voiceGender('Google UK English Male')).toBe('male');
    expect(voiceGender('Samantha')).toBeNull();
  });
  it('picks the Indian English voice of the right gender', () => {
    expect(pickBrowserVoice(WIN_VOICES, 'en-IN', 'female')?.voice.name).toContain('Heera');
    expect(pickBrowserVoice(WIN_VOICES, 'en-IN', 'male')?.voice.name).toContain('Ravi');
    expect(pickBrowserVoice(WIN_VOICES, 'en-IN', 'male')?.genderMatched).toBe(true);
  });
  it('never substitutes a neighbouring locale: no es-MX voice means no match, not Spanish from Spain or English from the US', () => {
    expect(pickBrowserVoice(WIN_VOICES, 'es-MX', 'female')).toBeNull();
    expect(pickBrowserVoice([{ name: 'Monica', lang: 'es-ES', localService: true }], 'es-MX', 'female')).toBeNull();
  });
  it('accepts Android-style underscore locales and prefers natural voices', () => {
    const v: BrowserVoiceInfo[] = [
      { name: 'Microsoft Sabina - Spanish (Mexico)', lang: 'es-MX', localService: true },
      { name: 'Microsoft Dalia Online (Natural) - Spanish (Mexico)', lang: 'es_MX', localService: false },
    ];
    expect(pickBrowserVoice(v, 'es-MX', 'female')?.voice.name).toContain('Natural');
  });
  it('reports an unknown or wrong gender instead of hiding it', () => {
    const m = pickBrowserVoice([{ name: 'Microsoft Heera - English (India)', lang: 'en-IN', localService: true }], 'en-IN', 'male');
    expect(m?.genderMatched).toBe(false);
    expect(m?.gender).toBe('female');
  });
});

describe('which voice is usable, and what is said when none is', () => {
  it('AssemblyAI personas are always usable', () => {
    for (const p of PERSONAS.filter((x) => x.voices[0].engine === 'assemblyai')) expect(chooseVoice(p, NONE).ref?.engine).toBe('assemblyai');
  });
  it('Indian English: Azure when keyed, else the device voice, else a plain "needs" message', () => {
    const cardamom = personaById('cardamom');
    expect(chooseVoice(cardamom, { azure: true, browserVoices: WIN_VOICES }).ref?.engine).toBe('azure');
    const dev = chooseVoice(cardamom, WIN);
    expect(dev.ref?.engine).toBe('browser');
    expect(dev.browserVoiceName).toContain('Heera');
    const none = chooseVoice(cardamom, NONE);
    expect(none.ref).toBeNull();
    expect(none.needs).toMatch(/Azure/);
    expect(none.needs).toMatch(/en-IN/);
  });
  it('Mexican Spanish is unavailable on this machine without a key, and available with one', () => {
    const taco = personaById('taco');
    expect(chooseVoice(taco, WIN).ref).toBeNull();
    expect(chooseVoice(taco, AZ).ref?.voice).toBe('es-MX-DaliaNeural');
    expect(chooseVoice(personaById('mariachi'), AZ).ref?.voice).toBe('es-MX-JorgeNeural');
    expect(chooseVoice(personaById('chaiwala'), AZ).ref?.voice).toBe('en-IN-PrabhatNeural');
  });
});

describe('planSpeech: the language and the persona agree, and a fallback is always stated', () => {
  it('a native persona speaks its own language', () => {
    const p = planSpeech('taco', 'es', AZ);
    expect(p.ref.engine).toBe('azure');
    expect(p.ttsLanguage).toBe('spanish');
    expect(p.fellBack).toBeUndefined();
  });
  it('switching to Spanish with an English persona uses the native Spanish voice', () => {
    expect(planSpeech('anna', 'es', NONE).assemblyVoice).toBe('lola');
    expect(planSpeech('anna', 'es', NONE).ref.engine).toBe('assemblyai');
    expect(planSpeech('cardamom', 'es-MX', AZ).assemblyVoice).toBe('lola');
  });
  it('an unavailable accent voice falls back to the language voice and says why, never silently', () => {
    const p = planSpeech('cardamom', 'en', NONE);
    expect(p.ref.engine).toBe('assemblyai');
    expect(p.fellBack).toMatch(/Azure/);
    expect(planSpeech('taco', 'es', WIN).fellBack).toMatch(/es-MX/);
  });
  it('a persona of another language never speaks English with a foreign accent', () => {
    expect(planSpeech('lola', 'en', NONE).assemblyVoice).toBe('anna');
    expect(planSpeech('taco', 'en', AZ).ref.engine).toBe('assemblyai');
  });
  it('the browser voice carries the installed voice name', () => {
    const p = planSpeech('chaiwala', 'en', WIN);
    expect(p.ref.engine).toBe('browser');
    expect(p.browserVoiceName).toContain('Ravi');
    expect(p.assemblyVoice).toBe('anna');
  });
});

describe('language switch picks the matching native voice', () => {
  it.each([
    ['anna', 'es-ES', 'lola'], ['charles', 'fr', 'estelle'], ['anna', 'de-DE', 'juergen'], ['paul', 'it', 'giovanni'], ['vera', 'pt-BR', 'rafael'],
    ['lola', 'en-GB', 'anna'], ['rafael', 'en', 'anna'],
    ['taco', 'es-ES', 'taco'], ['cardamom', 'en-GB', 'cardamom'], ['cardamom', 'es', 'lola'], ['taco', 'en', 'anna'],
    ['lola', 'ja-JP', 'anna'], ['cardamom', 'ja-JP', 'cardamom'], ['charles', 'hi-IN', 'charles'],
  ])('%s + %s -> %s', (cur, lang, want) => expect(personaAfterLanguageChange(cur, lang)).toBe(want));
  it('the managed voice agent only knows AssemblyAI voices', () => {
    expect(agentVoiceFor('taco')).toBe('anna');
    expect(agentVoiceFor('cardamom')).toBe('anna');
    expect(agentVoiceFor('lola')).toBe('lola');
    expect(agentVoiceFor('vera')).toBe('vera');
  });
});

describe('voice by name and by accent', () => {
  it.each([
    ['the Indian voice', 'cardamom'], ['indian english', 'cardamom'], ['male indian voice', 'chaiwala'], ['female indian', 'cardamom'],
    ['Mexican Spanish', 'taco'], ['a mexican voice', 'taco'], ['male mexican', 'mariachi'], ['Chaiwala Blitz', 'chaiwala'], ['taco tornado', 'taco'],
    ['Biscuit Blitz', 'paul'], ['a Spanish voice', 'lola'], ['british male', 'charles'],
  ])('%s -> %s', (q, id) => expect(resolvePersona(q)?.id).toBe(id));
});

describe('azure relay request', () => {
  it('escapes everything the person or the model said', () => {
    const x = buildSsml({ text: `Tom & Jerry <break/> "quote" it's`, voice: 'en-IN-NeerjaNeural', locale: 'en-IN' });
    expect(x).toContain('Tom &amp; Jerry &lt;break/&gt; &quot;quote&quot; it&apos;s');
    expect(x).not.toContain('<break');
    expect(x).toContain("name='en-IN-NeerjaNeural'");
  });
  it('rejects voices and locales that could inject markup', () => {
    expect(() => buildSsml({ text: 'x', voice: "en-IN-X'><evil/>", locale: 'en-IN' })).toThrow();
    expect(() => buildSsml({ text: 'x', voice: 'en-IN-NeerjaNeural', locale: "en-IN'><x" })).toThrow();
    expect(buildSsml({ text: 'x', voice: 'en-IN-Neerja:DragonHDLatestNeural', locale: 'en-IN' })).toContain('Dragon');
  });
  it('builds the host only from a plain region name', () => {
    expect(azureEndpoint('centralindia')).toBe('https://centralindia.tts.speech.microsoft.com/cognitiveservices/v1');
    for (const bad of ['evil.com/x', 'a b', '', 'east-us', 'EASTUS', 'x'.repeat(40), 'us@evil.com']) {
      expect(AZURE_REGION_RE.test(bad), bad).toBe(false);
      expect(() => azureEndpoint(bad)).toThrow();
    }
  });
  it('keeps the speech key out of the shared byok headers', () => {
    const c = { ...EMPTY_BYOK, ttsKey: ' abcdefghijklmnopqrst ', ttsRegion: 'EastUS' };
    expect(ttsHeaders(c)).toEqual({ 'x-stay-tts-key': 'abcdefghijklmnopqrst', 'x-stay-tts-region': 'eastus' });
    expect(byokHeaders(c)).toEqual({});
    expect(ttsHeaders(EMPTY_BYOK)).toEqual({});
    expect(ttsHeaders({ ...EMPTY_BYOK, ttsKey: 'abc' })).toEqual({});
  });
});

describe('POST /api/voice/tts', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = realFetch; });
  const KEY = 'k'.repeat(32);
  const req = (body: object, headers: Record<string, string> = { 'x-stay-tts-key': KEY, 'x-stay-tts-region': 'centralindia' }) =>
    new NextRequest('http://localhost:3000/api/voice/tts', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `10.0.0.${Math.floor(Math.random() * 250)}`, ...headers }, body: JSON.stringify(body) });

  it('relays one sentence to the documented Azure endpoint and streams the PCM back', async () => {
    const fetchMock = vi.fn(async () => new Response(new Uint8Array([1, 0, 2, 0]), { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const res = await ttsRoute(req({ text: 'Namaste.', voice: 'en-IN-NeerjaNeural', locale: 'en-IN' }));
    expect(res.status).toBe(200);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([1, 0, 2, 0]));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://centralindia.tts.speech.microsoft.com/cognitiveservices/v1');
    const h = init.headers as Record<string, string>;
    expect(h['Ocp-Apim-Subscription-Key']).toBe(KEY);
    expect(h['Content-Type']).toBe('application/ssml+xml');
    expect(h['X-Microsoft-OutputFormat']).toBe('raw-24khz-16bit-mono-pcm');
    expect(String(init.body)).toContain('Namaste.');
  });
  it('refuses without a key or with a hostile region, and never calls out', async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    expect((await ttsRoute(req({ text: 'x', voice: 'en-IN-NeerjaNeural', locale: 'en-IN' }, {}))).status).toBe(400);
    expect((await ttsRoute(req({ text: 'x', voice: 'en-IN-NeerjaNeural', locale: 'en-IN' }, { 'x-stay-tts-key': KEY, 'x-stay-tts-region': 'evil.com/x' }))).status).toBe(400);
    expect((await ttsRoute(req({ text: '', voice: 'en-IN-NeerjaNeural', locale: 'en-IN' }))).status).toBe(400);
    expect((await ttsRoute(req({ text: 'x'.repeat(801), voice: 'en-IN-NeerjaNeural', locale: 'en-IN' }))).status).toBe(400);
    expect((await ttsRoute(req({ text: 'x', voice: "bad'voice", locale: 'en-IN' }))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("turns Azure's 401 into a message about the key, without echoing the key", async () => {
    globalThis.fetch = vi.fn(async () => new Response('denied', { status: 401 })) as unknown as typeof fetch;
    const res = await ttsRoute(req({ text: 'x', voice: 'en-IN-NeerjaNeural', locale: 'en-IN' }));
    expect(res.status).toBe(401);
    const body = JSON.stringify(await res.json());
    expect(body).toContain('invalid_tts_key');
    expect(body).not.toContain(KEY);
  });
});

// ---- the engines, speaking the AssemblyAI TTS protocol toward FastSocket ----
const tick = (n = 6) => new Promise((r) => { let i = 0; const f = () => (++i >= n ? r(null) : setTimeout(f, 0)); f(); });
const pcm = (n: number) => new Uint8Array(n).map((_, i) => i % 251);
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));

function collect(c: { onmessage: ((e: { data: string }) => void) | null }) {
  const out: Array<Record<string, unknown>> = [];
  c.onmessage = (e) => out.push(JSON.parse(e.data));
  return out;
}
const streamOf = (...chunks: Uint8Array[]) => new Response(new ReadableStream({ start(c) { for (const k of chunks) c.enqueue(k); c.close(); } }), { status: 200 });

describe('AzureTts', () => {
  it('opens, then streams one flush as ordered Audio frames and exactly one FlushDone', async () => {
    const fetchImpl = vi.fn(async () => streamOf(pcm(1000), pcm(600))) as unknown as typeof fetch;
    const t = new AzureTts({ voice: 'en-IN-NeerjaNeural', locale: 'en-IN', fetchImpl, headers: () => ({ 'x-stay-tts-key': 'k' }) });
    const out = collect(t);
    await tick(2);
    expect(out[0].type).toBe('Begin');
    t.send(JSON.stringify({ type: 'Generate', text: 'Hello there.' }));
    t.send(JSON.stringify({ type: 'Flush' }));
    await tick(8);
    expect(out.map((m) => m.type)).toEqual(['Begin', 'Audio', 'Audio', 'FlushDone']);
    expect(out.slice(1).every((m) => m.flush_id === 0)).toBe(true);
    const sent = JSON.parse(((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit).body as string);
    expect(sent).toEqual({ text: 'Hello there.', voice: 'en-IN-NeerjaNeural', locale: 'en-IN' });
  });
  it('never splits a 16-bit sample across frames', async () => {
    const fetchImpl = vi.fn(async () => streamOf(pcm(101), pcm(99), pcm(3))) as unknown as typeof fetch;
    const t = new AzureTts({ voice: 'v-V-x', locale: 'en-IN', fetchImpl, headers: () => ({}) });
    const out = collect(t);
    await tick(2);
    t.send(JSON.stringify({ type: 'Generate', text: 'a' }));
    t.send(JSON.stringify({ type: 'Flush' }));
    await tick(10);
    const audio = out.filter((m) => m.type === 'Audio').map((m) => atob(String(m.audio)).length);
    expect(audio.every((n) => n % 2 === 0)).toBe(true);
    expect(audio.reduce((a, b) => a + b, 0)).toBe(202); // 101 + 99 + 3 = 203 bytes; the trailing odd byte is dropped, not played
  });
  it('releases audio in flush order even when the second sentence arrives first', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    let n = 0;
    const fetchImpl = vi.fn(async () => {
      const mine = n++;
      if (mine === 0) await gate;
      return streamOf(pcm(10 + mine));
    }) as unknown as typeof fetch;
    const t = new AzureTts({ voice: 'v-V-x', locale: 'en-IN', fetchImpl, headers: () => ({}) });
    const out = collect(t);
    await tick(2);
    for (const s of ['one', 'two']) { t.send(JSON.stringify({ type: 'Generate', text: s })); t.send(JSON.stringify({ type: 'Flush' })); }
    await tick(8);
    expect(out.filter((m) => m.type === 'Audio')).toHaveLength(0); // sentence two is ready but must wait for sentence one
    release();
    await tick(10);
    expect(out.slice(1).map((m) => `${m.type}${m.flush_id}`)).toEqual(['Audio0', 'FlushDone0', 'Audio1', 'FlushDone1']);
  });
  it('Cancel is acknowledged, aborts in-flight requests and drops late audio', async () => {
    let signal: AbortSignal | undefined;
    const fetchImpl = vi.fn(async (_u: unknown, init: RequestInit) => { signal = init.signal as AbortSignal; await new Promise((r) => setTimeout(r, 30)); return streamOf(pcm(50)); }) as unknown as typeof fetch;
    const t = new AzureTts({ voice: 'v-V-x', locale: 'en-IN', fetchImpl, headers: () => ({}) });
    const out = collect(t);
    await tick(2);
    t.send(JSON.stringify({ type: 'Generate', text: 'long' }));
    t.send(JSON.stringify({ type: 'Flush' }));
    await tick(2);
    t.send(JSON.stringify({ type: 'Cancel' }));
    await new Promise((r) => setTimeout(r, 80));
    expect(signal?.aborted).toBe(true);
    expect(out.map((m) => m.type)).toEqual(['Begin', 'Cancelled']);
  });
  it('a rejected key becomes an Error event, and the sentence still completes so the reply can end', async () => {
    const fetchImpl = vi.fn(async () => new Response('no', { status: 401 })) as unknown as typeof fetch;
    const t = new AzureTts({ voice: 'v-V-x', locale: 'en-IN', fetchImpl, headers: () => ({}) });
    const out = collect(t);
    await tick(2);
    t.send(JSON.stringify({ type: 'Generate', text: 'x' }));
    t.send(JSON.stringify({ type: 'Flush' }));
    await tick(8);
    expect(out.map((m) => m.type)).toEqual(['Begin', 'Error', 'FlushDone']);
  });
  it('an empty flush completes at once', async () => {
    const t = new AzureTts({ voice: 'v-V-x', locale: 'en-IN', fetchImpl: vi.fn() as unknown as typeof fetch, headers: () => ({}) });
    const out = collect(t);
    await tick(2);
    t.send(JSON.stringify({ type: 'Flush' }));
    expect(out.map((m) => m.type)).toEqual(['Begin', 'FlushDone']);
  });
});

class FakeUtterance {
  lang = ''; rate = 1; voice: unknown = null;
  onstart: (() => void) | null = null; onend: (() => void) | null = null; onerror: ((e: { error: string }) => void) | null = null;
  constructor(public text: string) {}
}
function fakeSynth() {
  const spoken: FakeUtterance[] = [];
  const synth = {
    spoken,
    cancelled: 0,
    getVoices: () => [{ name: 'Microsoft Heera - English (India)', lang: 'en-IN' }],
    speak(u: FakeUtterance) { spoken.push(u); },
    cancel() { this.cancelled++; for (const u of spoken.splice(0)) u.onerror?.({ error: 'canceled' }); },
  };
  return synth;
}

describe('BrowserTts', () => {
  beforeEach(() => { (globalThis as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = FakeUtterance; });
  it('speaks with the chosen voice and locale, signals the start, and completes the flush', async () => {
    const synth = fakeSynth();
    const t = new BrowserTts({ locale: 'en-IN', voiceName: 'Microsoft Heera - English (India)', synth: synth as unknown as SpeechSynthesis });
    const out = collect(t);
    await tick(2);
    t.send(JSON.stringify({ type: 'Generate', text: 'Hello' }));
    t.send(JSON.stringify({ type: 'Flush' }));
    const u = synth.spoken[0];
    expect(u.text).toBe('Hello');
    expect(u.lang).toBe('en-IN');
    expect((u.voice as { name: string }).name).toContain('Heera');
    expect(t.muteMic).toBe(true);
    u.onstart?.();
    u.onend?.();
    expect(out.map((m) => m.type)).toEqual(['Begin', 'Audio', 'FlushDone']);
    expect(out[1].audio).toBe('');
    expect(t.muteMic).toBe(false);
  });
  it('Cancel stops the sound, is acknowledged, and a cancelled utterance reports nothing further', async () => {
    const synth = fakeSynth();
    const t = new BrowserTts({ locale: 'en-IN', synth: synth as unknown as SpeechSynthesis });
    const out = collect(t);
    await tick(2);
    t.send(JSON.stringify({ type: 'Generate', text: 'Hello' }));
    t.send(JSON.stringify({ type: 'Flush' }));
    synth.spoken[0].onstart?.();
    t.send(JSON.stringify({ type: 'Cancel' }));
    expect(synth.cancelled).toBe(1);
    expect(out.map((m) => m.type)).toEqual(['Begin', 'Audio', 'Cancelled']);
    expect(t.muteMic).toBe(false);
  });
  it('a real speech error is reported', async () => {
    const synth = fakeSynth();
    const t = new BrowserTts({ locale: 'en-IN', synth: synth as unknown as SpeechSynthesis });
    const out = collect(t);
    await tick(2);
    t.send(JSON.stringify({ type: 'Generate', text: 'Hello' }));
    t.send(JSON.stringify({ type: 'Flush' }));
    synth.spoken[0].onerror?.({ error: 'synthesis-failed' });
    expect(out.map((m) => m.type)).toEqual(['Begin', 'Error', 'FlushDone']);
  });
});

// ---- through the real FastSocket: STT is scripted, the TTS leg is the engine under test ----
class FakeStt {
  static OPEN = 1;
  static instances: FakeStt[] = [];
  readyState = 0;
  sent: Array<string | Uint8Array> = [];
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  constructor(public url: string) {
    FakeStt.instances.push(this);
    queueMicrotask(() => { this.readyState = 1; this.onmessage?.({ data: JSON.stringify({ type: 'Begin' }) }); });
  }
  send(d: string | Uint8Array) { this.sent.push(d); }
  close() { this.readyState = 3; }
}

describe('FastSocket with a non-AssemblyAI voice', () => {
  beforeEach(() => {
    FakeStt.instances = [];
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = FakeStt;
    (globalThis as unknown as { fetch: unknown }).fetch = vi.fn(async () => new Response('', { status: 200 }));
    (globalThis as unknown as { window: unknown }).window = { localStorage: { getItem: () => null } };
    (globalThis as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = FakeUtterance;
  });
  afterEach(() => vi.restoreAllMocks());

  const session = { system_prompt: 'x', greeting: 'Namaste, I am here.', output: { voice: 'anna' }, tools: [], tts_language: 'english' };

  it('speaks the greeting through Azure: the app sees reply.audio then reply.done, and no AssemblyAI TTS socket is opened', async () => {
    const fetchImpl = vi.fn(async () => streamOf(pcm(480))) as unknown as typeof fetch;
    const s = new FastSocket({ sttToken: 's', ttsToken: 't', warmUp: false, ttsConnect: () => new AzureTts({ voice: 'en-IN-NeerjaNeural', locale: 'en-IN', fetchImpl, headers: () => ({}) }) });
    const events: Array<Record<string, unknown>> = [];
    s.onmessage = (e) => events.push(JSON.parse(e.data));
    await tick(2);
    s.send(JSON.stringify({ type: 'session.update', session }));
    await tick(14);
    const types = events.map((e) => e.type);
    expect(types).toContain('session.ready');
    expect(types).toContain('reply.audio');
    expect(types[types.length - 1]).toBe('reply.done');
    expect(FakeStt.instances.every((w) => !w.url.includes('streaming-tts'))).toBe(true);
    expect(events.find((e) => e.type === 'reply.audio')?.data).toBe(b64(pcm(480)));
  });

  it('a browser voice closes the microphone while it talks, so Stay does not answer itself', async () => {
    const synth = fakeSynth();
    const s = new FastSocket({ sttToken: 's', ttsToken: 't', warmUp: false, ttsConnect: () => new BrowserTts({ locale: 'en-IN', synth: synth as unknown as SpeechSynthesis }) });
    s.onmessage = () => undefined;
    await tick(2);
    s.send(JSON.stringify({ type: 'session.update', session }));
    await tick(8);
    const stt = FakeStt.instances.find((w) => !w.url.includes('tts'))!;
    const mic = b64(pcm(64));
    s.send(JSON.stringify({ type: 'input.audio', audio: mic }));
    expect(stt.sent.length).toBe(0); // the greeting is being spoken
    synth.spoken[0].onstart?.();
    synth.spoken[0].onend?.();
    s.send(JSON.stringify({ type: 'input.audio', audio: mic }));
    expect(stt.sent.length).toBe(1); // done speaking: the mic is open again
  });
});

describe('previews and the persona list stay honest', () => {
  it('every language has a preview text of about 20 seconds (40 to 70 words) that names the persona', () => {
    for (const lang of ['en', 'es', 'fr', 'de', 'it', 'pt']) {
      const t = previewText(lang, 'Test Name');
      const words = t.split(/\s+/).length;
      expect(words, lang).toBeGreaterThanOrEqual(40);
      expect(words, lang).toBeLessThanOrEqual(70);
      expect(t).toContain('Test Name');
    }
  });
});

describe('spoken voice commands', () => {
  it.each([
    ['use the Indian voice', 'cardamom'], ['switch to Mexican Spanish', 'taco'], ['change voice to Chaiwala Blitz', 'chaiwala'],
    ['switch to the male Indian voice', 'chaiwala'], ['change voice to Captain Crumpet', 'charles'], ['speak with a Mexican accent', 'taco'],
    ['switch to male voice', 'charles'], ['change voice to anna', 'anna'],
  ])('%s -> change_voice %s', (said, id) => expect(detectVoiceCommand(said)).toEqual({ type: 'change_voice', voiceId: id }));
  it('does not steal language switches or the voice menu', () => {
    expect(detectVoiceCommand('switch to Spanish')).toEqual({ type: 'change_language', langCode: 'es-ES', langName: 'Spanish' });
    expect(detectVoiceCommand('change voice')).toEqual({ type: 'open_voice_menu' });
    expect(detectVoiceCommand('change voice to xyzzy')).toEqual({ type: 'open_voice_menu' });
  });
});
