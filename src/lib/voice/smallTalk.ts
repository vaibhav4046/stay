/** Greetings and "how are you" chit-chat: answer like a person, never turn it into a task plan. */
const GREET = /\b(hi|hello|hey|hiya|namaste|hola|bonjour|hallo|sup|yo|good\s+(morning|afternoon|evening|night)|how\s+are\s+you|how'?s\s+it\s+going|what'?s\s+up|how\s+(have|are)\s+you\s+(been|doing)|are\s+you\s+there|can\s+you\s+hear\s+me|thank(s| you)|who\s+are\s+you)\b/i;
const TASKY = /\b(work|clean|email|write|read|study|tax|taxes|dishes|doc|report|homework|laundry|tidy|pay|call|send|finish|start|draft|fix|buy|plan|timer|remind|overwhelm|stuck|focus|procrastinat)\w*/i;

export function isSmallTalk(text: string): boolean {
  const t = (text || '').trim();
  if (!t || t.length > 80) return false;
  return GREET.test(t) && !TASKY.test(t);
}
