import { beforeEach, describe, expect, it, vi } from 'vitest';

const lookup = vi.fn();
vi.mock('node:dns/promises', () => ({ lookup: (...a: unknown[]) => lookup(...a) }));

import { allowByokUse, isPrivateIp, resolvesPublic, userTargetUsable } from '@/lib/llm/provider';

beforeEach(() => lookup.mockReset());

describe('isPrivateIp', () => {
  it.each(['0.0.0.0', '10.1.2.3', '127.0.0.1', '169.254.169.254', '172.16.0.1', '172.31.255.255', '192.168.1.1', '100.64.0.1', '100.127.1.1', '198.18.0.1', '224.0.0.1', '255.255.255.255', '::', '::1', 'fc00::1', 'fd12:3456::1', 'fe80::1', 'febf::1', 'ff02::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1', 'garbage', '1.2.3'])('private or unusable: %s', (ip) => expect(isPrivateIp(ip)).toBe(true));
  it.each(['8.8.8.8', '1.1.1.1', '172.15.0.1', '172.32.0.1', '100.128.0.1', '198.20.0.1', '2606:4700:4700::1111', '2a00:1450:4009:81f::200e', '::ffff:8.8.8.8'])('public: %s', (ip) => expect(isPrivateIp(ip)).toBe(false));
});

describe('resolvesPublic (a public-looking name must not lead somewhere private)', () => {
  it('accepts names that resolve only to public addresses', async () => {
    lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }, { address: '2606:2800:220:1::1', family: 6 }]);
    expect(await resolvesPublic('llm.example-public.com')).toBe(true);
  });
  it('rejects a name that resolves to loopback, to a private address, or to a mix', async () => {
    lookup.mockResolvedValueOnce([{ address: '127.0.0.1', family: 4 }]);
    expect(await resolvesPublic('localtest.me')).toBe(false);
    lookup.mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }, { address: '10.0.0.5', family: 4 }]);
    expect(await resolvesPublic('mixed.example-public.com')).toBe(false);
    lookup.mockResolvedValueOnce([{ address: '169.254.169.254', family: 4 }]);
    expect(await resolvesPublic('metadata.example-public.com')).toBe(false);
  });
  it('rejects when the name does not resolve at all', async () => {
    lookup.mockRejectedValueOnce(new Error('ENOTFOUND'));
    expect(await resolvesPublic('nowhere.example-public.com')).toBe(false);
  });
  it('does not look up the three built-in providers, and caches answers briefly', async () => {
    expect(await resolvesPublic('api.groq.com')).toBe(true);
    expect(lookup).not.toHaveBeenCalled();
    lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    await resolvesPublic('cached.example-public.com');
    await resolvesPublic('cached.example-public.com');
    expect(lookup).toHaveBeenCalledTimes(1);
  });
});

describe('own-key requests are limited too', () => {
  it('allows 120 a minute per address, then refuses', () => {
    const ip = 'test-limit-ip';
    for (let i = 0; i < 120; i++) expect(allowByokUse(ip)).toBe(true);
    expect(allowByokUse(ip)).toBe(false);
    expect(allowByokUse('another-ip')).toBe(true);
  });
  it('userTargetUsable reports bad_endpoint for a private resolution and rate_limited past the cap', async () => {
    const req = new Request('https://stay.test/x', { headers: { 'x-forwarded-for': '203.0.113.9' } });
    lookup.mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);
    expect(await userTargetUsable(req, { baseUrl: 'https://rebind.example-public.com/v1', key: 'k', model: 'm' })).toBe('bad_endpoint');
    lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    expect(await userTargetUsable(req, { baseUrl: 'https://ok.example-public.com/v1', key: 'k', model: 'm' })).toBeNull();
  });
});
