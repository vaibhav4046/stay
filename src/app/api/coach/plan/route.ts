import { NextRequest, NextResponse } from 'next/server';
import {
  CoachPlanRequestSchema,
  CoachPlanResponseSchema,
} from '@/lib/coach/schema';
import {
  BARRIER_DEFINITIONS,
  STRATEGY_DEFINITIONS,
  buildDeterministicCoachPlan,
  chooseBestStrategy,
  inferBarrierFromTask,
} from '@/lib/coach/strategies';
import {
  detectCrisisSignal,
  detectMedicationAdviceRequest,
  CRISIS_RESOURCES,
} from '@/lib/safety/crisis';
import { compressPromptForTokenEfficiency } from '@/lib/voice/tokenOptimizer';
import { callLlm, llmHeaders } from '@/lib/llm/provider';
import { attachGuardHeaders, guardPaidRoute, readBoundedJson } from '@/lib/security/apiGuard';
import type { CoachPlanProposal } from '@/types/domain';

export async function POST(req: NextRequest) {
  const guard = guardPaidRoute(req, 'coach');
  if (!guard.ok && guard.response) return guard.response;

  const parsedBody = await readBoundedJson(req, 32_768);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.data;

  const parsedReq = CoachPlanRequestSchema.safeParse(body);
  if (!parsedReq.success) {
    return attachGuardHeaders(
      NextResponse.json(
        {
          error: parsedReq.error.issues[0]?.message || 'Please enter a valid task description.',
        },
        { status: 400 }
      ),
      guard
    );
  }

  const input = parsedReq.data;

  // 1. Pre-LLM deterministic safety checks (Crisis & Medication Dosing)
  const crisisCheck = detectCrisisSignal(input.taskText);
  if (crisisCheck.triggered) {
    const crisisPlan: CoachPlanProposal = {
      spokenResponse: crisisCheck.message,
      taskText: input.taskText,
      barrierType: 'other',
      strategyKey: 'task_shrinking',
      strategyLabel: 'Crisis Resources & Immediate Support',
      firstStep: 'Pause task coaching and connect with human crisis support right now.',
      whyThisFits: 'Immediate personal safety comes before any task.',
      timerMinutes: 0,
      checkinPrompt: 'Please reach out for human support now. Numbers for your country are listed here, and findahelpline.com has more.',
      safetyFlag: 'crisis',
      resources: CRISIS_RESOURCES,
    };
    return NextResponse.json(crisisPlan, { status: 200 });
  }

  const medCheck = detectMedicationAdviceRequest(input.taskText);
  if (medCheck.triggered) {
    const medPlan: CoachPlanProposal = {
      spokenResponse: medCheck.message,
      taskText: input.taskText,
      barrierType: 'other',
      strategyKey: 'task_shrinking',
      strategyLabel: 'Prescriber / Pharmacist Referral',
      firstStep: 'Consult your prescribing clinician or pharmacist regarding medication queries.',
      whyThisFits: 'Stay never gives medication or dosing advice.',
      timerMinutes: 0,
      checkinPrompt: 'Please speak with your prescribing clinician or pharmacist.',
      safetyFlag: 'medical_boundary',
    };
    return NextResponse.json(medPlan, { status: 200 });
  }

  // 2. Determine barrier & best strategy candidate
  const barrierType = input.barrierType || inferBarrierFromTask(input.taskText);
  const { strategyKey } = chooseBestStrategy({
    barrierType,
    preferredStrategy: input.preferredStrategy,
    strategyHistory: input.strategyHistory,
  });

  // No plan cache: a shared cache keyed on the task text served one person's personalised plan to another person.

  const fallbackPlan = buildDeterministicCoachPlan({
    ...input,
    barrierType,
    preferredStrategy: strategyKey,
  });

  const groqModel = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

  try {
    const strategyDef = STRATEGY_DEFINITIONS[strategyKey];
    const barrierDef = BARRIER_DEFINITIONS[barrierType];

    const systemPrompt = compressPromptForTokenEfficiency(`You are Stay, a calm, practical friend for an adult with ADHD.
Plain words and contractions, no clinical jargon, no lectures. Never open with "I hear you", "I'm right here with you" or "It sounds like".
Your spoken response must be under 35 words: one tiny physical first step that names the thing it is about, then one short question about a timer. Never repeat the person's own sentence back to them.

${input.userMemoryPrompt ? `${input.userMemoryPrompt}\n\n` : ''}Return ONLY a valid JSON object matching this exact schema:
{
  "spokenResponse": "string (under 35 words, plain and friendly)",
  "taskText": "string",
  "barrierType": "${barrierType}",
  "strategyKey": "${strategyKey}",
  "strategyLabel": "${strategyDef.label}",
  "firstStep": "string (one concrete physical move that takes under 90 seconds to begin, under 20 words)",
  "whyThisFits": "string (one plain sentence on why this step is easier to start)",
  "timerMinutes": ${input.preferredMinutes || fallbackPlan.timerMinutes},
  "checkinPrompt": "string (one short, non-judgmental question for when the timer ends)",
  "safetyFlag": "none"
}
Hard rules:
- MULTILINGUAL CONVERSATION: Detect the language and script of the user's task description (e.g. Hindi, Hinglish, Korean, Spanish, French, German, Japanese, Mandarin, Arabic, Portuguese, etc.). If the task is in a non-English language or mixed vernacular, write ALL string fields ("spokenResponse", "firstStep", "whyThisFits", "checkinPrompt") in that EXACT SAME language in plain, natural language.
- Never diagnose ADHD or any medical condition.
- Never give medication or dosing advice.
- Do not wrap the JSON in markdown fences.`);

    const userPrompt = compressPromptForTokenEfficiency(`User care context: ${input.careContext}
Task being avoided: "${input.taskText}"
Primary barrier: ${barrierDef.label} (${barrierType})
Selected strategy: ${strategyDef.label} (${strategyKey})
Target focus block: ${input.preferredMinutes || fallbackPlan.timerMinutes} minutes
Generate the JSON coaching plan.`);

    const llm = await callLlm(req, {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      maxTokens: 700,
      temperature: 0.3,
      serverModel: groqModel,
      timeoutMs: 7000,
    });
    const hdr = { headers: llmHeaders(llm) };
    if (!llm.ok) return NextResponse.json(fallbackPlan, { status: 200, ...hdr });

    const rawContent: string = llm.text;
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(fallbackPlan, { status: 200, ...hdr });
    }

    const candidate = JSON.parse(jsonMatch[0]);
    const validated = CoachPlanResponseSchema.safeParse({
      ...fallbackPlan,
      ...candidate,
      taskText: input.taskText.trim(),
      // the block length is the person's choice (short by default); the model may not stretch it
      timerMinutes: input.preferredMinutes || candidate.timerMinutes || fallbackPlan.timerMinutes,
      barrierType,
      strategyKey,
      strategyLabel: strategyDef.label,
      safetyFlag: 'none',
    });

    if (!validated.success) {
      return NextResponse.json(fallbackPlan, { status: 200, ...hdr });
    }

    // Ensure LLM response did not accidentally introduce medical dosing advice
    if (detectMedicationAdviceRequest(validated.data.spokenResponse).triggered) {
      return NextResponse.json(fallbackPlan, { status: 200, ...hdr });
    }

    return NextResponse.json(validated.data, { status: 200, ...hdr });
  } catch {
    return NextResponse.json(fallbackPlan, { status: 200 });
  }
}
