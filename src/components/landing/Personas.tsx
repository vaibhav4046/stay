'use client';

import { useState } from 'react';
import type { VoicePersona } from '@/lib/voice/personas';
import type { DotGlyph } from './personaDots';

type Filter = 'all' | 'British' | 'American' | 'native';

const NATIVE_NAME: Record<string, string> = { es: 'Spanish', fr: 'French', de: 'German', it: 'Italian', pt: 'Portuguese' };

export function Personas({ personas, glyphs }: { personas: VoicePersona[]; glyphs: Record<string, DotGlyph | null> }) {
  const [filter, setFilter] = useState<Filter>('all');
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
          return (
            <li key={p.id} className="lp-persona" data-testid="persona">
              <svg viewBox="0 0 100 100" className="lp-glyph" aria-hidden="true" focusable="false">
                {g && (
                  <>
                    <path d={g.a} stroke={g.colors[0]} />
                    <path d={g.b} stroke={g.colors[1]} />
                  </>
                )}
              </svg>
              <div>
                <h4 className="card-title">{p.name}</h4>
                <p className="meta">{p.voiceLabel}{p.nativeLang ? `, ${NATIVE_NAME[p.nativeLang]} accent` : ''}</p>
                <p className="mt-1.5 text-[0.92rem] text-ink-2">{p.style}</p>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="meta mt-4 max-w-[64ch]">
        Sixteen real voices from the speech provider. Only the five native-accent ones are genuine accents of Spanish, French, German, Italian and Portuguese; the British and American voices are just that, and the personality comes from a one-line style note. The dot picture is the orb shape that voice takes on.
      </p>
    </div>
  );
}
