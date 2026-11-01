/* eslint-disable @next/next/no-img-element */
/** The Stay mark is the resting orb itself: a sphere of dots (drawn by scripts/build-icons.mjs). */
export function StayLogo({ size = 28, className = '' }: { size?: number; className?: string }) {
  return <img src="/brand/stay-mark.svg" width={size} height={size} alt="" aria-hidden="true" className={`shrink-0 select-none ${className}`} />;
}
