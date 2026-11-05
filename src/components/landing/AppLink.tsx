'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ComponentProps } from 'react';

/**
 * A link into the app that does not download the app's code until the person shows interest. The default prefetch fetched and ran the
 * whole Today screen (about 140 KB of script, a half-second of main-thread work on a phone) for every visitor of the home page, most of
 * whom only read it. Hover, keyboard focus or a touch warms the route, so a real click is still fast.
 */
export function AppLink({ href, onPointerEnter, onFocus, onTouchStart, ...rest }: ComponentProps<typeof Link>) {
  const router = useRouter();
  const warm = () => router.prefetch(typeof href === 'string' ? href : (href.pathname ?? '/'));
  return (
    <Link
      href={href}
      prefetch={false}
      onPointerEnter={(e) => {
        warm();
        onPointerEnter?.(e);
      }}
      onFocus={(e) => {
        warm();
        onFocus?.(e);
      }}
      onTouchStart={(e) => {
        warm();
        onTouchStart?.(e);
      }}
      {...rest}
    />
  );
}
