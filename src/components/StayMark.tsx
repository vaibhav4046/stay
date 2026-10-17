import { StayLogo } from '@/components/StayLogo';

export function StayMark({ size = 28, className = '' }: { size?: number; className?: string }) {
  return <StayLogo size={size} className={className} />;
}

export function StayWordmark() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <StayLogo size={28} className="drop-shadow-xs" />
      <span className="font-display text-[1.18rem] font-bold tracking-tight text-ink">Stay</span>
    </span>
  );
}

