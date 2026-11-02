/**
 * T2.3: when the person starts talking over Stay, Stay gets quiet at once, without waiting for the server to say the person
 * started speaking (a round trip of about 0.8 s). This only ducks the voice. It never cancels the reply: that is decided later,
 * from words, by the speech-to-text turn (a cough or Stay's own echo never reaches that point, and the duck lifts by itself).
 *
 * Fed with the microphone's energy frames. Pure and clock-free: the caller passes the time.
 */
export interface LocalBargeInOptions {
  /** microphone level that counts as loud (the same 0 to 1 scale as the mic worklet's rms) */
  threshold?: number;
  /** consecutive loud frames before ducking, so one click or cough is not enough */
  frames?: number;
  /** how long after the last loud frame the duck lifts if nothing confirmed a real turn */
  holdMs?: number;
}

export type BargeInCommand = 'duck' | 'unduck' | null;

export class LocalBargeIn {
  private loud = 0;
  private ducked = false;
  private lastLoudAt = 0;
  private readonly threshold: number;
  private readonly frames: number;
  private readonly holdMs: number;

  constructor(opts: LocalBargeInOptions = {}) {
    this.threshold = opts.threshold ?? 0.3;
    this.frames = opts.frames ?? 2;
    this.holdMs = opts.holdMs ?? 600;
  }

  get isDucked(): boolean {
    return this.ducked;
  }

  /** One microphone energy frame. `audible` is whether Stay's voice is being played right now. */
  feed(rms: number, audible: boolean, nowMs: number): BargeInCommand {
    if (!audible) {
      this.loud = 0;
      if (this.ducked) {
        this.ducked = false;
        return 'unduck';
      }
      return null;
    }
    if (rms > this.threshold) {
      this.loud += 1;
      this.lastLoudAt = nowMs;
      if (this.loud >= this.frames && !this.ducked) {
        this.ducked = true;
        return 'duck';
      }
      return null;
    }
    this.loud = 0;
    if (this.ducked && nowMs - this.lastLoudAt >= this.holdMs) {
      this.ducked = false;
      return 'unduck';
    }
    return null;
  }

  /** The reply was cancelled or ended: forget the duck (the player resets its own gain). */
  reset(): void {
    this.loud = 0;
    this.ducked = false;
  }
}
