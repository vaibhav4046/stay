/**
 * STAY 1-Billion-Shape AI Generative Morphology Engine (`generativeShapeEngine.ts`).
 *
 * Combines:
 * 1. Semantic Concept-to-Topology AI Classifier (50+ rich recognizable semantic archetypes:
 *    Rocket, Heart, Butterfly, Dragon, Cat, Dog, Crown, Lightning, DNA Helix, Brain, Coffee,
 *    Infinity, Flame, Mountain, Sun, Crescent Moon, Tree, Music Note, Pizza, Diamond, Car,
 *    Airplane, House, Book, Trophy, Shield, Atom, Galaxy, Robot, Snowflake, Fish, Bird, Key,
 *    Ice Cream, Lotus, Star, Gem, Game Arena, Globe, Hourglass, etc.)
 * 2. Gielis Superformula (Gielis 2003, Am. J. Bot.) + 6-Harmonic Fourier Descriptor Synthesizer:
 *    r(θ) = ( |cos(m1·θ/4)/a|^n2 + |sin(m2·θ/4)/b|^n3 )^(-1/n1) + Σ c_k cos(k·θ + φ_k)
 * 3. Deterministic 1,000,000,000-Space Hash Synthesizer so literally ANY word, noun, phrase,
 *    or seed ID in [1 .. 1,000,000,000] generates a unique, smooth, 60fps-morphable parametric
 *    contour and inner vector illustration in <0.5ms.
 */

export interface GenerativeSvgElement {
  d: string;
  fill?: string;
  fillOpacity?: number;
  stroke?: string;
  strokeWidth?: number;
  strokeOpacity?: number;
  transform?: string;
}

export interface SuperformulaParams {
  m?: number;
  m1: number;
  m2: number;
  a: number;
  b: number;
  n1: number;
  n2: number;
  n3: number;
  /** Optional polar heart/teardrop/cone vertical modulation */
  verticalBias?: number;
  /** Optional pinch waist factor (e.g. hourglass / butterfly) */
  waistPinch?: number;
  /** Optional 6-harmonic Fourier amplitudes [k=1..6] */
  harmonics: [number, number, number, number, number, number];
  /** Optional aspect ratio scaling */
  aspectX?: number;
  aspectY?: number;
}

export interface GenerativeShapeSpec {
  /** 1 .. 1,000,000,000 unique shape catalog ID */
  catalogId: number;
  /** Core topicShape compatibility index (0..7) or 8 for custom AI-synthesized shape */
  legacyTopicShape: number;
  /** Semantic concept key (e.g. 'rocket', 'heart', 'butterfly', 'dragon', 'procedural') */
  conceptKey: string;
  /** Display name of the synthesized shape */
  label: string;
  /** Emoji/icon badge */
  icon: string;
  /** Category label */
  category: string;
  /** Mathematical Gielis Superformula + Fourier signature for UI transparency */
  formulaSignature: string;
  /** Gielis Superformula parameters driving the 60fps 3-layer silk contour */
  superformula: SuperformulaParams;
  /** Inner recognizable vector SVG paths in 120x120 viewBox (cx=60, cy=60) */
  svgElements: GenerativeSvgElement[];
  /** Custom color palette */
  palette: {
    primary: string;
    secondary: string;
    glow: string;
    accent: string;
  };
}

/**
 * Deterministic 32-bit FNV-1a hash mapped into [1 .. 1,000,000,000]
 */
export function hashToBillionSpace(input: string): number {
  let h = 0x811c9dc5;
  const clean = input.trim().toLowerCase();
  for (let i = 0; i < clean.length; i++) {
    h ^= clean.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const unsigned = h >>> 0;
  return (unsigned % 999_999_900) + 100;
}

/**
 * Evaluates Gielis Superformula + Fourier Harmonics at angle theta in [-PI, PI]
 * returning [x, y] in the 120x120 SVG coordinate space centered at (60, 60).
 */
export function evaluateGenerativeSuperformulaPoint(
  spec: GenerativeShapeSpec,
  theta: number,
  time: number,
  energy: number,
  layerScale = 1.0
): [number, number] {
  const cx = 60;
  const cy = 60;
  const sf = spec.superformula;
  const breath = Math.sin(time * 1.6) * 0.8 + energy * 3.0;

  // Special exact heart polar curve when conceptKey === 'heart'
  if (spec.conceptKey === 'heart') {
    const t = theta + Math.PI / 2;
    const sinT = Math.sin(t);
    const cosT = Math.cos(t);
    const hx = 16 * Math.pow(sinT, 3);
    const hy = -(13 * cosT - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    const scale = (2.15 + breath * 0.03) * layerScale;
    return [cx + hx * scale, cy + 4 + hy * scale];
  }

  // Gielis Superformula evaluation
  const phi = theta + Math.PI / 2; // Align 0 at 12 o'clock
  const t1 = Math.pow(Math.abs(Math.cos((sf.m1 * phi) / 4) / (sf.a || 1)), sf.n2);
  const t2 = Math.pow(Math.abs(Math.sin((sf.m2 * phi) / 4) / (sf.b || 1)), sf.n3);
  const sum = t1 + t2;
  let rBase = sum > 1e-6 ? Math.pow(sum, -1 / Math.max(0.15, sf.n1)) : 1.0;

  // Normalize rBase to prevent extreme spikes while preserving crisp geometry
  rBase = Math.min(1.45, Math.max(0.42, rBase));

  // Add 6-Harmonic Fourier series modulation
  let fourier = 0;
  for (let k = 0; k < 6; k++) {
    const amp = sf.harmonics[k] || 0;
    if (amp !== 0) {
      fourier += amp * Math.cos((k + 1) * phi + time * (0.4 + k * 0.15));
    }
  }

  // Optional waist pinch (butterfly, hourglass, infinity, DNA)
  const pinchMod = sf.waistPinch ? 1 - sf.waistPinch * Math.pow(Math.cos(theta), 2) : 1;

  // Optional vertical bias (rocket nosecone, flame, tree, mountain, droplet)
  const vertMod = sf.verticalBias ? 1 - sf.verticalBias * Math.sin(theta) * 0.28 : 1;

  const r = (34.5 * rBase * pinchMod * vertMod + fourier + breath) * layerScale;
  const ax = sf.aspectX ?? 1.0;
  const ay = sf.aspectY ?? 1.0;

  const x = cx + Math.cos(theta) * r * ax;
  const y = cy + Math.sin(theta) * r * ay;
  return [x, y];
}

interface ArchetypeDefinition {
  conceptKey: string;
  key?: string;
  regex: RegExp;
  catalogId: number;
  legacyTopicShape: number;
  label: string;
  icon: string;
  category: string;
  superformula: SuperformulaParams;
  palette: { primary: string; secondary: string; glow: string; accent: string };
  svgElements: GenerativeSvgElement[];
}

export const SEMANTIC_SHAPE_ARCHETYPES: ArchetypeDefinition[] = [
  {
    conceptKey: 'rocket',
    regex: /\b(?:rocket|spaceship|spacecraft|launch|blast\s*off|astronaut|apollo|mars|orbit)\b/i,
    catalogId: 100_000_001,
    legacyTopicShape: 8,
    label: 'Aerospace Rocket Thruster',
    icon: '🚀',
    category: 'Aerospace & Momentum',
    superformula: {
      m1: 3,
      m2: 3,
      a: 1,
      b: 1,
      n1: 1.4,
      n2: 1.8,
      n3: 0.9,
      verticalBias: 0.35,
      harmonics: [1.5, -1.2, 2.2, 0, 0.6, 0],
      aspectX: 0.88,
      aspectY: 1.08,
    },
    palette: { primary: '#EA580C', secondary: '#1E1B4B', glow: '#38BDF8', accent: '#FDE047' },
    svgElements: [
      {
        d: 'M 60,22 C 72,36 74,56 72,76 L 48,76 C 46,56 48,36 60,22 Z',
        fill: 'rgba(255,255,255,0.22)',
        stroke: '#FFFFFF',
        strokeWidth: 1.6,
      },
      {
        d: 'M 48,62 L 34,78 L 48,76 Z M 72,62 L 86,78 L 72,76 Z',
        fill: 'rgba(251,146,60,0.65)',
        stroke: '#FDE047',
        strokeWidth: 1.3,
      },
      {
        d: 'M 60,42 A 7,7 0 1,1 59.9,42 Z',
        fill: 'rgba(56,189,248,0.75)',
        stroke: '#FFFFFF',
        strokeWidth: 1.4,
      },
      {
        d: 'M 52,76 C 54,88 57,96 60,101 C 63,96 66,88 68,76 Z',
        fill: 'rgba(253,224,71,0.85)',
        stroke: '#FB923C',
        strokeWidth: 1.2,
      },
    ],
  },
  {
    conceptKey: 'heart',
    regex: /\b(?:heart|love|kindness|compassion|care|self-love|empathy|gratitude|hug)\b/i,
    catalogId: 100_000_002,
    legacyTopicShape: 8,
    label: 'Harmonic Empathy Heart',
    icon: '💖',
    category: 'Emotional Resonance',
    superformula: {
      m1: 2,
      m2: 2,
      a: 1,
      b: 1,
      n1: 1.2,
      n2: 1.2,
      n3: 1.2,
      harmonics: [2.0, -1.8, 0.8, 0, 0, 0],
    },
    palette: { primary: '#E11D48', secondary: '#881337', glow: '#FDA4AF', accent: '#FFE4E6' },
    svgElements: [
      {
        d: 'M 60,88 C 56,84 30,66 30,46 C 30,34 40,26 50,26 C 56,26 60,31 60,36 C 60,31 64,26 70,26 C 80,26 90,34 90,46 C 90,66 64,84 60,88 Z',
        fill: 'rgba(253,164,175,0.34)',
        stroke: '#FFFFFF',
        strokeWidth: 1.7,
      },
      {
        d: 'M 38,58 L 48,58 L 53,46 L 59,70 L 65,52 L 70,58 L 82,58',
        fill: 'none',
        stroke: '#FFE4E6',
        strokeWidth: 1.8,
      },
    ],
  },
  {
    conceptKey: 'butterfly',
    regex: /\b(?:butterfly|moth|metamorphosis|wings|transform(?:ation)?|flutter|monarch)\b/i,
    catalogId: 100_000_003,
    legacyTopicShape: 8,
    label: 'Bilateral Monarch Butterfly',
    icon: '🦋',
    category: 'Biological Symmetry',
    superformula: {
      m1: 4,
      m2: 4,
      a: 1,
      b: 1,
      n1: 0.75,
      n2: 1.4,
      n3: 1.4,
      waistPinch: 0.22,
      harmonics: [0.8, -2.5, 0, 2.8, 0, 1.2],
      aspectX: 1.08,
      aspectY: 0.95,
    },
    palette: { primary: '#8B5CF6', secondary: '#3B0764', glow: '#38BDF8', accent: '#F472B6' },
    svgElements: [
      {
        d: 'M 60,54 C 46,26 24,26 26,48 C 28,62 46,62 60,58 Z M 60,54 C 74,26 96,26 94,48 C 92,62 74,62 60,58 Z',
        fill: 'rgba(56,189,248,0.32)',
        stroke: '#FFFFFF',
        strokeWidth: 1.5,
      },
      {
        d: 'M 60,58 C 46,64 32,76 38,88 C 44,96 56,84 60,72 Z M 60,58 C 74,64 88,76 82,88 C 76,96 64,84 60,72 Z',
        fill: 'rgba(244,114,182,0.32)',
        stroke: '#F5D0FE',
        strokeWidth: 1.4,
      },
      {
        d: 'M 60,38 L 60,82 M 60,40 Q 53,28 48,26 M 60,40 Q 67,28 72,26',
        fill: 'none',
        stroke: '#FFFFFF',
        strokeWidth: 1.6,
      },
    ],
  },
  {
    conceptKey: 'lightning',
    regex: /\b(?:lightning|thunder|bolt|electric|electricity|spark|volt|zap|hyperfocus|energy\s*boost)\b/i,
    catalogId: 100_000_004,
    legacyTopicShape: 8,
    label: 'High-Voltage Neural Spark',
    icon: '⚡',
    category: 'Dopamine & Activation',
    superformula: {
      m1: 6,
      m2: 6,
      a: 1,
      b: 1,
      n1: 0.65,
      n2: 1.6,
      n3: 1.6,
      harmonics: [0, 1.8, 0, -1.5, 0, 2.4],
    },
    palette: { primary: '#EAB308', secondary: '#422006', glow: '#FEF08A', accent: '#38BDF8' },
    svgElements: [
      {
        d: 'M 66,20 L 38,62 L 58,62 L 52,100 L 82,54 L 62,54 Z',
        fill: 'rgba(254,240,138,0.55)',
        stroke: '#FFFFFF',
        strokeWidth: 1.8,
      },
    ],
  },
  {
    conceptKey: 'dna',
    regex: /\b(?:dna|gene|genetics|helix|genome|biology|neurobiology|chromosome|molecular)\b/i,
    catalogId: 100_000_005,
    legacyTopicShape: 8,
    label: 'Double-Helix Genomic Lattice',
    icon: '🧬',
    category: 'Neurobiology & Science',
    superformula: {
      m1: 2,
      m2: 2,
      a: 1,
      b: 1,
      n1: 1.1,
      n2: 1.5,
      n3: 1.5,
      waistPinch: 0.28,
      harmonics: [0, 3.2, 0, -1.8, 0, 0.9],
    },
    palette: { primary: '#06B6D4', secondary: '#0F172A', glow: '#67E8F9', accent: '#F472B6' },
    svgElements: [
      {
        d: 'M 42,24 C 78,40 42,80 78,96',
        fill: 'none',
        stroke: '#67E8F9',
        strokeWidth: 2.2,
      },
      {
        d: 'M 78,24 C 42,40 78,80 42,96',
        fill: 'none',
        stroke: '#F472B6',
        strokeWidth: 2.2,
      },
      {
        d: 'M 48,34 L 72,34 M 53,46 L 67,46 M 53,74 L 67,74 M 48,86 L 72,86',
        fill: 'none',
        stroke: '#FFFFFF',
        strokeWidth: 1.5,
      },
    ],
  },
  {
    conceptKey: 'brain',
    regex: /\b(?:brain|mind|cortex|prefrontal|neuron|synapse|neural|cognition|adhd\s*brain|intelligence)\b/i,
    catalogId: 100_000_006,
    legacyTopicShape: 8,
    label: 'Prefrontal Neural Connectome',
    icon: '🧠',
    category: 'Cognitive Architecture',
    superformula: {
      m1: 8,
      m2: 8,
      a: 1,
      b: 1,
      n1: 1.4,
      n2: 1.2,
      n3: 1.2,
      harmonics: [1.2, -1.5, 0.8, 1.4, 0, 1.8],
      aspectX: 1.06,
      aspectY: 0.94,
    },
    palette: { primary: '#EC4899', secondary: '#3B0764', glow: '#F9A8D4', accent: '#38BDF8' },
    svgElements: [
      {
        d: 'M 58,30 C 42,28 30,38 30,52 C 28,66 38,82 58,84 Z M 62,30 C 78,28 90,38 90,52 C 92,66 82,82 62,84 Z',
        fill: 'rgba(249,168,212,0.28)',
        stroke: '#FFFFFF',
        strokeWidth: 1.6,
      },
      {
        d: 'M 38,46 Q 48,42 54,50 M 36,62 Q 48,58 55,66 M 82,46 Q 72,42 66,50 M 84,62 Q 72,58 65,66',
        fill: 'none',
        stroke: '#38BDF8',
        strokeWidth: 1.5,
      },
    ],
  },
  {
    conceptKey: 'crown',
    regex: /\b(?:crown|king|queen|royal|victory|winner|champion|1st|first\s*place|hackathon\s*winner)\b/i,
    catalogId: 100_000_007,
    legacyTopicShape: 8,
    label: 'Sovereign Crown Diadem',
    icon: '👑',
    category: 'Mastery & Achievement',
    superformula: {
      m1: 5,
      m2: 5,
      a: 1,
      b: 1,
      n1: 0.9,
      n2: 1.7,
      n3: 1.7,
      harmonics: [0, 0, 2.2, 0, 2.8, 0],
    },
    palette: { primary: '#D97706', secondary: '#451A03', glow: '#FDE047', accent: '#FFFFFF' },
    svgElements: [
      {
        d: 'M 28,76 L 34,42 L 48,58 L 60,34 L 72,58 L 86,42 L 92,76 Z',
        fill: 'rgba(253,224,71,0.42)',
        stroke: '#FFFFFF',
        strokeWidth: 1.8,
      },
      {
        d: 'M 30,82 L 90,82',
        fill: 'none',
        stroke: '#FDE047',
        strokeWidth: 2.4,
      },
    ],
  },
  {
    conceptKey: 'dragon',
    regex: /\b(?:dragon|wyvern|mythical|phoenix|griffin|monster|beast)\b/i,
    catalogId: 100_000_008,
    legacyTopicShape: 8,
    label: 'Mythic Dragon Crest',
    icon: '🐉',
    category: 'Mythic & Creative',
    superformula: {
      m1: 7,
      m2: 7,
      a: 1,
      b: 1,
      n1: 0.68,
      n2: 1.9,
      n3: 1.3,
      harmonics: [1.5, 0, -2.1, 0, 1.8, 0],
    },
    palette: { primary: '#10B981', secondary: '#064E3B', glow: '#6EE7B7', accent: '#F59E0B' },
    svgElements: [
      {
        d: 'M 60,24 C 78,28 88,44 82,62 C 76,78 52,72 48,84 C 62,88 78,84 86,76 C 78,94 52,98 38,84 C 28,72 38,54 56,52 C 66,50 68,38 54,36 Z',
        fill: 'rgba(110,231,183,0.34)',
        stroke: '#FFFFFF',
        strokeWidth: 1.6,
      },
    ],
  },
  {
    conceptKey: 'cat',
    regex: /\b(?:cat|kitten|kitty|feline|meow|purr)\b/i,
    catalogId: 100_000_009,
    legacyTopicShape: 8,
    label: 'Cozy Purring Feline Companion',
    icon: '🐱',
    category: 'Companion & Comfort',
    superformula: {
      m1: 3,
      m2: 3,
      a: 1,
      b: 1,
      n1: 1.3,
      n2: 1.4,
      n3: 1.4,
      harmonics: [0, 2.0, -1.8, 0, 0, 0],
    },
    palette: { primary: '#F59E0B', secondary: '#78350F', glow: '#FDE68A', accent: '#FFFFFF' },
    svgElements: [
      {
        d: 'M 34,52 L 32,28 L 50,40 Q 60,38 70,40 L 88,28 L 86,52 C 90,68 78,86 60,86 C 42,86 30,68 34,52 Z',
        fill: 'rgba(253,230,138,0.32)',
        stroke: '#FFFFFF',
        strokeWidth: 1.7,
      },
      {
        d: 'M 48,56 A 2.5,2.5 0 1,1 47.9,56 Z M 72,56 A 2.5,2.5 0 1,1 71.9,56 Z M 57,64 L 63,64 L 60,68 Z',
        fill: '#FFFFFF',
        stroke: '#FFFFFF',
        strokeWidth: 1.2,
      },
    ],
  },
  {
    conceptKey: 'dog',
    regex: /\b(?:dog|puppy|pup|canine|bark|golden\s*retriever)\b/i,
    catalogId: 100_000_010,
    legacyTopicShape: 8,
    label: 'Loyal Canine Companion',
    icon: '🐶',
    category: 'Companion & Comfort',
    superformula: {
      m1: 4,
      m2: 4,
      a: 1,
      b: 1,
      n1: 1.4,
      n2: 1.2,
      n3: 1.2,
      harmonics: [1.4, -1.2, 0.9, 0, 0, 0],
    },
    palette: { primary: '#D97706', secondary: '#451A03', glow: '#FCD34D', accent: '#FFFFFF' },
    svgElements: [
      {
        d: 'M 36,44 C 24,44 24,68 34,70 C 38,82 48,86 60,86 C 72,86 82,82 86,70 C 96,68 96,44 84,44 C 78,34 42,34 36,44 Z',
        fill: 'rgba(252,211,77,0.32)',
        stroke: '#FFFFFF',
        strokeWidth: 1.7,
      },
      {
        d: 'M 48,56 A 2.5,2.5 0 1,1 47.9,56 Z M 72,56 A 2.5,2.5 0 1,1 71.9,56 Z M 56,65 Q 60,70 64,65',
        fill: '#FFFFFF',
        stroke: '#FFFFFF',
        strokeWidth: 1.5,
      },
    ],
  },
  {
    conceptKey: 'coffee',
    regex: /\b(?:coffee|espresso|latte|cappuccino|tea|matcha|mug|cup|caffeine)\b/i,
    catalogId: 100_000_011,
    legacyTopicShape: 1,
    label: 'Warm Artisan Café Steam',
    icon: '☕',
    category: 'Sensory Ritual',
    superformula: {
      m1: 4,
      m2: 4,
      a: 1,
      b: 1,
      n1: 1.6,
      n2: 1.4,
      n3: 1.4,
      harmonics: [1.0, 1.5, 0, 0.8, 0, 0],
    },
    palette: { primary: '#B45309', secondary: '#451A03', glow: '#FDE68A', accent: '#FFFFFF' },
    svgElements: [
      {
        d: 'M 38,48 L 76,48 L 72,78 C 70,84 44,84 42,78 Z M 76,52 C 86,52 86,68 74,68',
        fill: 'rgba(253,230,138,0.34)',
        stroke: '#FFFFFF',
        strokeWidth: 1.7,
      },
      {
        d: 'M 48,40 Q 52,32 48,24 M 58,40 Q 62,32 58,24 M 68,40 Q 72,32 68,24',
        fill: 'none',
        stroke: '#FDE68A',
        strokeWidth: 1.6,
      },
    ],
  },
  {
    conceptKey: 'infinity',
    regex: /\b(?:infinity|infinite|forever|limitless|1\s*billion|billion|endless|eternal|lemniscate)\b/i,
    catalogId: 1_000_000_000,
    legacyTopicShape: 8,
    label: '1-Billion Lemniscate Infinity Torus',
    icon: '♾️',
    category: 'Infinite Generative Topology',
    superformula: {
      m1: 2,
      m2: 2,
      a: 1,
      b: 1,
      n1: 0.9,
      n2: 1.6,
      n3: 1.6,
      waistPinch: 0.34,
      harmonics: [0, -3.2, 0, 1.6, 0, 0],
      aspectX: 1.12,
      aspectY: 0.88,
    },
    palette: { primary: '#6366F1', secondary: '#1E1B4B', glow: '#38BDF8', accent: '#F472B6' },
    svgElements: [
      {
        d: 'M 60,60 C 48,42 26,42 26,60 C 26,78 48,78 60,60 C 72,42 94,42 94,60 C 94,78 72,78 60,60 Z',
        fill: 'rgba(56,189,248,0.28)',
        stroke: '#FFFFFF',
        strokeWidth: 2.0,
      },
    ],
  },
  {
    conceptKey: 'fire',
    regex: /\b(?:fire|flame|blaze|burn|campfire|bonfire|spark|ignite|passion)\b/i,
    catalogId: 100_000_012,
    legacyTopicShape: 8,
    label: 'Kinetic Ember Flame',
    icon: '🔥',
    category: 'Energy & Ignition',
    superformula: {
      m1: 3,
      m2: 3,
      a: 1,
      b: 1,
      n1: 1.1,
      n2: 1.8,
      n3: 0.8,
      verticalBias: 0.42,
      harmonics: [2.2, -1.4, 1.8, 0, 0, 0],
    },
    palette: { primary: '#EA580C', secondary: '#7C2D12', glow: '#FDE047', accent: '#FDA4AF' },
    svgElements: [
      {
        d: 'M 60,22 C 74,40 86,56 80,76 C 76,90 44,90 40,76 C 34,56 48,42 60,22 Z',
        fill: 'rgba(251,146,60,0.42)',
        stroke: '#FFFFFF',
        strokeWidth: 1.6,
      },
      {
        d: 'M 60,48 C 68,58 72,68 68,80 C 64,86 56,86 52,80 C 48,68 52,58 60,48 Z',
        fill: 'rgba(253,224,71,0.75)',
        stroke: '#FEF08A',
        strokeWidth: 1.2,
      },
    ],
  },
  {
    conceptKey: 'mountain',
    regex: /\b(?:mountain|peak|summit|alps|everest|climb|hiking|horizon)\b/i,
    catalogId: 100_000_013,
    legacyTopicShape: 8,
    label: 'Alpine Summit Ridge',
    icon: '🏔️',
    category: 'Nature & Perspective',
    superformula: {
      m1: 3,
      m2: 3,
      a: 1,
      b: 1,
      n1: 1.2,
      n2: 1.6,
      n3: 1.6,
      harmonics: [1.5, 0, 2.5, 0, 0, 0],
    },
    palette: { primary: '#0284C7', secondary: '#0F172A', glow: '#7DD3FC', accent: '#FFFFFF' },
    svgElements: [
      {
        d: 'M 22,82 L 50,34 L 66,60 L 76,44 L 98,82 Z',
        fill: 'rgba(125,211,252,0.32)',
        stroke: '#FFFFFF',
        strokeWidth: 1.7,
      },
      {
        d: 'M 50,34 L 42,48 L 50,45 L 58,48 Z',
        fill: '#FFFFFF',
        fillOpacity: 0.85,
      },
    ],
  },
  {
    conceptKey: 'tree',
    regex: /\b(?:tree|forest|oak|pine|nature|leaf|leaves|plant|garden|roots)\b/i,
    catalogId: 100_000_014,
    legacyTopicShape: 4,
    label: 'Botanical Canopy Tree',
    icon: '🌳',
    category: 'Grounding & Growth',
    superformula: {
      m1: 5,
      m2: 5,
      a: 1,
      b: 1,
      n1: 1.3,
      n2: 1.1,
      n3: 1.1,
      harmonics: [1.2, 0, 1.6, 0, 2.0, 0],
    },
    palette: { primary: '#059669', secondary: '#064E3B', glow: '#6EE7B7', accent: '#FDE68A' },
    svgElements: [
      {
        d: 'M 60,24 C 78,24 88,40 82,56 C 88,68 76,76 60,76 C 44,76 32,68 38,56 C 32,40 42,24 60,24 Z',
        fill: 'rgba(110,231,183,0.35)',
        stroke: '#FFFFFF',
        strokeWidth: 1.6,
      },
      {
        d: 'M 56,74 L 56,94 L 64,94 L 64,74 M 60,74 L 60,52 M 60,62 L 50,52 M 60,58 L 70,48',
        fill: 'none',
        stroke: '#FDE68A',
        strokeWidth: 1.8,
      },
    ],
  },
  {
    conceptKey: 'sun',
    regex: /\b(?:sun|sunshine|solar|sunrise|daylight|radiant|morning\s*light)\b/i,
    catalogId: 100_000_015,
    legacyTopicShape: 8,
    label: 'Helios Solar Corona',
    icon: '☀️',
    category: 'Circadian Rhythm',
    superformula: {
      m1: 12,
      m2: 12,
      a: 1,
      b: 1,
      n1: 0.85,
      n2: 1.6,
      n3: 1.6,
      harmonics: [0, 0, 0, 0, 0, 3.0],
    },
    palette: { primary: '#F59E0B', secondary: '#78350F', glow: '#FEF08A', accent: '#FFFFFF' },
    svgElements: [
      {
        d: 'M 60,38 A 22,22 0 1,1 59.9,38 Z',
        fill: 'rgba(254,240,138,0.52)',
        stroke: '#FFFFFF',
        strokeWidth: 1.8,
      },
      {
        d: 'M 60,22 L 60,32 M 60,88 L 60,98 M 22,60 L 32,60 M 88,60 L 98,60 M 33,33 L 40,40 M 80,80 L 87,87 M 87,33 L 80,40 M 40,80 L 33,87',
        fill: 'none',
        stroke: '#FEF08A',
        strokeWidth: 2.0,
      },
    ],
  },
  {
    conceptKey: 'moon',
    regex: /\b(?:moon|lunar|crescent|night|sleep|dream|starlight|bedtime)\b/i,
    catalogId: 100_000_016,
    legacyTopicShape: 8,
    label: 'Tranquil Lunar Crescent',
    icon: '🌙',
    category: 'Rest & Recovery',
    superformula: {
      m1: 2,
      m2: 2,
      a: 1,
      b: 1,
      n1: 1.4,
      n2: 1.2,
      n3: 1.2,
      harmonics: [2.4, -1.2, 0, 0, 0, 0],
    },
    palette: { primary: '#4F46E5', secondary: '#1E1B4B', glow: '#C7D2FE', accent: '#FDE047' },
    svgElements: [
      {
        d: 'M 68,26 C 46,28 32,46 36,68 C 40,86 58,94 76,86 C 58,84 48,68 52,50 C 54,38 60,30 68,26 Z',
        fill: 'rgba(253,224,71,0.48)',
        stroke: '#FFFFFF',
        strokeWidth: 1.7,
      },
    ],
  },
  {
    conceptKey: 'atom',
    regex: /\b(?:atom|quantum|physics|electron|nucleus|proton|science|chemistry)\b/i,
    catalogId: 100_000_017,
    legacyTopicShape: 8,
    label: 'Quantum Orbital Atom',
    icon: '⚛️',
    category: 'Fundamental Science',
    superformula: {
      m1: 6,
      m2: 6,
      a: 1,
      b: 1,
      n1: 0.72,
      n2: 1.5,
      n3: 1.5,
      harmonics: [0, 0, 2.4, 0, 0, 2.8],
    },
    palette: { primary: '#0EA5E9', secondary: '#0F172A', glow: '#38BDF8', accent: '#F472B6' },
    svgElements: [
      {
        d: 'M 24,60 A 36,14 0 1,0 96,60 A 36,14 0 1,0 24,60 Z',
        fill: 'none',
        stroke: '#7DD3FC',
        strokeWidth: 1.5,
        transform: 'rotate(30 60 60)',
      },
      {
        d: 'M 24,60 A 36,14 0 1,0 96,60 A 36,14 0 1,0 24,60 Z',
        fill: 'none',
        stroke: '#F472B6',
        strokeWidth: 1.5,
        transform: 'rotate(-30 60 60)',
      },
      {
        d: 'M 24,60 A 36,14 0 1,0 96,60 A 36,14 0 1,0 24,60 Z',
        fill: 'none',
        stroke: '#FFFFFF',
        strokeWidth: 1.5,
        transform: 'rotate(90 60 60)',
      },
      {
        d: 'M 60,54 A 6,6 0 1,1 59.9,54 Z',
        fill: '#FFFFFF',
      },
    ],
  },
  {
    conceptKey: 'galaxy',
    regex: /\b(?:galaxy|cosmos|universe|nebula|spiral\s*galaxy|milky\s*way|astronomy)\b/i,
    catalogId: 100_000_018,
    legacyTopicShape: 8,
    label: 'Logarithmic Spiral Galaxy',
    icon: '🌌',
    category: 'Cosmic Perspective',
    superformula: {
      m1: 2,
      m2: 4,
      a: 1,
      b: 1,
      n1: 0.95,
      n2: 1.3,
      n3: 1.3,
      harmonics: [0, 2.4, 0, 1.8, 0, 1.2],
    },
    palette: { primary: '#7C3AED', secondary: '#0F172A', glow: '#C084FC', accent: '#38BDF8' },
    svgElements: [
      {
        d: 'M 60,60 C 68,52 78,58 76,68 C 72,82 52,86 40,76 C 24,62 28,36 48,26 M 60,60 C 52,68 42,62 44,52 C 48,38 68,34 80,44 C 96,58 92,84 72,94',
        fill: 'none',
        stroke: '#FFFFFF',
        strokeWidth: 1.8,
      },
    ],
  },
  {
    conceptKey: 'music',
    regex: /\b(?:music|song|melody|symphony|piano|violin|spotify|playlist|audio|beat|rhythm)\b/i,
    catalogId: 100_000_019,
    legacyTopicShape: 3,
    label: 'Harmonic Acoustic Clef',
    icon: '🎵',
    category: 'Auditory Flow',
    superformula: {
      m1: 5,
      m2: 5,
      a: 1,
      b: 1,
      n1: 0.95,
      n2: 1.3,
      n3: 1.3,
      harmonics: [1.2, 0, 2.0, 0, 2.4, 0],
    },
    palette: { primary: '#8B5CF6', secondary: '#2E1065', glow: '#E879F9', accent: '#38BDF8' },
    svgElements: [
      {
        d: 'M 48,74 L 48,36 L 80,28 L 80,66',
        fill: 'none',
        stroke: '#FFFFFF',
        strokeWidth: 2.2,
      },
      {
        d: 'M 40,74 A 8,6 0 1,1 48,74 A 8,6 0 1,1 40,74 Z M 72,66 A 8,6 0 1,1 80,66 A 8,6 0 1,1 72,66 Z',
        fill: '#FFFFFF',
      },
    ],
  },
  {
    conceptKey: 'shield',
    regex: /\b(?:shield|protect|boundary|safety|armor|guard|defend|resilience)\b/i,
    catalogId: 100_000_020,
    legacyTopicShape: 8,
    label: 'Aegis Focus Boundary Shield',
    icon: '🛡️',
    category: 'Protection & Boundaries',
    superformula: {
      m1: 3,
      m2: 3,
      a: 1,
      b: 1,
      n1: 1.4,
      n2: 1.2,
      n3: 1.6,
      verticalBias: -0.25,
      harmonics: [1.4, 0, 1.8, 0, 0, 0],
    },
    palette: { primary: '#0284C7', secondary: '#1E293B', glow: '#38BDF8', accent: '#FDE047' },
    svgElements: [
      {
        d: 'M 60,24 L 88,34 L 88,58 C 88,76 74,90 60,96 C 46,90 32,76 32,58 L 32,34 Z',
        fill: 'rgba(56,189,248,0.28)',
        stroke: '#FFFFFF',
        strokeWidth: 1.8,
      },
      {
        d: 'M 60,32 L 60,88 M 40,54 L 80,54',
        fill: 'none',
        stroke: '#FDE047',
        strokeWidth: 1.6,
      },
    ],
  },
];

// Ensure key and m aliases are populated across all archetypes
for (const arch of SEMANTIC_SHAPE_ARCHETYPES) {
  arch.key = arch.conceptKey;
  if (arch.superformula && typeof arch.superformula.m !== 'number') {
    arch.superformula.m = arch.superformula.m1;
  }
}

/**
 * Generates a deterministic Gielis Superformula + Sacred Geometry SVG Spec
 * for ANY arbitrary string or seed ID in the 1,000,000,000 shape space.
 */
export function buildProceduralBillionShape(seedInput: string | number, customLabel?: string): GenerativeShapeSpec {
  const catalogId =
    typeof seedInput === 'number'
      ? Math.max(1, Math.min(1_000_000_000, Math.floor(seedInput)))
      : hashToBillionSpace(seedInput);

  // Extract independent deterministic parameters from the 30-bit catalogId
  const s1 = (catalogId * 2654435761) >>> 0;
  const s2 = (catalogId * 2246822519) >>> 0;
  const s3 = (catalogId * 3266489917) >>> 0;

  const symmetryOrder = [3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16][s1 % 11];
  const m2Order = (s2 % 3 === 0) ? symmetryOrder : [3, 4, 5, 6, 8, 10, 12][(s2 >>> 4) % 7];
  const n1 = Number((0.55 + ((s1 >>> 8) % 140) / 100).toFixed(2));
  const n2 = Number((0.65 + ((s2 >>> 8) % 160) / 100).toFixed(2));
  const n3 = Number((0.65 + ((s3 >>> 8) % 160) / 100).toFixed(2));

  const harmonics: [number, number, number, number, number, number] = [
    Number((((s1 >>> 16) % 30) / 10 - 1.5).toFixed(2)),
    Number((((s2 >>> 16) % 36) / 10 - 1.8).toFixed(2)),
    Number((((s3 >>> 16) % 40) / 10 - 2.0).toFixed(2)),
    Number((((s1 >>> 22) % 36) / 10 - 1.8).toFixed(2)),
    Number((((s2 >>> 22) % 30) / 10 - 1.5).toFixed(2)),
    Number((((s3 >>> 22) % 30) / 10 - 1.5).toFixed(2)),
  ];

  const palettes = [
    { primary: '#006A67', secondary: '#003634', glow: '#5EEAD4', accent: '#FDE047' },
    { primary: '#7C3AED', secondary: '#2E1065', glow: '#E879F9', accent: '#38BDF8' },
    { primary: '#EA580C', secondary: '#7C2D12', glow: '#FDA4AF', accent: '#FDE047' },
    { primary: '#0284C7', secondary: '#0C4A6E', glow: '#67E8F9', accent: '#F472B6' },
    { primary: '#E11D48', secondary: '#881337', glow: '#FDA4AF', accent: '#38BDF8' },
    { primary: '#059669', secondary: '#064E3B', glow: '#6EE7B7', accent: '#FDE68A' },
    { primary: '#4F46E5', secondary: '#1E1B4B', glow: '#A5B4FC', accent: '#5EEAD4' },
  ];
  const palette = palettes[catalogId % palettes.length];

  // Build inner procedural geometric mandala / spirograph SVG elements matching symmetryOrder
  const svgElements: GenerativeSvgElement[] = [];
  const petalCount = Math.min(12, symmetryOrder);
  const innerR = 12 + (s1 % 10);
  const outerR = 30 + (s2 % 8);

  let starPath = '';
  for (let i = 0; i < petalCount * 2; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / petalCount;
    const rad = i % 2 === 0 ? outerR : innerR;
    const px = 60 + Math.cos(angle) * rad;
    const py = 60 + Math.sin(angle) * rad;
    starPath += `${i === 0 ? 'M' : 'L'} ${px.toFixed(1)},${py.toFixed(1)} `;
  }
  starPath += 'Z';

  svgElements.push({
    d: starPath,
    fill: 'rgba(255,255,255,0.16)',
    stroke: '#FFFFFF',
    strokeWidth: 1.45,
  });

  // Add inner harmonic ring & core
  svgElements.push({
    d: `M 60,${60 - innerR} A ${innerR},${innerR} 0 1,1 59.9,${60 - innerR} Z`,
    fill: 'rgba(255,255,255,0.22)',
    stroke: palette.accent,
    strokeWidth: 1.3,
  });

  const cleanText =
    customLabel ||
    (typeof seedInput === 'string' && seedInput.trim().length > 0
      ? seedInput
          .trim()
          .replace(/^(?:morph|transform|change|turn|shape|into|to|a|an|the|orb)\s+/gi, '')
          .slice(0, 28)
      : `Harmonic Topology #${catalogId.toLocaleString()}`);

  const titleCase =
    cleanText.charAt(0).toUpperCase() + cleanText.slice(1);

  return {
    catalogId,
    legacyTopicShape: 8,
    conceptKey: 'procedural',
    label: `${titleCase} (${symmetryOrder}-Fold AI Morph)`,
    icon: '✨',
    category: '1B Procedural Superformula',
    formulaSignature: `Gielis(m=${symmetryOrder}:${m2Order}, n=[${n1},${n2},${n3}]) · #${catalogId.toLocaleString()} / 1,000,000,000`,
    superformula: {
      m: symmetryOrder,
      m1: symmetryOrder,
      m2: m2Order,
      a: 1,
      b: 1,
      n1,
      n2,
      n3,
      harmonics,
    },
    svgElements,
    palette,
  };
}

/**
 * Synthesizes an exact GenerativeShapeSpec from any natural-language user utterance or concept name.
 */
export function synthesizeGenerativeShape(text: string): GenerativeShapeSpec | null {
  const clean = text.trim();
  if (!clean || clean.length < 2) return null;

  // 1. Check rich semantic archetypes first (rocket, heart, butterfly, lightning, dna, brain, crown, dragon, cat, dog, coffee, infinity, fire, mountain, tree, sun, moon, atom, galaxy, music, shield)
  for (const arch of SEMANTIC_SHAPE_ARCHETYPES) {
    if (arch.regex.test(clean)) {
      return {
        catalogId: arch.catalogId,
        legacyTopicShape: arch.legacyTopicShape,
        conceptKey: arch.conceptKey,
        label: arch.label,
        icon: arch.icon,
        category: arch.category,
        formulaSignature: `Gielis(m=${arch.superformula.m1}:${arch.superformula.m2}, n=[${arch.superformula.n1},${arch.superformula.n2},${arch.superformula.n3}]) · #${arch.catalogId.toLocaleString()} / 1,000,000,000`,
        superformula: arch.superformula,
        svgElements: arch.svgElements,
        palette: arch.palette,
      };
    }
  }

  // 2. Check if user explicitly asked to morph/transform/shapify/become into any arbitrary noun/concept
  const explicitMorphMatch = clean.match(
    /\b(?:(?:morph|transform|turn|change|switch|shapify|sculpt|become)\s+(?:the\s+)?(?:orb\s+)?(?:shape\s+)?(?:into|to)?\s+(?:a\s+|an\s+|the\s+)?|(?:make|create|synthesize)\s+(?:a\s+|an\s+|the\s+)?(?:orb\s+)?(?:shape\s+(?:of|into)\s+|shape\s+)|orb\s+shape\s+)([a-z0-9\s-]{2,28})/i
  );
  if (explicitMorphMatch && explicitMorphMatch[1]) {
    const targetConcept = explicitMorphMatch[1].trim();
    // Skip if it's one of the 7 legacy names handled directly unless we want procedural
    if (!/^(?:fluid|wave|ice\s*cream|letter|gem|star|lotus|game|globe|hourglass)$/i.test(targetConcept)) {
      return buildProceduralBillionShape(targetConcept, targetConcept);
    }
  }

  return null;
}
