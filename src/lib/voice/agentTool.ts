/**
 * The agent's whole control surface: ONE compact tool. Every extra tool adds about 0.08 s to every reply (measured),
 * so actions live in an enum instead of separate tool definitions. The system prompt is kept under ~200 tokens for the
 * same reason (long prompts made replies run 9 s instead of 4 s).
 */
import type { UserMemoryProfile } from '@/lib/coach/userMemory';
import { type VoicePersona } from './personas';

export const APP_ACTIONS = [
  'open', 'ground', 'timer_start', 'timer_stop', 'outcome', 'plan', 'shape', 'color', 'language', 'voice',
  'memory_add', 'memory_forget', 'memory_show', 'park', 'park_show', 'dump', 'list_add', 'list_show', 'routine', 'remind', 'quiet', 'game', 'pause', 'export_data', 'delete_data',
] as const;
export type AppActionName = (typeof APP_ACTIONS)[number];

export interface AppActionArgs {
  action: AppActionName;
  value?: string;
  minutes?: number;
  step?: string;
}

export const APP_TOOL = {
  type: 'function',
  name: 'app',
  description: 'Control the Stay app. Call only when the user explicitly asks to open, change, start, stop, remember, forget, park or show something. One action per call. Never save feelings, worries or what they are struggling with unless they say remember. For park, value is the thought to set aside for later, in the user\'s words (park it: call the dentist -> value "call the dentist").',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: [...APP_ACTIONS] },
      value: {
        type: 'string',
        description: 'Target or text: screen (today, history, report, checkin, settings, privacy, memory, voice), language, voice name or gender/accent or random, colour (aurora, sunset, ocean, cyber, emerald, default), object for the orb, fact to remember or forget (or all), thought to park for later, item for the list for today, routine name (morning, leaving, evening), what to check on later, task, outcome (started, partly_started, not_started, paused), game (memory, focus, words) with optional easy/medium/hard, on/off',
      },
      minutes: { type: 'number' },
      step: { type: 'string', description: 'The first tiny step, when planning or starting a timer' },
    },
    required: ['action'],
  },
} as const;

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);

/** One compact line of what Stay knows about the user (top few facts only; the rest is fetched on demand by the tool). */
export function memoryLine(m: UserMemoryProfile): string {
  const bits: string[] = [];
  if (m.name) bits.push(`name ${clip(m.name, 20)}`);
  if (m.roleOrField) bits.push(clip(m.roleOrField, 30));
  bits.push(...m.facts.slice(-6).map((f) => clip(f, 60)));
  const last = m.recentSessionsSummary[0];
  if (last) bits.push(`last task "${clip(last.task, 40)}" ${last.outcome.replace(/_/g, ' ')}`);
  return bits.length ? `Remember: ${bits.join('; ')}.` : '';
}

export function buildSystemPrompt(persona: VoicePersona, memory: UserMemoryProfile): string {
  return [
    `You are Stay, a calm friend who helps an adult with ADHD start tasks. Voice: ${persona.name}. ${persona.style}`,
    'One or two short sentences, at most 15 words. Never read lists aloud. Never talk over a pause.',
    'Call the app tool when asked to open a screen, start or stop a timer, change voice or language, remember, forget, show memory, add to their list, brain dump, start a routine, check in later, or park a thought ("park it: call the dentist" = action park, value the thought). Never for ordinary talk. Confirm briefly.',
    'If they ramble, name ONE two-minute first step; park the rest only if asked.',
    'Match their language. Not a therapist; never advise on medication.',
    memoryLine(memory),
  ].filter(Boolean).join('\n');
}

/** Greetings stay under ~8 words so the first thing the user hears never lasts longer than their patience. */
const GREET_LOCAL: Record<string, { hi: (n: string) => string; resumed: string; ask: string }> = {
  es: { hi: (n) => (n ? `Hola, ${n}.` : 'Hola.'), resumed: 'Sigo aquí contigo.', ask: '¿Qué estás posponiendo?' },
  fr: { hi: (n) => (n ? `Salut ${n}.` : 'Salut.'), resumed: 'Je suis toujours là.', ask: 'Qu’est-ce que tu repousses ?' },
  de: { hi: (n) => (n ? `Hallo ${n}.` : 'Hallo.'), resumed: 'Ich bin noch da.', ask: 'Was schiebst du gerade auf?' },
  it: { hi: (n) => (n ? `Ciao ${n}.` : 'Ciao.'), resumed: 'Sono ancora qui.', ask: 'Cosa stai rimandando?' },
  pt: { hi: (n) => (n ? `Olá, ${n}.` : 'Olá.'), resumed: 'Continuo aqui contigo.', ask: 'O que estás a adiar?' },
};

/** Opening line. A fast-voice session in another language greets in that language (the voice only speaks its own). */
export function buildGreeting(persona: VoicePersona, memory: UserMemoryProfile, resumed = false, lang = 'en'): string {
  const local = GREET_LOCAL[lang];
  if (local) return resumed ? local.resumed : `${local.hi(memory.name ? clip(memory.name, 16) : '')} ${local.ask}`;
  if (resumed) return 'Still here with you.'; // all-day mode renewed the session: do not re-introduce
  const last = memory.recentSessionsSummary[0];
  if (memory.name && last) return `Welcome back, ${clip(memory.name, 16)}. How did ${clip(last.task, 28)} go?`;
  if (last) return `Welcome back. How did ${clip(last.task, 28)} go?`;
  if (memory.name) return `Hi ${clip(memory.name, 16)}. What are you putting off?`;
  return `${persona.name} here. What are you putting off?`;
}

export function appKeyterms(): string[] {
  return ['Stay', 'ADHD', 'micro-step', 'parking lot', 'Crumpet', 'Chaiwala', 'Sprocket', 'Lavender', 'Fettuccine', 'Tornado', 'Pretzel', 'Waffle', 'Outback', 'Croissant', 'Bagel', 'Maple Moose', 'Matcha', 'Viking Velvet', 'Goblin Mode', 'Pumpkin Pixel'];
}
