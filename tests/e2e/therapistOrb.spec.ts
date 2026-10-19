import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { installFakeVoice } from './helpers/fakeVoice';

// Chromium with a fake microphone (the app asks for one when it starts a voice session) and no audible output.
test.use({
  deviceScaleFactor: Number(process.env.ORB_DPR || 1),
  permissions: ['microphone'],
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] },
});

const SHOTS = path.join(__dirname, '..', '..', 'docs', 'therapist-orb');

async function onboard(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __stayOrbDebug: boolean }).__stayOrbDebug = true;
    // sessionStorage survives page changes, so every document's violations are kept
    document.addEventListener('securitypolicyviolation', (e) => {
      const list = JSON.parse(sessionStorage.getItem('csp') || '[]') as string[];
      list.push(`${e.violatedDirective} ${e.blockedURI}`);
      sessionStorage.setItem('csp', JSON.stringify(list));
    });
  });
  await page.goto('/app/today');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByTestId('care-self_managing').click();
  await page.getByTestId('onboarding-ack').click();
  await page.getByTestId('onboarding-done').click();
  await expect(page.getByTestId('orb-button')).toBeVisible();
  await page.waitForSelector('[data-testid="orb-button"] canvas');
}

const shapeKey = (page: Page) => page.locator('[data-testid="orb-button"] [data-shape]').first().getAttribute('data-shape');
const orbDebug = (page: Page) =>
  page.evaluate(() => {
    const o = (window as unknown as { __stayOrb?: { face: { open: number; wide: number; blink: number; tilt: number; nod: number; breath: number }; shape: string; figureOn: boolean; onsets: number; frameMs: number[] } }).__stayOrb;
    return o ? { face: o.face, shape: o.shape, figureOn: o.figureOn, onsets: o.onsets, frames: o.frameMs.length } : null;
  });
const cspViolations = (page: Page) => page.evaluate(() => JSON.parse(sessionStorage.getItem('csp') || '[]') as string[]);

async function startVoice(page: Page) {
  await page.getByTestId('orb-button').click();
  await expect(page.getByTestId('orb-status')).toHaveText('Listening', { timeout: 10000 });
}

test.describe('The therapist orb', () => {
  test('the face button morphs the orb into a person and back, with dots only', async ({ page }) => {
    await onboard(page);
    expect(await shapeKey(page)).toBe('orb');
    await page.getByTestId('face-toggle').click();
    await expect(page.getByTestId('face-toggle')).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => shapeKey(page), { timeout: 5000 }).toBe('human');
    await expect.poll(async () => (await orbDebug(page))?.figureOn, { timeout: 5000 }).toBe(true);
    await page.waitForTimeout(3200); // the pour finishes
    await expect(page.locator('[data-testid="orb-button"] img, [data-testid="orb-button"] svg, [data-testid="orb-button"] video')).toHaveCount(0);
    expect((await page.getByTestId('orb-button').screenshot()).length).toBeGreaterThan(12000); // not blank
    await page.getByTestId('face-toggle').click();
    await expect.poll(() => shapeKey(page), { timeout: 8000 }).toBe('orb');
  });

  test('keyword shapes still work, and a keyword evicts the face', async ({ page }) => {
    await onboard(page);
    await page.getByTestId('face-toggle').click();
    await expect.poll(() => shapeKey(page)).toBe('human');
    await page.getByTestId('task-input').fill('my taxes');
    await page.getByTestId('send').click();
    await expect.poll(() => shapeKey(page), { timeout: 8000 }).not.toBe('human');
  });

  test('while Stay speaks the face engages and the mouth follows the real audio, then rests in silence', async ({ page }) => {
    const voice = await installFakeVoice(page);
    await onboard(page);
    await startVoice(page);
    expect(voice.ready()).toBe(true);
    expect(await shapeKey(page)).toBe('orb');

    const speaking = voice.speak('Hello, I am here with you. Let us take one small step together.', 14);
    await expect.poll(() => shapeKey(page), { timeout: 4000 }).toBe('human');
    await expect(page.getByTestId('orb-status')).toHaveText('Speaking');

    // sample the live mouth every ~40 ms while the reply plays
    const opens: number[] = [];
    const t0 = Date.now();
    while (Date.now() - t0 < 2400) {
      const d = await orbDebug(page);
      if (d) opens.push(d.face.open);
      await page.waitForTimeout(40);
    }
    await speaking;
    expect(Math.max(...opens)).toBeGreaterThan(0.3); // clearly opens on the vowels
    expect(Math.min(...opens.slice(Math.floor(opens.length / 3)))).toBeLessThan(0.15); // and closes between syllables
    expect((await orbDebug(page))!.onsets).toBeGreaterThanOrEqual(3);

    // silence: mouth back to rest, then she lingers a moment and becomes the topical shape again
    await expect.poll(async () => (await orbDebug(page))!.face.open, { timeout: 8000 }).toBeLessThan(0.03);
    await expect.poll(() => shapeKey(page), { timeout: 12000 }).toBe('orb');
    expect(await cspViolations(page)).toEqual([]);
  });

  test('when the user talks the face gives way to the topical shape', async ({ page }) => {
    const voice = await installFakeVoice(page);
    await onboard(page);
    await startVoice(page);
    void voice.speak('Take your time. I am listening.', 10);
    await expect.poll(() => shapeKey(page), { timeout: 4000 }).toBe('human');
    voice.userSpeaks('I feel completely overwhelmed');
    await expect.poll(() => shapeKey(page), { timeout: 6000 }).toBe('tangle');
  });

  test('prefers-reduced-motion: the face still forms and the mouth still moves, but no blink, no head motion, no wobble', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce', permissions: ['microphone'] });
    const page = await context.newPage();
    const voice = await installFakeVoice(page);
    await onboard(page);
    await startVoice(page);
    void voice.speak('Hello, I am here with you. One small step.', 12);
    await expect.poll(() => shapeKey(page), { timeout: 4000 }).toBe('human');
    let maxOpen = 0, maxBlink = 0, maxTilt = 0, maxNod = 0, maxBreath = 0;
    const t0 = Date.now();
    while (Date.now() - t0 < 5200) {
      const d = await orbDebug(page);
      if (d) {
        maxOpen = Math.max(maxOpen, d.face.open);
        maxBlink = Math.max(maxBlink, d.face.blink);
        maxTilt = Math.max(maxTilt, Math.abs(d.face.tilt));
        maxNod = Math.max(maxNod, Math.abs(d.face.nod));
        maxBreath = Math.max(maxBreath, Math.abs(d.face.breath));
      }
      await page.waitForTimeout(50);
    }
    expect(maxOpen).toBeGreaterThan(0.15);
    expect(maxOpen).toBeLessThan(0.7); // quieter than normal motion
    expect([maxBlink, maxTilt, maxNod, maxBreath]).toEqual([0, 0, 0, 0]);
    await context.close();
  });

  test('screenshots for the docs (only with ORB_SHOTS=1)', async ({ page }, info) => {
    test.skip(!process.env.ORB_SHOTS, 'documentation capture: run with ORB_SHOTS=1');
    info.setTimeout(120000);
    fs.mkdirSync(SHOTS, { recursive: true });
    const tag = process.env.ORB_TAG || 'desktop';
    await page.setViewportSize(tag.startsWith('phone') ? { width: 390, height: 844 } : { width: 1000, height: 900 });
    const voice = await installFakeVoice(page);
    await onboard(page);
    const orb = page.getByTestId('orb-button');
    await page.waitForTimeout(1500);
    await orb.screenshot({ path: path.join(SHOTS, `${tag}-0-sphere.png`) });

    await page.getByTestId('face-toggle').click();
    await page.waitForTimeout(700);
    await orb.screenshot({ path: path.join(SHOTS, `${tag}-1-mid-morph-a.png`) });
    await page.waitForTimeout(500);
    await orb.screenshot({ path: path.join(SHOTS, `${tag}-1-mid-morph-b.png`) });
    await page.waitForTimeout(3500);
    await orb.screenshot({ path: path.join(SHOTS, `${tag}-2-idle.png`) });
    await page.getByTestId('face-toggle').click(); // release the pin so speech drives it

    await startVoice(page);
    // long sustained vowels so the mouth stays open for the whole screenshot
    void voice.speak('Aaah, hello there. I am here with you.', 8, { syllableSeconds: 1.1, gapSeconds: 0.5 });
    await expect.poll(() => shapeKey(page), { timeout: 4000 }).toBe('human');
    await page.waitForTimeout(2600);
    let shots = 0;
    for (let i = 0; i < 160 && shots < 2; i++) {
      const d = await orbDebug(page);
      if (d && d.face.open > 0.8) {
        await orb.screenshot({ path: path.join(SHOTS, `${tag}-3-speaking-open-${shots}.png`) });
        const after = await orbDebug(page);
        if (after && after.face.open > 0.65) shots++;
        await page.waitForTimeout(500);
      } else await page.waitForTimeout(30);
    }
  });

  test('frame times: sphere, morph and speaking (only with ORB_PERF=1)', async ({ page }, info) => {
    test.skip(!process.env.ORB_PERF, 'measurement: run with ORB_PERF=1');
    info.setTimeout(120000);
    const tag = process.env.ORB_TAG || 'desktop';
    const throttle = Number(process.env.ORB_THROTTLE || 1);
    await page.setViewportSize(tag.startsWith('phone') ? { width: 390, height: 844 } : { width: 1000, height: 900 });
    const voice = await installFakeVoice(page);
    await onboard(page);
    if (throttle > 1) await (await page.context().newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: throttle });
    const measure = async (ms: number) => {
      await page.evaluate(() => { const o = (window as unknown as { __stayOrb: { frameMs: number[]; cpuMs: number[] } }).__stayOrb; o.frameMs.length = 0; o.cpuMs.length = 0; });
      await page.waitForTimeout(ms);
      const frames = (await page.evaluate(() => (window as unknown as { __stayOrb: { frameMs: number[] } }).__stayOrb.frameMs.slice())) as number[];
      const cpu = ((await page.evaluate(() => (window as unknown as { __stayOrb: { cpuMs: number[] } }).__stayOrb.cpuMs.slice())) as number[]).sort((a, b) => a - b);
      const sorted = [...frames].sort((a, b) => a - b);
      const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
      return { frames: frames.length, medianMs: +q(0.5).toFixed(1), p95Ms: +q(0.95).toFixed(1), p99Ms: +q(0.99).toFixed(1), worstMs: +sorted[sorted.length - 1].toFixed(1), fpsAvg: +(1000 / (frames.reduce((s, x) => s + x, 0) / frames.length)).toFixed(1), over33ms: frames.filter((x) => x > 33.4).length, cpuMedianMs: +cpu[Math.floor(cpu.length * 0.5)].toFixed(2), cpuP95Ms: +cpu[Math.floor(cpu.length * 0.95)].toFixed(2), cpuWorstMs: +cpu[cpu.length - 1].toFixed(2) };
    };
    await page.waitForTimeout(1200);
    const sphere = await measure(3000);
    await page.getByTestId('face-toggle').click();
    const morph = await measure(2800);
    await page.waitForTimeout(800);
    const figureIdle = await measure(3000);
    await page.getByTestId('face-toggle').click();
    await startVoice(page);
    void voice.speak('Hello, I am here with you. Let us take one small step together, whenever you are ready.', 30);
    await expect.poll(() => shapeKey(page), { timeout: 4000 }).toBe('human');
    await page.waitForTimeout(1500);
    const speaking = await measure(4000);
    const renderer = await page.evaluate(() => {
      const gl = document.createElement('canvas').getContext('webgl');
      const ext = gl?.getExtension('WEBGL_debug_renderer_info');
      return gl && ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : 'unknown';
    });
    const out = { tag, renderer, headless: !process.env.PW_HEADED, cpuThrottle: throttle, dpr: Number(process.env.ORB_DPR || 1), viewport: page.viewportSize(), dots: page.viewportSize()!.width < 640 ? 3200 : 5200, sphere, morph, figureIdle, speaking };
    fs.mkdirSync(SHOTS, { recursive: true });
    fs.writeFileSync(path.join(SHOTS, `frame-times-${tag}.json`), JSON.stringify(out, null, 2));
    console.log('FRAME TIMES', JSON.stringify(out));
  });
});
