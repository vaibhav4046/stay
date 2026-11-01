'use client';

/**
 * Stay's motif: a wave. Both pieces are SVG and move with transform only (compositor-friendly); under reduced motion the
 * global rule in globals.css stops the drift and the wave simply sits still.
 */

/** One period-repeated sine path, `periods` full cycles across a 100-unit-wide, `h`-high box. */
function sinePath(periods: number, amp: number, h: number): string {
  const mid = h / 2;
  const steps = periods * 24;
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * 100;
    const y = mid + Math.sin((i / steps) * periods * Math.PI * 2) * amp;
    pts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return pts.join(' ');
}

interface WaveProps {
  /** peak height in px (the line is 2x this tall at most) */
  amplitude?: number;
  /** full cycles per 100 units of width */
  periods?: number;
  /** slower drift for calm states */
  slow?: boolean;
  /** fade the two ends (off for progress, where the end meets the thumb) */
  fade?: boolean;
  className?: string;
}

/** A thin looping wave that fades at both ends. Decorative: hidden from assistive tech. */
export function Wave({ amplitude = 6, periods = 4, slow = false, fade = true, className = '' }: WaveProps) {
  const h = amplitude * 2 + 4;
  const d = sinePath(periods, amplitude, h);
  const svg = (
    <svg viewBox={`0 0 100 ${h}`} preserveAspectRatio="none" className="h-full w-1/2 shrink-0" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
    </svg>
  );
  return (
    <div
      className={`wave-track ${className}`}
      style={{ height: h, ...(fade ? { maskImage: 'linear-gradient(90deg, transparent, #000 18%, #000 82%, transparent)', WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 18%, #000 82%, transparent)' } : {}) }}
      aria-hidden="true"
      data-testid="wave"
    >
      <div className={`wave-drift ${slow ? 'wave-drift-slow' : ''} flex h-full w-[200%]`}>
        {svg}
        {svg}
      </div>
    </div>
  );
}

interface WaveProgressProps {
  /** 0 to 1 */
  value: number;
  label: string;
  className?: string;
}

/** Progress as a wavy line up to the thumb and a straight line after it, like a media player. */
export function WaveProgress({ value, label, className = '' }: WaveProgressProps) {
  const v = Math.min(1, Math.max(0, value));
  const pct = `${(v * 100).toFixed(2)}%`;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
      className={`relative h-6 w-full ${className}`}
      data-testid="wave-progress"
    >
      {/* the remaining straight line */}
      <div className="absolute inset-y-0 right-0 flex items-center" style={{ left: pct }}>
        <div className="h-[5px] w-full rounded-full bg-[#C9C9C9]/45" />
      </div>
      {/* the wavy line already travelled */}
      <div className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: pct, color: 'var(--color-accent)' }}>
        {/* the wave is as wide as the whole track, so it does not squash as the value grows */}
        <div className="h-full" style={{ width: v > 0 ? `${100 / v}%` : '100%' }}>
          <Wave amplitude={5} periods={9} fade={false} />
        </div>
      </div>
      <div
        className="absolute top-1/2 h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#D9EEFF] bg-[#397CE8] shadow-[0_0_0_4px_rgb(217_238_255_/_0.22),0_0_18px_rgb(57_124_232_/_0.6)]"
        style={{ left: pct }}
      />
    </div>
  );
}
