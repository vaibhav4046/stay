/**
 * Call sounds, made in the browser (no files): a soft rising two-note chime when a call connects and a falling one when it ends, the
 * way a phone tells you the line opened or closed (owner, 2 Nov 2026: "when I'm ending the conversation, the ending noise should come").
 * Quiet on purpose: two short sine notes with a soft attack and a long fade, well under Stay's voice.
 */
export type ChimeKind = 'connect' | 'end';

export interface ChimeNote {
  /** Hz */
  freq: number;
  /** seconds after the chime starts */
  at: number;
  /** seconds */
  length: number;
}

/** E5 and B5, a fifth apart: up for hello, down for goodbye. */
export function chimeNotes(kind: ChimeKind): ChimeNote[] {
  const low = 659.25;
  const high = 987.77;
  const [first, second] = kind === 'connect' ? [low, high] : [high, low];
  return [
    { freq: first, at: 0, length: 0.22 },
    { freq: second, at: 0.12, length: kind === 'end' ? 0.42 : 0.32 },
  ];
}

const PEAK_GAIN = 0.07;

let shared: AudioContext | null = null;

export function playChime(kind: ChimeKind): void {
  if (typeof window === 'undefined') return;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  try {
    shared ??= new Ctor();
    const ctx = shared;
    void ctx.resume();
    const t0 = ctx.currentTime + 0.02;
    for (const n of chimeNotes(kind)) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = n.freq;
      gain.gain.setValueAtTime(0, t0 + n.at);
      gain.gain.linearRampToValueAtTime(PEAK_GAIN, t0 + n.at + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + n.at + n.length);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0 + n.at);
      osc.stop(t0 + n.at + n.length + 0.05);
    }
  } catch {
    // no sound is fine: the screen already shows the call state
  }
}
