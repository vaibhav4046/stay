/**
 * Deterministic Wispr-inspired voice commands & Keyterms manager (§8.2)
 * Handles edits, backtrack actions and custom vocabulary BEFORE invoking the LLM.
 */

export interface WisprCommandResult {
  handled: boolean;
  action?:
    | 'scratch'
    | 'change'
    | 'repeat'
    | 'heard'
    | 'shorter'
    | 'remove_fillers'
    | 'translate'
    | 'keep_original'
    | 'switch_language';
  argument?: string;
  cleanText?: string;
}

const FILLERS = /\b(um|uh|erm|like|you know|sort of|kind of|i mean|basically|actually)\b/gi;

/**
 * Parses user speech for deterministic Wispr editing commands.
 */
export function parseWisprCommand(text: string): WisprCommandResult {
  const t = text.trim();
  const lower = t.toLowerCase();

  // "scratch that" / "scratch"
  if (/^(?:scratch\s+that|scratch|erase\s+that|cancel\s+that)[.!]?$/i.test(t)) {
    return { handled: true, action: 'scratch' };
  }

  // "actually, change that to ..." / "actually change to ..." / "actually ..."
  const changeMatch = t.match(/^(?:actually,?\s+(?:change\s+(?:that\s+)?to\s+)?|no\s+wait,?\s+)(.+)$/i);
  if (changeMatch && changeMatch[1]?.trim()) {
    return {
      handled: true,
      action: 'change',
      argument: changeMatch[1].trim(),
    };
  }

  // "repeat the last thing" / "repeat that" / "say that again"
  if (/^(?:repeat(?:\s+the\s+last\s+thing|\s+that)?|say\s+that\s+again|what\s+did\s+you\s+say)[.!]?$/i.test(t)) {
    return { handled: true, action: 'repeat' };
  }

  // "show me what you heard" / "show what you heard" / "what did you hear"
  if (/^(?:show(?:\s+me)?\s+what\s+you\s+heard|what\s+did\s+you\s+hear)[.!]?$/i.test(t)) {
    return { handled: true, action: 'heard' };
  }

  // "make that shorter" / "shorter please"
  if (/^(?:make\s+that\s+shorter|shorter\s+please|shorten\s+that)[.!]?$/i.test(t)) {
    return { handled: true, action: 'shorter' };
  }

  // "remove the filler words" / "clean up filler words"
  if (/^(?:remove\s+(?:the\s+)?filler\s+words|clean\s+up\s+fillers)[.!]?$/i.test(t)) {
    return { handled: true, action: 'remove_fillers' };
  }

  // "translate that" / "translate this"
  if (/^(?:translate\s+(?:that|this)|translate)[.!]?$/i.test(t)) {
    return { handled: true, action: 'translate' };
  }

  // "keep the original language" / "don't translate"
  if (/^(?:keep\s+the\s+original\s+language|don'?t\s+translate|original\s+language)[.!]?$/i.test(t)) {
    return { handled: true, action: 'keep_original' };
  }

  // "use English / Spanish / French / German / Italian / Portuguese / Hindi"
  const langMatch = lower.match(
    /\buse\s+(english|spanish|french|german|italian|portuguese|hindi)\b|\bswitch\s+to\s+(english|spanish|french|german|italian|portuguese|hindi)\b/
  );
  if (langMatch) {
    const lang = (langMatch[1] || langMatch[2])?.toLowerCase();
    return { handled: true, action: 'switch_language', argument: lang };
  }

  return { handled: false, cleanText: removeFillerWords(t) };
}

/**
 * Removes vocal filler words ("um", "uh", "you know") while preserving grammar.
 */
export function removeFillerWords(text: string): string {
  return text
    .replace(FILLERS, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,?!])/g, '$1')
    .trim();
}

/** Keyterms / "My words" storage (§8.2, max 100 entries, 'stay:keyterms:v1') */
const KEYTERMS_STORAGE_KEY = 'stay:keyterms:v1';
const MAX_KEYTERMS = 100;

export function loadMyWords(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEYTERMS_STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (Array.isArray(list)) {
      return list.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, MAX_KEYTERMS);
    }
  } catch {
    // fallback empty
  }
  return [];
}

export function saveMyWords(words: string[]): string[] {
  const sanitized = Array.from(
    new Set(
      words
        .map((w) => w.trim())
        .filter((w) => w.length > 0 && w.length <= 60)
    )
  ).slice(0, MAX_KEYTERMS);

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(KEYTERMS_STORAGE_KEY, JSON.stringify(sanitized));
    } catch {
      // storage quota or private mode
    }
  }
  return sanitized;
}

export function addMyWord(word: string): string[] {
  const current = loadMyWords();
  const trimmed = word.trim();
  if (!trimmed) return current;
  return saveMyWords([trimmed, ...current]);
}

export function removeMyWord(word: string): string[] {
  const current = loadMyWords();
  const lower = word.trim().toLowerCase();
  return saveMyWords(current.filter((w) => w.toLowerCase() !== lower));
}
