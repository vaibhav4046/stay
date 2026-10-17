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
  | { type: 'change_language'; langCode: string; langName: string }
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

  // 7. Change Language ("switch to Spanish", "speak Hindi", "habla español", "parle français", "auto detect language")
  if (/\b(?:auto\s+(?:detect\s+)?language|detect\s+language(?:\s+automatically)?|auto\s+language)\b/i.test(clean)) {
    return { type: 'change_language', langCode: 'auto', langName: 'Auto Detect' };
  }
  if (/\b(?:switch\s+to\s+spanish|speak\s+(?:in\s+)?spanish|cambiar\s+a\s+español|habla\s+(?:en\s+)?español)\b/i.test(clean)) {
    return { type: 'change_language', langCode: 'es-ES', langName: 'Spanish' };
  }
  if (/\b(?:switch\s+to\s+hindi|speak\s+(?:in\s+)?hindi|हिन्दी\s*में\s*बोलो|hindi\s+me\s+(?:baat\s+karo|bolo))\b/i.test(clean)) {
    return { type: 'change_language', langCode: 'hi-IN', langName: 'Hindi' };
  }
  if (/\b(?:switch\s+to\s+french|speak\s+(?:in\s+)?french|parle\s+(?:en\s+)?français|changer\s+en\s+français)\b/i.test(clean)) {
    return { type: 'change_language', langCode: 'fr-FR', langName: 'French' };
  }
  if (/\b(?:switch\s+to\s+german|speak\s+(?:in\s+)?german|sprich\s+deutsch|auf\s+deutsch)\b/i.test(clean)) {
    return { type: 'change_language', langCode: 'de-DE', langName: 'German' };
  }
  if (/\b(?:switch\s+to\s+japanese|speak\s+(?:in\s+)?japanese|日本語で話して|nihongo)\b/i.test(clean)) {
    return { type: 'change_language', langCode: 'ja-JP', langName: 'Japanese' };
  }
  if (/\b(?:switch\s+to\s+chinese|speak\s+(?:in\s+)?chinese|说中文|普通话)\b/i.test(clean)) {
    return { type: 'change_language', langCode: 'zh-CN', langName: 'Chinese' };
  }
  if (/\b(?:switch\s+to\s+italian|speak\s+(?:in\s+)?italian|parla\s+italiano)\b/i.test(clean)) {
    return { type: 'change_language', langCode: 'it-IT', langName: 'Italian' };
  }
  if (/\b(?:switch\s+to\s+portuguese|speak\s+(?:in\s+)?portuguese|fale\s+português)\b/i.test(clean)) {
    return { type: 'change_language', langCode: 'pt-PT', langName: 'Portuguese' };
  }
  if (/\b(?:switch\s+to\s+russian|speak\s+(?:in\s+)?russian|говори\s+по-русски)\b/i.test(clean)) {
    return { type: 'change_language', langCode: 'ru-RU', langName: 'Russian' };
  }
  if (/\b(?:switch\s+to\s+arabic|speak\s+(?:in\s+)?arabic|تكلم\s+بالعربية)\b/i.test(clean)) {
    return { type: 'change_language', langCode: 'ar-SA', langName: 'Arabic' };
  }
  if (/\b(?:switch\s+to\s+korean|speak\s+(?:in\s+)?korean|한국어로\s*말해줘)\b/i.test(clean)) {
    return { type: 'change_language', langCode: 'ko-KR', langName: 'Korean' };
  }
  if (/\b(?:switch\s+to\s+english|speak\s+(?:in\s+)?english|default\s+language)\b/i.test(clean)) {
    return { type: 'change_language', langCode: 'en-GB', langName: 'English' };
  }
  const generalLangMatch = clean.match(/\b(?:switch|change|set)\s+(?:the\s+)?language\s+(?:to\s+)?([a-z]+)\b/i);
  if (generalLangMatch && generalLangMatch[1]) {
    const raw = generalLangMatch[1].toLowerCase();
    const map: Record<string, [string, string]> = {
      spanish: ['es-ES', 'Spanish'],
      hindi: ['hi-IN', 'Hindi'],
      french: ['fr-FR', 'French'],
      german: ['de-DE', 'German'],
      italian: ['it-IT', 'Italian'],
      portuguese: ['pt-PT', 'Portuguese'],
      japanese: ['ja-JP', 'Japanese'],
      chinese: ['zh-CN', 'Chinese'],
      korean: ['ko-KR', 'Korean'],
      dutch: ['nl-NL', 'Dutch'],
      russian: ['ru-RU', 'Russian'],
      turkish: ['tr-TR', 'Turkish'],
      polish: ['pl-PL', 'Polish'],
      arabic: ['ar-SA', 'Arabic'],
      swedish: ['sv-SE', 'Swedish'],
      norwegian: ['no-NO', 'Norwegian'],
      danish: ['da-DK', 'Danish'],
      finnish: ['fi-FI', 'Finnish'],
      greek: ['el-GR', 'Greek'],
      czech: ['cs-CZ', 'Czech'],
      romanian: ['ro-RO', 'Romanian'],
      hungarian: ['hu-HU', 'Hungarian'],
      ukrainian: ['uk-UA', 'Ukrainian'],
      vietnamese: ['vi-VN', 'Vietnamese'],
      thai: ['th-TH', 'Thai'],
      indonesian: ['id-ID', 'Indonesian'],
      malay: ['ms-MY', 'Malay'],
      hebrew: ['he-IL', 'Hebrew'],
      bengali: ['bn-BD', 'Bengali'],
      tamil: ['ta-IN', 'Tamil'],
      telugu: ['te-IN', 'Telugu'],
      english: ['en-GB', 'English'],
      auto: ['auto', 'Auto Detect'],
    };
    if (map[raw]) {
      return { type: 'change_language', langCode: map[raw][0], langName: map[raw][1] };
    }
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
