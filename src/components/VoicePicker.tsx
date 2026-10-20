'use client';

import { useEffect, useState } from 'react';
import { loadByok, saveByok } from '@/lib/byok/config';
import { PERSONAS, RECOMMENDED_PERSONAS, chooseVoice, type VoicePersona } from '@/lib/voice/personas';
import { BYOK_CHANGED_EVENT, useTtsCaps } from '@/lib/voice/tts/caps';
import { startPreview, stopPreview, testAzureKey } from '@/lib/voice/tts/preview';
import { ENGINES, type TtsCaps } from '@/lib/voice/tts/types';

interface Props {
  selected: string;
  /** Applies the choice. Returns false when the voice cannot speak here. */
  onSelect: (personaId: string) => unknown;
  /** Accent voices (browser, Azure) only speak in Fast voice. */
  fastVoice: boolean;
}

/** One line saying which engine would speak this persona right now, e.g. "AssemblyAI" or "Browser voice: Microsoft Heera". */
function engineLine(p: VoicePersona, caps: TtsCaps): string {
  const c = chooseVoice(p, caps);
  if (!c.ref) return 'Needs setup';
  if (c.ref.engine === 'browser') return `Browser voice: ${c.browserVoiceName}`;
  if (c.ref.engine === 'azure') return `${ENGINES.azure.label}: ${c.ref.voice.split('-').slice(2).join('-').replace(/Neural$/, '')}`;
  return ENGINES.assemblyai.label;
}

function VoiceCard({ p, caps, selected, playing, error, onPick, onPreview }: { p: VoicePersona; caps: TtsCaps; selected: boolean; playing: boolean; error: string | null; onPick: () => void; onPreview: () => void }) {
  const usable = chooseVoice(p, caps).ref !== null;
  return (
    <div className="rounded-xl border p-3" style={{ borderColor: selected ? 'var(--color-accent)' : 'var(--color-line)', opacity: usable ? 1 : 0.8 }} data-testid={`voice-${p.id}`} data-usable={usable}>
      <button type="button" className="chip w-full justify-start" aria-pressed={selected} onClick={onPick}>
        <span>
          <span className="block font-medium">{p.name}</span>
          <span className="meta block">{p.gender === 'female' ? 'Female' : 'Male'} · {p.voiceLabel}</span>
        </span>
      </button>
      <p className="meta mt-2">{p.style}</p>
      <p className="meta mt-1" data-testid={`voice-engine-${p.id}`}>{engineLine(p, caps)}</p>
      <div className="mt-2 flex items-center gap-2">
        <button type="button" className="btn btn-secondary" onClick={onPreview} disabled={!usable} aria-label={`${playing ? 'Stop' : 'Play'} a 20 second preview of ${p.name}`} data-testid={`preview-${p.id}`}>
          {playing ? 'Stop' : 'Preview (20 s)'}
        </button>
        {!usable && <span className="meta">{chooseVoice(p, caps).needs}</span>}
      </div>
      {error && <p className="meta mt-1" role="alert" style={{ color: 'var(--color-danger)' }}>{error}</p>}
    </div>
  );
}

/** The curated shortlist, the full list, and the optional setup for accent voices. */
export function VoicePicker({ selected, onSelect, fastVoice }: Props) {
  const caps = useTtsCaps();
  const [playing, setPlaying] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [key, setKey] = useState('');
  const [region, setRegion] = useState('');
  const [keyStatus, setKeyStatus] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    const c = loadByok();
    setKey(c.ttsKey);
    setRegion(c.ttsRegion);
    return () => stopPreview();
  }, []);

  const preview = async (p: VoicePersona) => {
    if (playing === p.id) {
      stopPreview();
      return;
    }
    setErrors((e) => ({ ...e, [p.id]: '' }));
    try {
      setPlaying(p.id);
      await startPreview(p, caps, () => setPlaying((cur) => (cur === p.id ? null : cur)));
    } catch (err) {
      setPlaying(null);
      setErrors((e) => ({ ...e, [p.id]: err instanceof Error ? err.message : 'Preview failed.' }));
    }
  };

  const pick = (p: VoicePersona) => {
    const need = chooseVoice(p, caps).needs;
    if (need) {
      setErrors((e) => ({ ...e, [p.id]: need }));
      return;
    }
    setErrors((e) => ({ ...e, [p.id]: '' }));
    onSelect(p.id);
  };

  const saveKey = (nextKey: string, nextRegion: string) => {
    setKey(nextKey);
    setRegion(nextRegion);
    setKeyStatus(null);
    saveByok({ ...loadByok(), ttsKey: nextKey, ttsRegion: nextRegion });
    window.dispatchEvent(new Event(BYOK_CHANGED_EVENT));
  };

  const card = (p: VoicePersona) => (
    <VoiceCard key={p.id} p={p} caps={caps} selected={selected === p.id} playing={playing === p.id} error={errors[p.id] || null} onPick={() => pick(p)} onPreview={() => preview(p)} />
  );
  const others = PERSONAS.filter((p) => !p.recommended);

  return (
    <div data-testid="voice-picker">
      <p className="label">Recommended</p>
      <p className="meta mt-1">Four voices that are clear and calm, with the accent each name promises. Say a name to switch, like &ldquo;change voice to Chaiwala Blitz&rdquo;, &ldquo;use the Indian voice&rdquo; or &ldquo;switch to Mexican Spanish&rdquo;.</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2" data-testid="voice-recommended">{RECOMMENDED_PERSONAS.map(card)}</div>
      {!fastVoice && <p className="meta mt-2" role="note">Browser and Azure voices only speak in Fast voice. With Fast voice off, Stay uses the standard voice.</p>}

      <details className="mt-4" data-testid="voice-more">
        <summary className="label cursor-pointer">More voices ({others.length})</summary>
        <p className="meta mt-1">Every name matches its voice: British and American voices are British and American, and only the native voices speak Spanish, French, German, Italian or Portuguese. Lantern Iris and Compass Reid are English voices whose accent the provider does not document.</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">{others.map(card)}</div>
      </details>

      <details className="mt-4" data-testid="voice-engines">
        <summary className="label cursor-pointer">Accent voices: Indian English and Mexican Spanish</summary>
        <p className="meta mt-2">AssemblyAI has British, American and five native-language voices, and no Indian English or Mexican Spanish. Those two accents come from other engines, shown on each voice:</p>
        <ul className="meta mt-2 list-disc pl-5">
          <li><strong>{ENGINES.browser.label}.</strong> {ENGINES.browser.note} On this device: {caps.browserVoices.filter((v) => /^(en[-_]IN|es[-_]MX)/i.test(v.lang)).map((v) => `${v.name} (${v.lang})`).join(', ') || 'no Indian English or Mexican Spanish voice found'}.</li>
          <li><strong>{ENGINES.azure.label}.</strong> {ENGINES.azure.note}</li>
        </ul>
        <div className="mt-3 grid gap-3">
          <label className="block">
            <span className="label">Azure Speech key (optional)</span>
            <input className="field mt-1 w-full" type="password" autoComplete="off" spellCheck={false} placeholder="Paste your key" value={key} onChange={(e) => saveKey(e.target.value, region)} data-testid="tts-key" />
          </label>
          <label className="block">
            <span className="label">Azure region, for example centralindia or eastus</span>
            <input className="field mt-1 w-full" type="text" autoComplete="off" spellCheck={false} placeholder="centralindia" value={region} onChange={(e) => saveKey(key, e.target.value.trim().toLowerCase())} data-testid="tts-region" />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn btn-secondary" disabled={!caps.azure} onClick={async () => setKeyStatus(await testAzureKey())} data-testid="tts-check">Test this key</button>
            {keyStatus && <span className="meta" role="status" style={{ color: keyStatus.ok ? undefined : 'var(--color-danger)' }}>{keyStatus.message}</span>}
          </div>
        </div>
        <p className="meta mt-3">Stays in this browser and travels through Stay&apos;s server to Azure with each spoken sentence. Never saved or logged by Stay. If Azure rejects it mid-conversation, Stay switches to the standard voice.</p>
      </details>
    </div>
  );
}
