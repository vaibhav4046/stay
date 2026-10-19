/**
 * Self-check for spoken confirmations. A tool result carries a `say` line built from what actually happened. When the model
 * words its own confirmation instead, this compares it to the result and flags a mismatch (claiming success after a failure,
 * reporting failure after a success, quoting different minutes), so the hook can speak the true line instead.
 * Simple confirmations skip the model entirely (quickConfirmation in fastSocket speaks `say`), which cannot mismatch.
 */
export interface ToolOutcome {
  action: string;
  result: { ok?: boolean; say?: string; minutes?: number; error?: string } & Record<string, unknown>;
}

const CLAIMS_SUCCESS = /\b(?:done|saved|added|moved|marked|removed|parked|started|scheduled|all set|got it|sorted|i(?:'ve| have) (?:added|saved|moved|set|started|marked|removed))\b/i;
const CLAIMS_FAILURE = /\b(?:couldn'?t|could not|can'?t|cannot|unable to|didn'?t work|did not work|failed|went wrong|not able)\b/i;

export interface Verdict {
  ok: boolean;
  issue?: 'claimed_success_after_failure' | 'reported_failure_after_success' | 'wrong_minutes';
  /** What to say instead: always derived from the tool result. */
  correction?: string;
}

export function truthfulLine(o: ToolOutcome): string {
  if (o.result.ok === true) return o.result.say || 'Done.';
  return o.result.say || (o.result.error ? `That did not work: ${o.result.error.replace(/[.\s]+$/, '')}.` : 'That did not work.');
}

export function verifySpoken(o: ToolOutcome, spoken: string): Verdict {
  const text = spoken.trim();
  if (!text) return { ok: true };
  if (o.result.ok === false && CLAIMS_SUCCESS.test(text) && !CLAIMS_FAILURE.test(text)) {
    return { ok: false, issue: 'claimed_success_after_failure', correction: truthfulLine(o) };
  }
  if (o.result.ok === true && CLAIMS_FAILURE.test(text) && !CLAIMS_SUCCESS.test(text)) {
    return { ok: false, issue: 'reported_failure_after_success', correction: truthfulLine(o) };
  }
  if (o.result.ok === true && typeof o.result.minutes === 'number') {
    const said = [...text.matchAll(/(\d+)\s*-?\s*min/gi)].map((m) => Number(m[1]));
    if (said.length > 0 && !said.includes(o.result.minutes)) return { ok: false, issue: 'wrong_minutes', correction: truthfulLine(o) };
  }
  return { ok: true };
}
