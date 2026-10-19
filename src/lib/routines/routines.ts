/**
 * Routines: a few steps you do in order, one at a time, each with its own short timer.
 * ADHD brains lose the thread between "wake up" and "out of the door"; a routine gives one visible next step.
 */
export interface RoutineStep {
  text: string;
  /** Suggested minutes for this step; 0 means no timer. */
  minutes: number;
}

export interface Routine {
  id: string;
  name: string;
  steps: RoutineStep[];
  builtIn?: boolean;
}

export const ROUTINES_KEY = 'stay_routines_v1';

export const DEFAULT_ROUTINES: Routine[] = [
  {
    id: 'morning',
    name: 'Morning start',
    builtIn: true,
    steps: [
      { text: 'Drink a glass of water', minutes: 1 },
      { text: 'Wash your face and brush your teeth', minutes: 4 },
      { text: 'Put on clothes for the day', minutes: 4 },
      { text: 'Eat or drink something', minutes: 10 },
      { text: 'Look at today: pick the ONE thing that matters', minutes: 2 },
    ],
  },
  {
    id: 'leaving',
    name: 'Leaving the house',
    builtIn: true,
    steps: [
      { text: 'Keys, phone, wallet: touch each one', minutes: 1 },
      { text: 'Bag packed? Charger, water, anything for later', minutes: 2 },
      { text: 'Lights and windows', minutes: 1 },
      { text: 'Shoes on, door shut, check it is locked', minutes: 1 },
    ],
  },
  {
    id: 'evening',
    name: 'Evening wind-down',
    builtIn: true,
    steps: [
      { text: 'Five-minute tidy: only what is in your hands', minutes: 5 },
      { text: 'Set out tomorrow: clothes, keys, bag', minutes: 3 },
      { text: 'Write tomorrow\'s ONE thing somewhere you will see it', minutes: 2 },
      { text: 'Screens down, lights low', minutes: 0 },
    ],
  },
];

export function loadRoutines(): Routine[] {
  try {
    const raw = typeof window === 'undefined' ? null : window.localStorage.getItem(ROUTINES_KEY);
    const custom = raw ? (JSON.parse(raw) as Routine[]) : [];
    const ok = Array.isArray(custom) ? custom.filter((r) => r && typeof r.id === 'string' && typeof r.name === 'string' && Array.isArray(r.steps) && r.steps.length > 0) : [];
    return [...DEFAULT_ROUTINES, ...ok];
  } catch {
    return DEFAULT_ROUTINES;
  }
}

function saveCustom(list: Routine[]): void {
  try {
    window.localStorage.setItem(ROUTINES_KEY, JSON.stringify(list.filter((r) => !r.builtIn)));
  } catch {
    // private mode: kept for this page only
  }
}

/** Steps typed one per line, optionally "step - 5 min" or "step (5)". */
export function parseSteps(text: string): RoutineStep[] {
  return text
    .split(/\n+/)
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trim())
    .filter((l) => l.length >= 2)
    .slice(0, 15)
    .map((l) => {
      const m = l.match(/^(.*?)(?:\s*[-–,(]\s*(\d{1,3})\s*(?:min(?:utes?)?|m)?\)?)$/i);
      const minutes = m ? Math.min(120, Number(m[2])) : 0;
      return { text: (m ? m[1] : l).trim().slice(0, 100), minutes };
    })
    .filter((s) => s.text.length >= 2);
}

export function addRoutine(name: string, steps: RoutineStep[], now = new Date()): Routine[] {
  const n = name.trim().slice(0, 40);
  if (!n || steps.length === 0) return loadRoutines();
  const custom = loadRoutines().filter((r) => !r.builtIn);
  const r: Routine = { id: `r-${now.getTime()}-${Math.random().toString(36).slice(2, 5)}`, name: n, steps };
  saveCustom([...custom, r]);
  return loadRoutines();
}

export function removeRoutine(id: string): Routine[] {
  saveCustom(loadRoutines().filter((r) => !r.builtIn && r.id !== id));
  return loadRoutines();
}

/** Finds a routine from what was said or typed ("morning", "my evening routine", "leave the house"). */
export function findRoutine(query: string, list: Routine[] = loadRoutines()): Routine | null {
  const q = query.toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, ' ').replace(/\b(my|the|a|routine|please|start|run|begin)\b/g, ' ').replace(/\s+/g, ' ').trim();
  if (!q) return null;
  const exact = list.find((r) => r.name.toLowerCase() === q);
  if (exact) return exact;
  const aliases: Record<string, string> = { morning: 'morning', wake: 'morning', 'get up': 'morning', leave: 'leaving', leaving: 'leaving', out: 'leaving', door: 'leaving', house: 'leaving', evening: 'evening', night: 'evening', bed: 'evening', 'wind down': 'evening' };
  for (const [k, id] of Object.entries(aliases)) if (q.includes(k)) { const r = list.find((x) => x.id === id); if (r) return r; }
  return list.find((r) => r.name.toLowerCase().includes(q) || q.includes(r.name.toLowerCase())) ?? null;
}
