import { describe, expect, it } from 'vitest';
import { parseHostCommand, pathFromDeepLink } from '@/lib/host';

describe('host commands (wrapper to page)', () => {
  it('accepts the known commands as a JSON string or an object', () => {
    expect(parseHostCommand(JSON.stringify({ type: 'voice-start' }))).toEqual({ type: 'voice-start' });
    expect(parseHostCommand({ type: 'grounding' })).toEqual({ type: 'grounding' });
    expect(parseHostCommand(JSON.stringify({ type: 'timer', minutes: 20 }))).toEqual({ type: 'timer', minutes: 20 });
  });

  it('rejects unknown types, bad timers and garbage', () => {
    for (const bad of ['nope', '{"type":"rm -rf"}', '{"type":"timer","minutes":0}', '{"type":"timer","minutes":9999}', '{"type":"timer"}', null, 5, '']) {
      expect(parseHostCommand(bad as unknown)).toBeNull();
    }
  });
});

describe('deep links', () => {
  const host = 'stay-two-swart.vercel.app';
  it('maps stay:// links onto app screens and keeps only the known parameters', () => {
    expect(pathFromDeepLink('stay://today?timer=20', host)).toBe('/app/today?timer=20');
    expect(pathFromDeepLink('stay://today?voice=auto&evil=1', host)).toBe('/app/today?voice=auto');
    expect(pathFromDeepLink('stay://today?action=grounding', host)).toBe('/app/today?action=grounding');
    expect(pathFromDeepLink('stay://history', host)).toBe('/app/history');
  });

  it('accepts https links into this site only', () => {
    expect(pathFromDeepLink(`https://${host}/app/settings`, host)).toBe('/app/settings');
    expect(pathFromDeepLink('https://evil.example/app/today', host)).toBeNull();
    expect(pathFromDeepLink(`https://${host}/api/secret`, host)).toBeNull();
  });

  it('refuses unknown hosts, odd parameter values and non-links', () => {
    expect(pathFromDeepLink('stay://nowhere', host)).toBeNull();
    expect(pathFromDeepLink('stay://today?timer=<script>', host)).toBe('/app/today');
    expect(pathFromDeepLink('javascript:alert(1)', host)).toBeNull();
    expect(pathFromDeepLink('not a url', host)).toBeNull();
  });
});
