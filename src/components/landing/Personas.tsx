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
          return (
            <li
              key={p.id}
              className={`lp-persona group relative cursor-pointer select-none transition-all duration-300 hover:scale-[1.02] hover:shadow-md ${
                isPlaying ? '!border-accent !bg-accent/5 ring-2 ring-accent/30' : ''
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
              <div className="flex items-start justify-between">
                <div className="relative">
                  <svg
                    viewBox="0 0 100 100"
                    className={`lp-glyph transition-all duration-500 ease-out group-hover:scale-125 group-hover:-rotate-6 group-hover:drop-shadow-[0_8px_16px_rgba(99,102,241,0.45)] ${
                      isPlaying ? 'scale-125 -rotate-6 animate-pulse drop-shadow-[0_0_14px_rgba(99,102,241,0.7)]' : ''
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

                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all duration-300 ${
                    isPlaying
                      ? 'bg-accent text-white shadow-sm'
                      : 'bg-stone-100 text-stone-600 opacity-0 group-hover:opacity-100 dark:bg-stone-800 dark:text-stone-300'
                  }`}
                >
                  {isPlaying ? (
                    <>
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                      </span>
                      Playing
                    </>
                  ) : (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                      Listen
                    </>
                  )}
                </span>
              </div>

              <div>
                <h4 className="card-title flex items-center justify-between">
                  <span>{p.name}</span>
                </h4>
                <p className="meta">{p.voiceLabel}{p.nativeLang ? `, ${NATIVE_NAME[p.nativeLang]} accent` : ''}</p>
                <p className="mt-1.5 text-[0.92rem] text-ink-2">{p.style}</p>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="meta mt-4 max-w-[64ch]">
        Sixteen real voices from the speech provider. Click any card to preview their real voice. The dot picture is the orb shape that voice takes on.
      </p>
    </div>
  );
}
