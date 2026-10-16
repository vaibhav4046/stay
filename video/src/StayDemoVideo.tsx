import React from 'react';

export const StayDemoVideo: React.FC = () => {
  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        backgroundColor: '#FAF8F5',
        color: '#212422',
        fontFamily: 'DM Sans, system-ui, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 80,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 40 }}>
        <svg width={64} height={64} viewBox="0 0 32 32" fill="none">
          <circle cx="14" cy="16" r="10" stroke="#212422" strokeWidth="2.5" />
          <circle cx="18" cy="16" r="6" stroke="#006A67" strokeWidth="2.5" />
          <line x1="3" y1="16" x2="29" y2="16" stroke="#212422" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        <span style={{ fontSize: 48, fontWeight: 700, letterSpacing: '-0.02em' }}>Stay</span>
      </div>

      <h1 style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.1, textAlign: 'center', maxWidth: 1100, marginBottom: 30 }}>
        Make starting easier.
      </h1>

      <p style={{ fontSize: 32, color: '#626B66', textAlign: 'center', maxWidth: 900, lineHeight: 1.5 }}>
        A voice-first ADHD task-initiation and treatment-adherence companion built with AssemblyAI Voice Agent API.
      </p>

      <div style={{ marginTop: 60, display: 'flex', gap: 24 }}>
        <div style={{ background: '#FFFFFF', border: '1px solid #E9E6DF', borderRadius: 16, padding: '24px 32px' }}>
          <div style={{ fontSize: 18, color: '#006A67', fontWeight: 600 }}>01 · Shrink the first step</div>
          <div style={{ fontSize: 20, marginTop: 8, color: '#212422' }}>Under 2 minutes to begin</div>
        </div>
        <div style={{ background: '#FFFFFF', border: '1px solid #E9E6DF', borderRadius: 16, padding: '24px 32px' }}>
          <div style={{ fontSize: 18, color: '#006A67', fontWeight: 600 }}>02 · Proactive body double</div>
          <div style={{ fontSize: 20, marginTop: 8, color: '#212422' }}>Speaks first at timer end</div>
        </div>
        <div style={{ background: '#FFFFFF', border: '1px solid #E9E6DF', borderRadius: 16, padding: '24px 32px' }}>
          <div style={{ fontSize: 18, color: '#006A67', fontWeight: 600 }}>03 · Clinician summary</div>
          <div style={{ fontSize: 20, marginTop: 8, color: '#212422' }}>1-page PDF for appointments</div>
        </div>
      </div>
    </div>
  );
};
