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
} from '@/lib/safety/crisis';

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
    const crisisPlan = buildDeterministicCoachPlan(input);
    return NextResponse.json(crisisPlan, { status: 200 });
  }

  const medCheck = detectMedicationAdviceRequest(input.taskText);
  if (medCheck.triggered) {
    const medPlan = buildDeterministicCoachPlan(input);
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

    const systemPrompt = `You are Stay, a calm, practical task-initiation companion for adults with ADHD.
Return ONLY a valid JSON object matching this exact schema:
{
  "spokenResponse": "string (under 35 words, warm and matter-of-fact, never preachy)",
  "taskText": "string",
  "barrierType": "${barrierType}",
  "strategyKey": "${strategyKey}",
  "strategyLabel": "${strategyDef.label}",
  "firstStep": "string (concrete physical action taking under 2 minutes to begin)",
  "whyThisFits": "string (1 concise sentence explaining why this strategy helps this barrier)",
  "timerMinutes": ${fallbackPlan.timerMinutes},
  "checkinPrompt": "string (1 short question to ask when the timer ends)",
  "safetyFlag": "none"
}
Hard rules:
- Never diagnose ADHD or any condition.
- Never give medication or dosing advice.
- Do not wrap the JSON in markdown fences.`;

    const userPrompt = `User care context: ${input.careContext}
Task being avoided: "${input.taskText}"
Primary barrier: ${barrierDef.label} (${barrierType})
Selected strategy: ${strategyDef.label} (${strategyKey})
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
