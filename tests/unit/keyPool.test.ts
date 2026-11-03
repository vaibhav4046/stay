import { describe, it, expect } from 'vitest';
import { CompliantKeyRotationPool } from '@/lib/voice/tokenOptimizer';

/**
 * Groq's free tier gives each key 200,000 tokens a day per model (3 Nov 2026: the one key was spent by testing and the site answered
 * "too many requests"). A second key in GROQ_API_KEYS doubles the room; these tests pin how the pool uses it.
 */
describe('Groq key pool', () => {
  it('reads a comma-separated list and the single key, without repeats', () => {
    const pool = new CompliantKeyRotationPool('groq', ['k1, k2', 'k2']);
    expect(pool.getStatus().totalKeysConfigured).toBe(2);
  });

  it('shares the load: successive calls alternate between the keys', () => {
    const pool = new CompliantKeyRotationPool('groq', ['k1,k2']);
    expect([pool.getNextHealthyKey(), pool.getNextHealthyKey(), pool.getNextHealthyKey(), pool.getNextHealthyKey()]).toEqual(['k1', 'k2', 'k1', 'k2']);
  });

  it('a key that was refused rests, and the other one is used', () => {
    const pool = new CompliantKeyRotationPool('groq', ['k1,k2']);
    pool.reportRateLimitOrError('k1');
    expect([pool.getNextHealthyKey(), pool.getNextHealthyKey(), pool.getNextHealthyKey()]).toEqual(['k2', 'k2', 'k2']);
    expect(pool.getStatus().rateLimitFailovers).toBe(1);
  });

  it('with every key resting, the one that frees first is used rather than none', () => {
    const pool = new CompliantKeyRotationPool('groq', ['k1,k2']);
    pool.reportRateLimitOrError('k1', 120_000);
    pool.reportRateLimitOrError('k2', 30_000);
    expect(pool.getNextHealthyKey()).toBe('k2');
  });

  it('no keys at all gives null', () => {
    expect(new CompliantKeyRotationPool('groq', [undefined, '']).getNextHealthyKey()).toBeNull();
  });
});
