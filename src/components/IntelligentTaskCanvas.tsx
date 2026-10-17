'use client';

import { useEffect, useState } from 'react';
import type { MultiIntentParseResult, VoiceCommandAction } from '@/lib/voice/voiceCommands';

interface Props {
  intent: (MultiIntentParseResult & { utterance: string }) | null;
  taskText: string;
  firstStep: string | null;
  steps: { id: string; text: string; seconds: number }[];
  draftTitle: string;
  shapeLabel: string | null;
}

function describeCommand(c: NonNullable<VoiceCommandAction>): string {
  switch (c.type) {
    case 'start_game':
      return `🎮 Game · ${c.game}${c.difficulty ? ` · ${c.difficulty}` : ''}`;
    case 'set_game_difficulty':
      return `🎚️ Difficulty · ${c.difficulty}`;
    case 'start_timer':
      return `⏱️ Timer · ${c.minutes}m`;
    case 'change_language':
      return `🌐 Language · ${c.langName}`;
    case 'change_orb_shape':
      return `✨ Shape · ${c.shapeLabel}`;
    case 'synthesize_billion_shape':
      return `♾️ Become · ${c.concept}`;
    case 'change_orb_color':
      return `🎨 Color · ${c.colorTheme}`;
    case 'web_research':
      return `🔎 Research · ${c.query}`;
    case 'navigate':
      return `↗ Open · ${c.label}`;
    case 'change_voice':
      return `🗣️ Voice · ${c.voiceId}`;
    default:
      return `✓ ${c.type.replace(/_/g, ' ')}`;
  }
}

const NODES = ['Heard you', 'Calm first', '60s step', 'Drafted'];

export function IntelligentTaskCanvas({ intent, taskText, firstStep, steps, draftTitle, shapeLabel }: Props) {
  const [revealed, setRevealed] = useState(0);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const key = `${intent?.utterance ?? ''}|${firstStep ?? ''}`;

  // Stream steps in one by one, like a model thinking out loud.
  useEffect(() => {
    setRevealed(0);
    setDone({});
    const id = setInterval(() => setRevealed((r) => (r >= steps.length + 1 ? r : r + 1)), 260);
    return () => clearInterval(id);
  }, [key, steps.length]);

  const actions = intent?.commands ?? [];
  const context = intent?.conversationalContext ?? taskText;
  const activeNode = Math.min(3, revealed);

  return (
    <section
      data-testid="intelligent-chatgpt-canvas"
      data-multi-context={intent?.isMultiContext ? 'true' : 'false'}
      className="mt-4 w-full max-w-xl rounded-[24px] bg-white/92 backdrop-blur-2xl p-4 border border-black/[0.08] shadow-[0_20px_60px_rgba(0,0,0,0.07)] space-y-3 text-left"
    >
      {actions.length > 0 && (
        <div className="flex flex-wrap gap-1.5" data-testid="canvas-action-receipts">
          {actions.map((a, i) => (
            <span
              key={i}
              className="canvas-pop rounded-full bg-[#006A67]/10 text-[#006A67] px-2.5 py-0.5 text-[0.7rem] font-semibold"
              style={{ animationDelay: `${i * 90}ms` }}
            >
              {describeCommand(a)}
            </span>
          ))}
          {shapeLabel && (
            <span className="canvas-pop rounded-full bg-black/[0.05] px-2.5 py-0.5 text-[0.7rem] font-semibold text-ink">
              ♾️ {shapeLabel}
            </span>
          )}
        </div>
      )}

      {context && (
        <p className="text-[0.82rem] text-ink leading-snug" data-testid="canvas-context">
          <span className="text-ink-2">Also heard: </span>
          {context}
        </p>
      )}

      <svg viewBox="0 0 400 56" className="w-full h-12" role="img" aria-label="Task flow">
        <line x1="40" y1="22" x2="360" y2="22" stroke="rgba(0,0,0,0.08)" strokeWidth="2" />
        <line
          x1="40"
          y1="22"
          x2={40 + (320 * activeNode) / 3}
          y2="22"
          stroke="#006A67"
          strokeWidth="2"
          style={{ transition: 'all 400ms cubic-bezier(.2,.8,.2,1)' }}
        />
        {NODES.map((n, i) => {
          const x = 40 + (320 * i) / 3;
          const on = i <= activeNode;
          return (
            <g key={n}>
              <circle
                cx={x}
                cy="22"
                r={on ? 7 : 5}
                fill={on ? '#006A67' : '#fff'}
                stroke="#006A67"
                strokeWidth="1.5"
                style={{ transition: 'all 300ms' }}
              />
              <text x={x} y="48" textAnchor="middle" fontSize="10" fill={on ? '#1d1d1f' : '#86868b'}>
                {n}
              </text>
            </g>
          );
        })}
      </svg>

      {firstStep && revealed > 0 && (
        <p className="canvas-pop text-[0.9rem] font-medium text-ink">→ {firstStep}</p>
      )}

      <ol className="space-y-1" data-testid="canvas-steps">
        {steps.slice(0, Math.max(0, revealed - 1)).map((s) => (
          <li key={s.id} className="canvas-pop">
            <button
              type="button"
              onClick={() => setDone((d) => ({ ...d, [s.id]: !d[s.id] }))}
              className="w-full flex items-center justify-between gap-2 rounded-xl bg-[#F5F5F7] px-3 py-1.5 text-[0.76rem] hover:bg-black/[0.05] transition-colors"
            >
              <span className={done[s.id] ? 'line-through text-ink-2' : 'text-ink'}>
                {done[s.id] ? '✓ ' : '○ '}
                {s.text}
              </span>
              <span className="font-mono text-[0.66rem] text-[#006A67]">{s.seconds}s</span>
            </button>
          </li>
        ))}
      </ol>
      {revealed > steps.length && (
        <p className="text-[0.7rem] text-ink-2">✨ {draftTitle} is ready in Auto-Drafted Work.</p>
      )}
    </section>
  );
}
