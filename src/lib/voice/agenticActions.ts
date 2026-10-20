/**
 * The new agentic tool actions, kept out of the voice hook so its diff stays small. Each returns a plain object. `say` is
 * built from what happened and `quick: true` lets the fast engine speak it directly instead of asking the model to word it.
 * Actions that change something about the person (style, learning) need an explicit spoken ask, like MEMORY_CUE.
 */
import type { CoachPlanProposal, CoachSessionRecord } from '@/types/domain';
import type { AppActionArgs } from '@/lib/voice/agentTool';
import { buildDeterministicCoachPlan } from '@/lib/coach/strategies';
import { loadToday, TODAY_KEY, type TodayItem } from '@/lib/coach/todayList';
import { applyListEdit } from '@/lib/coach/listEdit';
import { addReminder, loadReminders } from '@/lib/reminders';
import { advanceSteps, breakDown, loadSteps, MAX_REMIND_MINUTES, parseEnergyMinutes, parseWhen, pickResume, planDay, saveSteps, wrapUp } from '@/lib/coach/agentPlanner';
import { applyStyleCommand, loadInstructions, saveInstructions, styleBlock } from '@/lib/coach/customInstructions';
import { loadLearnings, setLearningsEnabled } from '@/lib/coach/learnings';
import { loadUserCalibration } from '@/lib/coach/selfImprovement';

/** A style change needs the person to have asked for one, not the model's idea of what they might like. */
export const STYLE_CUE = /\b(?:talk to me|speak to me|talk|speak|reply|answer|respond|sound|be)\s+(?:more|less|a bit|a little|much|gentler|shorter|briefer|direct|blunt|softer|slower|simpler|kinder|warmer)\b|\bcall me\b|\bdon'?t (?:say|call me|use)\b|\bstop (?:saying|calling)\b|\b(?:fewer|less) words\b|\bkeep it (?:short|brief|simple)\b|\b(?:shorter|briefer|briefly|gentler|softer|slower|simpler)\b/i;
export const LEARN_CUE = /\b(?:learn|learning|improv\w*|adapt\w*|track\w*|study)\b/i;

export interface AgenticCtx {
  now: () => Date;
  lastUserSaid: () => string;
  sessions: () => CoachSessionRecord[];
  startTimer: (minutes: number, step: string) => void;
  proposePlan: (plan: CoachPlanProposal) => void;
  todayChanged: () => void;
  remindersChanged: () => void;
  /** Adds a system note to the live session (the system prompt itself is fixed when the session starts). */
  note: (content: string) => void;
}

const out = (ok: boolean, say: string, extra: Record<string, unknown> = {}) => ({ ok, quick: ok, say, ...extra });
const hhmm = (ms: number) => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const preferredBlock = () => {
  try {
    return loadUserCalibration().preferredMinutes || null;
  } catch {
    return null;
  }
};

function writeList(list: TodayItem[]): boolean {
  try {
    window.localStorage.setItem(TODAY_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

/**
 * The fact to save for "remember that I work best in the mornings". The model sometimes passes just the cue word as the value, so a
 * value that is empty or only a cue is replaced by what the person actually said, minus the cue. Still needs MEMORY_CUE upstream.
 */
export function factFromUtterance(value: string, said: string): string {
  const v = value.trim();
  if (v.length >= 6 && !/^(?:remember|note|that|this|save|keep in mind|don'?t forget)[\s.]*$/i.test(v)) return v;
  return said.replace(/^\s*(?:please |can you |could you )?(?:remember|note|make a note|keep in mind|don'?t forget|do not forget|save)(?: that| this)?\s*/i, '').replace(/[.!?\s]+$/, '').slice(0, 160);
}

export const AGENTIC_ACTIONS = new Set(['list_edit', 'plan_day', 'break_down', 'step_next', 'wrap_up', 'resume', 'style', 'learning', 'remind']);

/** Runs one of the agentic actions. Returns null for any other action (the hook handles those). */
export function runAgenticAction(args: AppActionArgs, ctx: AgenticCtx): Record<string, unknown> | null {
  const value = String(args.value ?? '').trim();
  const now = ctx.now();
  switch (args.action) {
    case 'list_edit': {
      const r = applyListEdit(value || ctx.lastUserSaid(), now);
      if (r.ok) ctx.todayChanged();
      return out(r.ok, r.say, r.changed ? { changed: r.changed } : {});
    }

    case 'plan_day': {
      const said = parseEnergyMinutes(`${value} ${ctx.lastUserSaid()}`);
      const plan = planDay({ energy: said.energy, minutes: args.minutes && args.minutes > 0 ? args.minutes : said.minutes, items: loadToday(now), preferredBlock: preferredBlock() });
      if (!plan.empty) {
        const ids = new Map(plan.picked.map((p, i) => [p.id, i]));
        const saved = writeList(loadToday(now).map((i) => (ids.has(i.id) ? { ...i, bucket: ids.get(i.id) === 0 ? 'now' as const : 'today' as const, minutes: plan.picked[ids.get(i.id)!].minutes } : i.bucket === 'now' && !i.done ? { ...i, bucket: 'today' as const } : i)));
        if (!saved) return out(false, 'I made a plan but could not save it on this device.');
        ctx.todayChanged();
      }
      return out(true, plan.say, { picked: plan.picked.map((p) => ({ text: p.text, minutes: p.minutes })), assumed: plan.assumed });
    }

    case 'break_down': {
      const parsedTask = value || (args as { task?: string }).task || args.step || '';
      const fallbackTask = ctx.lastUserSaid().replace(/^\s*(?:can you |could you |please |hey stay |stay )?(?:break|split|cut|divide)(?:\s+down)?\s*/i, '').replace(/\s*(?:in|into|to)\s*(?:small|smaller|tiny|few)?\s*steps?.*$/i, '').replace(/[.!?\s]+$/, '').trim();
      const task = parsedTask || fallbackTask;
      if (!task) return out(false, 'Which task should I break down?');
      const plan = breakDown(task, args.minutes ?? preferredBlock() ?? 10, now);
      saveSteps(plan);
      const first = plan.steps[0];
      ctx.proposePlan({ ...buildDeterministicCoachPlan({ taskText: task, preferredMinutes: first.minutes }), firstStep: first.text, timerMinutes: first.minutes });
      const shortText = first.text.length > 45 ? first.text.slice(0, 44).trimEnd() + '…' : first.text;
      return out(true, `Step one (${first.minutes}m): ${shortText}.`, { steps: plan.steps.map((s) => ({ text: s.text, minutes: s.minutes })) });
    }

    case 'step_next': {
      const plan = loadSteps();
      if (!plan) return out(false, 'There are no steps running. Tell me a task and I will break it down.');
      let p = plan;
      let finishedOne = false;
      if (plan.cursor !== undefined) {
        const a = advanceSteps(p);
        p = a.plan;
        finishedOne = a.finished !== null;
      }
      const next = p.steps.find((s) => !s.done);
      if (!next) {
        saveSteps(null);
        return out(true, 'That was the last step. Nicely done.');
      }
      const index = p.steps.indexOf(next);
      saveSteps({ ...p, cursor: index });
      ctx.startTimer(next.minutes, next.text);
      return out(true, `${finishedOne ? 'Good. ' : ''}Step ${index + 1} of ${p.steps.length}, ${next.minutes} minutes: ${next.text}. Timer started.`, { minutes: next.minutes, step: index + 1 });
    }

    case 'wrap_up': {
      const w = wrapUp(loadToday(now), ctx.sessions(), now);
      return out(true, w.say, { wins: w.wins });
    }

    case 'resume': {
      const item = pickResume(loadToday(now), now);
      if (!item) return out(false, 'Nothing is waiting from before. Want to start something small?');
      const plan = buildDeterministicCoachPlan({ taskText: item.text, preferredMinutes: item.minutes ?? preferredBlock() ?? undefined });
      if (item.firstStep) plan.firstStep = item.firstStep;
      const list = loadToday(now);
      if (writeList(list.map((i) => (i.id === item.id ? { ...i, bucket: 'now' as const, createdAt: now.toISOString() } : i.bucket === 'now' && !i.done ? { ...i, bucket: 'today' as const } : i)))) ctx.todayChanged();
      ctx.proposePlan(plan);
      const step = plan.firstStep.length > 110 ? `${plan.firstStep.slice(0, 109).trimEnd()}…` : plan.firstStep;
      return out(true, `Picking up ${item.text.length > 40 ? `${item.text.slice(0, 39)}…` : item.text}. First step: ${step}`, { item: item.text });
    }

    case 'style': {
      if (!STYLE_CUE.test(ctx.lastUserSaid())) return { ok: false, error: 'not changed: the person did not ask for a different way of talking' };
      const cur = loadInstructions();
      const r = applyStyleCommand(cur, value || ctx.lastUserSaid());
      if (!r.ok) return { ok: false, say: r.say, error: r.say };
      const { saved, error } = saveInstructions(r.next);
      if (error) return { ok: false, say: error, error };
      ctx.note(styleBlock(saved) || 'Style: back to your usual way.');
      return out(true, r.say, { preset: saved.preset });
    }

    case 'learning': {
      if (!LEARN_CUE.test(ctx.lastUserSaid())) return { ok: false, error: 'not changed: the person did not ask about learning' };
      const on = !/\b(?:off|stop|disable|don'?t|no)\b/i.test(`${value} ${ctx.lastUserSaid()}`) ;
      setLearningsEnabled(on);
      return out(true, on ? 'I will keep learning from your blocks. The Memory screen shows why for each thing.' : 'Okay, I have stopped learning from your blocks. Nothing new will be saved. What I learned before is still on the Memory screen to keep or delete.', { learning: on ? 'on' : 'off', items: loadLearnings().items.length });
    }

    case 'remind': {
      const when = parseWhen(value || ctx.lastUserSaid(), now);
      const mins = args.minutes && args.minutes > 0 ? args.minutes : when.minutes;
      if (!mins || mins < 1) return { ok: false, error: 'say after how many minutes, or at what time', say: 'When should I check in? Say in how many minutes, or at what time.' };
      if (mins > MAX_REMIND_MINUTES) return { ok: false, error: 'check-ins can be set up to four hours ahead', say: 'I can set a check-in up to four hours ahead. Want one sooner?' };
      const text = when.text.replace(/\b\d+\s*(?:min(?:ute)?s?|h(?:ours?)?)\b/i, '').trim() || 'Check in';
      const { reminder } = addReminder(mins, text, now.getTime());
      ctx.remindersChanged();
      return out(true, `Okay, I will check in at ${hhmm(reminder.dueAt)}${text === 'Check in' ? '' : ` about ${text.slice(0, 40)}`}, gently.`, { minutes: Math.round(mins), total: loadReminders().length });
    }

    default:
      return null;
  }
}
