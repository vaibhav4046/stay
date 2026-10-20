import { describe, expect, it } from 'vitest';
import { DEFAULT_PERSONA_ID, PERSONAS, RECOMMENDED_PERSONAS, personaById, resolvePersona } from '@/lib/voice/personas';
import { APP_ACTIONS, APP_TOOL, buildGreeting, buildSystemPrompt, memoryLine } from '@/lib/voice/agentTool';
import { DEFAULT_USER_MEMORY, type UserMemoryProfile } from '@/lib/coach/userMemory';
import { LIBRARY } from '@/lib/orb/library';

const AAI_VOICES = ['alba', 'eve', 'george', 'jane', 'jean', 'mary', 'michael', 'anna', 'charles', 'paul', 'vera', 'iris', 'reid', 'giovanni', 'lola', 'juergen', 'rafael', 'estelle'];
const ACCENT_ENGINE_VOICES = ['cardamom', 'chaiwala', 'taco', 'mariachi'];
const withMemory = (m: Partial<UserMemoryProfile>): UserMemoryProfile => ({ ...DEFAULT_USER_MEMORY, ...m });

describe('voice personas', () => {
  it('is 22 personas: 18 real AssemblyAI voices plus 4 accent voices from other engines, with unique names', () => {
    expect(PERSONAS.length).toBe(22);
    expect(new Set(PERSONAS.map((p) => p.id)).size).toBe(22);
    expect(new Set(PERSONAS.map((p) => p.name)).size).toBe(22);
    for (const p of PERSONAS) expect([...AAI_VOICES, ...ACCENT_ENGINE_VOICES]).toContain(p.id);
    for (const id of AAI_VOICES) expect(personaById(id).voices[0].engine).toBe('assemblyai');
    for (const id of ACCENT_ENGINE_VOICES) expect(personaById(id).voices.map((v) => v.engine)).toEqual(['azure', 'browser']);
    expect(PERSONAS.some((p) => p.gender === 'male')).toBe(true);
    expect(PERSONAS.some((p) => p.gender === 'female')).toBe(true);
  });
  it('only claims a native language for voices that really speak it, and an accent only where the provider or locale guarantees it', () => {
    const native = PERSONAS.filter((p) => p.lang !== 'en').map((p) => p.id).sort();
    expect(native).toEqual(['estelle', 'giovanni', 'juergen', 'lola', 'mariachi', 'rafael', 'taco']);
    for (const p of PERSONAS.filter((x) => x.voices[0].engine === 'assemblyai' && x.lang === 'en' && !['iris', 'reid'].includes(x.id))) expect(p.voiceLabel).toMatch(/British|American/);
    for (const id of ['iris', 'reid']) expect(personaById(id).voiceLabel).toMatch(/not documented/);
    // AssemblyAI says "Spanish", not "Mexican": the provider voice must not be labelled with a regional accent
    expect(personaById('lola').voices[0].accent).toBe('Spanish');
  });
  it('a persona name never promises an accent its voice does not have', () => {
    const IMPLIES: Array<[RegExp, string]> = [
      [/chai|masala|cardamom|desi|curry|bollywood/i, 'Indian English'],
      [/taco|mariachi|salsa|burrito|nacho|sombrero/i, 'Mexican Spanish'],
      [/scouse|cockney|brummie|geordie|biscuit|crumpet|marmite|lavender/i, 'British'],
      [/outback|aussie|maple|moose|viking|brooklyn|bagel|texas|matcha|sushi/i, 'NONE'],
    ];
    for (const p of PERSONAS) {
      for (const [re, accent] of IMPLIES) {
        if (re.test(p.name)) expect(p.voices[0].accent, p.name + ' -> ' + accent).toBe(accent === 'British' ? 'British' : accent);
      }
    }
    // spot checks of the complaint that started this: no Chaiwala or Taco on the wrong voice
    expect(personaById('paul').name).not.toMatch(/chai/i);
    expect(personaById('lola').name).not.toMatch(/taco/i);
    expect(personaById('chaiwala').voices[0].accent).toBe('Indian English');
    expect(personaById('taco').voices[0].accent).toBe('Mexican Spanish');
  });
  it('recommends four: one Indian English, one Mexican Spanish, and two voices that need no setup', () => {
    const rec = RECOMMENDED_PERSONAS;
    expect(rec).toHaveLength(4);
    expect(rec.some((p) => p.voices[0].accent === 'Indian English')).toBe(true);
    expect(rec.some((p) => p.voices[0].accent === 'Mexican Spanish')).toBe(true);
    expect(rec.filter((p) => p.voices[0].engine === 'assemblyai')).toHaveLength(2);
  });
  it('every persona points at an orb shape that exists', () => {
    const ids = new Set(LIBRARY.map((e) => e.id));
    for (const p of PERSONAS) expect(ids.has(p.shape), `${p.name} -> ${p.shape}`).toBe(true);
  });
  const cases: Array<[string, string | null]> = [
    ['Captain Crumpet', 'charles'], ['crumpet', 'charles'], ['Switch to Goblin Mode Gus', 'rafael'], ['pumpkin', 'jean'], ['Chaiwala Blitz', 'chaiwala'], ['Biscuit Blitz', 'paul'], ['Taco Tornado', 'taco'],
    ['Lady Lavender please', 'anna'], ['charles', 'charles'], ['xyzzy', null], ['', null], ['the', null],
  ];
  it.each(cases)('resolves %s -> %s', (q, id) => expect(resolvePersona(q)?.id ?? null).toBe(id));
  it('resolves by traits and never returns the current voice for "random"', () => {
    const m = resolvePersona('a male british voice');
    expect(m?.gender).toBe('male');
    expect(m?.voiceLabel).toMatch(/British/);
    expect(resolvePersona('the Indian voice')?.voices[0].accent).toBe('Indian English');
    expect(resolvePersona('switch to Mexican Spanish')?.voices[0].accent).toBe('Mexican Spanish');
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
    expect(empty.length).toBeLessThan(780);
    expect(full.length).toBeLessThan(1130); // about 250 tokens with a full memory line
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
