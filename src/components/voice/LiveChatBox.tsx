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
  /** a picture shown with this message (kept in memory only) */
  imageUrl?: string;
}

export interface LiveChatBoxProps {
  transcripts: ChatTranscriptEntry[];
  partialUserTranscript?: string;
  liveSpokenText?: string;
  visualState: VoiceVisualState;
  isConnected: boolean;
  detectedLanguage?: string;
  targetTranslationLang?: string;
  isTranslating?: boolean;
  /** Per-turn translation outcome, keyed by transcript id. Never a fabricated string. */
  translations?: Record<string, TranslationEntry>;
  thinkingStatusLine?: string;
  undoNotice?: { label: string; onUndo: () => void } | null;
  onClear?: () => void;
  onWisprAction?: (action: 'scratch' | 'change' | 'repeat' | 'heard') => void;
  onStarterSelect?: (prompt: string) => void;
  onAddKeyterm?: (word: string) => void;
  quietMode?: boolean;
  onToggleQuietMode?: () => void;
  /** Chat-first mode: no card, no header, no inner scroll. The page scrolls; the empty state is the caller's. */
  bare?: boolean;
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
  detectedLanguage = 'en-GB',
  targetTranslationLang,
  isTranslating = false,
  translations = {},
  thinkingStatusLine = 'Finding the smallest first step',
  undoNotice = null,
  onClear,
  onWisprAction,
  onStarterSelect,
  onAddKeyterm,
  quietMode = false,
  onToggleQuietMode,
  bare = false,
  className = '',
}: LiveChatBoxProps) {
  const [isOpen, setIsOpen] = useState(true);
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
    if (!isOpen || bare) return;
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
  }, [transcripts, partialUserTranscript, liveSpokenText, isThinking, isInterrupted, isOpen, bare]);

  // Exact 12-state labels & high-contrast tokens (§6.1, §7.2)
  const statusConfig = (() => {
    if (isInterrupted) {
      return {
        stateCode: 'INTERRUPTED',
        label: 'Interrupted',
        srAnnouncement: 'Interrupted — listening to your thought',
        dotStyle: { backgroundColor: '#F0B35A' },
        textStyle: { color: '#F0B35A' },
      };
    }
    if (visualState === 'transcribing' || isUserSpeaking) {
      return {
        stateCode: 'TRANSCRIBING',
        label: 'Transcribing speech',
        srAnnouncement: 'Transcribing speech',
        dotStyle: { backgroundColor: '#8FD3FF' },
        textStyle: { color: '#8FD3FF' },
      };
    }
    if (isAgentSpeaking) {
      return {
        stateCode: 'SPEAKING',
        label: 'Speaking',
        srAnnouncement: 'Speaking',
        dotStyle: { backgroundColor: '#8FD3FF' },
        textStyle: { color: '#8FD3FF' },
      };
    }
    if (isThinking) {
      return {
        stateCode: 'THINKING',
        label: 'Thinking',
        srAnnouncement: 'Thinking',
        dotStyle: { backgroundColor: '#F0B35A' },
        textStyle: { color: '#F0B35A' },
      };
    }
    if (visualState === 'listening') {
      return {
        stateCode: 'LISTENING',
        label: 'Listening',
        srAnnouncement: 'Listening',
        dotStyle: { backgroundColor: '#8FD3FF' },
        textStyle: { color: '#8FD3FF' },
      };
    }
    if (visualState === 'connecting') {
      return {
        stateCode: 'CONNECTING',
        label: 'CONNECTING',
        srAnnouncement: 'CONNECTING',
        dotStyle: { backgroundColor: '#8FD3FF' },
        textStyle: { color: '#8FD3FF' },
      };
    }
    if (visualState === 'reconnecting') {
      return {
        stateCode: 'RECONNECTING',
        label: 'RECONNECTING',
        srAnnouncement: 'RECONNECTING',
        dotStyle: { backgroundColor: '#F0B35A' },
        textStyle: { color: '#F0B35A' },
      };
    }
    if (visualState === 'paused') {
      return {
        stateCode: 'PAUSED',
        label: 'PAUSED',
        srAnnouncement: 'PAUSED',
        dotStyle: { backgroundColor: '#C5D6E6' },
        textStyle: { color: '#C5D6E6' },
      };
    }
    if (visualState === 'text_only_fallback' || quietMode) {
      return {
        stateCode: 'TEXT_ONLY',
        label: 'TEXT_ONLY',
        srAnnouncement: 'TEXT_ONLY',
        dotStyle: { backgroundColor: '#C5D6E6' },
        textStyle: { color: '#C5D6E6' },
      };
    }
    if (visualState === 'error') {
      return {
        stateCode: 'ERROR',
        label: 'ERROR',
        srAnnouncement: 'ERROR',
        dotStyle: { backgroundColor: '#FF8A80' },
        textStyle: { color: '#FF8A80' },
      };
    }
    if (isConnected) {
      return {
        stateCode: 'LISTENING',
        label: 'LISTENING',
        srAnnouncement: 'LISTENING',
        dotStyle: { backgroundColor: '#8FD3FF' },
        textStyle: { color: '#8FD3FF' },
      };
    }
    return {
      stateCode: 'IDLE',
      label: 'IDLE',
      srAnnouncement: '',
      dotStyle: { backgroundColor: '#C5D6E6' },
      textStyle: { color: '#C5D6E6' },
    };
  })();

  // Announce only state changes and final turns in aria-live="polite", never word-by-word partials (§7.4)
  const lastFinalEntry = transcripts[transcripts.length - 1];
  const politeAnnouncement = lastFinalEntry
    ? `${lastFinalEntry.role === 'user' ? 'You said' : 'Stay said'}: ${lastFinalEntry.text}`
    : statusConfig.srAnnouncement;

  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const getLanguageLabel = (code: string) => {
    if (code.startsWith('hi')) return 'हिन्दी · Hindi';
    if (code.startsWith('es')) return 'Español · Spanish';
    if (code.startsWith('fr')) return 'Français · French';
    if (code.startsWith('de')) return 'Deutsch · German';
    if (code.startsWith('ja')) return '日本語 · Japanese';
    if (code.startsWith('ko')) return '한국어 · Korean';
    if (code.startsWith('it')) return 'Italiano · Italian';
    if (code.startsWith('pt')) return 'Português · Portuguese';
    return 'English · Multilingual';
  };

  return (
    <section
      className={bare ? `relative w-full ${className}` : `card relative w-full overflow-hidden border border-[#1E2B3D] bg-[#0F1620] ${className}`}
      style={bare ? { color: '#EEF6FF' } : { color: '#EEF6FF', backgroundColor: '#0F1620' }}
      aria-label="Live conversation transcripts"
      data-testid="live-chat-box"
    >
      {/* Single polite aria-live region for state transitions and final turns only (§7.4) */}
      <div className="sr-only" aria-live="polite" role="status" data-testid="chat-sr-announcer">
        {politeAnnouncement}
      </div>

      {bare && (
        <div className="mb-2 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5" data-testid="chat-status-pill">
            <span className="h-2 w-2 rounded-full" style={statusConfig.dotStyle} aria-hidden="true" />
            <span className="font-semibold tracking-tight" style={statusConfig.textStyle}>
              {statusConfig.label === 'IDLE' ? 'Ready' : statusConfig.label === 'TEXT_ONLY' ? 'Text only' : statusConfig.label.charAt(0) + statusConfig.label.slice(1).toLowerCase()}
            </span>
          </div>
          {transcripts.length > 0 && onClear && (
            <button type="button" onClick={onClear} className="rounded px-2 py-1 font-medium hover:underline" style={{ color: '#C5D6E6' }} title="Start a new conversation" data-testid="chat-clear-btn">
              New chat
            </button>
          )}
        </div>
      )}

      {/* Header bar with Status, Language Badge, and Controls */}
      {!bare && (
      <div
        className="flex flex-wrap items-center justify-between gap-1.5 px-3.5 py-2 border-b border-[#1E2B3D]"
        style={{ backgroundColor: '#05080C', color: '#EEF6FF' }}
      >
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <div className="flex items-center gap-1.5" data-testid="chat-status-pill">
            <span className="h-2 w-2 rounded-full" style={statusConfig.dotStyle} aria-hidden="true" />
            <span className="text-xs font-semibold tracking-tight truncate" style={statusConfig.textStyle}>
              {statusConfig.label}
            </span>
          </div>

          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.72rem] font-medium border border-[#8FD3FF]/25"
            style={{ backgroundColor: '#12304A', color: '#B8E4FF' }}
            data-testid="chat-language-badge"
            title="Detected speech language"
          >
            <span>{getLanguageLabel(detectedLanguage)}</span>
            {targetTranslationLang && targetTranslationLang !== 'none' && (
              <span>→ {targetTranslationLang.toUpperCase()}</span>
            )}
          </span>

          {transcripts.length > 0 && (
            <span
              className="tnum rounded-full px-1.5 py-0.5 text-[0.72rem] font-medium border border-[#1E2B3D]"
              style={{ backgroundColor: '#1A2433', color: '#C5D6E6' }}
            >
              {transcripts.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {onToggleQuietMode && (
            <button
              type="button"
              onClick={onToggleQuietMode}
              className="text-[0.75rem] font-medium px-2.5 py-1 rounded border transition-colors"
              style={
                quietMode
                  ? { backgroundColor: '#12304A', color: '#B8E4FF', borderColor: '#8FD3FF' }
                  : { backgroundColor: '#0F1620', color: '#C5D6E6', borderColor: '#1E2B3D' }
              }
              title={quietMode ? 'Switch to Duplex Voice' : 'Switch to Text-Only'}
              data-testid="chat-mode-toggle"
            >
              {quietMode ? 'Text only' : 'Voice'}
            </button>
          )}

          {transcripts.length > 0 && onClear && (
            <button
              type="button"
              onClick={onClear}
              className="text-[0.75rem] font-medium hover:underline px-2 py-1 rounded"
              style={{ color: '#C5D6E6' }}
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
            className="p-1 rounded-md hover:bg-[#1A2433] cursor-pointer"
            style={{ color: '#C5D6E6' }}
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
              className={isOpen ? 'rotate-180' : 'rotate-0'}
              aria-hidden="true"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      </div>
      )}

      {/* Undo toast for deterministic Wispr edits (§8.2, 4s fade only) */}
      {undoNotice && (
        <div
          className="flex items-center justify-between gap-2 px-3.5 py-1.5 border-b border-[#1E2B3D] text-xs"
          style={{ backgroundColor: '#1A2433', color: '#EEF6FF' }}
          role="status"
          data-testid="wispr-undo-toast"
        >
          <span>{undoNotice.label}</span>
          <button
            type="button"
            onClick={undoNotice.onUndo}
            className="font-semibold underline px-2 py-0.5 rounded"
            style={{ color: '#8FD3FF' }}
            data-testid="wispr-undo-btn"
          >
            Undo
          </button>
        </div>
      )}

      {/* Collapsed Preview Pill */}
      {!isOpen && (isUserSpeaking || isAgentSpeaking) && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-expanded={false}
          aria-label="Expand live chat to view conversation"
          data-testid="chat-collapsed-preview-btn"
          className="w-full text-left px-3.5 py-2 text-xs border-t border-[#8FD3FF]/20 flex items-center justify-between cursor-pointer"
          style={{ backgroundColor: '#12304A', color: '#EEF6FF' }}
        >
          <span className="truncate">
            {isUserSpeaking ? `You: ${partialUserTranscript}` : `Stay: ${liveSpokenText}`}
          </span>
          <span className="text-[0.72rem] font-semibold shrink-0 ml-2" style={{ color: '#8FD3FF' }}>
            Expand
          </span>
        </button>
      )}

      {/* Expanded Live Conversation Column (§7.3, §7.4) */}
      {isOpen && (
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className={bare ? 'space-y-4' : 'max-h-[42dvh] sm:max-h-[48dvh] overflow-y-auto p-3.5 space-y-3 overscroll-contain'}
          data-testid="chat-message-list"
          role="log"
          aria-live="off"
        >
          {transcripts.length === 0 && !isUserSpeaking && !isAgentSpeaking && !isThinking ? (
            bare ? null : <div
              className="py-5 px-2 text-center flex flex-col items-center gap-3"
              data-testid="chat-empty-state"
              style={{ color: '#EEF6FF' }}
            >
              <p className="font-display text-[1.25rem] font-semibold leading-snug" style={{ color: '#EEF6FF' }}>
                What feels hard to start?
              </p>
              <p className="text-[0.8125rem]" style={{ color: '#C5D6E6' }}>
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
                      style={{ backgroundColor: '#1A2433', color: '#EEF6FF', borderColor: '#1E2B3D' }}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              {(() => {
                const lastUserIndex = transcripts.map((t) => t.role).lastIndexOf('user');
                const lastAgentIndex = transcripts.map((t) => t.role).lastIndexOf('agent');
                return transcripts.map((entry, index) => {
                  const isUser = entry.role === 'user';
                  const isLastUser = index === lastUserIndex;
                  const isLastAgent = index === lastAgentIndex;
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
                        style={{ color: '#C5D6E6' }}
                      >
                        {!isUser && <StayLogo size={13} className="shrink-0" />}
                        <span className="font-medium" style={{ color: '#EEF6FF' }}>
                          {isUser ? 'You' : 'Stay'}
                        </span>
                        {entry.timestamp && <span className="tnum">· {formatTime(entry.timestamp)}</span>}
                        {entry.sourceLanguage && (
                          <span className="uppercase text-[0.7rem] px-1 rounded bg-[#1A2433] border border-[#1E2B3D]">
                            {entry.sourceLanguage}
                          </span>
                        )}
                        {entry.interrupted && (
                          <span
                            className="rounded-full px-2 py-0.5 text-[0.7rem] font-semibold border border-[#F0B35A]/30"
                            style={{ backgroundColor: 'rgba(240,179,90,0.14)', color: '#F0B35A' }}
                            data-testid="turn-interrupted-badge"
                          >
                            Interrupted
                          </span>
                        )}
                        {entry.verbatimText && entry.verbatimText !== entry.text && (
                          <button
                            type="button"
                            onClick={() => setShowVerbatimId(showVerbatimId === entry.id ? null : entry.id)}
                            className="text-[0.72rem] underline ml-1 cursor-pointer"
                            style={{ color: '#8FD3FF' }}
                          >
                            {showVerbatimId === entry.id ? 'Show clean' : 'Show what I heard'}
                          </button>
                        )}
                        {isLastUser && onWisprAction && (
                          <button
                            type="button"
                            onClick={() => onWisprAction('scratch')}
                            className="text-[0.72rem] underline ml-2 cursor-pointer text-[#C5D6E6] hover:text-[#EEF6FF]"
                            data-testid="wispr-scratch-btn"
                            title="Scratch this thought"
                          >
                            Undo
                          </button>
                        )}
                        {isLastAgent && onWisprAction && (
                          <div className="flex items-center gap-2 ml-2">
                            <button
                              type="button"
                              onClick={() => onWisprAction('repeat')}
                              className="text-[0.72rem] underline cursor-pointer text-[#8FD3FF]"
                              data-testid="wispr-repeat-btn"
                              title="Repeat Stay's last response"
                            >
                              Say again
                            </button>
                            <button
                              type="button"
                              onClick={() => onWisprAction('heard')}
                              className="text-[0.72rem] underline cursor-pointer text-[#C5D6E6]"
                              data-testid="wispr-heard-btn"
                              title="Show what Stay heard"
                            >
                              What I heard
                            </button>
                          </div>
                        )}
                      </div>
                    <div
                      className={`bubble stay-pop ${isUser ? 'bubble-user' : 'bubble-agent'} px-4 py-2.5 max-w-[68ch] text-[1.0625rem] leading-[1.55] break-words`}
                      style={
                        {
                              overflowWrap: 'anywhere',
                            }
                      }
                    >
                      {entry.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={entry.imageUrl} alt="What you showed Stay" className="mb-2 max-h-48 w-full rounded-xl object-cover" data-testid="chat-picture" />
                      )}
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
                                    style={{ color: '#EEF6FF', textDecorationColor: '#F0B35A' }}
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
                          className="mt-1.5 pt-1.5 border-t border-[#1E2B3D] text-[0.92rem] leading-snug flex items-start gap-1.5"
                          style={{ color: '#C5D6E6' }}
                          data-testid="turn-translation-line"
                        >
                          <span
                            className="uppercase text-[0.68rem] font-semibold px-1.5 py-0.5 rounded shrink-0 border border-[#1E2B3D]"
                            style={{ backgroundColor: '#0F1620', color: '#C5D6E6' }}
                          >
                            {tx.targetLanguage}
                          </span>
                          <span>{tx.text}</span>
                        </div>
                      )}
                      {tx?.status === 'unavailable' && (
                        <div
                          className="mt-1.5 pt-1.5 border-t border-[#1E2B3D] text-[0.82rem] leading-snug flex items-start gap-1.5"
                          style={{ color: '#C5D6E6' }}
                          data-testid="turn-translation-unavailable"
                        >
                          <span
                            className="uppercase text-[0.66rem] font-semibold px-1.5 py-0.5 rounded shrink-0 border border-[#1E2B3D]"
                            style={{ backgroundColor: '#0F1620', color: '#C5D6E6' }}
                          >
                            {tx.targetLanguage}
                          </span>
                          <span>Not translated ({tx.reason}). Nothing was guessed.</span>
                        </div>
                      )}
                      {tx?.status === 'pending' && (
                        <div
                          className="mt-1.5 pt-1.5 border-t border-[#1E2B3D] text-[0.78rem]"
                          style={{ color: '#C5D6E6' }}
                          data-testid="turn-translation-pending"
                        >
                          translating…
                        </div>
                      )}
                    </div>
                  </div>
                );
              });
            })()}

              {/* Real-time streaming User partial speech in --ink-2 with reserved line-height (§7.4) */}
              {isUserSpeaking && (
                <div className="flex flex-col items-end max-w-full" data-testid="chat-live-user-partial">
                  <div
                    className="flex items-center gap-1.5 mb-1 px-1 text-[0.8125rem] font-medium"
                    style={{ color: '#8FD3FF' }}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#8FD3FF' }} />
                    <span>You (speaking)</span>
                  </div>
                  <div
                    className="bubble bubble-user bubble-live px-4 py-2.5 max-w-[68ch] text-[1.0625rem] leading-[1.55] break-words"
                    style={{ overflowWrap: 'anywhere' }}
                  >
                    <span>{partialUserTranscript}</span>
                  </div>
                </div>
              )}

              {/* Pending indicator, shown only while speech is still coming in (§8.3) */}
              {isTranslating && isUserSpeaking && (
                <div className="text-right text-[0.78rem]" style={{ color: '#C5D6E6' }} data-testid="chat-translating-indicator">
                  will translate when you finish
                </div>
              )}

              {/* Real-time Agent thinking status with user-safe status line (§7.4, §8.4) */}
              {isThinking && (
                <div className="flex flex-col items-start max-w-full" data-testid="chat-live-thinking">
                  <div
                    className="flex items-center gap-1.5 mb-1 px-1 text-[0.8125rem] font-medium"
                    style={{ color: '#F0B35A' }}
                  >
                    <StayLogo size={13} className="shrink-0" />
                    <span>Stay · {thinkingStatusLine}</span>
                    <span className="typing-dots" aria-hidden="true"><i /><i /><i /></span>
                  </div>
                </div>
              )}

              {/* Real-time streaming Agent speech */}
              {showAgentStreamingBubble && (
                <div className="flex flex-col items-start max-w-full" data-testid="chat-live-agent-partial">
                  <div
                    className="flex items-center gap-1.5 mb-1 px-1 text-[0.8125rem] font-medium"
                    style={{ color: '#8FD3FF' }}
                  >
                    <StayLogo size={13} className="shrink-0" />
                    <span>Stay (speaking)</span>
                  </div>
                  <div
                    className="bubble bubble-agent bubble-live px-4 py-2.5 max-w-[68ch] text-[1.0625rem] leading-[1.55] break-words"
                    style={{ overflowWrap: 'anywhere' }}
                  >
                    <span>{liveSpokenText}</span>
                  </div>
                </div>
              )}

              {/* Interrupted notice */}
              {isInterrupted && (
                <div className="py-1 text-center" data-testid="chat-live-interrupted-badge">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#F0B35A]/30 px-2.5 py-0.5 text-[0.75rem] font-medium"
                    style={{ backgroundColor: 'rgba(240,179,90,0.14)', color: '#F0B35A' }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#F0B35A' }} />
                    Interrupted — listening to your thought
                  </span>
                </div>
              )}
            </>
          )}

          {/* Jump to latest control pill (§7.3) */}
          {showJumpToBottom && !bare && (
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
              style={{ backgroundColor: '#8FD3FF', color: '#05080C' }}
              aria-label="Jump to latest"
            >
              <span>Jump to latest</span>
            </button>
          )}
        </div>
      )}
    </section>
  );
}
