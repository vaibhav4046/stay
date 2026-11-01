'use client';

import React, { useEffect, useRef, useState } from 'react';
import { StayLogo } from '@/components/StayLogo';
import type { VoiceTranscriptEntry } from '@/lib/voice/useVoiceAgent';
import type { VoiceVisualState } from '@/types/domain';

export interface LiveChatBoxProps {
  transcripts: VoiceTranscriptEntry[];
  partialUserTranscript?: string;
  liveSpokenText?: string;
  visualState: VoiceVisualState;
  isConnected: boolean;
  onClear?: () => void;
  className?: string;
}

export function LiveChatBox({
  transcripts,
  partialUserTranscript = '',
  liveSpokenText = '',
  visualState,
  isConnected,
  onClear,
  className = '',
}: LiveChatBoxProps) {
  const [isOpen, setIsOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const isUserSpeaking = Boolean(partialUserTranscript.trim());
  const isAgentSpeaking =
    visualState === 'speaking' &&
    Boolean(liveSpokenText.trim()) &&
    !transcripts.some((t) => t.role === 'agent' && t.text === liveSpokenText.trim());
  const isThinking = visualState === 'thinking';
  const isInterrupted = visualState === 'interrupted';

  const totalEntries = transcripts.length + (isUserSpeaking ? 1 : 0) + (isAgentSpeaking ? 1 : 0);

  // Auto-scroll whenever messages update or live text streams
  useEffect(() => {
    if (!isOpen) return;
    const el = scrollRef.current;
    if (el) {
      el.scrollTo({
        top: el.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [transcripts, partialUserTranscript, liveSpokenText, isThinking, isInterrupted, isOpen]);

  // Status badge config
  const statusConfig = (() => {
    if (isInterrupted) {
      return {
        label: 'Interrupted',
        dotClass: 'bg-amber-500 animate-pulse',
        textClass: 'text-amber-700 dark:text-amber-300',
      };
    }
    if (isUserSpeaking) {
      return {
        label: 'Transcribing speech...',
        dotClass: 'bg-emerald-500 animate-ping',
        textClass: 'text-emerald-700 dark:text-emerald-300',
      };
    }
    if (isAgentSpeaking) {
      return {
        label: 'Stay speaking...',
        dotClass: 'bg-indigo-500 animate-pulse',
        textClass: 'text-indigo-700 dark:text-indigo-300',
      };
    }
    if (isThinking) {
      return {
        label: 'Thinking...',
        dotClass: 'bg-purple-500 animate-bounce',
        textClass: 'text-purple-700 dark:text-purple-300',
      };
    }
    if (isConnected) {
      return {
        label: 'Live',
        dotClass: 'bg-emerald-500',
        textClass: 'text-emerald-700 dark:text-emerald-300',
      };
    }
    return {
      label: 'Conversation history',
      dotClass: 'bg-stone-400',
      textClass: 'text-ink-3',
    };
  })();

  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <section
      className={`card w-full overflow-hidden transition-all duration-300 ease-out border border-line/90 bg-surface/90 shadow-sm backdrop-blur-md dark:bg-stone-900/90 ${className}`}
      aria-label="Live conversation transcripts"
      data-testid="live-chat-box"
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-line/60 bg-surface-2/60 dark:bg-stone-800/40">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5" data-testid="chat-status-pill">
            <span className={`h-2 w-2 rounded-full ${statusConfig.dotClass}`} aria-hidden="true" />
            <span className={`text-xs font-semibold tracking-tight truncate ${statusConfig.textClass}`}>
              {statusConfig.label}
            </span>
          </div>
          {transcripts.length > 0 && (
            <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[0.68rem] font-medium text-ink-3 border border-line/60">
              {transcripts.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {transcripts.length > 0 && onClear && (
            <button
              type="button"
              onClick={onClear}
              className="text-[0.72rem] font-medium text-ink-3 hover:text-ink hover:underline px-2 py-1 rounded transition-colors"
              title="Clear transcript history"
              data-testid="chat-clear-btn"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            aria-expanded={isOpen}
            className="p-1 rounded-md text-ink-3 hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer"
            aria-label={isOpen ? 'Collapse live chat' : 'Expand live chat'}
            data-testid="chat-toggle-btn"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : 'rotate-0'}`}
              aria-hidden="true"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      </div>

      {/* Collapsed Preview Pill (when user minimized chat but speaking) */}
      {!isOpen && (isUserSpeaking || isAgentSpeaking) && (
        <div
          onClick={() => setIsOpen(true)}
          className="px-3.5 py-2 text-xs text-ink-2 bg-primary/5 border-t border-primary/20 flex items-center justify-between cursor-pointer hover:bg-primary/10 transition-colors"
        >
          <span className="truncate italic">
            {isUserSpeaking ? `You: ${partialUserTranscript}` : `Stay: ${liveSpokenText}`}
          </span>
          <span className="text-[0.68rem] text-primary font-medium shrink-0 ml-2">Click to expand</span>
        </div>
      )}

      {/* Expanded Live Chat Stream */}
      {isOpen && (
        <div
          ref={scrollRef}
          className="max-h-60 sm:max-h-72 overflow-y-auto p-3 space-y-2.5 text-sm scroll-smooth overscroll-contain"
          data-testid="chat-message-list"
          role="log"
          aria-live="polite"
        >
          {transcripts.length === 0 && !isUserSpeaking && !isAgentSpeaking && !isThinking ? (
            <div className="py-6 text-center text-xs text-ink-3 flex flex-col items-center gap-1.5" data-testid="chat-empty-state">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-ink-3 opacity-60">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span>Speak or type to begin. Transcripts will stream here in real time.</span>
            </div>
          ) : (
            <>
              {transcripts.map((entry) => {
                const isUser = entry.role === 'user';
                return (
                  <div
                    key={entry.id}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-full`}
                    data-testid={isUser ? 'chat-user-message' : 'chat-agent-message'}
                  >
                    <div className="flex items-center gap-1.5 mb-1 px-1 text-[0.7rem] text-ink-3">
                      {!isUser && <StayLogo size={13} className="shrink-0" />}
                      <span className="font-medium text-ink-2">{isUser ? 'You' : 'Stay'}</span>
                      {entry.timestamp && <span>· {formatTime(entry.timestamp)}</span>}
                    </div>
                    <div
                      className={`rounded-2xl px-3.5 py-2 max-w-[88%] text-[0.88rem] leading-relaxed break-words shadow-2xs ${
                        isUser
                          ? 'rounded-tr-xs bg-primary/10 text-ink dark:text-stone-100 border border-primary/20'
                          : 'rounded-tl-xs bg-surface-2 text-ink dark:text-stone-100 border border-line/80'
                      }`}
                    >
                      {entry.text}
                    </div>
                  </div>
                );
              })}

              {/* Real-time streaming User partial speech */}
              {isUserSpeaking && (
                <div
                  className="flex flex-col items-end max-w-full animate-fade-in"
                  data-testid="chat-live-user-partial"
                >
                  <div className="flex items-center gap-1.5 mb-1 px-1 text-[0.7rem] text-emerald-600 dark:text-emerald-400 font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                    <span>You (speaking...)</span>
                  </div>
                  <div className="rounded-2xl rounded-tr-xs bg-emerald-500/10 text-ink dark:text-stone-100 border border-emerald-500/30 px-3.5 py-2 max-w-[88%] text-[0.88rem] leading-relaxed break-words shadow-2xs">
                    <span className="italic">{partialUserTranscript}</span>
                    <span className="inline-block w-1.5 h-3.5 bg-emerald-600 dark:bg-emerald-400 ml-1 translate-y-0.5 animate-pulse" />
                  </div>
                </div>
              )}

              {/* Real-time Agent thinking status */}
              {isThinking && (
                <div className="flex flex-col items-start max-w-full" data-testid="chat-live-thinking">
                  <div className="flex items-center gap-1.5 mb-1 px-1 text-[0.7rem] text-purple-600 dark:text-purple-400 font-medium">
                    <StayLogo size={13} className="shrink-0" />
                    <span>Stay is thinking</span>
                  </div>
                  <div className="rounded-2xl rounded-tl-xs bg-surface-2 border border-line px-3.5 py-2 text-[0.88rem] flex items-center gap-1 text-ink-3">
                    <span className="h-1.5 w-1.5 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}

              {/* Real-time streaming Agent speech */}
              {isAgentSpeaking && (
                <div
                  className="flex flex-col items-start max-w-full animate-fade-in"
                  data-testid="chat-live-agent-partial"
                >
                  <div className="flex items-center gap-1.5 mb-1 px-1 text-[0.7rem] text-indigo-600 dark:text-indigo-400 font-medium">
                    <StayLogo size={13} className="shrink-0" />
                    <span>Stay (speaking...)</span>
                  </div>
                  <div className="rounded-2xl rounded-tl-xs bg-indigo-500/10 text-ink dark:text-stone-100 border border-indigo-500/30 px-3.5 py-2 max-w-[88%] text-[0.88rem] leading-relaxed break-words shadow-2xs">
                    <span>{liveSpokenText}</span>
                    <span className="inline-block w-1.5 h-3.5 bg-indigo-600 dark:bg-indigo-400 ml-1 translate-y-0.5 animate-pulse" />
                  </div>
                </div>
              )}

              {/* Interrupted notice */}
              {isInterrupted && (
                <div className="py-1 text-center" data-testid="chat-live-interrupted-badge">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 text-[0.7rem] font-medium text-amber-700 dark:text-amber-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    Interrupted — listening to your thought
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
