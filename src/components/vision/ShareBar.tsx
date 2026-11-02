'use client';

import { useEffect, useRef } from 'react';
import type { ShareMode } from '@/lib/vision/capture';

export interface ShareBarProps {
  mode: ShareMode;
  stream: MediaStream;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  glance: boolean;
  onGlance: (on: boolean) => void;
  onLook: () => void;
  onStop: () => void;
}

/** Shown above the composer for as long as something is shared: what Stay can see, and the way to stop. */
export function ShareBar({ mode, stream, videoRef, glance, onGlance, onLook, onStop }: ShareBarProps) {
  const local = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const v = local.current;
    if (!v) return;
    v.srcObject = stream;
    void v.play().catch(() => undefined);
    (videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = v;
    return () => {
      v.srcObject = null;
    };
  }, [stream, videoRef]);

  return (
    <div className="glass mx-auto mb-2 flex w-full flex-wrap items-center gap-3 rounded-2xl p-2 pr-3" role="status" data-testid="share-bar" data-share-mode={mode}>
      <video ref={local} muted playsInline autoPlay className="h-14 w-24 shrink-0 rounded-lg bg-black object-cover" aria-label={mode === 'screen' ? 'Preview of the screen you are sharing' : 'Preview of your camera'} data-testid="share-preview" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
          <span className="h-2 w-2 shrink-0 rounded-full bg-accent shadow-[0_0_10px_rgb(143_211_255/0.9)]" aria-hidden="true" />
          {mode === 'screen' ? 'Sharing your screen' : 'Camera is on'}
        </p>
        <p className="meta">With voice on, Stay looks once to start. After that it only looks when you ask, or press Look now.</p>
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-2">
        <input type="checkbox" className="h-4 w-4 accent-[#8FD3FF]" checked={glance} onChange={(e) => onGlance(e.target.checked)} data-testid="glance-toggle" />
        Glance every 2 min
      </label>
      <button type="button" className="btn btn-secondary h-10 !px-3 text-sm" onClick={onLook} data-testid="look-now">
        Look now
      </button>
      <button type="button" className="btn btn-ghost h-10 !px-3 text-sm" onClick={onStop} data-testid="stop-share">
        Stop
      </button>
    </div>
  );
}
