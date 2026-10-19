import type { Page, WebSocketRoute } from '@playwright/test';

/**
 * A fake managed voice agent for the browser: the app connects to wss://agents.assemblyai.com as usual, but the
 * socket is answered here. Replies are real PCM16 audio frames (vowel-like syllables) sent at real-time pace, so
 * the app's own playback, level analysis and lip sync run exactly as they do for a live agent. No keys, no network.
 */

const RATE = 24000;

/** A voiced "syllable": a 140 Hz source with a few harmonics under a raised-cosine envelope. `bright` adds hiss. */
function syllable(seconds: number, f0: number, bright: number): Float32Array {
  const n = Math.round(seconds * RATE);
  const out = new Float32Array(n);
  let seed = 99;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const env = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
    let v = 0;
    for (let h = 1; h <= 6; h++) v += Math.sin(2 * Math.PI * f0 * h * t) / h;
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const noise = (seed / 4294967296) * 2 - 1;
    out[i] = env * (0.22 * v * (1 - bright) + 0.25 * noise * bright);
  }
  return out;
}

export function replyPcm(syllables: number, opts: { syllableSeconds?: number; gapSeconds?: number } = {}): Float32Array {
  const syl = opts.syllableSeconds ?? 0.17;
  const gap = opts.gapSeconds ?? 0.07;
  const parts: Float32Array[] = [];
  for (let i = 0; i < syllables; i++) {
    parts.push(syllable(syl, 130 + (i % 4) * 14, i % 5 === 3 ? 0.7 : 0.05));
    parts.push(new Float32Array(Math.round(gap * RATE)));
  }
  const out = new Float32Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function toBase64(pcm: Float32Array): string {
  const buf = Buffer.alloc(pcm.length * 2);
  for (let i = 0; i < pcm.length; i++) buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(pcm[i] * 32767))), i * 2);
  return buf.toString('base64');
}

export interface FakeVoice {
  /** True once the app has opened the socket and received session.ready. */
  ready(): boolean;
  /** Stream one spoken reply in real time (resolves when the last audio frame has been sent). */
  speak(text: string, syllables?: number, shape?: { syllableSeconds?: number; gapSeconds?: number }): Promise<void>;
  /** The user starts talking over Stay (barge-in) with a partial transcript. */
  userSpeaks(partial: string): void;
  sentTypes(): string[];
}

export async function installFakeVoice(page: Page): Promise<FakeVoice> {
  let sock: WebSocketRoute | null = null;
  let ready = false;
  const sent: string[] = [];
  await page.addInitScript(() => localStorage.setItem('stay_fast_voice', '0')); // the managed-agent path
  await page.route('**/api/voice/token*', (route) =>
    route.fulfill({ json: { token: 'fake-token', agentId: 'fake-agent', wsUrl: 'wss://agents.assemblyai.com/v1/ws' } }),
  );
  await page.routeWebSocket(/agents\.assemblyai\.com/, (ws) => {
    sock = ws;
    ws.onMessage((raw) => {
      let m: { type?: string };
      try {
        m = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (m.type) sent.push(m.type);
      if (m.type === 'session.update') {
        ready = true;
        ws.send(JSON.stringify({ type: 'session.ready' }));
      }
    });
  });

  const send = (m: Record<string, unknown>) => sock?.send(JSON.stringify(m));
  return {
    ready: () => ready,
    sentTypes: () => sent,
    userSpeaks(partial) {
      send({ type: 'input.speech.started' });
      send({ type: 'transcript.user.delta', text: partial });
    },
    async speak(text, syllables = 9, shape = {}) {
      const pcm = replyPcm(syllables, shape);
      send({ type: 'reply.started' });
      const chunk = Math.round(RATE * 0.12);
      const t0 = Date.now();
      for (let i = 0, k = 0; i < pcm.length; i += chunk, k++) {
        const wait = k * 100 - (Date.now() - t0); // send slightly faster than real time, like a streaming TTS
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        send({ type: 'reply.audio', data: toBase64(pcm.subarray(i, i + chunk)) });
      }
      send({ type: 'transcript.agent', text, item_id: `a-${Date.now()}` });
      send({ type: 'reply.done' });
    },
  };
}
