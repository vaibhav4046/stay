/**
 * The model's own words for a tool call it was not allowed to make, turned into the call it meant. Live film run, 4 Nov 2026: only four
 * actions were on offer for "Show my report.", the model wrote action "show" with a "target", and the provider refused the whole turn.
 * Returns the arguments for the allowed action, or null when it cannot be told what was meant.
 */
export function repairToolCall(failedGeneration: string, allowed: readonly string[]): string | null {
  let call: { name?: unknown; arguments?: Record<string, unknown> };
  try {
    call = JSON.parse(failedGeneration);
  } catch {
    return null;
  }
  const a = call?.arguments;
  if (call?.name !== 'app' || !a || typeof a.action !== 'string') return null;
  const said = a.action.toLowerCase().replace(/[^a-z_]/g, '');
  const action = allowed.includes(said) ? said : /^(?:show|display|view|see|go|navigate|pull_up|bring_up|switch|show_report|view_report)$/.test(said) && allowed.includes('open') ? 'open' : '';
  if (!action) return null;
  const value = [a.value, a.target, a.screen, a.panel].find((v): v is string => typeof v === 'string' && v.length > 0 && v.length < 120);
  return JSON.stringify({ action, ...(value ? { value } : {}), ...(typeof a.minutes === 'number' ? { minutes: a.minutes } : {}), ...(typeof a.step === 'string' ? { step: a.step.slice(0, 160) } : {}) });
}

const PANEL = /\b(reports?|history|settings|memory|brain dump|routines?|parked|reminders?|today)\b/i;
const SHOW_WORDS = /\b(?:show|open|see|pull up|bring up|take me|let me see)\b/i;

/**
 * "Show my report." made the model write action "outcome" with a target "reports" about one time in three (live check, 4 Nov 2026): it
 * had just heard how a block went. When the person's words ask to see a screen and the call names that screen, it is an open.
 * Returns the arguments of the open, or null when the call is something else.
 */
export function outcomeAsOpen(args: string, asked: string): string | null {
  let a: Record<string, unknown>;
  try {
    a = JSON.parse(args || '{}') as Record<string, unknown>;
  } catch {
    return null;
  }
  if (a.action !== 'outcome' || !SHOW_WORDS.test(asked)) return null;
  const named = [a.value, a.target, a.screen, a.panel].find((v): v is string => typeof v === 'string');
  const panel = PANEL.exec(named ?? '')?.[1] ?? (named === undefined ? PANEL.exec(asked)?.[1] : undefined);
  return panel ? JSON.stringify({ action: 'open', value: panel.toLowerCase() }) : null;
}
