'use client';

import { useCrisisPanel } from '@/components/CrisisHelpPanel';

/** The one Urgent help button. It lives in every header (never floating over content) and is a full 44 px target. */
export function UrgentHelpButton() {
  const { openCrisisPanel } = useCrisisPanel();
  return (
    <button
      type="button"
      onClick={() => openCrisisPanel()}
      className="btn btn-secondary text-[0.85rem]"
      style={{ minHeight: 44, padding: '0 0.7rem', color: '#FF8A80', borderColor: 'rgba(255,138,128,0.35)' }}
      data-testid="crisis-help-trigger"
    >
      Urgent help
    </button>
  );
}
