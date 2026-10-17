/**
 * Stay Hands-Free Voice Commands & Speech Intent Detection Engine.
 * Allows users to control timers, pause/resume listening, break down tasks,
 * toggle quiet mode, change voices, and inspect memory / history completely hands-free.
 */

export type VoiceCommandAction =
  | { type: 'pause_listening' }
  | { type: 'resume_listening' }
  | { type: 'start_timer'; minutes: number }
  | { type: 'break_down' }
  | { type: 'record_outcome'; outcome: 'started' | 'partly_started' | 'not_started' | 'paused_or_stopped' }
  | { type: 'stop_timer' }
  | { type: 'show_memory' }
  | { type: 'show_history' }
  | { type: 'open_grounding' }
  | { type: 'change_voice'; voiceId: string }
  | { type: 'open_voice_menu' }
  | { type: 'toggle_quiet_mode' }
  | { type: 'clear_chat' }
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

  // 3. Show Memory ("show me the memory", "open memory", "what do you remember about me")
  if (
    /\b(?:show\s+(?:me\s+)?(?:the\s+|my\s+)?memory|open\s+(?:the\s+|my\s+)?memory|view\s+memory|what\s+do\s+you\s+remember(?:\s+about\s+me)?|inspect\s+memory)\b/i.test(
      clean
    )
  ) {
    return { type: 'show_memory' };
  }

  // 4. Show History / Chat ("show history", "open history", "show chat history", "past sessions", "recent tasks")
  if (
    /\b(?:show\s+(?:chat\s+)?history|open\s+(?:chat\s+)?history|view\s+history|past\s+sessions|recent\s+tasks|show\s+sessions)\b/i.test(
      clean
    )
  ) {
    return { type: 'show_history' };
  }

  // 5. Grounding / Somatic ("stay ground me", "open grounding", "help me breathe", "box breathing", "calm down")
  if (
    /\b(?:(?:stay\s+)?ground\s+me|open\s+grounding|help\s+me\s+breathe|box\s+breathing|take\s+a\s+breath|calm\s+down)\b/i.test(
      clean
    )
  ) {
    return { type: 'open_grounding' };
  }

  // 6. Change Voice ("change voice to oliver", "switch to male voice", "change voice to anna", "switch voice")
  const voiceMatch =
    clean.match(/\b(?:change|switch|set)\s+(?:the\s+)?voice(?:\s+to)?\s+(anna|oliver|amanda|charles|rachel|josh|male|female)\b/i) ||
    clean.match(/\b(?:change|switch|set|use)\s+(?:to\s+)?(anna|oliver|amanda|charles|rachel|josh|male|female)\s+voice\b/i);
  if (voiceMatch && voiceMatch[1]) {
    const target = voiceMatch[1].toLowerCase();
    const resolvedId = target === 'male' ? 'oliver' : target === 'female' ? 'anna' : target;
    return { type: 'change_voice', voiceId: resolvedId };
  }
  if (/\b(?:change voice|switch voice|voice settings|select voice|choose voice)\b/i.test(clean)) {
    return { type: 'open_voice_menu' };
  }

  // 7. Toggle Quiet Mode ("quiet mode", "turn on quiet mode", "text only mode")
  if (
    /\b(?:quiet\s+mode|turn\s+on\s+quiet\s+mode|switch\s+to\s+quiet(?:\s+mode)?|text\s+only(?:\s+mode)?)\b/i.test(
      clean
    )
  ) {
    return { type: 'toggle_quiet_mode' };
  }

  // 8. Clear Chat / Start Over ("clear chat", "start over", "reset task", "new task")
  if (
    /\b(?:clear\s+(?:the\s+)?(?:chat|task|screen)|start\s+over|reset\s+(?:the\s+)?task|new\s+task)\b/i.test(
      clean
    )
  ) {
    return { type: 'clear_chat' };
  }

  // 9. Start Timer Command ("start 20 minutes", "set timer for 15 min", "start the timer")
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

  // 10. Break Down Task Command ("break this down", "shrink this", "make it smaller")
  if (
    /\b(?:break this down|shrink this|make it smaller|make it ridiculously small|what's the first step|give me step one)\b/i.test(
      clean
    )
  ) {
    return { type: 'break_down' };
  }

  // 11. Outcome Logging Command ("i finished", "i started", "i'm done", "had to stop")
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

  // 12. Stop Timer Command ("stop timer", "cancel timer")
  if (/\b(?:stop timer|cancel timer|reset timer|stop the timer)\b/i.test(clean)) {
    return { type: 'stop_timer' };
  }

  return null;
}

export const parseVoiceCommand = detectVoiceCommand;
