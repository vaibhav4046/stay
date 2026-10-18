import { describe, expect, it } from 'vitest';
import { DEFAULT_PERSONA_ID, PERSONAS, personaById, resolvePersona } from '@/lib/voice/personas';
import { APP_ACTIONS, APP_TOOL, buildGreeting, buildSystemPrompt, memoryLine } from '@/lib/voice/agentTool';
import { DEFAULT_USER_MEMORY, type UserMemoryProfile } from '@/lib/coach/userMemory';
import { LIBRARY } from '@/lib/orb/library';

const PROVIDER_VOICES = ['alba', 'eve', 'george', 'jane', 'jean', 'mary', 'michael', 'anna', 'charles', 'paul', 'vera', 'giovanni', 'lola', 'juergen', 'rafael', 'estelle'];
const withMemory = (m: Partial<UserMemoryProfile>): UserMemoryProfile => ({ ...DEFAULT_USER_MEMORY, ...m });

describe('voice personas', () => {
  it('is 16 personas, one per real provider voice, with unique silly names', () => {
    expect(PERSONAS.length).toBe(16);
    expect(new Set(PERSONAS.map((p) => p.id)).size).toBe(16);
    expect(new Set(PERSONAS.map((p) => p.name)).size).toBe(16);
    for (const p of PERSONAS) expect(PROVIDER_VOICES).toContain(p.id);
    expect(PERSONAS.some((p) => p.gender === 'male')).toBe(true);
    expect(PERSONAS.some((p) => p.gender === 'female')).toBe(true);
  });
  it('only claims a native accent for the five voices that really are native', () => {
    const native = PERSONAS.filter((p) => p.nativeLang).map((p) => p.id).sort();
    expect(native).toEqual(['estelle', 'giovanni', 'juergen', 'lola', 'rafael']);
    for (const p of PERSONAS.filter((x) => !x.nativeLang)) expect(p.voiceLabel).toMatch(/British|American/);
  });
  it('every persona points at an orb shape that exists', () => {
    const ids = new Set(LIBRARY.map((e) => e.id));
    for (const p of PERSONAS) expect(ids.has(p.shape), `${p.name} -> ${p.shape}`).toBe(true);
  });
  const cases: Array<[string, string | null]> = [
    ['Captain Crumpet', 'charles'], ['crumpet', 'charles'], ['Switch to Goblin Mode Gus', 'rafael'], ['pumpkin', 'jean'],
    ['Lady Lavender please', 'anna'], ['charles', 'charles'], ['xyzzy', null], ['', null], ['the', null],
  ];
  it.each(cases)('resolves %s -> %s', (q, id) => expect(resolvePersona(q)?.id ?? null).toBe(id));
  it('resolves by traits and never returns the current voice for "random"', () => {
    const m = resolvePersona('a male british voice');
    expect(m?.gender).toBe('male');
    expect(m?.voiceLabel).toMatch(/British/);
    expect(resolvePersona('female american')?.gender).toBe('female');
    expect(resolvePersona('a Spanish voice')?.id).toBe('lola');
    for (let i = 0; i < 20; i++) expect(resolvePersona('surprise me', 'anna')?.id).not.toBe('anna');
  });
  it('falls back to a safe default', () => expect(personaById('nope').id).toBe(DEFAULT_PERSONA_ID));
});

describe('agent prompt, greeting and tool (latency budget)', () => {
  const persona = personaById('charles');
  it('system prompt stays tiny: long prompts doubled reply time in measurement', () => {
    const empty = buildSystemPrompt(persona, DEFAULT_USER_MEMORY);
    const full = buildSystemPrompt(persona, withMemory({ name: 'Sam', roleOrField: 'product designer', facts: ['dog is called Biscuit', 'works best at 20 minutes', 'dreads tax paperwork', 'prefers mornings', 'sister is Ana'], recentSessionsSummary: [{ task: 'Reply to the landlord about the renewal', outcome: 'partly_started', minutes: 20, timestamp: '2026-10-18' }] }));
    expect(empty.length).toBeLessThan(700);
    expect(full.length).toBeLessThan(1050); // about 250 tokens with a full memory line
    expect(full).toContain('Biscuit');
    expect(full).toContain(persona.name);
  });
  it('a new user gets no invented memory line', () => expect(memoryLine(DEFAULT_USER_MEMORY)).toBe(''));
  it('greeting is short, and remembers a returning user', () => {
    expect(buildGreeting(persona, DEFAULT_USER_MEMORY).split(/\s+/).length).toBeLessThanOrEqual(8);
    const g = buildGreeting(persona, withMemory({ name: 'Sam', recentSessionsSummary: [{ task: 'Reply to the landlord about the renewal', outcome: 'started', minutes: 10, timestamp: 't' }] }));
    expect(g).toContain('Sam');
    expect(g.split(/\s+/).length).toBeLessThanOrEqual(14);
  });
  it('is exactly one tool; destructive actions only open a confirm screen elsewhere', () => {
    expect(APP_TOOL.name).toBe('app');
    expect(APP_TOOL.parameters.properties.action.enum).toEqual([...APP_ACTIONS]);
    expect(JSON.stringify(APP_TOOL).length).toBeLessThan(1700);
  });
});
