/**
 * The microphone's current level, written by the capture worklet message handler and read by visuals.
 * Module state, not React state: the hot audio path never causes a render. It reads 0 if nothing has been written
 * for a moment, so a stopped or revoked microphone can never leave a wave "listening".
 */
const STALE_MS = 250;
let level = 0;
let writtenAt = 0;

export const signalBus = {
  setInput(rms: number): void {
    level = Number.isFinite(rms) ? Math.min(1, Math.max(0, rms)) : 0;
    writtenAt = performance.now();
  },
  input(now: number = performance.now()): number {
    return now - writtenAt > STALE_MS ? 0 : level;
  },
  reset(): void {
    level = 0;
    writtenAt = 0;
  },
};
