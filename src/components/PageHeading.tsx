'use client';

import { useContext } from 'react';
import { InlineSheetContext } from '@/components/Sheet';

/**
 * The h1 of an app page, always the first thing above its cards. Shown inside the conversation (the panel already
 * carries the same title as its own heading), it renders nothing, so the title never appears twice.
 */
export function PageHeading({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  if (useContext(InlineSheetContext)) return null;
  return <h1 className={`section-title ${className}`.trim()}>{children}</h1>;
}
