/**
 * Stay Persistent User Memory & Cognitive Profile Engine.
 * Gives Stay long-term memory across sessions: tracks user name, role/context,
 * personal ADHD triggers, past task breakthroughs, and habits.
 * Injected into both real-time voice and text model system prompts.
 */

import { noteStatedAvoidance } from '@/lib/coach/learnings';

export interface UserMemoryProfile {
  name: string | null;
  roleOrField: string | null;
  coreTriggers: string[];
  knownStrengths: string[];
  facts: string[];
  recentSessionsSummary: Array<{
    task: string;
    outcome: string;
    minutes: number;
    timestamp: string;
  }>;
  lastActive: string;
}

const MEMORY_STORAGE_KEY = 'stay_user_memory_v1';

/** A new user starts with an empty memory: nothing is "known" until they say it or finish a session. */
export const DEFAULT_USER_MEMORY: UserMemoryProfile = {
  name: null,
  roleOrField: null,
  coreTriggers: [],
  knownStrengths: [],
  facts: [],
  recentSessionsSummary: [],
  lastActive: new Date().toISOString(),
};

/**
 * Loads the user's permanent memory profile from browser storage.
 */
export function loadUserMemory(): UserMemoryProfile {
  const freshDefaults: UserMemoryProfile = {
    name: null,
    roleOrField: null,
    coreTriggers: [...DEFAULT_USER_MEMORY.coreTriggers],
    knownStrengths: [...DEFAULT_USER_MEMORY.knownStrengths],
    facts: [...DEFAULT_USER_MEMORY.facts],
    recentSessionsSummary: [],
    lastActive: new Date().toISOString(),
  };
  if (typeof window === 'undefined') {
    return freshDefaults;
  }
  try {
    const raw = localStorage.getItem(MEMORY_STORAGE_KEY);
    if (!raw) return freshDefaults;
    const parsed = JSON.parse(raw) as Partial<UserMemoryProfile>;
    return {
      ...freshDefaults,
      ...parsed,
      coreTriggers: Array.isArray(parsed.coreTriggers) ? parsed.coreTriggers : freshDefaults.coreTriggers,
      knownStrengths: Array.isArray(parsed.knownStrengths) ? parsed.knownStrengths : freshDefaults.knownStrengths,
      facts: Array.isArray(parsed.facts) ? parsed.facts : freshDefaults.facts,
      recentSessionsSummary: Array.isArray(parsed.recentSessionsSummary)
        ? parsed.recentSessionsSummary
        : freshDefaults.recentSessionsSummary,
    };
  } catch {
    return freshDefaults;
  }
}

/**
 * Persists updated memory profile to storage.
 */
export function saveUserMemory(profile: UserMemoryProfile): void {
  if (typeof window === 'undefined') return;
  try {
    profile.lastActive = new Date().toISOString();
    localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // ignore quota errors
  }
}

/**
 * Automatically extracts semantic memories, preferences, names, and triggers
 * from live user utterances without requiring manual data entry.
 */
export function extractMemoriesFromUtterance(text: string): {
  profile: UserMemoryProfile;
  extractedFact?: string;
} {
  const profile = loadUserMemory();
  const lower = text.toLowerCase().trim();
  let extractedFact: string | undefined;

  // 1. Detect Name ("my name is X", "I'm X", "call me X")
  const nameMatch = text.match(/\b(?:my name is|call me|i am|i'm)\s+([A-Z][a-z]+)\b/);
  if (nameMatch && nameMatch[1] && !['Sorry', 'Just', 'Trying', 'Stuck', 'Really', 'Here', 'Not', 'Ready'].includes(nameMatch[1])) {
    profile.name = nameMatch[1];
    extractedFact = `Learned user name: ${nameMatch[1]}`;
  }

  // 2. Detect Role / Context ("I am a developer", "I'm a student", "I work as a software engineer")
  const roleMatch = text.match(
    /\b(?:i am a|i'm a|i work as a|i work in)\s+([a-zA-Z\s]+?)(?:\s+(?:and|with|who|but|at)\b|[.,\n]|$)/i
  );
  if (roleMatch && roleMatch[1]) {
    const role = roleMatch[1].trim();
    if (!profile.roleOrField && role.length >= 3 && role.length <= 32) {
      profile.roleOrField = role;
      extractedFact = `Learned user role/context: ${role}`;
    }
  }

  // 3. Detect Avoidance Triggers ("I hate doing X", "I struggle with X", "X is killing me", "avoiding X")
  const triggerMatch = text.match(/\b(?:i struggle with|i hate doing|i'm dreading|always put off|avoiding)\s+([a-zA-Z\s]{3,30})/i);
  if (triggerMatch && triggerMatch[1]) {
    const trigger = triggerMatch[1].trim();
    if (!profile.coreTriggers.some((t) => t.toLowerCase() === trigger.toLowerCase())) {
      profile.coreTriggers.unshift(trigger);
      profile.coreTriggers = profile.coreTriggers.slice(0, 8);
      extractedFact = `Learned avoidance trigger: ${trigger}`;
    }
  }

  // 4. Detect Specific Breakthroughs / Preferences ("X really helped", "I work best with X")
  const prefMatch = text.match(/\b(?:i work best with|what helps is|i prefer|works well for me)\s+([a-zA-Z0-9\s-]{3,35})/i);
  if (prefMatch && prefMatch[1]) {
    const pref = prefMatch[1].trim();
    if (!profile.knownStrengths.some((s) => s.toLowerCase() === pref.toLowerCase())) {
      profile.knownStrengths.unshift(pref);
      profile.knownStrengths = profile.knownStrengths.slice(0, 8);
      extractedFact = `Learned user preference: ${pref}`;
    }
  }

  noteStatedAvoidance(text); // keeps the exact quote as evidence for the Memory screen; a no-op when learning is off
  saveUserMemory(profile);
  return { profile, extractedFact };
}

/**
 * Records an episodic session memory after a task focus block.
 */
export function recordSessionMemory(params: {
  task: string;
  outcome: string;
  minutes: number;
}): UserMemoryProfile {
  const profile = loadUserMemory();
  profile.recentSessionsSummary.unshift({
    task: params.task.slice(0, 120),
    outcome: params.outcome,
    minutes: params.minutes,
    timestamp: new Date().toISOString(),
  });
  profile.recentSessionsSummary = profile.recentSessionsSummary.slice(0, 10);
  saveUserMemory(profile);
  return profile;
}

/**
 * Adds an explicit memory fact supplied directly by the user.
 */
export function addUserMemoryFact(fact: string): UserMemoryProfile {
  const trimmed = fact.trim();
  if (!trimmed) return loadUserMemory();
  const profile = loadUserMemory();
  if (!profile.facts.includes(trimmed)) {
    profile.facts.unshift(trimmed);
    profile.facts = profile.facts.slice(0, 15);
  }
  saveUserMemory(profile);
  return profile;
}

/**
 * Removes a memory item by index or type.
 */
export function removeUserMemoryFact(index: number): UserMemoryProfile {
  const profile = loadUserMemory();
  profile.facts.splice(index, 1);
  saveUserMemory(profile);
  return profile;
}

/**
 * Clears all user memories and restores defaults.
 */
export function clearAllUserMemories(): UserMemoryProfile {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(MEMORY_STORAGE_KEY);
  }
  return loadUserMemory();
}

/**
 * Builds the comprehensive AGI Memory System Prompt block.
 * Injected into both Voice Agent WebSocket and /api/coach/plan.
 */
export function buildMemorySystemPrompt(profile: UserMemoryProfile): string {
  const nameLine = profile.name ? `• User's Name: ${profile.name} (Address them warmly by name!).` : '• User Name: Not yet shared.';
  const roleLine = profile.roleOrField ? `• Work / Life Context: ${profile.roleOrField}.` : '';
  const triggers = profile.coreTriggers.map((t) => `"${t}"`).join(', ');
  const strengths = profile.knownStrengths.map((s) => `"${s}"`).join(', ');
  const facts = profile.facts.map((f) => `• ${f}`).join('\n');

  const recentSessions = profile.recentSessionsSummary.length > 0
    ? profile.recentSessionsSummary
        .slice(0, 3)
        .map((s) => `• "${s.task}" (${s.minutes}m block) -> ${s.outcome}`)
        .join('\n')
    : '• No prior sessions recorded yet.';

  return `
[STAY PERSISTENT USER MEMORY & AGI KNOWLEDGE GRAPH]
${nameLine}
${roleLine ? roleLine + '\n' : ''}• Known ADHD Avoidance Traps: ${triggers || 'None recorded'}.
• Known Working Strengths: ${strengths || 'None recorded'}.
• User Facts & Insights:
${facts || '• None recorded.'}
• Recent Task History (Episodic Memory):
${recentSessions}
• Memory Guidance: Naturally reference their context, past successes, or name when appropriate. Never say "According to my memory bank"—speak with natural, genuine human recollection.
`.trim();
}

/** Removes one stated trigger or helpful thing by position, so nothing Stay holds about the person is hidden from them. */
export function removeUserMemoryList(list: 'coreTriggers' | 'knownStrengths', index: number): UserMemoryProfile {
  const profile = loadUserMemory();
  profile[list].splice(index, 1);
  saveUserMemory(profile);
  return profile;
}
