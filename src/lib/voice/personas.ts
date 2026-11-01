/**
 * Voice personas. Every persona is a real voice plus a one-line personality, and its name never claims an accent the
 * voice does not have: a British voice does not get a "Chaiwala" name, a voice with an undocumented accent does not get a
 * "Taco" name. Accents come from the provider's documentation (AssemblyAI lists British / American / five native
 * languages) or from the locale of the voice (Azure en-IN, es-MX; the device's own en-IN / es-MX voices).
 *
 * A persona lists its voices in order of preference. The first one this device and this person's settings can use wins:
 * e.g. Indian English is Azure Neural when the person added an Azure key, else the device's own en-IN voice, else the
 * persona is shown as "needs setup" (never silently replaced with a British voice).
 */
import type { SpeechLang, TtsCaps, VoiceRef } from './tts/types';
import { pickBrowserVoice } from './tts/browserVoices';

export interface VoicePersona {
  /** Stable id. For AssemblyAI personas this is the provider's voice id (also what is stored in localStorage). */
  id: string;
  /** Plain, respectful name + accent description (§7.7). */
  name: string;
  /** Optional spoken/legacy aliases for voice resolution. */
  aliases?: string[];
  gender: 'female' | 'male';
  /** What the voice really is. */
  voiceLabel: string;
  /** Short personality line added to the agent's prompt (kept under 20 words for latency). */
  style: string;
  /** Orb shape (a built-in library id) the orb morphs into when this persona takes over. */
  shape: string;
  /** The language this persona speaks. */
  lang: SpeechLang;
  /** Voices in order of preference. */
  voices: VoiceRef[];
  /** Part of the short, curated list at the top of the picker. */
  recommended: boolean;
  nativeLang: SpeechLang | null;
}

const aai = (voice: string, lang: SpeechLang, locale: string, accent: string): VoiceRef => ({ engine: 'assemblyai', voice, lang, locale, accent });
const azure = (voice: string, lang: SpeechLang, locale: string, accent: string): VoiceRef => ({ engine: 'azure', voice, lang, locale, accent });
const browser = (lang: SpeechLang, locale: string, accent: string): VoiceRef => ({ engine: 'browser', voice: '', lang, locale, accent });

const BRIT = (v: string) => aai(v, 'en', 'en-GB', 'British');
const AMER = (v: string) => aai(v, 'en', 'en-US', 'American');
const UNLABELLED = (v: string) => aai(v, 'en', 'en', 'English, accent not documented');

type Seed = Omit<VoicePersona, 'lang' | 'recommended' | 'voices' | 'nativeLang'> & { voices: VoiceRef[]; recommended?: boolean; nativeLang?: SpeechLang | null };
const make = (s: Seed): VoicePersona => ({ ...s, lang: s.voices[0].lang, recommended: s.recommended ?? false, nativeLang: s.nativeLang ?? (s.voices[0].lang !== 'en' ? s.voices[0].lang : null) });

export const PERSONAS: VoicePersona[] = [
  // British (AssemblyAI §2.4)
  make({ id: 'anna', name: 'Adrienne', aliases: ['Lady Lavender', 'Adrienne', 'Anna'], gender: 'female', voiceLabel: 'calm, British (AssemblyAI)', style: 'Soft and calm. Slows everything down when you are overwhelmed.', shape: 'moon', voices: [BRIT('anna')], recommended: true }),
  make({ id: 'charles', name: 'Oliver', aliases: ['Captain Crumpet', 'Oliver', 'Charles'], gender: 'male', voiceLabel: 'steady, British (AssemblyAI)', style: 'Calm and composed. Keeps your to-do list orderly and unhurried.', shape: 'cup', voices: [BRIT('charles')] }),
  make({ id: 'paul', name: 'Paul', aliases: ['Biscuit Blitz', 'Paul'], gender: 'male', voiceLabel: 'upbeat, British (AssemblyAI)', style: 'Quick and upbeat. Encourages two-minute sprints.', shape: 'bolt', voices: [BRIT('paul')] }),
  make({ id: 'vera', name: 'Vera', aliases: ['Marmite Sprocket', 'Vera'], gender: 'female', voiceLabel: 'grounded, British (AssemblyAI)', style: 'Direct and clear, no waffle. Keeps you grounded.', shape: 'key', voices: [BRIT('vera')] }),
  // American (AssemblyAI §2.4)
  make({ id: 'jane', name: 'Jane', aliases: ['Waffle Wizard', 'Jane'], gender: 'female', voiceLabel: 'warm, American (AssemblyAI)', style: 'Warm late-night focus companion.', shape: 'star', voices: [AMER('jane')] }),
  make({ id: 'eve', name: 'Audrey', aliases: ['Countdown Cookie', 'Audrey', 'Eve'], gender: 'female', voiceLabel: 'calm, American (AssemblyAI)', style: 'Direct and zero-nonsense. Counts you down: three, two, one.', shape: 'clock', voices: [AMER('eve')], recommended: true }),
  make({ id: 'george', name: 'Blake', aliases: ['Porch Light', 'Blake', 'George'], gender: 'male', voiceLabel: 'easygoing, American (AssemblyAI)', style: 'Laid-back. Makes starting tasks feel low-stakes.', shape: 'sun', voices: [AMER('george')] }),
  make({ id: 'michael', name: 'Michael', aliases: ['Pancake Paladin', 'Michael'], gender: 'male', voiceLabel: 'polite, American (AssemblyAI)', style: 'Polite and steady. Acknowledges every small step.', shape: 'tree', voices: [AMER('michael')] }),
  make({ id: 'alba', name: 'Alba', aliases: ['Arcade Gremlin', 'Alba'], gender: 'female', voiceLabel: 'brisk, American (AssemblyAI)', style: 'Brisk, focused pace for clearing your inbox.', shape: 'game', voices: [AMER('alba')] }),
  make({ id: 'mary', name: 'Mary', aliases: ['Velvet Scalpel', 'Mary'], gender: 'female', voiceLabel: 'clear, American (AssemblyAI)', style: 'Minimalist. Strips ten tasks down to one.', shape: 'mountain', voices: [AMER('mary')] }),
  make({ id: 'jean', name: 'Jean', aliases: ['Pumpkin Pixel', 'Jean'], gender: 'female', voiceLabel: 'gentle, American (AssemblyAI)', style: 'Gentle encouragement, never pressure.', shape: 'sprout', voices: [AMER('jean')] }),
  // Other English accents mapped via §2.4 in FastSocket
  make({ id: 'iris', name: 'Iris', aliases: ['Lantern Iris', 'Iris'], gender: 'female', voiceLabel: 'English voice, accent not documented', style: 'Quiet and steady. Lights the next small step.', shape: 'bulb', voices: [UNLABELLED('iris')] }),
  make({ id: 'reid', name: 'Reid', aliases: ['Compass Reid', 'Reid'], gender: 'male', voiceLabel: 'English voice, accent not documented', style: 'Plain-spoken guide. Points at the next step and waits.', shape: 'target', voices: [UNLABELLED('reid')] }),
  // Native-language voices (AssemblyAI §2.4)
  make({ id: 'lola', name: 'Camila', aliases: ['Couch Rocket', 'Camila', 'Lola'], gender: 'female', voiceLabel: 'warm, Spanish (AssemblyAI)', style: 'Warm Spanish coach for starting when stuck.', shape: 'rocket', voices: [aai('lola', 'es', 'es', 'Spanish')] }),
  make({ id: 'estelle', name: 'Claire', aliases: ['Croissant Bandit', 'Claire', 'Estelle'], gender: 'female', voiceLabel: 'calm, French (AssemblyAI)', style: 'Calm French companion. Gently nudges you off distractions.', shape: 'heart', voices: [aai('estelle', 'fr', 'fr', 'French')] }),
  make({ id: 'juergen', name: 'Greta', aliases: ['Professor Pretzel', 'Greta', 'Juergen'], gender: 'male', voiceLabel: 'steady, German (AssemblyAI)', style: 'Methodical. Breaks big projects into small steps.', shape: 'bulb', voices: [aai('juergen', 'de', 'de', 'German')] }),
  make({ id: 'giovanni', name: 'Marco', aliases: ['Fettuccine Maestro', 'Marco', 'Giovanni'], gender: 'male', voiceLabel: 'expressive, Italian (AssemblyAI)', style: 'Warm and expressive. Keeps momentum steady.', shape: 'note', voices: [aai('giovanni', 'it', 'it', 'Italian')] }),
  make({ id: 'rafael', name: 'Lucas', aliases: ['Goblin Mode Gus', 'Lucas', 'Rafael'], gender: 'male', voiceLabel: 'warm, Portuguese (AssemblyAI)', style: 'Supportive peer: just do ninety seconds first.', shape: 'target', voices: [aai('rafael', 'pt', 'pt', 'Portuguese')] }),
  // Regional accent voices (Indian English, Mexican Spanish)
  make({
    id: 'cardamom', name: 'Kavya', aliases: ['Cardamom Calm', 'Kavya'], gender: 'female', voiceLabel: 'calm, Indian English voice',
    style: 'Warm and unhurried. Turns a pile of tasks into one gentle next step.', shape: 'lotus', recommended: true,
    voices: [azure('en-IN-NeerjaNeural', 'en', 'en-IN', 'Indian English'), browser('en', 'en-IN', 'Indian English')],
  }),
  make({
    id: 'chaiwala', name: 'Andrew', aliases: ['Chaiwala Blitz', 'Andrew'], gender: 'male', voiceLabel: 'calm, Indian English (AssemblyAI)',
    style: 'Calm and steady. Encourages two-minute sprints.', shape: 'bolt',
    voices: [aai('chaiwala', 'en', 'en-IN', 'Indian English'), azure('en-IN-PrabhatNeural', 'en', 'en-IN', 'Indian English'), browser('en', 'en-IN', 'Indian English')],
  }),
  make({
    id: 'taco', name: 'Constanza', aliases: ['Taco Tornado', 'Constanza'], gender: 'female', voiceLabel: 'warm, Mexican Spanish (AssemblyAI)',
    style: 'Warm coach. Helps you start in Mexican Spanish.', shape: 'rocket', recommended: true,
    voices: [aai('taco', 'es', 'es-MX', 'Mexican Spanish'), azure('es-MX-DaliaNeural', 'es', 'es-MX', 'Mexican Spanish'), browser('es', 'es-MX', 'Mexican Spanish')],
  }),
  make({
    id: 'mariachi', name: 'Mateo', aliases: ['Mariachi Metronome', 'Mateo'], gender: 'male', voiceLabel: 'steady, Mexican Spanish (AssemblyAI)',
    style: 'Steady rhythm. Keeps you moving one step at a time.', shape: 'note',
    voices: [aai('mariachi', 'es', 'es-MX', 'Mexican Spanish'), azure('es-MX-JorgeNeural', 'es', 'es-MX', 'Mexican Spanish'), browser('es', 'es-MX', 'Mexican Spanish')],
  }),
];

export const DEFAULT_PERSONA_ID = 'anna';
export const personaById = (id: string): VoicePersona => PERSONAS.find((p) => p.id === id) ?? (PERSONAS.find((p) => p.id === DEFAULT_PERSONA_ID) as VoicePersona);
export const RECOMMENDED_PERSONAS = PERSONAS.filter((p) => p.recommended);

/** Language -> the AssemblyAI native voice, the automatic choice when the person switches language. */
export const NATIVE_PERSONA_FOR_LANG: Record<string, string> = { es: 'lola', fr: 'estelle', de: 'juergen', it: 'giovanni', pt: 'rafael' };

// ---- availability and the voice actually used --------------------------------------------------------------------

export interface VoiceChoice {
  /** The voice that will speak, or null when none of the persona's voices is usable here. */
  ref: VoiceRef | null;
  /** For a browser voice: the installed voice's name. */
  browserVoiceName?: string;
  /** Why it is not available, in words the person can act on. */
  needs?: string;
}

/** The first of a persona's voices this device and these settings can use. */
export function chooseVoice(persona: VoicePersona, caps: TtsCaps): VoiceChoice {
  for (const ref of persona.voices) {
    if (ref.engine === 'assemblyai') return { ref };
    if (ref.engine === 'azure' && caps.azure) return { ref };
    if (ref.engine === 'browser') {
      const m = pickBrowserVoice(caps.browserVoices, ref.locale, persona.gender);
      if (m) return { ref, browserVoiceName: m.voice.name };
    }
  }
  const locale = persona.voices[0].locale;
  const label = persona.voices[0].accent;
  return { ref: null, needs: `Needs an Azure Speech key (Settings, voice) or a ${label} (${locale}) voice installed on this device.` };
}

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N} ]+/gu, ' ').replace(/\s+/g, ' ').trim();

const ACCENT_WORDS: Array<[RegExp, string]> = [
  [/\bindian\b|\bindia\b|\bdesi\b|\bhinglish\b/, 'Indian English'],
  [/\bmexican\b|\bmexico\b|\bmexicano\b/, 'Mexican Spanish'],
  [/british|\buk\b|\bbrit\b|\bbritain\b|\benglish\b/, 'British'],
  [/american|\bus\b|\busa\b|new york/, 'American'],
  [/spanish|espanol|español/, 'Spanish'],
  [/french/, 'French'],
  [/german/, 'German'],
  [/italian/, 'Italian'],
  [/portuguese/, 'Portuguese'],
];

/**
 * Resolve what the user said or the agent passed ("Chaiwala Blitz", "crumpet", "male british", "the Indian voice",
 * "Mexican Spanish", "random", a voice id) to a persona. Returns null when nothing matches, so the caller can say so
 * instead of guessing.
 */
export function resolvePersona(query: string, currentId?: string): VoicePersona | null {
  const q = norm(query);
  if (!q) return null;
  if (/^(random|surprise me|anyone|any voice|something else|another one|different)/.test(q)) {
    const pool = PERSONAS.filter((p) => p.id !== currentId);
    return pool[Math.floor(Math.random() * pool.length)];
  }
  const byId = PERSONAS.find((p) => norm(p.id) === q);
  if (byId) return byId;
  const GENERIC_DESC = new Set([
    'calm', 'warm', 'steady', 'upbeat', 'grounded', 'easygoing', 'polite', 'brisk', 'clear', 'gentle', 'quiet', 'direct', 'expressive',
    'british', 'american', 'indian', 'english', 'mexican', 'spanish', 'french', 'german', 'italian', 'portuguese', 'voice', 'assemblyai',
  ]);
  // name / alias match: full given name, or any distinctive word of it (min 4 letters)
  for (const p of PERSONAS) {
    const given = p.name.split('—')[0]?.trim() || p.name;
    const names = [given, ...(p.aliases ?? [])].map(norm).filter(Boolean);
    if (names.some((n) => q.includes(n) || (q.length >= 4 && !GENERIC_DESC.has(q) && n.includes(q)))) return p;
  }
  const words = q.split(' ').filter((w) => w.length >= 4 && !GENERIC_DESC.has(w));
  for (const p of PERSONAS) {
    const given = p.name.split('—')[0]?.trim() || p.name;
    const nw = [given, ...(p.aliases ?? [])]
      .flatMap((s) => norm(s).split(' '))
      .filter((w) => !GENERIC_DESC.has(w));
    if (words.some((w) => nw.includes(w))) return p;
  }
  // trait match: gender and/or accent words
  const wantF = /\b(female|woman|girl|lady)\b/.test(q);
  const wantM = /\b(male|man|boy|guy)\b/.test(q) && !wantF;
  const accent = ACCENT_WORDS.find(([re]) => re.test(q))?.[1] ?? null;
  if (wantF || wantM || accent) {
    const pool = PERSONAS.filter((p) => (!wantF || p.gender === 'female') && (!wantM || p.gender === 'male') && (!accent || p.voices[0].accent === accent) && p.id !== currentId);
    if (pool.length) return pool[0];
  }
  return null;
}
