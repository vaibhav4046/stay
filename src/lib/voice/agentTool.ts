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
  'dump_end', 'list_edit', 'plan_day', 'break_down', 'step_next', 'wrap_up', 'resume', 'style', 'learning',
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
  description: 'Control the Stay app. Only when the user explicitly asks to open, change, start, stop, remember, forget, park, plan or show something. One action per call. Never save feelings or worries unless they say remember. When the result has "say", speak that line.',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: [...APP_ACTIONS] },
      value: {
        type: 'string',
        description: 'Target/text: screen, lang, voice, colour, orb object, fact to remember (memory_add), thought to park, list item, routine, reminder, task, outcome, on/off. list_edit: spoken change ("move bins to later", "that one is done"). plan_day: energy/time. break_down: the task ("break writing cover letter into steps"). step_next/resume: no value. style: how to talk ("shorter"). learning: on/off.',
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

/** What the person set (style block) and what Stay learned (one line) are optional and empty by default, so the base budget is unchanged. */
export function buildSystemPrompt(persona: VoicePersona, memory: UserMemoryProfile, extra: { style?: string; learned?: string } = {}): string {
  return [
    `You are Stay, a calm friend who helps an adult with ADHD start tasks. Voice: ${persona.name}. ${persona.style}`,
    'ONE short sentence, under 14 words total. Never read lists aloud. When upset or sad ("I feel like a failure"), no tools; say: I hear you, that is hard.',
    'Call app tool for: screen, timer, voice/lang, remember fact ("remember X" = memory_add), change list ("that one is done" = list_edit), brain dump, plan day, break into steps ("break X into steps" = break_down), next step, reminder ("remind me" = remind), wrap up, resume ("pick up" = resume), talk shorter ("talk more briefly" = style, value "minimal"), stop learning ("stop learning" = learning, value "off"), or park ("park it: X" = park). Never call break_down for ordinary avoidance: give ONE 2-minute step. After tool, speak its say line.',
    'If they ramble, name ONE two-minute first step; park the rest only if asked.',
    extra.style,
    'Match their language. Not a therapist; never advise on medication.',
    memoryLine(memory),
    extra.learned,
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
  return [
    'Stay', 'ADHD', 'micro-step', 'parking lot', 'brain dump', 'wall of awful', 'two-minute timer',
    'step next', 'wrap up', 'park it', 'rejection sensitivity', 'Cardamom', 'Chaiwala', 'Taco', 'Mariachi',
    'Lady Lavender', 'Captain Crumpet', 'Biscuit Blitz', 'Marmite Sprocket', 'Waffle Wizard',
    'Countdown Cookie', 'Porch Light', 'Pancake Paladin', 'Arcade Gremlin', 'Velvet Scalpel',
    'Pumpkin Pixel', 'Lantern Iris', 'Compass Reid', 'Couch Rocket', 'Croissant Bandit',
    'Professor Pretzel', 'Fettuccine Maestro', 'Goblin Mode Gus',
  ];
}
