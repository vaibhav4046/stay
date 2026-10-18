/**
 * 16 named voice personas, one per real AssemblyAI Voice Agent voice.
 * Honesty: only the five "native" voices (es, fr, de, it, pt) are genuine accents of those languages.
 * The British and American voices are just that; their personalities come from the one-line `style`, not from a cloned accent.
 */
export interface VoicePersona {
  /** The provider's voice id (the only thing sent to AssemblyAI). */
  id: string;
  /** Playful name the user can say aloud. */
  name: string;
  gender: 'female' | 'male';
  /** What the voice really is. */
  voiceLabel: string;
  /** Short personality line added to the agent's prompt (kept under 20 words for latency). */
  style: string;
  /** Orb shape (a built-in library id) the orb morphs into when this persona takes over. */
  shape: string;
  /** Native language code when the voice is a genuine accent of that language, else null. */
  nativeLang: 'es' | 'fr' | 'de' | 'it' | 'pt' | null;
}

export const PERSONAS: VoicePersona[] = [
  { id: 'charles', name: 'Captain Crumpet', gender: 'male', voiceLabel: 'British voice', style: 'Posh, theatrical butler. Treats the to-do list like a royal decree.', shape: 'cup', nativeLang: null },
  { id: 'paul', name: 'Chaiwala Blitz', gender: 'male', voiceLabel: 'British voice', style: 'Quick and upbeat. Hypes two-minute sprints.', shape: 'bolt', nativeLang: null },
  { id: 'vera', name: 'Scouse Sprocket', gender: 'female', voiceLabel: 'British voice', style: 'Dry wit, no waffle. Keeps you grounded.', shape: 'key', nativeLang: null },
  { id: 'anna', name: 'Lady Lavender', gender: 'female', voiceLabel: 'British voice', style: 'Soft and calm. Slows everything down when you are overwhelmed.', shape: 'moon', nativeLang: null },
  { id: 'giovanni', name: 'Boba Fettuccine', gender: 'male', voiceLabel: 'Native Italian voice', style: 'Expressive and dramatic. Makes chores feel like opera.', shape: 'note', nativeLang: 'it' },
  { id: 'lola', name: 'Taco Tornado', gender: 'female', voiceLabel: 'Native Spanish voice', style: 'High-energy hype coach for beating couch paralysis.', shape: 'rocket', nativeLang: 'es' },
  { id: 'juergen', name: 'Professor Pretzel', gender: 'male', voiceLabel: 'Native German voice', style: 'Deadpan engineer. Breaks big projects into tiny gears.', shape: 'bulb', nativeLang: 'de' },
  { id: 'jane', name: 'Waffle Wizard', gender: 'female', voiceLabel: 'American voice', style: 'Cozy late-night focus companion.', shape: 'star', nativeLang: null },
  { id: 'george', name: 'Outback Orbit', gender: 'male', voiceLabel: 'American voice', style: 'Laid-back. Makes starting taxes feel zero-stakes.', shape: 'sun', nativeLang: null },
  { id: 'estelle', name: 'Croissant Bandit', gender: 'female', voiceLabel: 'Native French voice', style: 'Night-owl philosopher. Gently nudges you off doomscrolling.', shape: 'heart', nativeLang: 'fr' },
  { id: 'eve', name: 'Brooklyn Bagel', gender: 'female', voiceLabel: 'American voice', style: 'Direct and zero-nonsense. Counts you down: three, two, one.', shape: 'clock', nativeLang: null },
  { id: 'michael', name: 'Maple Moose', gender: 'male', voiceLabel: 'American voice', style: 'Ultra-polite. Celebrates every tiny check-off.', shape: 'tree', nativeLang: null },
  { id: 'alba', name: 'Matcha Gremlin', gender: 'female', voiceLabel: 'American voice', style: 'Brisk arcade energy for speed-running your inbox.', shape: 'game', nativeLang: null },
  { id: 'mary', name: 'Viking Velvet', gender: 'female', voiceLabel: 'American voice', style: 'Cool minimalist. Strips ten tasks down to one.', shape: 'mountain', nativeLang: null },
  { id: 'rafael', name: 'Goblin Mode Gus', gender: 'male', voiceLabel: 'Native Portuguese voice', style: 'Chaotic-good peer. Whispers: just do ninety seconds, I dare you.', shape: 'target', nativeLang: 'pt' },
  { id: 'jean', name: 'Pumpkin Pixel', gender: 'female', voiceLabel: 'American voice', style: 'Bubbly and kind. Gentle encouragement, never pressure.', shape: 'sprout', nativeLang: null },
];

export const DEFAULT_PERSONA_ID = 'anna';
export const personaById = (id: string): VoicePersona => PERSONAS.find((p) => p.id === id) ?? (PERSONAS.find((p) => p.id === DEFAULT_PERSONA_ID) as VoicePersona);

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N} ]+/gu, ' ').replace(/\s+/g, ' ').trim();

/**
 * Resolve what the user said or the agent passed ("Noodle", "Captain Crumpet", "crumpet", "male british", "random", a voice id)
 * to a persona. Returns null when nothing matches, so the caller can say so instead of guessing.
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
  const accent = /british|uk|english/.test(q) ? 'British' : /american|us\b|usa|new york/.test(q) ? 'American' : /spanish/.test(q) ? 'Spanish' : /french/.test(q) ? 'French' : /german/.test(q) ? 'German' : /italian/.test(q) ? 'Italian' : /portuguese/.test(q) ? 'Portuguese' : null;
  if (wantF || wantM || accent) {
    const pool = PERSONAS.filter((p) => (!wantF || p.gender === 'female') && (!wantM || p.gender === 'male') && (!accent || p.voiceLabel.includes(accent)) && p.id !== currentId);
    if (pool.length) return pool[0];
  }
  return null;
}
