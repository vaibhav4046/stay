import { describe, expect, it } from 'vitest';
import { readUserLlm, safeBaseUrl } from '@/lib/llm/provider';
import { byokHeaders, resolveTarget, EMPTY_BYOK } from '@/lib/byok/config';

const req = (h: Record<string, string>) => new Request('https://stay.test/api/x', { headers: h });

describe('safeBaseUrl (SSRF guard for custom providers)', () => {
  it.each([
    'https://api.groq.com/openai/v1',
    'https://api.mistral.ai/v1/',
    'https://openrouter.ai/api/v1',
  ])('accepts %s', (u) => expect(safeBaseUrl(u)).not.toBeNull());

  it.each([
    'http://api.groq.com/openai/v1',
    'https://localhost:3000/v1',
    'https://127.0.0.1/v1',
    'https://169.254.169.254/latest',
    'https://10.0.0.5/v1',
    'https://192.168.1.2/v1',
    'https://[::1]/v1',
    'https://printer.local/v1',
    'https://db.internal/v1',
    'https://intranet/v1',
    'https://user:pass@api.groq.com/v1',
    'ftp://api.groq.com',
    'not a url',
  ])('rejects %s', (u) => expect(safeBaseUrl(u)).toBeNull());

  it('strips trailing slashes and keeps the path', () => {
    expect(safeBaseUrl('https://api.mistral.ai/v1///')).toBe('https://api.mistral.ai/v1');
  });
});

describe('readUserLlm', () => {
  const good = { 'x-stay-llm-key': 'sk-abc123', 'x-stay-llm-base': 'https://api.mistral.ai/v1', 'x-stay-llm-model': 'mistral-small-latest' };
  it('reads a complete, safe set of headers', () => {
    expect(readUserLlm(req(good))).toEqual({ key: 'sk-abc123', baseUrl: 'https://api.mistral.ai/v1', model: 'mistral-small-latest' });
  });
  it('needs all three headers', () => {
    expect(readUserLlm(req({ ...good, 'x-stay-llm-model': '' }))).toBeNull();
    expect(readUserLlm(req({}))).toBeNull();
  });
  it('refuses private hosts, odd models and keys with whitespace', () => {
    expect(readUserLlm(req({ ...good, 'x-stay-llm-base': 'https://127.0.0.1/v1' }))).toBeNull();
    expect(readUserLlm(req({ ...good, 'x-stay-llm-model': 'a b; drop' }))).toBeNull();
    expect(readUserLlm(req({ ...good, 'x-stay-llm-key': 'sk abc' }))).toBeNull();
  });
});

describe('client config to headers', () => {
  it('sends nothing for the shared default', () => {
    expect(byokHeaders(EMPTY_BYOK)).toEqual({});
  });
  it('uses the preset address and model unless overridden', () => {
    const h = byokHeaders({ ...EMPTY_BYOK, provider: 'mistral', llmKey: ' k ' });
    expect(h).toEqual({ 'x-stay-llm-key': 'k', 'x-stay-llm-base': 'https://api.mistral.ai/v1', 'x-stay-llm-model': 'mistral-small-latest' });
    expect(resolveTarget({ ...EMPTY_BYOK, provider: 'groq', llmKey: 'k', model: 'openai/gpt-oss-20b' })?.model).toBe('openai/gpt-oss-20b');
  });
  it('custom needs both address and model; AssemblyAI key rides alone', () => {
    expect(byokHeaders({ ...EMPTY_BYOK, provider: 'custom', llmKey: 'k' })).toEqual({});
    expect(byokHeaders({ ...EMPTY_BYOK, assemblyKey: 'aai-key' })).toEqual({ 'x-stay-aai-key': 'aai-key' });
  });
});
