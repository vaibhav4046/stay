import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { resetSecurityStateForTests } from '@/lib/security/apiGuard';
import { CRISIS_FIXED_MESSAGE, detectCrisisSignal } from '@/lib/safety/crisis';
import { CRISIS_RESOURCES, crisisMessageFor, crisisResourcesFor, regionFromLocale } from '@/lib/safety/region';

const llm = vi.hoisted(() => ({ openLlmStream: vi.fn(), callLlm: vi.fn() }));
vi.mock('@/lib/llm/stream', () => ({ openLlmStream: llm.openLlmStream }));
vi.mock('@/lib/llm/provider', async (orig) => ({ ...(await orig<typeof import('@/lib/llm/provider')>()), callLlm: llm.callLlm }));
import { POST as chatPost } from '@/app/api/voice/chat/route';
import { POST as translatePost } from '@/app/api/voice/translate/route';
import { POST as mcpPost } from '@/app/api/mcp/route';

const CRISIS = 'I want to kill myself';
const json = (path: string, body: unknown) =>
  new NextRequest(`http://localhost:3000${path}`, { method: 'POST', headers: { host: 'localhost:3000', origin: 'http://localhost:3000', 'content-type': 'application/json' }, body: JSON.stringify(body) });

beforeEach(() => {
  resetSecurityStateForTests();
  llm.openLlmStream.mockReset();
  llm.callLlm.mockReset();
});

describe('T0.3 the crisis gate runs before any model, on every path', () => {
  it('typed text (chat route)', async () => {
    const res = await chatPost(json('/api/voice/chat', { messages: [{ role: 'user', content: CRISIS }] }));
    expect(((await res.json()) as { safety: string }).safety).toBe('crisis');
    expect(llm.openLlmStream).not.toHaveBeenCalled();
  });

  it('a spoken transcript reaches the same route as typed text, so the same gate (and FastSocket stays silent on it: fastSocket.test.ts)', async () => {
    const res = await chatPost(json('/api/voice/chat', { messages: [{ role: 'user', content: 'honestly i think i want to end my life.' }], withTools: true }));
    expect(((await res.json()) as { safety: string }).safety).toBe('crisis');
    expect(llm.openLlmStream).not.toHaveBeenCalled();
  });

  it('translation input: not sent to the translator model', async () => {
    const res = await translatePost(json('/api/voice/translate', { text: CRISIS, targetLanguage: 'es' }));
    expect(res.status).toBe(422);
    expect(((await res.json()) as { safety: string }).safety).toBe('crisis');
    expect(llm.callLlm).not.toHaveBeenCalled();
  });

  it('translation input about medication is not translated either', async () => {
    const res = await translatePost(json('/api/voice/translate', { text: 'can I double my Vyvanse dose', targetLanguage: 'es' }));
    expect(res.status).toBe(422);
    expect(((await res.json()) as { safety: string }).safety).toBe('medication');
    expect(llm.callLlm).not.toHaveBeenCalled();
  });

  it('an ordinary sentence still reaches the translator', async () => {
    llm.callLlm.mockResolvedValue({ res: new Response(JSON.stringify({ choices: [{ message: { content: 'Hola' } }] })), source: 'server' });
    await translatePost(json('/api/voice/translate', { text: 'Good morning', targetLanguage: 'es' }));
    expect(llm.callLlm).toHaveBeenCalled();
  });

  it('agent tools (MCP): crisis text gets the safety message, not a first step', async () => {
    for (const [name, args] of [['break_down_task', { taskText: CRISIS }], ['triage_brain_dump', { rawThoughts: `laundry. ${CRISIS}. emails` }]] as const) {
      const res = await mcpPost(new NextRequest('http://localhost:3000/api/mcp', { method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }) }));
      const out = JSON.parse(((await res.json()) as { result: { content: Array<{ text: string }> } }).result.content[0].text) as { safety: string; message: string };
      expect(out.safety, name).toBe('crisis');
      expect(out.message, name).toBe(CRISIS_FIXED_MESSAGE);
    }
  });

  it('text a vision model reads out of a picture: covered in conversation.test.ts (visionReplyIsSafe + the route)', () => {
    expect(detectCrisisSignal('The note says: I want to end my life').triggered).toBe(true);
  });
});

describe('T0.3 contacts follow the region', () => {
  const GB = ['999', '111', '116 123', 'Text SHOUT to 85258'];
  it('maps time zones and locales', () => {
    expect(regionFromLocale('en-US', 'Europe/London')).toBe('GB'); // a UK person with an American-English browser
    expect(regionFromLocale('en-GB', 'America/New_York')).toBe('US');
    expect(regionFromLocale('en', 'America/Toronto')).toBe('CA');
    expect(regionFromLocale('en-US', 'Asia/Kolkata')).toBe('OTHER'); // not the US just because of the browser language
    expect(regionFromLocale('en-GB', undefined)).toBe('GB');
    expect(regionFromLocale('fr-CA', undefined)).toBe('CA');
    expect(regionFromLocale(undefined, undefined)).toBe('OTHER');
  });

  it('UK message names 999, 111 and Samaritans, and not 988', () => {
    const m = crisisMessageFor('GB');
    for (const n of ['999', '111', '116 123']) expect(m).toContain(n);
    expect(m).not.toContain('988');
  });

  it('US and Canada message names 988; elsewhere names findahelpline.com', () => {
    expect(crisisMessageFor('US')).toContain('988');
    expect(crisisMessageFor('CA')).toContain('988');
    expect(crisisMessageFor('OTHER')).toContain('findahelpline.com');
    expect(crisisMessageFor('OTHER')).not.toContain('999');
  });

  it('with no region (a server), every region is named', () => {
    for (const n of ['999', '116 123', '988', 'findahelpline.com']) expect(CRISIS_FIXED_MESSAGE).toContain(n);
  });

  it('the urgent help page lists every region, the person\'s own first', () => {
    const us = crisisResourcesFor('US');
    expect(us[0].contact).toBe('988');
    expect(us.map((r) => r.contact)).toEqual(expect.arrayContaining([...GB, '988', 'findahelpline.com']));
    expect(us).toHaveLength(CRISIS_RESOURCES.length);
    expect(crisisResourcesFor('GB')[0].contact).toBe('999');
    expect(crisisResourcesFor('OTHER')[0].contact).toBe('findahelpline.com');
  });
});
