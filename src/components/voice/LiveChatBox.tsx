'use client';

import React, { useState, useEffect, useRef } from 'react';
import type { VoiceVisualState } from '@/types/domain';
import type { TranslationEntry } from '@/lib/voice/translateClient';
import { StayLogo } from '@/components/StayLogo';

export interface ChatWordTiming {
  word: string;
  start: number;
  end: number;
  confidence?: number;
}

export interface ChatTranscriptEntry {
  id: string;
  role: 'user' | 'agent' | 'system';
  text: string;
  verbatimText?: string;
  targetLanguage?: string;
  sourceLanguage?: string;
  engine?: string;
  timestamp?: string;
  interrupted?: boolean;
  heardText?: string;
  unheardText?: string;
  words?: ChatWordTiming[];
}

export interface LiveChatBoxProps {
  transcripts: ChatTranscriptEntry[];
  partialUserTranscript?: string;
  liveSpokenText?: string;
  visualState: VoiceVisualState;
  isConnected: boolean;
  isTranslating?: boolean;
  /** Per-turn translation outcome, keyed by transcript id. Never a fabricated string. */
  translations?: Record<string, TranslationEntry>;
  thinkingStatusLine?: string;
  undoNotice?: { label: string; onUndo: () => void } | null;
  onWisprAction?: (action: 'scratch' | 'change' | 'repeat' | 'heard') => void;
  onStarterSelect?: (prompt: string) => void;
  onAddKeyterm?: (word: string) => void;
  quietMode?: boolean;
  /** Cards that belong to the conversation (plan, timer, outcome, today). They scroll with it. */
  children?: React.ReactNode;
  className?: string;
}

const DEFAULT_STARTERS = [
  'I feel overwhelmed by my to-do list',
  'Help me start a 2-minute block',
  'Help me prepare for my doctor appointment',
];

export function LiveChatBox({
  transcripts,
  partialUserTranscript = '',
  liveSpokenText = '',
  visualState,
  isConnected,
  isTranslating = false,
  translations = {},
  thinkingStatusLine = 'Finding the smallest first step',
  undoNotice = null,
  onWisprAction,
  onStarterSelect,
  onAddKeyterm,
  quietMode = false,
  children,
  className = '',
}: LiveChatBoxProps) {
  const [recentlyInterrupted, setRecentlyInterrupted] = useState(false);
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const [showVerbatimId, setShowVerbatimId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const isNearBottomRef = useRef(true);

  useEffect(() => {
    if (visualState === 'interrupted') {
      setRecentlyInterrupted(true);
      const t = setTimeout(() => setRecentlyInterrupted(false), 3000);
      return () => clearTimeout(t);
    } else if (visualState === 'speaking') {
      setRecentlyInterrupted(false);
    }
  }, [visualState]);

  const isUserSpeaking = Boolean(partialUserTranscript.trim());
  const isAgentSpeaking = visualState === 'speaking';
  const showAgentStreamingBubble =
    isAgentSpeaking &&
    Boolean(liveSpokenText.trim()) &&
    !transcripts.some((t) => t.role === 'agent' && t.text === liveSpokenText.trim());
  const isThinking = visualState === 'thinking';
  const isInterrupted = visualState === 'interrupted' || recentlyInterrupted;
  const hasChildren = React.Children.toArray(children).length > 0;

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 65;
    isNearBottomRef.current = near;
    if (near && showJumpToBottom) {
      setShowJumpToBottom(false);
    }
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    if (isNearBottomRef.current) {
      requestAnimationFrame(() => {
        if (el) {
          el.scrollTop = el.scrollHeight;
        }
      });
      setShowJumpToBottom(false);
    } else {
      setShowJumpToBottom(true);
    }
  }, [transcripts, partialUserTranscript, liveSpokenText, isThinking, isInterrupted, children]);

  // Announce only state changes and final turns in aria-live="polite", never word-by-word partials (§7.4)
  const srStateLabel = (() => {
    if (isInterrupted) return 'Interrupted — listening to your thought';
    if (visualState === 'transcribing' || isUserSpeaking) return 'Transcribing speech';
    if (isAgentSpeaking) return 'Speaking';
    if (isThinking) return 'Thinking';
    if (visualState === 'listening') return 'Listening';
    if (visualState === 'connecting') return 'Connecting';
    if (visualState === 'reconnecting') return 'Reconnecting';
    if (visualState === 'paused') return 'Paused';
    if (visualState === 'text_only_fallback' || quietMode) return 'Text only';
    if (visualState === 'error') return 'Error';
    if (isConnected) return 'Listening';
    return '';
  })();

  const lastFinalEntry = transcripts[transcripts.length - 1];
  const politeAnnouncement = lastFinalEntry
    ? `${lastFinalEntry.role === 'user' ? 'You said' : 'Stay said'}: ${lastFinalEntry.text}`
    : srStateLabel;

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
      className={`card relative flex min-h-0 w-full flex-col overflow-hidden border border-[#E4DFD6] bg-[#FFFFFF] ${className}`}
      style={{ color: '#212422', backgroundColor: '#FFFFFF' }}
      aria-label="Live conversation transcripts"
      data-testid="live-chat-box"
    >
      {/* Single polite aria-live region for state transitions and final turns only (§7.4) */}
      <div className="sr-only" aria-live="polite" role="status" data-testid="chat-sr-announcer">
        {politeAnnouncement}
      </div>

      {/* Undo toast for deterministic Wispr edits (§8.2, 4s fade only) */}
      {undoNotice && (
        <div
          className="flex shrink-0 items-center justify-between gap-2 border-b border-[#E4DFD6] px-3.5 py-1.5 text-xs"
          style={{ backgroundColor: '#F4F1EC', color: '#212422' }}
          role="status"
          data-testid="wispr-undo-toast"
        >
          <span>{undoNotice.label}</span>
          <button
            type="button"
            onClick={undoNotice.onUndo}
            className="font-semibold underline px-2 py-0.5 rounded"
            style={{ color: '#006A67' }}
            data-testid="wispr-undo-btn"
          >
            Undo
          </button>
        </div>
      )}

      {/* The one and only scroll container: transcript, live partials, then the cards for this turn. */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-3 overscroll-contain"
        data-testid="chat-message-list"
        role="log"
        aria-live="off"
      >
        {transcripts.length === 0 && !isUserSpeaking && !isAgentSpeaking && !isThinking && !hasChildren ? (
          <div
            className="py-6 px-2 text-center flex flex-col items-center gap-3"
            data-testid="chat-empty-state"
            style={{ color: '#212422' }}
          >
            <p className="font-display text-[1.25rem] font-semibold leading-snug" style={{ color: '#212422' }}>
              What feels hard to start?
            </p>
            <p className="text-[0.875rem]" style={{ color: '#4A4F4B' }}>
              Speak or type one messy thought. Stay turns it into one tiny step.
            </p>
            {onStarterSelect && (
              <div className="flex flex-wrap justify-center gap-2 mt-1" data-testid="empty-starter-chips">
                {DEFAULT_STARTERS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => onStarterSelect(prompt)}
                    className="chip text-[0.85rem] !min-h-[38px] !py-1.5 !px-3"
                    style={{ backgroundColor: '#F4F1EC', color: '#212422', borderColor: '#E4DFD6' }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {transcripts.map((entry) => {
              const isUser = entry.role === 'user';
              const displayText =
                showVerbatimId === entry.id && entry.verbatimText ? entry.verbatimText : entry.heardText ?? entry.text;
              const tx = isUser ? translations[entry.id] : undefined;
              return (
                <div
                  key={entry.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-full`}
                  data-testid={isUser ? 'chat-user-message' : 'chat-agent-message'}
                >
                  <div
                    className="flex items-center gap-1.5 mb-1 px-1 text-[0.8125rem]"
                    style={{ color: '#4A4F4B' }}
                  >
                    {!isUser && <StayLogo size={13} className="shrink-0" />}
                    <span className="font-medium" style={{ color: '#212422' }}>
                      {isUser ? 'You' : 'Stay'}
                    </span>
                    {entry.timestamp && <span className="tnum">· {formatTime(entry.timestamp)}</span>}
                    {entry.sourceLanguage && (
                      <span className="uppercase text-[0.7rem] px-1 rounded bg-[#F4F1EC] border border-[#E4DFD6]">
                        {entry.sourceLanguage}
                      </span>
                    )}
                    {entry.interrupted && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[0.7rem] font-semibold border border-[#B45309]/30"
                        style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}
                        data-testid="turn-interrupted-badge"
                      >
                        Interrupted
                      </span>
                    )}
                    {entry.verbatimText && entry.verbatimText !== entry.text && (
                      <button
                        type="button"
                        onClick={() => setShowVerbatimId(showVerbatimId === entry.id ? null : entry.id)}
                        className="text-[0.72rem] underline ml-1"
                        style={{ color: '#006A67' }}
                      >
                        {showVerbatimId === entry.id ? 'Show clean' : 'Show what I heard'}
                      </button>
                    )}
                    {isUser && onWisprAction && (
                      <button
                        type="button"
                        onClick={() => onWisprAction('scratch')}
                        className="text-[0.72rem] underline ml-2 cursor-pointer hover:text-ink"
                        style={{ color: '#4A4F4B' }}
                        data-testid="wispr-scratch-btn"
                        title="Scratch this thought"
                      >
                        Scratch that
                      </button>
                    )}
                    {!isUser && onWisprAction && (
                      <div className="flex items-center gap-2 ml-2">
                        <button
                          type="button"
                          onClick={() => onWisprAction('repeat')}
                          className="text-[0.72rem] underline cursor-pointer"
                          style={{ color: '#006A67' }}
                          data-testid="wispr-repeat-btn"
                          title="Repeat Stay's last response"
                        >
                          Repeat
                        </button>
                        <button
                          type="button"
                          onClick={() => onWisprAction('heard')}
                          className="text-[0.72rem] underline cursor-pointer"
                          style={{ color: '#4A4F4B' }}
                          data-testid="wispr-heard-btn"
                          title="Show what Stay heard"
                        >
                          What you heard
                        </button>
                      </div>
                    )}
                  </div>
                  <div
                    className="rounded-[12px] px-3.5 py-2.5 max-w-[68ch] text-[1.0625rem] leading-[1.55] break-words border"
                    style={
                      isUser
                        ? {
                            backgroundColor: '#E4F0EF',
                            color: '#212422',
                            borderColor: 'rgba(0, 106, 103, 0.28)',
                            overflowWrap: 'anywhere',
                          }
                        : {
                            backgroundColor: '#F4F1EC',
                            color: '#212422',
                            borderColor: '#E4DFD6',
                            overflowWrap: 'anywhere',
                          }
                    }
                  >
                    {entry.words && entry.words.some((w) => typeof w.confidence === 'number' && w.confidence < 0.6) ? (
                      <span>
                        {entry.words.map((w, idx) => {
                          const lowConf = typeof w.confidence === 'number' && w.confidence < 0.6;
                          return (
                            <React.Fragment key={`${w.word}-${idx}`}>
                              {lowConf ? (
                                <button
                                  type="button"
                                  onClick={() => onAddKeyterm?.(w.word.replace(/[^\p{L}\p{N}-]/gu, ''))}
                                  className="underline decoration-dotted underline-offset-4 cursor-pointer font-medium"
                                  style={{ color: '#212422', textDecorationColor: '#B45309' }}
                                  title={`Low confidence (${Math.round((w.confidence ?? 0) * 100)}%) — click to add "${w.word}" to My words`}
                                  data-testid="low-confidence-word"
                                >
                                  {w.word}
                                </button>
                              ) : (
                                <span>{w.word}</span>
                              )}
                              {idx < entry.words!.length - 1 ? ' ' : ''}
                            </React.Fragment>
                          );
                        })}
                      </span>
                    ) : (
                      <span>{displayText}</span>
                    )}

                    {/* Translation line under the original in --ink-2 with language tag (§7.4, §8.3).
                        Only a real translation is shown; a failed attempt says so. */}
                    {tx?.status === 'ok' && (
                      <div
                        className="mt-1.5 pt-1.5 border-t border-[#E4DFD6] text-[0.92rem] leading-snug flex items-start gap-1.5"
                        style={{ color: '#4A4F4B' }}
                        data-testid="turn-translation-line"
                      >
                        <span
                          className="uppercase text-[0.68rem] font-semibold px-1.5 py-0.5 rounded shrink-0 border border-[#E4DFD6]"
                          style={{ backgroundColor: '#FFFFFF', color: '#4A4F4B' }}
                        >
                          {tx.targetLanguage}
                        </span>
                        <span>{tx.text}</span>
                      </div>
                    )}
                    {tx?.status === 'unavailable' && (
                      <div
                        className="mt-1.5 pt-1.5 border-t border-[#E4DFD6] text-[0.82rem] leading-snug flex items-start gap-1.5"
                        style={{ color: '#4A4F4B' }}
                        data-testid="turn-translation-unavailable"
                      >
                        <span
                          className="uppercase text-[0.66rem] font-semibold px-1.5 py-0.5 rounded shrink-0 border border-[#E4DFD6]"
                          style={{ backgroundColor: '#FFFFFF', color: '#4A4F4B' }}
                        >
                          {tx.targetLanguage}
                        </span>
                        <span>Not translated ({tx.reason}). Nothing was guessed.</span>
                      </div>
                    )}
                    {tx?.status === 'pending' && (
                      <div
                        className="mt-1.5 pt-1.5 border-t border-[#E4DFD6] text-[0.78rem]"
                        style={{ color: '#4A4F4B' }}
                        data-testid="turn-translation-pending"
                      >
                        translating…
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Real-time streaming User partial speech in --ink-2 with reserved line-height (§7.4) */}
            {isUserSpeaking && (
              <div className="flex flex-col items-end max-w-full" data-testid="chat-live-user-partial">
                <div
                  className="flex items-center gap-1.5 mb-1 px-1 text-[0.8125rem] font-medium"
                  style={{ color: '#006A67' }}
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#006A67' }} aria-hidden="true" />
                  <span>You (speaking)</span>
                </div>
                <div
                  className="rounded-[12px] px-3.5 py-2.5 max-w-[68ch] text-[1.0625rem] leading-[1.55] break-words border border-[#006A67]/30"
                  style={{ backgroundColor: '#FAF8F5', color: '#4A4F4B', overflowWrap: 'anywhere' }}
                >
                  <span>{partialUserTranscript}</span>
                </div>
              </div>
            )}

            {/* Pending indicator, shown only while speech is still coming in (§8.3) */}
            {isTranslating && isUserSpeaking && (
              <div className="text-right text-[0.78rem]" style={{ color: '#4A4F4B' }} data-testid="chat-translating-indicator">
                will translate when you finish
              </div>
            )}

            {/* Real-time Agent thinking status with user-safe status line (§7.4, §8.4) */}
            {isThinking && (
              <div className="flex flex-col items-start max-w-full" data-testid="chat-live-thinking">
                <div
                  className="flex items-center gap-1.5 mb-1 px-1 text-[0.8125rem] font-medium"
                  style={{ color: '#B45309' }}
                >
                  <StayLogo size={13} className="shrink-0" />
                  <span>Stay · {thinkingStatusLine}</span>
                </div>
              </div>
            )}

            {/* Real-time streaming Agent speech */}
            {showAgentStreamingBubble && (
              <div className="flex flex-col items-start max-w-full" data-testid="chat-live-agent-partial">
                <div
                  className="flex items-center gap-1.5 mb-1 px-1 text-[0.8125rem] font-medium"
                  style={{ color: '#006A67' }}
                >
                  <StayLogo size={13} className="shrink-0" />
                  <span>Stay (speaking)</span>
                </div>
                <div
                  className="rounded-[12px] px-3.5 py-2.5 max-w-[68ch] text-[1.0625rem] leading-[1.55] break-words border border-[#E4DFD6]"
                  style={{ backgroundColor: '#F4F1EC', color: '#212422', overflowWrap: 'anywhere' }}
                >
                  <span>{liveSpokenText}</span>
                </div>
              </div>
            )}

            {/* Interrupted notice */}
            {isInterrupted && (
              <div className="py-1 text-center" data-testid="chat-live-interrupted-badge">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#B45309]/30 px-2.5 py-0.5 text-[0.75rem] font-medium"
                  style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#B45309' }} aria-hidden="true" />
                  Interrupted — listening to your thought
                </span>
              </div>
            )}

            {/* Plan, timer, outcome, and today cards live inside the conversation, not beside it. */}
            {children}
          </>
        )}

        {/* Jump to latest control pill (§7.3) */}
        {showJumpToBottom && (
          <button
            type="button"
            onClick={() => {
              const el = scrollRef.current;
              if (el) {
                el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
                setShowJumpToBottom(false);
                isNearBottomRef.current = true;
              }
            }}
            data-testid="chat-jump-latest"
            className="sticky bottom-1 float-right flex items-center gap-1 rounded-full text-[0.75rem] font-medium px-3 py-1 shadow-sm cursor-pointer z-10"
            style={{ backgroundColor: '#006A67', color: '#FFFFFF' }}
            aria-label="Jump to latest"
          >
            <span>Jump to latest</span>
          </button>
        )}
      </div>
    </section>
  );
}
