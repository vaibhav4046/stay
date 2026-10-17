import React from 'react';

export function StayLogo({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="stayLogoSphere" cx="32%" cy="28%" r="72%">
          <stop offset="0%" stopColor="#99F6E4" />
          <stop offset="38%" stopColor="#0D9488" />
          <stop offset="76%" stopColor="#006A67" />
          <stop offset="100%" stopColor="#002B29" />
        </radialGradient>
        <linearGradient id="stayLogoSilkRing" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.92" />
          <stop offset="50%" stopColor="#5EEAD4" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.85" />
        </linearGradient>
        <linearGradient id="stayLogoPetal" x1="32" y1="6" x2="32" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#99F6E4" stopOpacity="0.25" />
        </linearGradient>
      </defs>

      {/* Outer Ambient Studio Halo */}
      <circle cx="32" cy="32" r="30" fill="url(#stayLogoSphere)" opacity="0.16" />

      {/* Main Iridescent Glass Sculpture Core */}
      <circle
        cx="32"
        cy="32"
        r="25"
        fill="url(#stayLogoSphere)"
        stroke="url(#stayLogoSilkRing)"
        strokeWidth="1.75"
      />

      {/* Precision Harmonic Lotus & Soundwave Orbitals */}
      <ellipse
        cx="32"
        cy="32"
        rx="20"
        ry="10.5"
        transform="rotate(-30 32 32)"
        stroke="url(#stayLogoPetal)"
        strokeWidth="1.4"
      />
      <ellipse
        cx="32"
        cy="32"
        rx="20"
        ry="10.5"
        transform="rotate(30 32 32)"
        stroke="url(#stayLogoPetal)"
        strokeWidth="1.4"
      />
      <ellipse
        cx="32"
        cy="32"
        rx="10.5"
        ry="20"
        stroke="rgba(255,255,255,0.55)"
        strokeWidth="1.2"
      />

      {/* Top Specular Studio Glass Highlight */}
      <ellipse
        cx="24"
        cy="20"
        rx="8.5"
        ry="4.5"
        transform="rotate(-24 24 20)"
        fill="white"
        fillOpacity="0.52"
      />

      {/* Central Living Resonance Point */}
      <circle cx="32" cy="32" r="4" fill="#FFFFFF" fillOpacity="0.95" />
    </svg>
  );
}
