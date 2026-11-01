'use client';

import { useEffect, useState } from 'react';
import { loadByok, saveByok } from '@/lib/byok/config';
import { PERSONAS, RECOMMENDED_PERSONAS, chooseVoice, type VoicePersona } from '@/lib/voice/personas';
import { dotGlyph, type DotGlyph } from '@/components/landing/personaDots';
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

type FilterMode = 'all' | 'ready' | 'british' | 'american' | 'native';

/** Memoized static dot glyphs for every persona shape */
const GLYPHS: Record<string, DotGlyph | null> = {};
for (const p of PERSONAS) {
  if (!GLYPHS[p.shape]) {
    GLYPHS[p.shape] = dotGlyph(p.shape, 90);
  }
}

/** One line saying which engine would speak this persona right now, e.g. "AssemblyAI" or "Browser voice: Microsoft Heera". */
function engineLine(p: VoicePersona, caps: TtsCaps): string {
  const c = chooseVoice(p, caps);
  if (!c.ref) return 'Needs setup';
  if (c.ref.engine === 'browser') return `Browser voice: ${c.browserVoiceName}`;
  if (c.ref.engine === 'azure') return `${ENGINES.azure.label}: ${c.ref.voice.split('-').slice(2).join('-').replace(/Neural$/, '')}`;
  return ENGINES.assemblyai.label;
}

/** Structured ElevenLabs-style metadata tags (Accent, Gender, Tone) for a voice persona. */
function personaTags(p: VoicePersona): { accent: string; gender: string; tone: string } {
  const accent = p.voiceLabel
    .replace(/,\s*accent not documented/i, '')
    .replace(/\s*voice$/i, '')
    .trim();
  const gender = p.gender === 'female' ? 'Female' : 'Male';
  const firstClause = p.style.split('.')[0]?.trim() || 'Calm coach';
  const tone = firstClause.length > 24 ? `${firstClause.slice(0, 22).trim()}…` : firstClause;
  return { accent, gender, tone };
}

function VoiceCard({
  p,
  caps,
  selected,
  playing,
  error,
  onPick,
  onPreview,
  glyph,
  hidden = false,
}: {
  p: VoicePersona;
  caps: TtsCaps;
  selected: boolean;
  playing: boolean;
  error: string | null;
  onPick: () => void;
  onPreview: () => void;
  glyph: DotGlyph | null;
  hidden?: boolean;
}) {
  const usable = chooseVoice(p, caps).ref !== null;
  const needText = chooseVoice(p, caps).needs;
  const tags = personaTags(p);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onPick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(); } }}
      className={`el-voice-card group relative flex flex-col justify-between rounded-2xl border cursor-pointer select-none ${
        selected
          ? '!border-primary !bg-primary/[0.04] ring-2 ring-primary/25 shadow-sm'
          : 'border-line bg-surface hover:border-line-strong'
      } ${playing ? 'ring-2 ring-emerald-500/40 !border-emerald-600' : ''} p-4 ${hidden ? 'hidden' : ''}`}
      style={{ opacity: usable ? 1 : 0.82 }}
      data-testid={`voice-${p.id}`}
      data-usable={usable}
    >
      <div>
        <div className="flex items-start gap-2.5">
          {/* Logo container with 3D hover transform animation */}
          <div className="relative w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-2xl bg-surface-2/90 border border-line/80 p-1.5 transition-all duration-300 ease-out group-hover:scale-110 group-hover:-rotate-2 group-hover:bg-primary/[0.08] group-hover:border-primary/40 group-hover:shadow-[0_8px_20px_-4px_rgba(0,106,103,0.3)]">
            <svg
              viewBox="0 0 100 100"
              className={`voice-card-glyph ${
                playing ? 'is-playing' : ''
              }`}
              aria-hidden="true"
              focusable="false"
            >
              {glyph && (
                <>
                  <path
                    d={glyph.a}
                    stroke={glyph.colors[0]}
                    fill="none"
                    strokeWidth="4.6"
                    strokeLinecap="round"
                    style={{ fill: 'none', strokeWidth: 4.6, strokeLinecap: 'round' }}
                  />
                  <path
                    d={glyph.b}
                    stroke={glyph.colors[1]}
                    fill="none"
                    strokeWidth="4.6"
                    strokeLinecap="round"
                    style={{ fill: 'none', strokeWidth: 4.6, strokeLinecap: 'round' }}
                  />
                </>
              )}
            </svg>
            {playing && (
              <span className="absolute -inset-1 rounded-xl border border-primary/40 animate-ping pointer-events-none" />
            )}
          </div>

          <button
            type="button"
            className="flex-1 min-w-0 text-left focus:outline-none cursor-pointer"
            aria-pressed={selected}
            onClick={(e) => { e.stopPropagation(); onPick(); }}
          >
            <div className="flex items-start justify-between gap-1.5">
              <span className="font-display font-semibold text-ink text-[0.98rem] leading-snug group-hover:text-primary transition-colors">
                {p.name}
              </span>

              {/* ElevenLabs circular radio/check indicator */}
              <span
                aria-hidden="true"
                data-testid={`voice-radio-${p.id}`}
                className={`flex-shrink-0 mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center transition-all duration-200 ${
                  selected
                    ? 'bg-primary border-primary text-white scale-100 shadow-xs'
                    : 'border-line-strong bg-surface group-hover:border-primary/60'
                }`}
              >
                {selected ? (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-transparent group-hover:bg-primary/30 transition-colors" />
                )}
              </span>
            </div>

            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
              {usable ? (
                <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-emerald-500/10 px-2 py-0.5 text-[0.68rem] font-medium text-emerald-700 dark:text-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Ready
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-amber-500/10 px-2 py-0.5 text-[0.68rem] font-medium text-amber-800 dark:text-amber-300">
                  Needs Setup
                </span>
              )}
              <span className="meta text-[0.72rem] text-ink-3 truncate" data-testid={`voice-engine-${p.id}`}>
                {engineLine(p, caps)}
              </span>
            </div>
          </button>
        </div>

        {/* ElevenLabs category tags (Accent · Gender · Tone) */}
        <div className="mt-2.5 flex items-center gap-1.5 flex-wrap" data-testid={`voice-tags-${p.id}`}>
          <span className="inline-flex items-center rounded-md bg-surface-2 px-2 py-0.5 text-[0.68rem] font-medium text-ink-2 border border-line/80">
            {p.voiceLabel}
          </span>
          <span className="inline-flex items-center rounded-md bg-surface-2 px-2 py-0.5 text-[0.68rem] font-medium text-ink-2 border border-line/80">
            {tags.gender}
          </span>
          <span className="inline-flex items-center rounded-md bg-primary/[0.06] px-2 py-0.5 text-[0.68rem] font-medium text-primary border border-primary/15">
            {tags.tone}
          </span>
        </div>

        <p className="meta mt-2 text-xs leading-relaxed text-ink-2">{p.style}</p>
      </div>

      <div className="mt-3 pt-3 border-t border-line/60">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <button
            type="button"
            className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium transition-all duration-200 cursor-pointer ${
              playing
                ? 'bg-primary text-white shadow-sm scale-105'
                : usable
                  ? 'bg-surface-2 text-ink hover:bg-primary/10 hover:text-primary hover:scale-105 active:scale-95 hover:shadow-xs'
                  : 'bg-surface-2 text-ink-3 opacity-50 cursor-not-allowed'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              onPreview();
            }}
            disabled={!usable}
            aria-label={`${playing ? 'Stop' : 'Play'} a 20 second preview of ${p.name}`}
            data-testid={`preview-${p.id}`}
          >
            <span className={`w-4 h-4 rounded-full flex items-center justify-center ${playing ? 'bg-white/20' : 'bg-surface'}`}>
              {playing ? (
                <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                </svg>
              ) : (
                <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="ml-0.5">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              )}
            </span>
            <span>{playing ? 'Stop' : 'Preview (20 s)'}</span>
            <span
              className="flex items-center gap-0.5 ml-0.5 h-3.5"
              data-testid={`voice-wave-indicator-${p.id}`}
              aria-hidden="true"
            >
              <span className={`w-0.5 rounded-full ${playing ? 'bg-white animate-soundwave-1' : 'h-1.5 bg-ink-3/35 group-hover:bg-primary/50 transition-all'}`} />
              <span className={`w-0.5 rounded-full ${playing ? 'bg-white animate-soundwave-2' : 'h-2.5 bg-ink-3/35 group-hover:bg-primary/50 transition-all'}`} />
              <span className={`w-0.5 rounded-full ${playing ? 'bg-white animate-soundwave-3' : 'h-1.5 bg-ink-3/35 group-hover:bg-primary/50 transition-all'}`} />
              <span className={`w-0.5 rounded-full ${playing ? 'bg-white animate-soundwave-4' : 'h-3 bg-ink-3/35 group-hover:bg-primary/50 transition-all'}`} />
              <span className={`w-0.5 rounded-full ${playing ? 'bg-white animate-soundwave-5' : 'h-1 bg-ink-3/35 group-hover:bg-primary/50 transition-all'}`} />
            </span>
          </button>

          {!usable && (
            <span className="meta text-xs text-amber-700 dark:text-amber-300">
              {needText}
            </span>
          )}
        </div>

        {error && <p className="meta mt-1.5 text-xs" role="alert" style={{ color: 'var(--color-danger)' }}>{error}</p>}
      </div>
    </div>
  );
}

/** The curated shortlist, the full list, and the optional setup for accent voices. */
export function VoicePicker({ selected, onSelect, fastVoice }: Props) {
  const caps = useTtsCaps();
  const [playing, setPlaying] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<FilterMode>('all');
  const [search, setSearch] = useState('');
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

  const matchesFilter = (p: VoicePersona) => {
    const q = search.trim().toLowerCase();
    if (q) {
      const hay = `${p.name} ${p.voiceLabel} ${p.style} ${p.gender}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (filter === 'all') return true;
    if (filter === 'ready') return chooseVoice(p, caps).ref !== null;
    if (filter === 'british') return p.voiceLabel.includes('British');
    if (filter === 'american') return p.voiceLabel.includes('American');
    if (filter === 'native') return p.nativeLang !== null;
    return true;
  };

  const readyCount = PERSONAS.filter((p) => chooseVoice(p, caps).ref !== null).length;
  const britishCount = PERSONAS.filter((p) => p.voiceLabel.includes('British')).length;
  const americanCount = PERSONAS.filter((p) => p.voiceLabel.includes('American')).length;
  const nativeCount = PERSONAS.filter((p) => p.nativeLang !== null).length;

  const card = (p: VoicePersona) => (
    <VoiceCard
      key={p.id}
      p={p}
      caps={caps}
      selected={selected === p.id}
      playing={playing === p.id}
      error={errors[p.id] || null}
      onPick={() => pick(p)}
      onPreview={() => preview(p)}
      glyph={GLYPHS[p.shape] ?? null}
      hidden={!matchesFilter(p)}
    />
  );

  const others = PERSONAS.filter((p) => !p.recommended);

  return (
    <div data-testid="voice-picker">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div>
          <p className="label">Recommended</p>
          <p className="meta mt-0.5">Four voices that are clear and calm, with the accent each name promises.</p>
        </div>

        <div className="relative w-full sm:w-56">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search voice, accent, tone…"
            aria-label="Search voices"
            data-testid="voice-search"
            className="w-full rounded-xl border border-line-strong bg-surface px-3 py-1.5 text-xs text-ink placeholder:text-ink-3 focus:border-primary focus:outline-none"
          />
        </div>

        {/* ElevenLabs category filter bar */}
        <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Filter voices">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
              filter === 'all' ? 'bg-primary text-white shadow-sm' : 'bg-surface-2 text-ink-2 hover:text-ink'
            }`}
          >
            All ({PERSONAS.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('ready')}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all flex items-center gap-1 ${
              filter === 'ready' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Ready ({readyCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter('british')}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
              filter === 'british' ? 'bg-primary text-white shadow-sm' : 'bg-surface-2 text-ink-2 hover:text-ink'
            }`}
          >
            British ({britishCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter('american')}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
              filter === 'american' ? 'bg-primary text-white shadow-sm' : 'bg-surface-2 text-ink-2 hover:text-ink'
            }`}
          >
            American ({americanCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter('native')}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
              filter === 'native' ? 'bg-primary text-white shadow-sm' : 'bg-surface-2 text-ink-2 hover:text-ink'
            }`}
          >
            Native ({nativeCount})
          </button>
        </div>
      </div>

      <div className="mt-2 grid gap-2.5 sm:grid-cols-2" data-testid="voice-recommended">
        {RECOMMENDED_PERSONAS.map(card)}
      </div>

      {!fastVoice && (
        <p className="meta mt-2" role="note">
          Browser and Azure voices only speak in Fast voice. With Fast voice off, Stay uses the standard voice.
        </p>
      )}

      <details className="mt-5" data-testid="voice-more">
        <summary className="label cursor-pointer select-none py-1">More voices ({others.length})</summary>
        <p className="meta mt-1">
          Every name matches its voice: British and American voices are British and American, and only the native voices speak Spanish, French, German, Italian or Portuguese. Lantern Iris and Compass Reid are English voices whose accent the provider does not document.
        </p>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">{others.map(card)}</div>
      </details>

      <details className="mt-5" data-testid="voice-engines">
        <summary className="label cursor-pointer select-none py-1">Accent voices: Indian English and Mexican Spanish</summary>
        <p className="meta mt-2">
          AssemblyAI has British, American and five native-language voices, and no Indian English or Mexican Spanish. Those two accents come from other engines, shown on each voice:
        </p>
        <ul className="meta mt-2 list-disc pl-5 space-y-1">
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
        <p className="meta mt-3">
          Stays in this browser and travels through Stay&apos;s server to Azure with each spoken sentence. Never saved or logged by Stay. If Azure rejects it mid-conversation, Stay switches to the standard voice.
        </p>
      </details>
    </div>
  );
}
