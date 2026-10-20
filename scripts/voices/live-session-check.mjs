// Live check of the voice engines inside the real app: a real Chromium with a fake microphone starts a real voice session
// against a running `next start` (real AssemblyAI speech-to-text and chat model) and we observe which engine speaks the greeting.
// Uses a little of the shared AssemblyAI allowance. Usage: node scripts/voices/live-session-check.mjs http://localhost:3057
import { chromium } from '@playwright/test';

const base = process.argv[2] || 'http://localhost:3000';
const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] });

async function session(label, { persona, language, byok, relay, deviceVoices }) {
  const ctx = await browser.newContext({ permissions: ['microphone'] });
  const page = await ctx.newPage();
  const relayCalls = [];
  if (relay) {
    await page.route('**/api/voice/tts', async (route) => {
      relayCalls.push({ headers: route.request().headers(), body: JSON.parse(route.request().postData() || '{}') });
      // half a second of a quiet 220 Hz tone, 24 kHz s16le, so the app has real PCM to play
      const n = 12000;
      const buf = Buffer.alloc(n * 2);
      for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 220 * i) / 24000) * 3000), i * 2);
      await route.fulfill({ status: 200, contentType: 'application/octet-stream', body: buf });
    });
  }
  await page.addInitScript(({ deviceVoices }) => {
    window.__spoken = [];
    if (deviceVoices) window.speechSynthesis.getVoices = () => deviceVoices;
    const speak = window.speechSynthesis.speak.bind(window.speechSynthesis);
    window.speechSynthesis.speak = (u) => {
      window.__spoken.push({ text: u.text, lang: u.lang, voice: u.voice && u.voice.name });
      speak(u);
    };
  }, { deviceVoices });
  await page.goto(`${base}/app/today`);
  await page.evaluate(({ persona, language, byok }) => {
    localStorage.clear();
    localStorage.setItem('stay_selected_voice', persona);
    if (language) localStorage.setItem('stay_selected_language', language);
    if (byok) localStorage.setItem('stay_byok', JSON.stringify(byok));
  }, { persona, language, byok });
  await page.reload();
  await page.getByTestId('care-self_managing').click();
  await page.getByTestId('onboarding-ack').click();
  await page.getByTestId('onboarding-done').click();
  await page.getByTestId('orb-button').click();
  await page.waitForFunction(() => document.querySelector('[data-testid="orb-status"]')?.textContent?.includes('Listening'), null, { timeout: 20000 }).catch(() => undefined);
  await page.waitForTimeout(6000);
  const status = await page.getByTestId('orb-status').textContent();
  const engine = await page.evaluate(() => document.querySelector('[data-engine]')?.getAttribute('data-engine') ?? null);
  const spoken = await page.evaluate(() => window.__spoken);
  console.log(`--- ${label}\n  status: ${status}\n  browser speechSynthesis calls: ${JSON.stringify(spoken)}\n  Azure relay calls: ${JSON.stringify(relayCalls.map((c) => ({ voice: c.body.voice, locale: c.body.locale, text: c.body.text, keyHeader: Boolean(c.headers['x-stay-tts-key']) })))}`);
  await ctx.close();
  return { status, spoken, relayCalls };
}

const heera = [
  { name: 'Microsoft Ravi - English (India)', lang: 'en-IN', localService: true, default: false, voiceURI: 'ravi' },
  { name: 'Microsoft Heera - English (India)', lang: 'en-IN', localService: true, default: false, voiceURI: 'heera' },
];
const ttsKey = 'k'.repeat(32);
const byok = { provider: 'default', llmKey: '', model: '', baseUrl: '', assemblyKey: '', ttsKey, ttsRegion: 'centralindia' };

const results = {};
results.assemblyai = await session('AssemblyAI voice (Anna, default)', { persona: 'anna' });
results.browser = await session('Indian English, device voice (Cardamom Calm, no Azure key)', { persona: 'cardamom', deviceVoices: heera });
results.azure = await session('Mexican Spanish through the Azure relay (Taco Tornado, mocked relay)', { persona: 'taco', language: 'es-ES', byok, relay: true });
results.fallback = await session('Mexican Spanish with no key and no device voice falls back to the Spanish AssemblyAI voice', { persona: 'taco', language: 'es-ES' });
await browser.close();

const ok = {
  assemblyai: results.assemblyai.spoken.length === 0,
  browser: results.browser.spoken.some((s) => s.lang === 'en-IN' && /Heera/.test(s.voice || '')),
  azure: results.azure.relayCalls.some((c) => c.body.voice === 'es-MX-DaliaNeural' && c.body.locale === 'es-MX' && c.headers['x-stay-tts-key'] === ttsKey) && results.azure.spoken.length === 0,
  fallback: results.fallback.relayCalls.length === 0 && results.fallback.spoken.length === 0,
};
console.log('\nVERDICT', JSON.stringify(ok));
process.exit(Object.values(ok).every(Boolean) ? 0 : 1);
