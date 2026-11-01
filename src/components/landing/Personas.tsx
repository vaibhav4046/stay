'use client';

import { useEffect, useRef, useState } from 'react';
import type { VoicePersona } from '@/lib/voice/personas';
import type { DotGlyph } from './personaDots';
import { previewClipUrl } from '@/lib/voice/tts/previewText';

type Filter = 'all' | 'British' | 'American' | 'native';

const NATIVE_NAME: Record<string, string> = { es: 'Spanish', fr: 'French', de: 'German', it: 'Italian', pt: 'Portuguese' };

export function Personas({ personas, glyphs }: { personas: VoicePersona[]; glyphs: Record<string, DotGlyph | null> }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>('anna');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const togglePlay = (p: VoicePersona) => {
    setSelectedId(p.id);
    if (playingId === p.id) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setPlayingId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    const url = previewClipUrl(p.id);
    const audio = new Audio(url);
    audioRef.current = audio;
    setPlayingId(p.id);

    const fallbackSynth = () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(`Hi, I'm ${p.name}. I'm here to help you start what you've been avoiding.`);
        if (p.nativeLang) u.lang = p.nativeLang;
        u.onend = () => setPlayingId((cur) => (cur === p.id ? null : cur));
        u.onerror = () => setPlayingId(null);
        window.speechSynthesis.speak(u);
      } else {
        setPlayingId(null);
      }
    };

    audio.play().catch(() => fallbackSynth());
    audio.onended = () => setPlayingId((cur) => (cur === p.id ? null : cur));
    audio.onerror = () => fallbackSynth();
  };

  const shown = personas.filter((p) => (filter === 'all' ? true : filter === 'native' ? p.nativeLang !== null : p.voiceLabel.startsWith(filter)));
  const counts = {
    all: personas.length,
    British: personas.filter((p) => p.voiceLabel.startsWith('British')).length,
    American: personas.filter((p) => p.voiceLabel.startsWith('American')).length,
    native: personas.filter((p) => p.nativeLang !== null).length,
  };

  return (
    <div data-testid="personas">
      <div className="lp-chip-row" role="group" aria-label="Filter voices">
        {(['all', 'British', 'American', 'native'] as Filter[]).map((f) => (
          <button key={f} type="button" className="chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All voices' : f === 'native' ? 'Native accent' : `${f} voice`} <span className="tnum lp-count">{counts[f]}</span>
          </button>
        ))}
      </div>
      <ul className="lp-persona-grid">
        {shown.map((p) => {
          const g = glyphs[p.shape];
          const isPlaying = playingId === p.id;
          const isSelected = selectedId === p.id;
          const accentTag = p.voiceLabel.replace(/,\s*accent not documented/i, '').replace(/\s*voice$/i, '').trim();
          const genderTag = p.gender === 'female' ? 'Female' : 'Male';
          const firstClause = p.style.split('.')[0]?.trim() || 'Calm coach';
          const toneTag = firstClause.length > 22 ? `${firstClause.slice(0, 20).trim()}…` : firstClause;

          return (
            <li
              key={p.id}
              className={`lp-persona el-voice-card group relative cursor-pointer select-none ${
                isPlaying
                  ? '!border-accent !bg-accent/5 ring-2 ring-accent/30'
                  : isSelected
                    ? '!border-primary !bg-primary/[0.03] ring-1 ring-primary/20'
                    : ''
              }`}
              data-testid="persona"
              onClick={() => togglePlay(p)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  togglePlay(p);
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`${isPlaying ? 'Pause' : 'Listen to'} ${p.name}'s voice`}
              aria-pressed={isPlaying}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="relative">
                  <svg
                    viewBox="0 0 100 100"
                    className={`lp-glyph transition-all duration-500 ease-out group-hover:scale-125 group-hover:-rotate-6 group-hover:drop-shadow-[0_8px_16px_rgba(0,106,103,0.35)] ${
                      isPlaying ? 'scale-125 -rotate-6 animate-pulse drop-shadow-[0_0_14px_rgba(0,106,103,0.6)]' : ''
                    }`}
                    aria-hidden="true"
                    focusable="false"
                  >
                    {g && (
                      <>
                        <path d={g.a} stroke={g.colors[0]} className="transition-all duration-300 group-hover:stroke-width-2" />
                        <path d={g.b} stroke={g.colors[1]} className="transition-all duration-300 group-hover:stroke-width-2" />
                      </>
                    )}
                  </svg>
                  {isPlaying && (
                    <span className="absolute -inset-1 rounded-full border border-accent/40 animate-ping pointer-events-none" />
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all duration-300 ${
                      isPlaying
                        ? 'bg-accent text-white shadow-sm'
                        : 'bg-surface-2 text-ink-2 group-hover:bg-accent-soft group-hover:text-accent-hover'
                    }`}
                  >
                    {isPlaying ? (
                      <>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <rect x="4" y="4" width="16" height="16" rx="2" />
                        </svg>
                        <span>Stop</span>
                        <span className="flex items-center gap-0.5 ml-0.5 h-3" aria-hidden="true">
                          <span className="w-0.5 bg-white rounded-full animate-soundwave-1" />
                          <span className="w-0.5 bg-white rounded-full animate-soundwave-2" />
                          <span className="w-0.5 bg-white rounded-full animate-soundwave-3" />
                          <span className="w-0.5 bg-white rounded-full animate-soundwave-4" />
                        </span>
                      </>
                    ) : (
                      <>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                        <span>Preview</span>
                      </>
                    )}
                  </span>

                  {/* Radio / check selection indicator */}
                  <span
                    aria-hidden="true"
                    className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all duration-200 ${
                      isSelected || isPlaying
                        ? 'bg-primary border-primary text-white shadow-xs'
                        : 'border-line-strong bg-surface group-hover:border-primary/60'
                    }`}
                  >
                    {(isSelected || isPlaying) && (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </span>
                </div>
              </div>

              <div>
                <h4 className="card-title flex items-center justify-between">
                  <span>{p.name}</span>
                </h4>
                <p className="meta">{p.voiceLabel}{p.nativeLang ? `, ${NATIVE_NAME[p.nativeLang]} accent` : ''}</p>
                <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                  <span className="inline-flex items-center rounded-md bg-surface-2 px-2 py-0.5 text-[0.68rem] font-medium text-ink-2 border border-line/80">
                    {accentTag}
                  </span>
                  <span className="inline-flex items-center rounded-md bg-surface-2 px-2 py-0.5 text-[0.68rem] font-medium text-ink-2 border border-line/80">
                    {genderTag}
                  </span>
                  <span className="inline-flex items-center rounded-md bg-primary/[0.06] px-2 py-0.5 text-[0.68rem] font-medium text-primary border border-primary/15">
                    {toneTag}
                  </span>
                </div>
                <p className="mt-2 text-[0.92rem] text-ink-2">{p.style}</p>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="meta mt-4 max-w-[64ch]">
        {personas.filter((p) => p.voices[0].engine === 'assemblyai').length} voices from AssemblyAI text-to-speech, plus {personas.filter((p) => p.voices[0].engine !== 'assemblyai').length} accent voices that use Azure or your device. Click any card to preview their real voice. The dot picture is the orb shape that voice takes on.
      </p>
    </div>
  );
}
