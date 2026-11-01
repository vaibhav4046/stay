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

  const isAai = transport.mode === 'assemblyai';
  // neutral by default; amber only when something other than AssemblyAI is speaking (R5: never silent)
  const badgeTone =
    transport.mode === 'device' || transport.mode === 'backup'
      ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
      : 'bg-surface text-ink border-line';
  const rest = isAai ? transport.label.replace(/^AssemblyAI\s*/, '') : transport.label;
  const lastLatencyMs = replyTimes.length > 0 ? Math.round(replyTimes[replyTimes.length - 1] * 1000) : null;

  return (
    <>
      <button
        type="button"
        data-testid="transport-badge"
        data-transport-mode={transport.mode}
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${badgeTone}`}
        title="See voice connection details"
        aria-label={`Voice transport: ${transport.label}. Click for diagnostics.`}
      >
        {isAai && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/assemblyai-logo.svg" alt="" aria-hidden="true" width={80} height={14} className="h-3.5 w-auto" />
            <span className="sr-only">AssemblyAI </span>
          </>
        )}
        {rest && <span>{rest}</span>}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Voice connection details"
            data-testid="diagnostics-sheet"
            className="w-full max-w-md rounded-2xl border border-line bg-surface p-5 text-ink shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h2 className="text-base font-semibold text-ink">Voice connection</h2>
                <p className="text-xs text-ink-2">What is listening and speaking right now. If it is not AssemblyAI, it says so.</p>
              </div>
              <button
                type="button"
                data-testid="close-diagnostics"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-ink hover:bg-surface-2"
              >
                Close
              </button>
            </div>

            <dl className="mt-4 space-y-2.5 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-ink-2">Who is speaking</dt>
                <dd className="font-mono font-semibold text-ink" data-testid="diag-transport-label">
                  {transport.label}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-ink-2">Status</dt>
                <dd className="font-mono text-ink">{isConnected ? 'Connected' : 'Idle / Disconnected'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-ink-2">Listening model</dt>
                <dd className="font-mono text-ink" data-testid="diag-stt-model">
                  {transport.sttModel} ({transport.sttSampleRate} Hz)
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-ink-2">Speaking model</dt>
                <dd className="font-mono text-ink" data-testid="diag-tts-model">
                  {transport.ttsModel} ({transport.ttsSampleRate} Hz)
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-ink-2">Voice</dt>
                <dd className="font-mono text-ink" data-testid="diag-voice-id">
                  {transport.voiceId}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-ink-2">Last disconnect code</dt>
                <dd className="font-mono text-ink" data-testid="diag-close-code">
                  {transport.lastCloseCode !== null ? String(transport.lastCloseCode) : 'None'}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-ink-2">Reason, if not AssemblyAI</dt>
                <dd className="font-mono text-ink" data-testid="diag-reason">
                  {transport.reason || 'None'}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-ink-2">Last reply time</dt>
                <dd className="font-mono text-ink">
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
