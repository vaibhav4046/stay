// Full-app voice test: runs the real Stay UI in Chromium with a fake microphone that plays a WAV, against the live
// AssemblyAI Voice Agent, and logs every WebSocket event. Measures lag and talk-over without a human.
// Usage: node scripts/voice-e2e/fake-mic-run.mjs <mic.wav> [baseURL] [seconds]
// Needs the app running (npm run start) and keys in .env.local. Prints event names and agent text only.
import { chromium } from '@playwright/test';

const wav = process.argv[2];
const base = process.argv[3] || 'http://localhost:3000';
const seconds = Number(process.argv[4] || 30);
if (!wav) {
  console.error('usage: node scripts/voice-e2e/fake-mic-run.mjs <mic.wav> [baseURL] [seconds]');
  process.exit(1);
}

const browser = await chromium.launch({
  args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    `--use-file-for-fake-audio-capture=${wav}%noloop`,
    '--autoplay-policy=no-user-gesture-required',
    // headless defaults to a software GPU; the orb then starves the main thread that relays mic audio. GL=hw uses the real GPU.
    ...(process.env.GL === 'hw' ? ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] : []),
  ],
});
const ctx = await browser.newContext({ permissions: ['microphone'], viewport: { width: 1200, height: 900 } });
const page = await ctx.newPage();

// count browser speech-synthesis calls: a second voice on top of the agent is the "talking over" bug
await page.addInitScript(() => {
  window.__tts = [];
  const orig = window.speechSynthesis?.speak?.bind(window.speechSynthesis);
  if (orig) window.speechSynthesis.speak = (u) => { window.__tts.push({ at: Date.now(), text: String(u.text).slice(0, 80) }); return orig(u); };
});

const t0 = { v: 0 };
const events = [];
const sent = {}; // input.audio frames sent per second: shows whether the mic reaches the server in real time
const rel = () => ((Date.now() - t0.v) / 1000).toFixed(2);
page.on('websocket', (ws) => {
  if (!ws.url().includes('assemblyai')) return;
  ws.on('framereceived', (f) => {
    let m;
    try { m = JSON.parse(String(f.payload)); } catch { return; }
    if (m.type === 'reply.audio' || m.type === 'transcript.agent.delta' || m.type === 'transcript.user.delta') {
      const last = events[events.length - 1];
      if (last && last.type === m.type) { last.n = (last.n || 1) + 1; last.until = rel(); return; }
    }
    events.push({ t: rel(), type: m.type, text: m.text || (m.type === 'tool.call' ? `${m.name} ${JSON.stringify(m.arguments)}` : m.code ? `${m.code}` : m.status || ''), n: 1 });
  });
  ws.on('framesent', (f) => {
    let m;
    try { m = JSON.parse(String(f.payload)); } catch { return; }
    if (m.type === 'input.audio') { const sec = Math.floor((Date.now() - t0.v) / 1000); sent[sec] = (sent[sec] || 0) + 1; }
    if (m.type !== 'input.audio') events.push({ t: rel(), type: '>> ' + m.type, text: m.type === 'reply.create' ? String(m.instructions || '').slice(0, 90) : m.type === 'conversation.message' ? String(m.content).slice(0, 90) : '', n: 1 });
  });
});

await page.goto(base + '/app/today');
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.getByTestId('care-self_managing').click();
await page.getByTestId('onboarding-ack').click();
await page.getByTestId('onboarding-done').click();
await page.getByTestId('orb-button').waitFor();

t0.v = Date.now();
await page.getByTestId('orb-button').click();
await page.waitForTimeout(seconds * 1000);

// lag from each final user transcript to the first agent audio that follows it (independent of the fake device's start offset)
{
  const turns = events.filter((e) => e.type === 'transcript.user');
  for (const u of turns) {
    const a = events.find((e) => e.type === 'reply.audio' && Number(e.t) >= Number(u.t));
    const starts = events.filter((e) => e.type === 'reply.started' && Number(e.t) >= Number(u.t) && (!a || Number(e.t) <= Number(a.t) + 30)).length;
    console.log(`TURN "${String(u.text).slice(0, 50)}" -> first agent audio ${a ? Math.round((Number(a.t) - Number(u.t)) * 1000) + ' ms' : 'none'} (reply.started x${starts})`);
  }
  const greeting = events.find((e) => e.type === 'transcript.agent');
  const ga = events.filter((e) => e.type === 'reply.audio').slice(0, 1)[0];
  if (greeting && ga) console.log(`GREETING first audio at ${ga.t}s, text ends at ${greeting.t}s -> ${(Number(greeting.t) - Number(ga.t)).toFixed(1)} s of speech`);
}
console.log('mic frames sent per second:', Object.entries(sent).map(([k, v]) => `${k}s:${v}`).join(' '));
console.log(`\n=== timeline (s since mic start) ===`);
for (const e of events) console.log(`${e.t.padStart(6)}  ${e.type.padEnd(26)} ${e.n > 1 ? `x${e.n} (until ${e.until}) ` : ''}${e.text ? JSON.stringify(String(e.text).slice(0, 110)) : ''}`);
const tts = await page.evaluate(() => window.__tts);
console.log(`\nbrowser speechSynthesis calls: ${tts.length}`);
for (const u of tts) console.log(`  +${((u.at - t0.v) / 1000).toFixed(2)}s ${JSON.stringify(u.text)}`);
const shown = await page.evaluate(() => ({ status: document.querySelector('[data-testid=orb-status]')?.textContent, caption: document.querySelector('[data-testid=caption]')?.textContent, plan: !!document.querySelector('[data-testid=plan-card]') }));
console.log('\nUI at end:', JSON.stringify(shown));
await browser.close();
