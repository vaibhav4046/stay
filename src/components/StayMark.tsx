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
      <defs>
        {/* 3D Orb Radial Gradient */}
        <radialGradient id="stay-orb-grad" cx="35%" cy="32%" r="68%">
          <stop offset="0%" stopColor="#E6FFFA" stopOpacity="0.95" />
          <stop offset="25%" stopColor="#00F5D4" stopOpacity="0.9" />
          <stop offset="65%" stopColor="#006A67" stopOpacity="1" />
          <stop offset="100%" stopColor="#003836" stopOpacity="1" />
        </radialGradient>

        {/* Ambient Halo */}
        <radialGradient id="stay-orb-halo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#00F5D4" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#006A67" stopOpacity="0" />
        </radialGradient>

        {/* Specular Highlight */}
        <linearGradient id="stay-orb-spec" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Ambient Glow */}
      <circle cx="16" cy="16" r="15" fill="url(#stay-orb-halo)" />

      {/* 3D Luminous Sphere */}
      <circle cx="16" cy="16" r="11" fill="url(#stay-orb-grad)" />

      {/* Specular Glint */}
      <ellipse cx="12.5" cy="12" rx="4.5" ry="2.6" fill="url(#stay-orb-spec)" transform="rotate(-30 12.5 12)" />

      {/* Orbital Filament Ring */}
      <ellipse cx="16" cy="16" rx="14" ry="4.2" stroke="#00F5D4" strokeWidth="1.2" strokeDasharray="2 1.5" strokeOpacity="0.75" transform="rotate(-20 16 16)" />
    </svg>
  );
}

export function StayWordmark() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <StayMark size={28} className="drop-shadow-xs" />
      <span className="font-display text-[1.18rem] font-bold tracking-tight text-ink">Stay</span>
    </span>
  );
}
