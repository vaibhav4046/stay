import { describe, it, expect, vi } from 'vitest';
import { GET } from '@/app/api/health/route';

describe('/api/health', () => {
  it('answers ok without calling any provider, and never shows a key', async () => {
    vi.stubEnv('GROQ_API_KEYS', 'secret-key-one-1234567890,secret-key-two-1234567890');
    vi.stubEnv('GROQ_API_KEY', 'secret-key-one-1234567890');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const res = GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.configured.modelKeys).toBe(2); // counted once each
    expect(JSON.stringify(body)).not.toContain('secret-key');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
});
