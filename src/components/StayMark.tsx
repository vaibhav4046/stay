export function StayMark({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <circle cx="14" cy="16" r="10" stroke="#212422" strokeWidth="2" />
      <circle cx="18" cy="16" r="6" stroke="#006A67" strokeWidth="2" />
      <line x1="3" y1="16" x2="29" y2="16" stroke="#212422" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function StayWordmark() {
  return (
    <span className="inline-flex items-center gap-2">
      <StayMark size={26} />
      <span className="font-display text-[1.15rem] font-semibold tracking-tight">Stay</span>
    </span>
  );
}
