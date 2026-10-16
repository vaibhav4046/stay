import fs from 'node:fs';
import path from 'node:path';

// Load .env.local if present
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].trim();
    }
  }
}

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
const EXISTING_AGENT_ID = process.env.ASSEMBLYAI_AGENT_ID;

if (!ASSEMBLYAI_API_KEY || !GROQ_API_KEY) {
  console.error('Missing ASSEMBLYAI_API_KEY or GROQ_API_KEY in environment or .env.local');
  process.exit(1);
}

const STAY_SYSTEM_PROMPT = `You are Stay, a calm, practical task-initiation companion for adults with ADHD.

Rules:
- Keep spoken responses under 35 words unless the user asks for more detail.
- Never diagnose ADHD or any other condition.
- Never recommend, adjust, start, stop, or compare medications or doses.
- If the user mentions self-harm, suicide, or immediate danger, stop coaching immediately and direct them to emergency and crisis support: UK 999, NHS 111, or Samaritans 116 123.
- Help the user pick ONE concrete task, identify the main barrier (overwhelm, unclear_next_step, perfectionism_or_fear, boredom_or_distraction, low_energy, or other), choose ONE practical strategy (task_shrinking, implementation_intention, reframing, or timeboxing), shrink the first step so it takes under two minutes to start, and start a short focus timer (5, 10, or 15 minutes).
- Use a calm, non-judgmental, adult tone. Never scold, guilt, or use productivity hype.
- When you have identified the user's task, barrier, strategy, and first step, call the client tool propose_coaching_plan or start_focus_timer when appropriate.`;

const TOOLS = [
  {
    type: 'function',
    name: 'propose_coaching_plan',
    description: 'Update the Stay UI with a concrete shrunk first step, barrier, strategy, and suggested focus timer duration.',
    parameters: {
      type: 'object',
      properties: {
        taskText: { type: 'string', description: 'The task the user is trying to start.' },
        barrierType: {
          type: 'string',
          enum: ['overwhelm', 'unclear_next_step', 'perfectionism_or_fear', 'boredom_or_distraction', 'low_energy', 'other']
        },
        strategyKey: {
          type: 'string',
          enum: ['task_shrinking', 'implementation_intention', 'reframing', 'timeboxing']
        },
        firstStep: { type: 'string', description: 'A concrete action that takes under two minutes to begin.' },
        timerMinutes: { type: 'integer', enum: [5, 10, 15] }
      },
      required: ['taskText', 'barrierType', 'strategyKey', 'firstStep', 'timerMinutes']
    }
  },
  {
    type: 'function',
    name: 'start_focus_timer',
    description: 'Start the Stay focus timer in the user interface once the user agrees to begin their first step.',
    parameters: {
      type: 'object',
      properties: {
        minutes: { type: 'integer', enum: [5, 10, 15], description: 'Focus timer duration in minutes.' },
        firstStep: { type: 'string', description: 'The single small step the user is focusing on.' }
      },
      required: ['minutes', 'firstStep']
    }
  },
  {
    type: 'function',
    name: 'record_session_outcome',
    description: 'Log the outcome of the focus block when the user reports how it went.',
    parameters: {
      type: 'object',
      properties: {
        outcome: { type: 'string', enum: ['started', 'partly_started', 'not_started', 'paused_or_stopped'] },
        helpfulRating: { type: 'integer', minimum: 1, maximum: 5 }
      },
      required: ['outcome']
    }
  }
];

async function syncAgent() {
  const payload = {
    name: 'stay-adhd-companion-v1',
    system_prompt: STAY_SYSTEM_PROMPT,
    greeting: "Hi, I'm Stay. Tell me one thing you're avoiding right now, and we'll make the first step smaller.",
    voice: { voice_id: 'anna' },
    output: {
      type: 'audio',
      voice: 'anna',
      format: { encoding: 'audio/pcm', sample_rate: 24000 }
    },
    tools: TOOLS,
    llm: [
      {
        base_url: 'https://api.groq.com/openai/v1',
        model: GROQ_MODEL,
        api_key: GROQ_API_KEY
      }
    ]
  };

  const url = EXISTING_AGENT_ID
    ? `https://agents.assemblyai.com/v1/agents/${EXISTING_AGENT_ID}`
    : 'https://agents.assemblyai.com/v1/agents';
  const method = EXISTING_AGENT_ID ? 'PUT' : 'POST';

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${ASSEMBLYAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    console.error(`Failed to ${method} agent: status ${res.status}`);
    process.exit(1);
  }

  const data = await res.json();
  console.log(`Synced AssemblyAI Voice Agent: ${data.id} (voice: ${data.output?.voice || data.voice?.voice_id})`);
}

syncAgent().catch((err) => {
  console.error('Error syncing agent:', err.message);
  process.exit(1);
});
