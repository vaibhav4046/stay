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

/** The small actions under a message: real buttons, 44px tall, quiet until pointed at. */
// 44px tall to reach, but the extra height is negative margin: the row takes one line, so a reply starting or a turn ending moves nothing
const wisprButton = 'relative -my-3 inline-flex min-h-11 min-w-11 items-center justify-center px-2 text-[0.78rem] text-ink-2 underline underline-offset-4 hover:text-ink';

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
  thinkingStatusLine = 'finding the smallest first step',
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
  // One bubble per reply, revealed as the voice says it. The reply's full text arrives before its audio has played; shown at once it
  // appeared whole, then a second bubble repeated it word by word (field test, 2 Nov 2026). While Stay is speaking that reply, its
  // bubble shows only the words already spoken; the separate live bubble is used only before the reply's text has arrived.
  const squash = (s: string) => s.replace(/\s+/g, ' ').trim();
  const lastAgentEntryIndex = transcripts.map((t) => t.role).lastIndexOf('agent');
  const spokenSoFar = squash(liveSpokenText);
  const speakingEntryIndex =
    isAgentSpeaking && spokenSoFar && lastAgentEntryIndex >= 0 && squash(transcripts[lastAgentEntryIndex].text).startsWith(spokenSoFar)
      ? lastAgentEntryIndex
      : -1;
  const showAgentStreamingBubble =
    isAgentSpeaking &&
    Boolean(spokenSoFar) &&
    speakingEntryIndex < 0 &&
    !transcripts.some((t) => t.role === 'agent' && squash(t.text) === spokenSoFar);
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
        srAnnouncement: 'Interrupted. Listening.',
        textStyle: { color: '#F0B35A' },
      };
    }
    if (visualState === 'transcribing' || isUserSpeaking) {
      return {
        stateCode: 'TRANSCRIBING',
        label: 'Transcribing speech',
        srAnnouncement: 'Transcribing speech',
        textStyle: { color: '#8FD3FF' },
      };
    }
    if (isAgentSpeaking) {
      return {
        stateCode: 'SPEAKING',
        label: 'Speaking',
        srAnnouncement: 'Speaking',
        textStyle: { color: '#8FD3FF' },
      };
    }
    if (isThinking) {
      return {
        stateCode: 'THINKING',
        label: 'Thinking',
        srAnnouncement: 'Thinking',
        textStyle: { color: '#F0B35A' },
      };
    }
    if (visualState === 'listening') {
      return {
        stateCode: 'LISTENING',
        label: 'Listening',
        srAnnouncement: 'Listening',
        textStyle: { color: '#8FD3FF' },
      };
    }
    if (visualState === 'connecting') {
      return {
        stateCode: 'CONNECTING',
        label: 'CONNECTING',
        srAnnouncement: 'CONNECTING',
        textStyle: { color: '#8FD3FF' },
      };
    }
    if (visualState === 'reconnecting') {
      return {
        stateCode: 'RECONNECTING',
        label: 'RECONNECTING',
        srAnnouncement: 'RECONNECTING',
        textStyle: { color: '#F0B35A' },
      };
    }
    if (visualState === 'paused') {
      return {
        stateCode: 'PAUSED',
        label: 'PAUSED',
        srAnnouncement: 'PAUSED',
        textStyle: { color: '#C5D6E6' },
      };
    }
    if (visualState === 'text_only_fallback' || quietMode) {
      return {
        stateCode: 'TEXT_ONLY',
        label: 'TEXT_ONLY',
        srAnnouncement: 'TEXT_ONLY',
        textStyle: { color: '#C5D6E6' },
      };
    }
    if (visualState === 'error') {
      return {
        stateCode: 'ERROR',
        label: 'ERROR',
        srAnnouncement: 'ERROR',
        textStyle: { color: '#FF8A80' },
      };
    }
    if (isConnected) {
      return {
        stateCode: 'LISTENING',
        label: 'LISTENING',
        srAnnouncement: 'LISTENING',
        textStyle: { color: '#8FD3FF' },
      };
    }
    return {
      stateCode: 'IDLE',
      label: 'IDLE',
      srAnnouncement: '',
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
    if (code.startsWith('hi')) return 'Hindi (हिन्दी)';
    if (code.startsWith('es')) return 'Spanish (Español)';
    if (code.startsWith('fr')) return 'French (Français)';
    if (code.startsWith('de')) return 'German (Deutsch)';
    if (code.startsWith('ja')) return 'Japanese (日本語)';
    if (code.startsWith('ko')) return 'Korean (한국어)';
    if (code.startsWith('it')) return 'Italian (Italiano)';
    if (code.startsWith('pt')) return 'Portuguese (Português)';
    return 'English';
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
            <span className="font-semibold tracking-tight" style={statusConfig.textStyle}>
              {statusConfig.label === 'IDLE' ? 'Ready' : statusConfig.label === 'TEXT_ONLY' ? 'Text only' : statusConfig.label.charAt(0) + statusConfig.label.slice(1).toLowerCase()}
            </span>
          </div>
          {transcripts.length > 0 && onClear && (
            <button type="button" onClick={onClear} className="btn btn-ghost !px-3 font-medium hover:underline" style={{ color: '#C5D6E6' }} title="Start a new conversation" data-testid="chat-clear-btn">
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
              title={quietMode ? 'Switch to voice' : 'Switch to text only'}
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
            className="btn btn-ghost !px-3 font-semibold underline"
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
                    index === speakingEntryIndex
                      ? liveSpokenText
                      : showVerbatimId === entry.id && entry.verbatimText ? entry.verbatimText : entry.heardText ?? entry.text;
                  const tx = isUser ? translations[entry.id] : undefined;
                  const hasVerbatim = Boolean(entry.verbatimText && entry.verbatimText !== entry.text);
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
                        {entry.timestamp && formatTime(entry.timestamp) && (
                          <time className="tnum" dateTime={entry.timestamp}>{formatTime(entry.timestamp)}</time>
                        )}
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
                                    title={`Not sure this was heard right (${Math.round((w.confidence ?? 0) * 100)}%). Click to add "${w.word}" to My words.`}
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
                    {(hasVerbatim || (isLastUser && onWisprAction) || (isLastAgent && onWisprAction)) && (
                      <div className={`flex flex-wrap items-center gap-1 ${isUser ? 'justify-end' : ''}`}>
                        {hasVerbatim && (
                          <button
                            type="button"
                            onClick={() => setShowVerbatimId(showVerbatimId === entry.id ? null : entry.id)}
                            className={wisprButton}
                          >
                            {showVerbatimId === entry.id ? 'Show clean' : 'Show what I heard'}
                          </button>
                        )}
                        {isLastUser && onWisprAction && (
                          <button type="button" onClick={() => onWisprAction('scratch')} className={wisprButton} data-testid="wispr-scratch-btn" title="Scratch this thought">
                            Undo
                          </button>
                        )}
                        {isLastAgent && onWisprAction && (
                          <>
                            <button type="button" onClick={() => onWisprAction('repeat')} className={wisprButton} data-testid="wispr-repeat-btn" title="Repeat Stay's last response">
                              Say again
                            </button>
                            <button type="button" onClick={() => onWisprAction('heard')} className={wisprButton} data-testid="wispr-heard-btn" title="Show what Stay heard">
                              What I heard
                            </button>
                          </>
                        )}
                      </div>
                    )}
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
                    <span>Stay is {thinkingStatusLine}</span>
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
                    Interrupted. Listening.
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
