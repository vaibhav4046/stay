/* eslint-disable @next/next/no-img-element */
/** The Stay mark is the resting orb itself: a sphere of dots (rendered once from the live orb). */
export function StayLogo({ size = 28, className = '' }: { size?: number; className?: string }) {
  return <img src="/icons/icon-192.png" width={size} height={size} alt="" aria-hidden="true" className={`shrink-0 select-none rounded-full ${className}`} />;
}
