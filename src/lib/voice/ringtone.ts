/**
 * Phone-style tones, synthesised with Web Audio (no audio files).
 * ringback: what the caller hears while it rings (two tones, 440 + 480 Hz, 2 s on / 4 s off).
 * incoming: what the person hears when Stay calls them (a brisk double ring).
 */
export type ToneKind = 'ringback' | 'incoming';

const PATTERNS: Record<ToneKind, { freqs: number[]; steps: number[] }> = {
  // alternating on/off durations in ms, starting with "on"
  ringback: { freqs: [440, 480], steps: [2000, 4000] },
  incoming: { freqs: [523, 659], steps: [400, 200, 400, 2200] },
};

const LEVEL = 0.07;

/** How long Stay "rings" before the voice session starts: one ring, long enough to hear. */
export const RING_MS = 2000;

/** Starts a tone and returns a function that stops it. Silent no-op where Web Audio is unavailable. */
export function startTone(kind: ToneKind): () => void {
  let ctx: AudioContext;
  try {
    ctx = new AudioContext();
    void ctx.resume();
  } catch {
    return () => {};
  }
  const { freqs, steps } = PATTERNS[kind];
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.connect(ctx.destination);
  for (const f of freqs) {
    const osc = ctx.createOscillator();
    osc.frequency.value = f;
    osc.connect(gain);
    osc.start();
  }

  let stopped = false;
  let step = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const tick = () => {
    if (stopped) return;
    const on = step % 2 === 0;
    gain.gain.setTargetAtTime(on ? LEVEL : 0, ctx.currentTime, 0.01);
    timer = setTimeout(tick, steps[step % steps.length]);
    step += 1;
  };
  tick();

  return () => {
    if (stopped) return;
    stopped = true;
    if (timer) clearTimeout(timer);
    gain.gain.setTargetAtTime(0, ctx.currentTime, 0.01);
    setTimeout(() => void ctx.close().catch(() => {}), 150);
  };
}

/** What Stay is told when a call connects so it talks like a person on a phone, not like a chat window. */
export const CALL_STYLE_INSTRUCTION =
  'This is a live phone call. Speak like a warm, unhurried friend: short spoken sentences, contractions, no lists, no markdown, no emoji, no stage directions. ' +
  'Keep the usual shape: a brief acknowledgement, one tiny next step, then at most a short question. Let them finish before you answer, and never rush them.';
