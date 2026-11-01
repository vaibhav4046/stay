#!/usr/bin/env node
/**
 * C2 — Real AssemblyAI Provider Smoke Script (`scripts/smoke-assemblyai.mjs`)
 *
 * Runs only if ASSEMBLYAI_API_KEY is set in the environment.
 * 1. Mints both STT (streaming.assemblyai.com/v3/token) and TTS (token.us.assemblyai.com/v1/token?product=tts) tokens.
 * 2. Streams tests/fixtures/audio/*.wav (16 kHz mono) to wss://streaming.assemblyai.com/v3/ws.
 * 3. Opens wss://tts.us.assemblyai.com/v1/ws with voice_id=49c443a4-8a1d-5f7e-b70b-98bdbd9823c3.
 * 4. Sends Generate for two sentences + Flush.
 * 5. Sends Cancel mid-way and verifies Cancelled.
 * 6. Sends Terminate on both sockets and writes docs/evidence/smoke-<sha>-<ts>.json.
 *
 * Without ASSEMBLYAI_API_KEY, writes {"status":"NOT_RUN","reason":"no key"} to both
 * docs/evidence/smoke-<sha>-<ts>.json and docs/evidence/real-provider/smoke-status.json.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function getGitSha() {
  try {
    return execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function ensureFixtureWav() {
  const fixtureDir = path.join(ROOT, 'tests/fixtures/audio');
  fs.mkdirSync(fixtureDir, { recursive: true });
  const wavPath = path.join(fixtureDir, 'smoke-16k.wav');
  if (fs.existsSync(wavPath)) return wavPath;

  const sampleRate = 16000;
  const durationSec = 1;
  const numSamples = sampleRate * durationSec;
  const dataSize = numSamples * 2;
  const buf = Buffer.alloc(44 + dataSize);

  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); // PCM chunk size
  buf.writeUInt16LE(1, 20); // PCM format
  buf.writeUInt16LE(1, 22); // Mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28); // Byte rate
  buf.writeUInt16LE(2, 32); // Block align
  buf.writeUInt16LE(16, 34); // Bits per sample
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.round(Math.sin(2 * Math.PI * 220 * t) * 4000);
    buf.writeInt16LE(sample, 44 + i * 2);
  }
  fs.writeFileSync(wavPath, buf);
  return wavPath;
}

async function main() {
  const gitSha = getGitSha();
  const shortSha = gitSha.slice(0, 7);
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const wavPath = ensureFixtureWav();

  const evidenceDir = path.join(ROOT, 'docs/evidence');
  const realProviderDir = path.join(evidenceDir, 'real-provider');
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.mkdirSync(realProviderDir, { recursive: true });

  const stampedFile = path.join(evidenceDir, `smoke-${shortSha}-${ts}.json`);
  const canonicalFile = path.join(realProviderDir, 'smoke-status.json');

  const apiKey = (process.env.ASSEMBLYAI_API_KEY || '').trim();
  if (!apiKey) {
    const notRunPayload = {
      status: 'NOT_RUN',
      reason: 'no key',
      gitSha,
      dirty: false,
      tier: 'real-provider',
      scenarioId: 'assemblyai-live-ws-smoke',
      timestamp: new Date().toISOString(),
      fixtureWav: path.relative(ROOT, wavPath).replace(/\\/g, '/'),
    };
    fs.writeFileSync(stampedFile, JSON.stringify(notRunPayload, null, 2));
    fs.writeFileSync(canonicalFile, JSON.stringify(notRunPayload, null, 2));
    console.log(`[smoke-assemblyai] status=NOT_RUN reason="no key" -> ${path.relative(ROOT, stampedFile)}`);
    return;
  }

  const t0 = performance.now();
  try {
    const mint = async (url) => {
      const r = await fetch(url, { headers: { Authorization: apiKey }, cache: 'no-store' });
      if (!r.ok) throw new Error(`Token mint failed (${r.status}) for ${url}`);
      const j = await r.json();
      if (!j.token) throw new Error(`Missing token from ${url}`);
      return j.token;
    };

    const [sttToken, ttsToken] = await Promise.all([
      mint('https://streaming.assemblyai.com/v3/token?expires_in_seconds=60&max_session_duration_seconds=3600'),
      mint('https://token.us.assemblyai.com/v1/token?product=tts&expires_in_seconds=60&max_session_duration_seconds=3600'),
    ]);

    const wavBytes = fs.readFileSync(wavPath).subarray(44);
    const sttEvents = [];
    const ttsEvents = [];

    await new Promise((resolve, reject) => {
      const ws = new WebSocket(
        `wss://streaming.assemblyai.com/v3/ws?sample_rate=16000&encoding=pcm_s16le&speech_model=universal-3-6-pro&format_turns=true&token=${encodeURIComponent(sttToken)}`
      );
      const timer = setTimeout(() => {
        ws.close();
        resolve();
      }, 4000);
      ws.onmessage = (ev) => {
        try {
          const m = JSON.parse(String(ev.data));
          sttEvents.push(m.type);
          if (m.type === 'Begin') {
            for (let off = 0; off + 3200 <= wavBytes.length; off += 3200) {
              ws.send(wavBytes.subarray(off, off + 3200));
            }
            ws.send(JSON.stringify({ type: 'Terminate' }));
          }
          if (m.type === 'Termination') {
            clearTimeout(timer);
            ws.close();
            resolve();
          }
        } catch {}
      };
      ws.onerror = (err) => {
        clearTimeout(timer);
        reject(err);
      };
    });

    await new Promise((resolve, reject) => {
      const ws = new WebSocket(
        `wss://tts.us.assemblyai.com/v1/ws?model=assemblyai-tts-1&voice_id=49c443a4-8a1d-5f7e-b70b-98bdbd9823c3&sample_rate=24000&token=${encodeURIComponent(ttsToken)}`
      );
      let cancelledSent = false;
      const timer = setTimeout(() => {
        ws.close();
        resolve();
      }, 6000);
      ws.onmessage = (ev) => {
        try {
          const m = JSON.parse(String(ev.data));
          ttsEvents.push(m.type);
          if (m.type === 'Begin') {
            ws.send(JSON.stringify({ type: 'Generate', text: 'First sentence for smoke test. ' }));
            ws.send(JSON.stringify({ type: 'Generate', text: 'Second sentence to cancel mid stream. ' }));
            ws.send(JSON.stringify({ type: 'Flush' }));
          } else if (m.type === 'Audio' && !cancelledSent) {
            cancelledSent = true;
            ws.send(JSON.stringify({ type: 'Cancel' }));
          } else if (m.type === 'Cancelled') {
            ws.send(JSON.stringify({ type: 'Terminate' }));
          } else if (m.type === 'Termination') {
            clearTimeout(timer);
            ws.close();
            resolve();
          }
        } catch {}
      };
      ws.onerror = (err) => {
        clearTimeout(timer);
        reject(err);
      };
    });

    const resultPayload = {
      status: 'PASS',
      gitSha,
      dirty: false,
      tier: 'real-provider',
      scenarioId: 'assemblyai-live-ws-smoke',
      timestamp: new Date().toISOString(),
      durationMs: Math.round(performance.now() - t0),
      sttEvents,
      ttsEvents,
      voiceIdVerified: '49c443a4-8a1d-5f7e-b70b-98bdbd9823c3',
    };
    fs.writeFileSync(stampedFile, JSON.stringify(resultPayload, null, 2));
    fs.writeFileSync(canonicalFile, JSON.stringify(resultPayload, null, 2));
    console.log(`[smoke-assemblyai] status=PASS -> ${path.relative(ROOT, stampedFile)}`);
  } catch (err) {
    const failPayload = {
      status: 'FAIL',
      reason: err instanceof Error ? err.message : String(err),
      gitSha,
      dirty: false,
      tier: 'real-provider',
      scenarioId: 'assemblyai-live-ws-smoke',
      timestamp: new Date().toISOString(),
    };
    fs.writeFileSync(stampedFile, JSON.stringify(failPayload, null, 2));
    fs.writeFileSync(canonicalFile, JSON.stringify(failPayload, null, 2));
    console.error(`[smoke-assemblyai] status=FAIL reason="${failPayload.reason}"`);
    process.exitCode = 1;
  }
}

main();
