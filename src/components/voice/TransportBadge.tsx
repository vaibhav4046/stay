'use client';

import React, { useState } from 'react';
import type { VoiceTransportInfo } from '@/lib/voice/useVoiceAgent';

export interface TransportBadgeProps {
  transport: VoiceTransportInfo;
  isConnected: boolean;
  replyTimes?: number[];
}

export function TransportBadge({ transport, isConnected, replyTimes = [] }: TransportBadgeProps) {
  const [open, setOpen] = useState(false);

  const badgeTone =
    transport.mode === 'assemblyai'
      ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
      : transport.mode === 'device' || transport.mode === 'backup'
      ? 'bg-amber-50 text-amber-900 border-amber-200'
      : 'bg-stone-100 text-stone-800 border-stone-300';

  const dotTone =
    transport.mode === 'assemblyai' && isConnected
      ? 'bg-emerald-600'
      : transport.mode === 'assemblyai'
      ? 'bg-emerald-500/70'
      : transport.mode === 'device' || transport.mode === 'backup'
      ? 'bg-amber-600'
      : 'bg-stone-500';

  const lastLatencyMs = replyTimes.length > 0 ? Math.round(replyTimes[replyTimes.length - 1] * 1000) : null;

  return (
    <>
      <button
        type="button"
        data-testid="transport-badge"
        data-transport-mode={transport.mode}
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${badgeTone}`}
        title="View live voice transport diagnostics"
        aria-label={`Voice transport: ${transport.label}. Click for diagnostics.`}
      >
        <span className={`h-2 w-2 rounded-full ${dotTone}`} aria-hidden="true" />
        <span>{transport.label}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Voice transport diagnostics"
            data-testid="diagnostics-sheet"
            className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-5 text-stone-900 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div>
                <h2 className="text-base font-semibold text-stone-900">Voice Transport Diagnostics</h2>
                <p className="text-xs text-stone-600">Honest real-time wire state (no hidden fallbacks)</p>
              </div>
              <button
                type="button"
                data-testid="close-diagnostics"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-stone-200 px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-100"
              >
                Close
              </button>
            </div>

            <dl className="mt-4 space-y-2.5 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-stone-600">Active transport</dt>
                <dd className="font-mono font-semibold text-stone-900" data-testid="diag-transport-label">
                  {transport.label}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-stone-600">Connection status</dt>
                <dd className="font-mono text-stone-900">{isConnected ? 'Connected' : 'Idle / Disconnected'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-stone-600">STT model</dt>
                <dd className="font-mono text-stone-900" data-testid="diag-stt-model">
                  {transport.sttModel} ({transport.sttSampleRate} Hz)
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-stone-600">TTS model</dt>
                <dd className="font-mono text-stone-900" data-testid="diag-tts-model">
                  {transport.ttsModel} ({transport.ttsSampleRate} Hz)
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-stone-600">Resolved voice_id</dt>
                <dd className="font-mono text-stone-900" data-testid="diag-voice-id">
                  {transport.voiceId}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-stone-600">Last WebSocket close code</dt>
                <dd className="font-mono text-stone-900" data-testid="diag-close-code">
                  {transport.lastCloseCode !== null ? String(transport.lastCloseCode) : 'None'}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-stone-600">Fallback / status reason</dt>
                <dd className="font-mono text-stone-900" data-testid="diag-reason">
                  {transport.reason || 'None'}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-stone-600">Last turn reply time</dt>
                <dd className="font-mono text-stone-900">
                  {lastLatencyMs !== null ? `${lastLatencyMs} ms` : 'not measured'}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </>
  );
}
