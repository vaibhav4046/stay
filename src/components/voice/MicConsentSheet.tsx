'use client';

import React, { useState } from 'react';
import { Sheet } from '@/components/Sheet';

export interface MicConsentSheetProps {
  isOpen: boolean;
  onConsent: () => void;
  onTextOnly: () => void;
  onClose: () => void;
}

export function MicConsentSheet({ isOpen, onConsent, onTextOnly, onClose }: MicConsentSheetProps) {
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  if (!isOpen) return null;

  return (
    <Sheet title="Microphone & Voice Privacy" onClose={onClose}>
      <div className="space-y-4 text-sm" style={{ color: '#F5F5F6' }} data-testid="mic-consent-sheet">
        <p className="leading-relaxed">
          Stay sends your voice to <strong>AssemblyAI</strong> (Universal-3.6 Pro and AssemblyAI TTS) to turn speech into text and speak back in real time.
        </p>

        <div className="p-3.5 rounded-[12px] border border-[#2E2F32] space-y-2 text-xs" style={{ backgroundColor: '#353537', color: '#C9C9C9' }}>
          <p className="font-semibold text-xs" style={{ color: '#F5F5F6' }}>What Stay stores on this device:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Your task notes, completed focus blocks, and custom word dictionary (saved in your local browser storage).</li>
            <li>No audio recordings are ever saved to disk or persistent servers.</li>
            <li>Voice audio streams ephemerally over secure WebSocket to AssemblyAI using single-use session tokens.</li>
          </ul>
        </div>

        <p className="text-xs" style={{ color: '#C9C9C9' }}>
          💡 <strong>Headphones work best:</strong> Prevents speaker audio from leaking into your microphone during full-duplex conversations.
        </p>

        {showHowItWorks && (
          <div className="p-3 rounded-lg border border-[#2E2F32] text-xs space-y-1" style={{ backgroundColor: '#08090B' }}>
            <p className="font-semibold" style={{ color: '#F5F5F6' }}>How this works:</p>
            <p>1. Clicking &ldquo;Start talking&rdquo; requests browser microphone access.</p>
            <p>2. Your browser captures 16 kHz audio with an acoustic low-pass filter and streams it over WebSocket to AssemblyAI.</p>
            <p>3. You can interrupt Stay at any moment by speaking, or click &ldquo;Stop&rdquo; to stop Stay speaking.</p>
            <p>4. You can revoke microphone permission anytime in Settings.</p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2">
          <button
            type="button"
            onClick={onConsent}
            className="btn btn-primary flex-1 font-semibold"
            style={{ backgroundColor: '#85B6FF', color: '#08090B' }}
            data-testid="consent-start-talking"
          >
            Start talking
          </button>
          <button
            type="button"
            onClick={onTextOnly}
            className="btn btn-secondary flex-1"
            style={{ backgroundColor: '#353537', color: '#F5F5F6', borderColor: '#2E2F32' }}
            data-testid="consent-text-only"
          >
            Use text only
          </button>
        </div>

        <div className="text-center pt-1">
          <button
            type="button"
            onClick={() => setShowHowItWorks((prev) => !prev)}
            className="text-xs underline hover:opacity-80"
            style={{ color: '#85B6FF' }}
          >
            {showHowItWorks ? 'Hide details' : 'How this works'}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
