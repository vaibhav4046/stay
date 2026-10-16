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
  UK_CRISIS_RESOURCES,
} from '@/lib/safety/crisis';
import type { CoachPlanProposal } from '@/types/domain';

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 });
  }

  const parsedReq = CoachPlanRequestSchema.safeParse(body);
  if (!parsedReq.success) {
    return NextResponse.json(
      {
        error: parsedReq.error.issues[0]?.message || 'Please enter a valid task description.',
      },
      { status: 400 }
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
      checkinPrompt: 'Please connect with 999, NHS 111, or Samaritans on 116 123.',
      safetyFlag: 'crisis',
      resources: UK_CRISIS_RESOURCES,
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

  const fallbackPlan = buildDeterministicCoachPlan({
    ...input,
    barrierType,
    preferredStrategy: strategyKey,
  });

  const groqKey = process.env.GROQ_API_KEY;
  const groqModel = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

  if (!groqKey) {
    return NextResponse.json(fallbackPlan, { status: 200 });
  }

  try {
    const strategyDef = STRATEGY_DEFINITIONS[strategyKey];
    const barrierDef = BARRIER_DEFINITIONS[barrierType];

    const systemPrompt = `You are Stay, an authentic, warm, deeply human body-double companion for adults with ADHD.
You speak like a trusted, empathetic friend sitting right across the table — casual contractions ("I'm", "let's", "you're"), natural conversational cadence, zero clinical jargon, zero condescending lectures, 100% warm reassurance.
Your spoken response MUST be under 35 words. Gently validate how heavy starting feels, propose one ridiculously tiny physical move, and offer to keep time.

${input.userMemoryPrompt ? `${input.userMemoryPrompt}\n\n` : ''}Return ONLY a valid JSON object matching this exact schema:
{
  "spokenResponse": "string (under 35 words, warm, casual, empathetic friend register)",
  "taskText": "string",
  "barrierType": "${barrierType}",
  "strategyKey": "${strategyKey}",
  "strategyLabel": "${strategyDef.label}",
  "firstStep": "string (concrete physical move taking under 90 seconds to begin)",
  "whyThisFits": "string (1 warm sentence explaining how this removes the pressure)",
  "timerMinutes": ${input.preferredMinutes || fallbackPlan.timerMinutes},
  "checkinPrompt": "string (1 casual, non-judgmental question for when the timer ends)",
  "safetyFlag": "none"
}
Hard rules:
- Never diagnose ADHD or any medical condition.
- Never give medication or dosing advice.
- Do not wrap the JSON in markdown fences.`;

    const userPrompt = `User care context: ${input.careContext}
Task being avoided: "${input.taskText}"
Primary barrier: ${barrierDef.label} (${barrierType})
Selected strategy: ${strategyDef.label} (${strategyKey})
Target focus block: ${input.preferredMinutes || fallbackPlan.timerMinutes} minutes
Generate the JSON coaching plan.`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5500);

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: groqModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 350,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json(fallbackPlan, { status: 200 });
    }

    const data = await res.json();
    const rawContent: string = data.choices?.[0]?.message?.content || '';
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(fallbackPlan, { status: 200 });
    }

    const candidate = JSON.parse(jsonMatch[0]);
    const validated = CoachPlanResponseSchema.safeParse({
      ...fallbackPlan,
      ...candidate,
      taskText: input.taskText.trim(),
      barrierType,
      strategyKey,
      strategyLabel: strategyDef.label,
      safetyFlag: 'none',
    });

    if (!validated.success) {
      return NextResponse.json(fallbackPlan, { status: 200 });
    }

    // Ensure LLM response did not accidentally introduce medical dosing advice
    if (detectMedicationAdviceRequest(validated.data.spokenResponse).triggered) {
      return NextResponse.json(fallbackPlan, { status: 200 });
    }

    return NextResponse.json(validated.data, { status: 200 });
  } catch {
    return NextResponse.json(fallbackPlan, { status: 200 });
  }
}
