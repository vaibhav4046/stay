'use client';

import type { CSSProperties, ReactNode } from 'react';
import type { PanelId } from '@/lib/voice/voiceCommands';
import { MORE_MENU_ASKS } from '@/components/moreMenuAsks';

/** `.btn` centres its content and is not in a cascade layer, so a utility class cannot left-align it: say it inline. */
const LEFT: CSSProperties = { justifyContent: 'flex-start' };

function Item({ onClick, testId, children }: { onClick: () => void; testId?: string; children: ReactNode }) {
  return (
    <button type="button" className="btn btn-secondary w-full py-2 text-sm" style={LEFT} onClick={onClick} data-testid={testId}>
      {children}
    </button>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-ink-3">{label}</p>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

/**
 * The body of the More sheet: six actions, nothing that the top nav already has. Everything else (history, memory, parked thoughts,
 * check-ins, "have Stay call me", settings) is one ask away or in the nav, and the line at the bottom says how to ask.
 */
export function MoreMenu({
  quietMode,
  onGround,
  onOpenPanel,
  onOpenVoice,
  onToggleQuiet,
}: {
  quietMode: boolean;
  onGround: () => void;
  onOpenPanel: (panel: PanelId) => void;
  onOpenVoice: () => void;
  onToggleQuiet: () => void;
}) {
  return (
    <>
      <div className="space-y-4">
        <Group label="Calm and focus">
          <Item onClick={onGround} testId="menu-ground">Ground me</Item>
          <Item onClick={() => onOpenPanel('dump')} testId="menu-dump">Brain dump</Item>
          <Item onClick={() => onOpenPanel('today')} testId="menu-today">Today&apos;s list</Item>
          <Item onClick={() => onOpenPanel('routines')} testId="menu-routines">Routines</Item>
        </Group>
        <Group label="Voice">
          <Item onClick={onOpenVoice} testId="menu-voice">Voice and language</Item>
          <Item onClick={onToggleQuiet} testId="menu-quiet">{quietMode ? 'Turn voice on' : 'Quiet mode (type only)'}</Item>
        </Group>
      </div>
      <p className="meta mt-4" data-testid="menu-asks">
        Or just ask, by voice or typing: {MORE_MENU_ASKS.map((a) => `“${a}”`).join(', ')}.
      </p>
    </>
  );
}
