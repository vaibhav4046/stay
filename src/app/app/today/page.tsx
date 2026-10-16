'use client';

import { useStayData } from '@/lib/storage/useStayData';
import { Onboarding } from '@/components/Onboarding';
import { CoachWorkspace } from '@/components/CoachWorkspace';
import { StrategyPatternSummary } from '@/components/StrategyPatternSummary';

export default function TodayPage() {
  const { profile, sessions, loaded, updateProfile, addSession } = useStayData('app');

  if (!loaded) return null;
  if (!profile.onboardingCompleted) return <Onboarding onDone={updateProfile} />;

  return (
    <div className="space-y-6">
      <h1 className="sr-only">Today</h1>
      <CoachWorkspace
        careContext={profile.careContext}
        sessions={sessions}
        proactiveCheckins={profile.proactiveCheckins}
        quietMode={profile.interactionMode === 'quiet_text_only'}
        onQuietModeChange={(q) => updateProfile({ interactionMode: q ? 'quiet_text_only' : 'voice_and_text' })}
        onLogSession={addSession}
        isDemo={false}
      />
      <StrategyPatternSummary sessions={sessions} />
    </div>
  );
}
