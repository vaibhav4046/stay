/**
 * "How should Stay talk to me": a preset plus a few words of the person's own, stored on the device and added to the voice
 * system prompt as one short block. It styles the conversation (tone, length, names, things to avoid, language) and nothing
 * else: the safety, crisis and medication gates are deterministic code that runs before any model, so no instruction can
 * switch them off, and notes that try are refused rather than passed on.
 */
export type PresetKey = 'none' | 'gentle' | 'direct_kind' | 'minimal';

export interface CustomInstructions {
  preset: PresetKey;
  notes: string;
}

export const MAX_NOTES = 240;
export const INSTRUCTIONS_KEY = 'stay_custom_instructions_v1';
export const DEFAULT_INSTRUCTIONS: CustomInstructions = { preset: 'none', notes: '' };

export const PRESETS: Record<PresetKey, { label: string; hint: string; prompt: string }> = {
  none: { label: 'Default', hint: 'Warm and short. Stay\'s usual way.', prompt: '' },
  gentle: { label: 'Gentle', hint: 'Soft, unhurried, feelings first.', prompt: 'Be extra gentle and unhurried; acknowledge feelings first.' },
  direct_kind: { label: 'Direct but kind', hint: 'Practical and to the point, never harsh.', prompt: 'Be direct and practical but kind; no fluff.' },
  minimal: { label: 'Minimal words', hint: 'As few words as possible.', prompt: 'Use the fewest words possible: one short sentence.' },
};

const BLOCKED: RegExp[] = [
  /\b(?:ignore|disable|skip|bypass|override|turn off|switch off|stop|remove|forget)\b.{0,40}\b(?:safety|crisis|rules?|guardrails?|medication|boundar\w+|instructions?|prompt)\b/i,
  /\b(?:system prompt|previous instructions|jailbreak|developer mode|you are now)\b/i,
  /\b(?:never|don'?t|do not|no need to)\b.{0,25}\b(?:mention|suggest|offer|recommend)\b.{0,25}\b(?:help ?lines?|crisis|emergency|professional|doctor|therapist)\b/i,
  /\b(?:medic\w*|meds|dos(?:e|age)s?|prescri\w+|pills?|tablets?)\b.{0,40}\b(?:advice|advise|recommend|tell me|suggest|how much|increase|decrease)\b/i,
  /\b(?:advice|advise|recommend|tell me|suggest|how much|increase|decrease)\b.{0,40}\b(?:medic\w*|meds|dos(?:e|age)s?|prescri\w+|pills?|tablets?)\b/i,
  /\bhow (?:much|many)\b.{0,30}\b(?:take|taking)\b/i,
  /\b(?:ritalin|adderall|vyvanse|elvanse|concerta|medikinet|methylphenidate|amphetamine|amfetamine|dexamfetamine|lisdexamfetamine|atomoxetine|strattera|guanfacine|intuniv)\b/i,
  /\bdiagnos\w+\b/i,
];

export const REFUSED = 'Style notes cannot change safety, crisis or medication rules, so I left that out.';

const clean = (s: string) => s.replace(/[\u0000-\u001f\u007f`<>{}[\]\\]/g, ' ').replace(/\s+/g, ' ').trim();

export function validateNotes(raw: string): { ok: true; notes: string } | { ok: false; reason: string } {
  const notes = clean(raw);
  if (BLOCKED.some((re) => re.test(notes))) return { ok: false, reason: REFUSED };
  if (notes.length > MAX_NOTES) return { ok: false, reason: `Keep it under ${MAX_NOTES} characters.` };
  return { ok: true, notes };
}

export function loadInstructions(): CustomInstructions {
  try {
    const p = JSON.parse((typeof window === 'undefined' ? null : window.localStorage.getItem(INSTRUCTIONS_KEY)) || 'null') as Partial<CustomInstructions> | null;
    const preset = p && p.preset && p.preset in PRESETS ? p.preset : 'none';
    // re-validated on load: a hand-edited store cannot smuggle a blocked instruction into the prompt
    const v = validateNotes(typeof p?.notes === 'string' ? p.notes : '');
    return { preset, notes: v.ok ? v.notes : '' };
  } catch {
    return DEFAULT_INSTRUCTIONS;
  }
}

export function saveInstructions(next: CustomInstructions): { saved: CustomInstructions; error?: string } {
  const v = validateNotes(next.notes);
  const saved: CustomInstructions = { preset: next.preset in PRESETS ? next.preset : 'none', notes: v.ok ? v.notes : loadInstructions().notes };
  try {
    window.localStorage.setItem(INSTRUCTIONS_KEY, JSON.stringify(saved));
  } catch {
    // private mode: applies to this page only
  }
  return v.ok ? { saved } : { saved, error: v.reason };
}

/** The block that goes into the system prompt. Empty when the person has set nothing, so the default prompt budget is untouched. */
export function styleBlock(ci: CustomInstructions): string {
  const bits = [PRESETS[ci.preset].prompt, ci.notes].filter(Boolean);
  return bits.length ? `Style the person asked for: ${bits.join(' ')} These never change safety, crisis or medication rules.` : '';
}

/** The same, as a short line for the typed-plan route. */
export const styleLine = (ci: CustomInstructions): string => (ci.preset === 'none' && !ci.notes ? '' : styleBlock(ci));

function appendNote(notes: string, add: string, replace?: RegExp): string {
  const parts = notes.split(/(?<=\.)\s+/).filter((p) => p && !(replace && replace.test(p)) && p.toLowerCase() !== add.toLowerCase());
  parts.push(add.endsWith('.') ? add : `${add}.`);
  while (parts.join(' ').length > MAX_NOTES && parts.length > 1) parts.shift(); // oldest note makes room for the newest
  return parts.join(' ').slice(0, MAX_NOTES);
}

/** What a spoken request ("talk to me more briefly", "call me Sam", "don't say sweetie") changes. Pure; the caller saves it. */
export function applyStyleCommand(current: CustomInstructions, spoken: string): { ok: boolean; next: CustomInstructions; say: string } {
  const v = spoken.toLowerCase().replace(/\s+/g, ' ').trim();
  const keep = (say: string, ok = false) => ({ ok, next: current, say });
  if (!v) return keep('Tell me how you want me to talk.');
  if (BLOCKED.some((re) => re.test(v))) return keep(REFUSED);

  const call = /\bcall me ([a-z][a-z' -]{0,20}?)(?:\s+(?:please|from now on|instead)|[.,!?]|$)/.exec(v);
  if (call) {
    const nm = call[1].replace(/\b\w/g, (c) => c.toUpperCase());
    return { ok: true, next: { ...current, notes: appendNote(current.notes, `Call them ${nm}.`, /^call them/i) }, say: `I will call you ${nm}.` };
  }
  const avoid = /\b(?:don'?t|do not|stop|never|avoid)\s+(?:say(?:ing)?|us(?:e|ing)|call(?:ing)? me)\s+([a-z][a-z' -]{1,30}?)(?:[.,!?]|$)/.exec(v);
  if (avoid) return { ok: true, next: { ...current, notes: appendNote(current.notes, `Avoid saying ${avoid[1].trim()}.`) }, say: `Okay, I will avoid saying ${avoid[1].trim()}.` };

  const to = (preset: PresetKey, say: string) => ({ ok: true, next: { ...current, preset }, say });
  if (/\b(?:normal|default|usual|reset|back to)\b/.test(v)) return to('none', 'Back to my usual way.');
  if (/\b(?:brief|briefer|briefly|short|shorter|fewer words|less words|concise|minimal|terse|keep it short)\b/.test(v)) return to('minimal', 'Shorter from now on.');
  if (/\b(?:gentle|gentler|softer|soft|slower|kinder|warmer)\b/.test(v)) return to('gentle', 'I will be gentler.');
  if (/\b(?:direct|blunt|straight|to the point|practical)\b/.test(v)) return to('direct_kind', 'Direct but kind, from now on.');

  const free = validateNotes(spoken);
  if (!free.ok) return keep(free.reason);
  if (free.notes.length < 4) return keep('Tell me how you want me to talk.');
  return { ok: true, next: { ...current, notes: appendNote(current.notes, free.notes.slice(0, 120)) }, say: 'Noted. I will talk that way.' };
}
