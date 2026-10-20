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
  /** Playful name the person can say aloud. */
  name: string;
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
}

const aai = (voice: string, lang: SpeechLang, locale: string, accent: string): VoiceRef => ({ engine: 'assemblyai', voice, lang, locale, accent });
const azure = (voice: string, lang: SpeechLang, locale: string, accent: string): VoiceRef => ({ engine: 'azure', voice, lang, locale, accent });
const browser = (lang: SpeechLang, locale: string, accent: string): VoiceRef => ({ engine: 'browser', voice: '', lang, locale, accent });

const BRIT = (v: string) => aai(v, 'en', 'en-GB', 'British');
const AMER = (v: string) => aai(v, 'en', 'en-US', 'American');
const UNLABELLED = (v: string) => aai(v, 'en', 'en', 'English, accent not documented');

type Seed = Omit<VoicePersona, 'lang' | 'recommended' | 'voices'> & { voices: VoiceRef[]; recommended?: boolean };
const make = (s: Seed): VoicePersona => ({ ...s, lang: s.voices[0].lang, recommended: s.recommended ?? false });

export const PERSONAS: VoicePersona[] = [
  // British (AssemblyAI documents: anna, charles, paul, vera)
  make({ id: 'anna', name: 'Lady Lavender', gender: 'female', voiceLabel: 'British voice', style: 'Soft and calm. Slows everything down when you are overwhelmed.', shape: 'moon', voices: [BRIT('anna')], recommended: true }),
  make({ id: 'charles', name: 'Captain Crumpet', gender: 'male', voiceLabel: 'British voice', style: 'Posh, theatrical butler. Treats the to-do list like a royal decree.', shape: 'cup', voices: [BRIT('charles')] }),
  make({ id: 'paul', name: 'Biscuit Blitz', gender: 'male', voiceLabel: 'British voice', style: 'Quick and upbeat. Hypes two-minute sprints.', shape: 'bolt', voices: [BRIT('paul')] }),
  make({ id: 'vera', name: 'Marmite Sprocket', gender: 'female', voiceLabel: 'British voice', style: 'Dry wit, no waffle. Keeps you grounded.', shape: 'key', voices: [BRIT('vera')] }),
  // American (documented: alba, eve, george, jane, jean, mary, michael)
  make({ id: 'jane', name: 'Waffle Wizard', gender: 'female', voiceLabel: 'American voice', style: 'Cozy late-night focus companion.', shape: 'star', voices: [AMER('jane')] }),
  make({ id: 'eve', name: 'Countdown Cookie', gender: 'female', voiceLabel: 'American voice', style: 'Direct and zero-nonsense. Counts you down: three, two, one.', shape: 'clock', voices: [AMER('eve')], recommended: true }),
  make({ id: 'george', name: 'Porch Light', gender: 'male', voiceLabel: 'American voice', style: 'Laid-back. Makes starting taxes feel zero-stakes.', shape: 'sun', voices: [AMER('george')] }),
  make({ id: 'michael', name: 'Pancake Paladin', gender: 'male', voiceLabel: 'American voice', style: 'Ultra-polite. Celebrates every tiny check-off.', shape: 'tree', voices: [AMER('michael')] }),
  make({ id: 'alba', name: 'Arcade Gremlin', gender: 'female', voiceLabel: 'American voice', style: 'Brisk arcade energy for speed-running your inbox.', shape: 'game', voices: [AMER('alba')] }),
  make({ id: 'mary', name: 'Velvet Scalpel', gender: 'female', voiceLabel: 'American voice', style: 'Cool minimalist. Strips ten tasks down to one.', shape: 'mountain', voices: [AMER('mary')] }),
  make({ id: 'jean', name: 'Pumpkin Pixel', gender: 'female', voiceLabel: 'American voice', style: 'Bubbly and kind. Gentle encouragement, never pressure.', shape: 'sprout', voices: [AMER('jean')] }),
  // Found by probing the live endpoint; the provider's voice page does not list them or say what accent they have.
  // Gender is assumed from the names.
  make({ id: 'iris', name: 'Lantern Iris', gender: 'female', voiceLabel: 'English voice, accent not documented', style: 'Quiet and steady. Lights the next small step.', shape: 'bulb', voices: [UNLABELLED('iris')] }),
  make({ id: 'reid', name: 'Compass Reid', gender: 'male', voiceLabel: 'English voice, accent not documented', style: 'Plain-spoken guide. Points at the next step and waits.', shape: 'target', voices: [UNLABELLED('reid')] }),
  // Native-language voices (AssemblyAI: "native accent"; it does not say which regional accent)
  make({ id: 'lola', name: 'Couch Rocket', gender: 'female', voiceLabel: 'Native Spanish voice', style: 'High-energy hype coach for beating couch paralysis.', shape: 'rocket', voices: [aai('lola', 'es', 'es', 'Spanish')] }),
  make({ id: 'estelle', name: 'Croissant Bandit', gender: 'female', voiceLabel: 'Native French voice', style: 'Night-owl philosopher. Gently nudges you off doomscrolling.', shape: 'heart', voices: [aai('estelle', 'fr', 'fr', 'French')] }),
  make({ id: 'juergen', name: 'Professor Pretzel', gender: 'male', voiceLabel: 'Native German voice', style: 'Deadpan engineer. Breaks big projects into tiny gears.', shape: 'bulb', voices: [aai('juergen', 'de', 'de', 'German')] }),
  make({ id: 'giovanni', name: 'Fettuccine Maestro', gender: 'male', voiceLabel: 'Native Italian voice', style: 'Expressive and dramatic. Makes chores feel like opera.', shape: 'note', voices: [aai('giovanni', 'it', 'it', 'Italian')] }),
  make({ id: 'rafael', name: 'Goblin Mode Gus', gender: 'male', voiceLabel: 'Native Portuguese voice', style: 'Chaotic-good peer. Whispers: just do ninety seconds, I dare you.', shape: 'target', voices: [aai('rafael', 'pt', 'pt', 'Portuguese')] }),
  // Accent voices AssemblyAI does not have. Azure Neural when the person added a key, else the device's own voice.
  make({
    id: 'cardamom', name: 'Cardamom Calm', gender: 'female', voiceLabel: 'Indian English voice',
    style: 'Warm and unhurried. Turns a pile of tasks into one gentle next step.', shape: 'lotus', recommended: true,
    voices: [azure('en-IN-NeerjaNeural', 'en', 'en-IN', 'Indian English'), browser('en', 'en-IN', 'Indian English')],
  }),
  make({
    id: 'chaiwala', name: 'Chaiwala Blitz', gender: 'male', voiceLabel: 'Indian English voice',
    style: 'Quick and upbeat. Hypes two-minute sprints, one chai at a time.', shape: 'bolt',
    voices: [azure('en-IN-PrabhatNeural', 'en', 'en-IN', 'Indian English'), browser('en', 'en-IN', 'Indian English')],
  }),
  make({
    id: 'taco', name: 'Taco Tornado', gender: 'female', voiceLabel: 'Mexican Spanish voice',
    style: 'Warm, high-energy coach. Cheers you off the couch in Mexican Spanish.', shape: 'rocket', recommended: true,
    voices: [azure('es-MX-DaliaNeural', 'es', 'es-MX', 'Mexican Spanish'), browser('es', 'es-MX', 'Mexican Spanish')],
  }),
  make({
    id: 'mariachi', name: 'Mariachi Metronome', gender: 'male', voiceLabel: 'Mexican Spanish voice',
    style: 'Steady rhythm. Keeps you moving one beat at a time.', shape: 'note',
    voices: [azure('es-MX-JorgeNeural', 'es', 'es-MX', 'Mexican Spanish'), browser('es', 'es-MX', 'Mexican Spanish')],
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
  // name match: full name, or any distinctive word of it (min 4 letters, so "the" and "mode" do not match everything)
  for (const p of PERSONAS) {
    const n = norm(p.name);
    if (q.includes(n) || n.includes(q)) return p;
  }
  const words = q.split(' ').filter((w) => w.length >= 4);
  for (const p of PERSONAS) {
    const nw = norm(p.name).split(' ');
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
