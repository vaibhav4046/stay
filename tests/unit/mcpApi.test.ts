import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/mcp/route';
import { NextRequest } from 'next/server';

describe('MCP Server API route (/api/mcp)', () => {
  it('responds with tool list on tools/list', async () => {
    const req = new NextRequest('http://localhost:3000/api/mcp', {
      method: 'POST',
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
      }),
    });
    const res = await POST(req);
    const json = await res.json();
    expect(json.jsonrpc).toBe('2.0');
    expect(json.result.tools).toBeDefined();
    expect(json.result.tools.map((t: { name: string }) => t.name)).toContain('break_down_task');
  });

  it('executes break_down_task via tools/call', async () => {
    const req = new NextRequest('http://localhost:3000/api/mcp', {
      method: 'POST',
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'break_down_task',
          arguments: {
            taskText: 'Clean my desk',
            strategy: 'task_shrinking',
          },
        },
      }),
    });
    const res = await POST(req);
    const json = await res.json();
    expect(json.jsonrpc).toBe('2.0');
    expect(json.result.content[0].type).toBe('text');
    const parsed = JSON.parse(json.result.content[0].text);
    expect(parsed.suggestedMinutes).toBe(2);
    expect(parsed.firstStep).toBeDefined();
  });

  it('returns JSON-RPC 2.0 error on unknown method', async () => {
    const req = new NextRequest('http://localhost:3000/api/mcp', {
      method: 'POST',
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'unknown/method',
      }),
    });
    const res = await POST(req);
    const json = await res.json();
    expect(json.error).toBeDefined();
    expect(json.error.code).toBe(-32601);
  });
});
