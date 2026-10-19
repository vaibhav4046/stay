/**
 * Key rotation for the shared provider keys (ASSEMBLYAI_API_KEYS / GROQ_API_KEYS, comma-separated, or the single
 * ASSEMBLYAI_API_KEY / GROQ_API_KEY): when one key is rate-limited it rests for a while and the next one is used.
 */

export interface KeyPoolStatus {
  provider: 'assemblyai' | 'groq';
  totalKeysConfigured: number;
  activeKeyIndex: number;
  rotationsCount: number;
  rateLimitFailovers: number;
}

interface KeyEntry {
  key: string;
  cooldownUntil: number;
  uses: number;
}

export class CompliantKeyRotationPool {
  private keys: KeyEntry[] = [];
  private currentIndex = 0;
  private rotations = 0;
  private failovers = 0;
  private provider: 'assemblyai' | 'groq';

  constructor(provider: 'assemblyai' | 'groq', rawEnvKeys: (string | undefined)[]) {
    this.provider = provider;
    const seen = new Set<string>();
    for (const raw of rawEnvKeys) {
      if (!raw) continue;
      for (const part of raw.split(',')) {
        const trimmed = part.trim();
        if (trimmed && !seen.has(trimmed)) {
          seen.add(trimmed);
          this.keys.push({ key: trimmed, cooldownUntil: 0, uses: 0 });
        }
      }
    }
  }

  public getNextHealthyKey(): string | null {
    if (this.keys.length === 0) return null;
    const now = Date.now();
    for (let offset = 0; offset < this.keys.length; offset++) {
      const idx = (this.currentIndex + offset) % this.keys.length;
      const entry = this.keys[idx];
      if (entry.cooldownUntil <= now) {
        if (offset > 0) this.rotations++;
        this.currentIndex = (idx + 1) % this.keys.length;
        entry.uses++;
        return entry.key;
      }
    }
    // If all keys are in cooldown, pick the one whose cooldown expires soonest
    let bestIdx = 0;
    for (let i = 1; i < this.keys.length; i++) {
      if (this.keys[i].cooldownUntil < this.keys[bestIdx].cooldownUntil) {
        bestIdx = i;
      }
    }
    this.currentIndex = bestIdx;
    return this.keys[bestIdx].key;
  }

  public reportRateLimitOrError(failedKey: string, cooldownMs = 60_000): void {
    const entry = this.keys.find((k) => k.key === failedKey);
    if (entry) {
      entry.cooldownUntil = Date.now() + cooldownMs;
      this.failovers++;
      this.rotations++;
    }
  }

  public getStatus(): KeyPoolStatus {
    return {
      provider: this.provider,
      totalKeysConfigured: Math.max(1, this.keys.length),
      activeKeyIndex: this.keys.length > 0 ? this.currentIndex % this.keys.length : 0,
      rotationsCount: this.rotations,
      rateLimitFailovers: this.failovers,
    };
  }
}

// Singleton pools for server/client telemetry
const assemblyPool = new CompliantKeyRotationPool('assemblyai', [
  typeof process !== 'undefined' ? process.env.ASSEMBLYAI_API_KEYS : undefined,
  typeof process !== 'undefined' ? process.env.ASSEMBLYAI_API_KEY : undefined,
]);

const groqPool = new CompliantKeyRotationPool('groq', [
  typeof process !== 'undefined' ? process.env.GROQ_API_KEYS : undefined,
  typeof process !== 'undefined' ? process.env.GROQ_API_KEY : undefined,
]);

export function getNextAssemblyAiKey(): string | null {
  return assemblyPool.getNextHealthyKey();
}

export function reportAssemblyAiKeyRateLimit(key: string): void {
  assemblyPool.reportRateLimitOrError(key);
}

export function getNextGroqKey(): string | null {
  return groqPool.getNextHealthyKey();
}

export function reportGroqKeyRateLimit(key: string): void {
  groqPool.reportRateLimitOrError(key);
}

/** Collapses runs of blank lines and spaces in a prompt. That is all it does; it is not a compression scheme. */
export function compressPromptForTokenEfficiency(rawPrompt: string): string {
  return rawPrompt
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}
