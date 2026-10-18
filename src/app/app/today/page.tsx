'use client';

import { useStayData } from '@/lib/storage/useStayData';
import { Onboarding } from '@/components/Onboarding';
import { StayHome } from '@/components/StayHome';
import { StrategyPatternSummary } from '@/components/StrategyPatternSummary';

export default function TodayPage() {
  const { profile, sessions, loaded, updateProfile, addSession } = useStayData('app');

  if (!loaded) return null;
  if (!profile.onboardingCompleted) return <Onboarding onDone={updateProfile} />;

  return (
    <div className="space-y-6">
      <StayHome
        careContext={profile.careContext}
        sessions={sessions}
        proactiveCheckins={profile.proactiveCheckins}
        quietMode={profile.interactionMode === 'quiet_text_only'}
        onQuietModeChange={(q) => updateProfile({ interactionMode: q ? 'quiet_text_only' : 'voice_and_text' })}
        onLogSession={addSession}
      />
      <StrategyPatternSummary sessions={sessions} />
    </div>
  );
}
