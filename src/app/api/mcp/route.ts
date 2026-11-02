import { NextRequest, NextResponse } from 'next/server';
import { buildDeterministicFirstStep } from '@/lib/coach/strategies';
import { fallbackTriage } from '@/lib/coach/triage';
import { attachGuardHeaders, guardPaidRoute, readBoundedJson } from '@/lib/security/apiGuard';
import { CRISIS_FIXED_MESSAGE, MEDICAL_BOUNDARY_FIXED_MESSAGE, detectCrisisSignal, detectMedicationAdviceRequest } from '@/lib/safety/crisis';

export const runtime = 'nodejs';

function checkAgentAuth(req: NextRequest): NextResponse | null {
  const configuredToken = process.env.STAY_AGENT_API_TOKEN?.trim();
  const requireAuth =
    Boolean(configuredToken) ||
    req.headers.get('x-stay-require-agent-auth') === '1' ||
    process.env.NODE_ENV === 'production';

  if (!requireAuth) return null;

  const authHeader = req.headers.get('authorization')?.trim() || '';
  const expected = configuredToken ? `Bearer ${configuredToken}` : '';
  if (!expected || authHeader !== expected) {
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Unauthorized: valid Bearer token required.' } },
      { status: 401 }
    );
  }
  return null;
}

interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

const MCP_TOOLS: McpTool[] = [
  {
    name: 'break_down_task',
    description: 'Deconstructs an overwhelming task into a microscopic, non-threatening 2-minute first step for an ADHD user.',
    inputSchema: {
      type: 'object',
      properties: {
        taskText: { type: 'string', description: 'The task the user is avoiding or feeling overwhelmed by.' },
        strategy: {
          type: 'string',
          enum: ['task_shrinking', 'implementation_intention', 'reframing', 'timeboxing'],
          description: 'The preferred psychological coaching strategy.',
        },
      },
      required: ['taskText'],
    },
  },
  {
    name: 'triage_brain_dump',
    description: 'Takes unstructured messy thoughts and categorizes them into Now (1 item), Today (few), and Later.',
    inputSchema: {
      type: 'object',
      properties: {
        rawThoughts: { type: 'string', description: 'Everything on the user’s mind in any order.' },
      },
      required: ['rawThoughts'],
    },
  },
  {
    name: 'ground_nervous_system',
    description: 'Provides a short somatic nervous-system regulation cue (breathing or 5-4-3-2-1 sensory orientation).',
    inputSchema: {
      type: 'object',
      properties: {
        intensity: { type: 'string', enum: ['mild', 'moderate', 'acute'], description: 'Level of freeze/overwhelm.' },
      },
    },
  },
];

export async function POST(req: NextRequest) {
  const guard = guardPaidRoute(req, 'agent');
  if (!guard.ok && guard.response) return guard.response;

  const authErr = checkAgentAuth(req);
  if (authErr) return authErr;

  try {
    const parsedBody = await readBoundedJson<Record<string, any>>(req, 32_768);
    if (!parsedBody.ok) return parsedBody.response;
    const body = parsedBody.data;
    const { jsonrpc, id, method, params } = body || {};

    if (jsonrpc !== '2.0') {
      return attachGuardHeaders(
        NextResponse.json(
          { jsonrpc: '2.0', id: id ?? null, error: { code: -32600, message: 'Invalid Request: jsonrpc must be 2.0' } },
          { status: 400 }
        ),
        guard
      );
    }

    // 1. tools/list
    if (method === 'tools/list') {
      return attachGuardHeaders(
        NextResponse.json({
          jsonrpc: '2.0',
          id,
          result: {
            tools: MCP_TOOLS,
          },
        }),
        guard
      );
    }

    // 2. tools/call
    if (method === 'tools/call') {
      const toolName = params?.name;
      const args = params?.arguments || {};

      // crisis and medication gates come before any tool, as on every other path
      const toolInput = [args.taskText, args.rawThoughts].filter((v): v is string => typeof v === 'string').join(' ');
      const toolSafety = detectCrisisSignal(toolInput).triggered ? 'crisis' : detectMedicationAdviceRequest(toolInput).triggered ? 'medication' : null;
      if (toolSafety) {
        return attachGuardHeaders(
          NextResponse.json({
            jsonrpc: '2.0',
            id,
            result: { isError: false, content: [{ type: 'text', text: JSON.stringify({ safety: toolSafety, message: toolSafety === 'crisis' ? CRISIS_FIXED_MESSAGE : MEDICAL_BOUNDARY_FIXED_MESSAGE }) }] },
          }),
          guard
        );
      }

      if (toolName === 'break_down_task') {
        const taskText = String(args.taskText || 'start task').slice(0, 500);
        const strategy = args.strategy || 'task_shrinking';
        const step = buildDeterministicFirstStep(taskText, strategy);
        return attachGuardHeaders(
          NextResponse.json({
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    firstStep: step,
                    strategyUsed: strategy,
                    suggestedMinutes: 2,
                    whyThisFits: 'Shrinks the opening move into a concrete 2-minute physical step to lower initiation friction.',
                  }),
                },
              ],
            },
          }),
          guard
        );
      }

      if (toolName === 'triage_brain_dump') {
        const raw = String(args.rawThoughts || '');
        const triaged = fallbackTriage(raw);
        return NextResponse.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(triaged),
              },
            ],
          },
        });
      }

      if (toolName === 'ground_nervous_system') {
        return NextResponse.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  exercise: 'Orb Breath Synchronization',
                  instruction: 'Take one slow breath with the expanding orb for 10 seconds. Release all tension in shoulders.',
                  durationSeconds: 10,
                }),
              },
            ],
          },
        });
      }

      return NextResponse.json(
        { jsonrpc: '2.0', id, error: { code: -32601, message: `Tool not found: ${toolName}` } },
        { status: 404 }
      );
    }

    // 3. resources/list
    if (method === 'resources/list') {
      return NextResponse.json({
        jsonrpc: '2.0',
        id,
        result: {
          resources: [
            {
              uri: 'stay://governance/model-routing',
              name: 'Multi-Tenant MCP Governance Matrix',
              mimeType: 'application/json',
            },
          ],
        },
      });
    }

    return NextResponse.json(
      { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not supported: ${method}` } },
      { status: 404 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal MCP Error';
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32603, message: msg } },
      { status: 500 }
    );
  }
}
