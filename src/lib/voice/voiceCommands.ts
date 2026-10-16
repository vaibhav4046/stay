/**
 * Stay Hands-Free Voice Commands & Speech Intent Detection Engine.
 * Allows users to control timers, pause/resume listening, break down tasks,
 * and record outcomes completely hands-free using natural speech commands.
 */

export type VoiceCommandAction =
  | { type: 'pause_listening' }
  | { type: 'resume_listening' }
  | { type: 'start_timer'; minutes: number }
  | { type: 'break_down' }
  | { type: 'record_outcome'; outcome: 'started' | 'partly_started' | 'not_started' | 'paused_or_stopped' }
  | { type: 'stop_timer' }
  | null;

/**
 * Evaluates live streaming or finalized user speech for immediate voice commands.
 */
export function detectVoiceCommand(text: string): VoiceCommandAction {
  const clean = text.toLowerCase().trim();
  if (!clean || clean.length < 3) return null;

  // 1. Pause / Mute Command ("stay pause", "pause listening", "mute mic", "hold on")
  if (
    /\b(?:stay pause|pause listening|mute microphone|mute mic|hold on(?: a second| a sec)?|one sec stay|stop listening|stay be quiet|pause for a sec)\b/i.test(
      clean
    )
  ) {
    return { type: 'pause_listening' };
  }

  // 2. Resume / Wake Command ("hey stay", "stay listen", "stay resume", "unmute", "i'm back")
  if (
    /\b(?:hey stay|stay listen|stay resume|unmute(?: mic| microphone)?|i'm back(?: stay)?|okay stay|resume listening)\b/i.test(
      clean
    )
  ) {
    return { type: 'resume_listening' };
  }

  // 3. Start Timer Command ("start 20 minutes", "set timer for 15 min", "start the timer")
  const timerMatch = clean.match(
    /\b(?:start|set|do|run)\s+(?:a\s+)?(?:(?:the\s+)?timer\s+(?:for\s+)?)?(\d{1,2})\s*(?:min|minute|minutes)(?:\s+timer|\s+block|\s+sprint)?\b/i
  );
  if (timerMatch && timerMatch[1]) {
    const mins = parseInt(timerMatch[1], 10);
    if (mins >= 1 && mins <= 60) {
      return { type: 'start_timer', minutes: mins };
    }
  }

  if (/\b(?:start timer|start the timer|begin timer|start focus timer)\b/i.test(clean)) {
    return { type: 'start_timer', minutes: 20 };
  }

  // 4. Break Down Task Command ("break this down", "shrink this", "make it smaller")
  if (
    /\b(?:break this down|shrink this|make it smaller|make it ridiculously small|what's the first step|give me step one)\b/i.test(
      clean
    )
  ) {
    return { type: 'break_down' };
  }

  // 5. Outcome Logging Command ("i finished", "i started", "i'm done", "had to stop")
  if (/\b(?:i finished|i'm finished|i'm done|i did it|all done)\b/i.test(clean)) {
    return { type: 'record_outcome', outcome: 'started' };
  }
  if (/\b(?:i started|i got started|started on it)\b/i.test(clean)) {
    return { type: 'record_outcome', outcome: 'started' };
  }
  if (/\b(?:i partly started|partly started|did some of it|halfway started)\b/i.test(clean)) {
    return { type: 'record_outcome', outcome: 'partly_started' };
  }
  if (/\b(?:didn't start|couldn't start|got stuck)\b/i.test(clean)) {
    return { type: 'record_outcome', outcome: 'not_started' };
  }
  if (/\b(?:had to stop|paused or stopped|stopped early|i stopped)\b/i.test(clean)) {
    return { type: 'record_outcome', outcome: 'paused_or_stopped' };
  }

  // 6. Stop Timer Command ("stop timer", "cancel timer")
  if (/\b(?:stop timer|cancel timer|reset timer|stop the timer)\b/i.test(clean)) {
    return { type: 'stop_timer' };
  }

  return null;
}

export const parseVoiceCommand = detectVoiceCommand;
