'use client';

import { useEffect, useState } from 'react';
import { Signal } from '@/components/Signal';
import type { VoiceVisualState } from '@/types/domain';

const CYCLE: Array<{ state: VoiceVisualState; ms: number; line: string }> = [
  { state: 'listening', ms: 3200, line: '"I keep putting off replying to my landlord."' },
  { state: 'thinking', ms: 1400, line: '' },
  { state: 'speaking', ms: 3800, line: '"Open the thread and type one rough sentence. Don\'t send it."' },
  { state: 'complete', ms: 2200, line: 'Started · 10 min' },
];

export function HeroSignal() {
  const [i, setI] = useState(0);
  const [energy, setEnergy] = useState(0.1);

  useEffect(() => {
    const t = window.setTimeout(() => setI((x) => (x + 1) % CYCLE.length), CYCLE[i].ms);
    return () => window.clearTimeout(t);
  }, [i]);

  useEffect(() => {
    const s = CYCLE[i].state;
    if (s !== 'listening' && s !== 'speaking') {
      setEnergy(0.05);
      return;
    }
    const id = window.setInterval(() => setEnergy(0.25 + Math.random() * 0.55), 140);
    return () => window.clearInterval(id);
  }, [i]);

  return (
    <div className="mx-auto w-full max-w-[420px]" aria-hidden="true">
      <Signal state={CYCLE[i].state} energy={energy} />
      <p className="mt-3 min-h-[3rem] text-center text-ink-2 text-[0.98rem]">{CYCLE[i].line}</p>
    </div>
  );
}
