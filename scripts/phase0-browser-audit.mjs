import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const OUT_DIR = path.resolve('docs/evidence');
const SHOT_DIR = path.join(OUT_DIR, 'phase0-screenshots');
fs.mkdirSync(SHOT_DIR, { recursive: true });

async function ensureServer() {
  try {
    const r = await fetch(`${BASE_URL}/app/today`);
    if (r.ok) return null;
  } catch {}
  console.log('Starting local next start on port 3000...');
  const proc = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'start', '--', '-p', '3000'], {
    stdio: 'ignore',
    shell: true,
  });
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      const r = await fetch(`${BASE_URL}/app/today`);
      if (r.ok) return proc;
    } catch {}
  }
  throw new Error('Could not start server on port 3000');
}

// Compute WCAG contrast ratio inside browser via canvas color normalization
async function measureBubbleContrast(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = window.getComputedStyle(el);
    const fgRaw = cs.color;
    const bgRaw = cs.backgroundColor;

    const toRgb = (cssColor, bgFallback = [250, 248, 245]) => {
      const c = document.createElement('canvas');
      c.width = 1;
      c.height = 1;
      const ctx = c.getContext('2d');
      ctx.fillStyle = `rgb(${bgFallback[0]}, ${bgFallback[1]}, ${bgFallback[2]})`;
      ctx.fillRect(0, 0, 1, 1);
      ctx.fillStyle = cssColor;
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2]];
    };

    const bgRgb = toRgb(bgRaw, [250, 248, 245]);
    const fgRgb = toRgb(fgRaw, bgRgb);

    const lum = ([r, g, b]) => {
      const a = [r, g, b].map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
    };

    const l1 = lum(fgRgb);
    const l2 = lum(bgRgb);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

    return {
      fgRaw,
      bgRaw,
      fgRgb: `rgb(${fgRgb.join(', ')})`,
      bgRgb: `rgb(${bgRgb.join(', ')})`,
      contrastRatio: Number(ratio.toFixed(2)),
    };
  }, selector);
}

async function ensureOnboarded(page) {
  const careSelf = page.getByTestId('care-self_managing');
  if (await careSelf.isVisible({ timeout: 2500 }).catch(() => false)) {
    await careSelf.click();
    await page.getByTestId('onboarding-ack').click();
    await page.getByTestId('onboarding-done').click();
  }
}

async function run() {
  const srv = await ensureServer();
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
      '--mute-audio',
    ],
  });

  const report = {
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    phase0_2_viewports: [],
    phase0_3_websockets: [],
    phase0_4_walkthrough: {},
    consoleErrors: [],
    networkFailures: [],
  };

  try {
    // 0.2: Viewports x Light/Dark
    const viewports = [
      { width: 1526, height: 726 },
      { width: 1440, height: 900 },
      { width: 768, height: 1024 },
      { width: 375, height: 740 },
      { width: 320, height: 640 },
    ];

    for (const scheme of ['light', 'dark']) {
      for (const vp of viewports) {
        const context = await browser.newContext({
          viewport: vp,
          colorScheme: scheme,
          permissions: ['microphone'],
        });
        const page = await context.newPage();
        await page.addInitScript(() => {
          localStorage.setItem('stay_onboarded_v1', '1');
          localStorage.setItem('stay_care_context_v1', 'self_managing');
        });
        await page.goto(`${BASE_URL}/app/today`, { waitUntil: 'networkidle' });
        await ensureOnboarded(page);

        // Submit one message so user bubble and Stay bubble exist
        const input = page.getByTestId('task-input');
        if (await input.isVisible().catch(() => false)) {
          await input.fill('Reply to one email');
          await page.getByTestId('send').click();
          await page.waitForSelector('[data-testid="chat-user-message"]', { timeout: 10000 }).catch(() => {});
          await page.waitForSelector('[data-testid="chat-agent-message"]', { timeout: 10000 }).catch(() => {});
        }

        const shotName = `before-${vp.width}x${vp.height}-${scheme}.png`;
        await page.screenshot({ path: path.join(SHOT_DIR, shotName) });

        const bboxY = async (sel) => {
          const loc = page.locator(sel).last();
          if (!(await loc.isVisible().catch(() => false))) return null;
          const b = await loc.boundingBox();
          return b ? Math.round(b.y) : null;
        };

        const statusY = await bboxY('[data-testid="orb-status"]');
        const latestBubbleY = await bboxY('[data-testid="chat-agent-message"], [data-testid="chat-user-message"]');
        const textInputY = await bboxY('[data-testid="task-input"]');
        const micButtonY = await bboxY('[data-testid="mic-button"], [data-testid="orb-button"]');
        const userContrast = await measureBubbleContrast(page, '[data-testid="chat-user-message"] > div:last-child');
        const stayContrast = await measureBubbleContrast(page, '[data-testid="chat-agent-message"] > div:last-child');
        const horizOverflow = await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth
        );

        report.phase0_2_viewports.push({
          viewport: `${vp.width}x${vp.height}`,
          colorScheme: scheme,
          screenshot: `docs/evidence/phase0-screenshots/${shotName}`,
          boundingBoxY: {
            statusLabel: statusY,
            latestBubble: latestBubbleY,
            textInput: textInputY,
            micButton: micButtonY,
            belowFoldInput: textInputY !== null ? textInputY > vp.height : null,
          },
          userBubble: userContrast,
          stayBubble: stayContrast,
          horizontalOverflow: horizOverflow,
        });

        await context.close();
      }
    }

    // 0.3 & 0.4 Walkthrough
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      colorScheme: 'light',
      permissions: ['microphone'],
    });
    const page = await ctx.newPage();

    page.on('console', (m) => {
      if (m.type() === 'error') {
        const t = m.text();
        if (!t.includes('favicon')) report.consoleErrors.push(t);
      }
    });
    page.on('requestfailed', (req) => {
      report.networkFailures.push({ url: req.url(), error: req.failure()?.errorText || 'failed' });
    });

    page.on('websocket', (ws) => {
      const redactedUrl = ws.url().replace(/([?&]token=)[^&]+/gi, '$1[REDACTED]');
      const entry = {
        url: redactedUrl,
        sentFrames: [],
        receivedFrames: [],
        closeError: null,
      };
      report.phase0_3_websockets.push(entry);
      ws.on('framesent', (f) => {
        if (entry.sentFrames.length < 10) {
          const p = typeof f.payload === 'string' ? f.payload.slice(0, 200) : `<binary ${f.payload.length} bytes>`;
          entry.sentFrames.push(p);
        }
      });
      ws.on('framereceived', (f) => {
        if (entry.receivedFrames.length < 10) {
          const p = typeof f.payload === 'string' ? f.payload.slice(0, 200) : `<binary ${f.payload.length} bytes>`;
          entry.receivedFrames.push(p);
        }
      });
      ws.on('socketerror', (err) => {
        entry.closeError = err;
      });
      ws.on('close', () => {
        entry.closed = true;
      });
    });

    // 0.4.1 Onboarding
    await page.goto(`${BASE_URL}/app/today`, { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });
    const careSelf = page.getByTestId('care-self_managing');
    if (await careSelf.isVisible({ timeout: 5000 }).catch(() => false)) {
      await careSelf.click();
      await page.getByTestId('onboarding-ack').click();
      await page.getByTestId('onboarding-done').click();
    }
    report.phase0_4_walkthrough.onboarding = await page.getByTestId('orb-button').isVisible();

    // 0.3 Click Talk
    await page.getByTestId('orb-button').click();
    await page.waitForTimeout(2500);
    const statusAfterTalk = await page.getByTestId('orb-status').textContent().catch(() => '');
    report.phase0_4_walkthrough.talkClickStatus = statusAfterTalk;
    // Stop voice if connected
    const pressed = await page.getByTestId('orb-button').getAttribute('aria-pressed');
    if (pressed === 'true') {
      await page.getByTestId('orb-button').click();
      await page.waitForTimeout(500);
    }

    // 0.4.2 Enter-submit
    const taskInput = page.getByTestId('task-input');
    await taskInput.fill('File my expense receipts');
    await taskInput.press('Enter');
    const planVisible = await page.getByTestId('plan-card').isVisible({ timeout: 10000 }).catch(() => false);
    report.phase0_4_walkthrough.enterSubmit = planVisible;

    // 0.4.3 Double-click Send
    await page.evaluate(() => localStorage.removeItem('stay:active_session:v1'));
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByTestId('task-input').fill('Clean desk surface');
    const sendBtn = page.getByTestId('send');
    await Promise.all([sendBtn.click(), sendBtn.click().catch(() => {})]);
    await page.waitForSelector('[data-testid="plan-card"]', { timeout: 10000 }).catch(() => {});
    const userMsgCount = await page.locator('[data-testid="chat-user-message"]').count();
    report.phase0_4_walkthrough.doubleClickSendUserMsgCount = userMsgCount;

    // 0.4.4 More open/close
    const moreBtn = page.getByTestId('menu-button');
    if (await moreBtn.isVisible().catch(() => false)) {
      await moreBtn.click();
      const dialogOpen = await page.locator('[role="dialog"]').isVisible({ timeout: 3000 }).catch(() => false);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      const dialogClosed = !(await page.locator('[role="dialog"]').isVisible().catch(() => false));
      report.phase0_4_walkthrough.moreOpenClose = dialogOpen && dialogClosed;
    }

    // 0.4.5 Timer start -> reload -> stop -> reload
    const startTimer = page.getByTestId('start-timer');
    if (await startTimer.isVisible().catch(() => false)) {
      await startTimer.click();
      await page.waitForSelector('[data-testid="timer-card"]', { timeout: 5000 });
      await page.reload({ waitUntil: 'networkidle' });
      const persistedAfterStart = await page.getByTestId('timer-card').isVisible().catch(() => false);
      if (persistedAfterStart) {
        await page.getByTestId('stop-timer').click();
        await page.reload({ waitUntil: 'networkidle' });
      }
      const stoppedAfterReload = !(await page.getByTestId('timer-card').isVisible().catch(() => false));
      report.phase0_4_walkthrough.timerStartReloadStopReload = persistedAfterStart && stoppedAfterReload;
    }

    // 0.4.6 Check-in saved twice
    await page.goto(`${BASE_URL}/app/treatment`, { waitUntil: 'networkidle' });
    const saveCheckin = page.getByTestId('save-checkin');
    if (await saveCheckin.isVisible({ timeout: 5000 }).catch(() => false)) {
      await saveCheckin.click();
      await page.waitForTimeout(300);
      await saveCheckin.click();
      await page.waitForTimeout(300);
      const checkinRows = await page.locator('[data-testid="checkin-row"]').count();
      report.phase0_4_walkthrough.checkinSavedTwiceRowCount = checkinRows;
    }

    // 0.4.7 PDF export
    await page.goto(`${BASE_URL}/app/reports`, { waitUntil: 'networkidle' });
    const exportPdf = page.getByTestId('export-pdf');
    if (await exportPdf.isVisible({ timeout: 5000 }).catch(() => false)) {
      await exportPdf.click();
      const pdfSuccess = await page.getByTestId('pdf-success-status').isVisible({ timeout: 5000 }).catch(() => false);
      report.phase0_4_walkthrough.pdfExport = pdfSuccess;
    }

    // 0.4.8 History
    await page.goto(`${BASE_URL}/app/history`, { waitUntil: 'networkidle' });
    report.phase0_4_walkthrough.historyLoaded = await page.locator('main').isVisible().catch(() => false);

    await ctx.close();

    // 0.4.9 Mic permission denied
    const deniedCtx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      permissions: [],
    });
    const deniedPage = await deniedCtx.newPage();
    await deniedPage.addInitScript(() => {
      localStorage.setItem('stay_onboarded_v1', '1');
      localStorage.setItem('stay_care_context_v1', 'self_managing');
      navigator.mediaDevices.getUserMedia = async () => {
        throw new DOMException('Permission denied', 'NotAllowedError');
      };
    });
    await deniedPage.goto(`${BASE_URL}/app/today`, { waitUntil: 'networkidle' });
    await ensureOnboarded(deniedPage);
    await deniedPage.getByTestId('orb-button').click();
    await deniedPage.waitForTimeout(1000);
    report.phase0_4_walkthrough.micDeniedStatus = await deniedPage.getByTestId('orb-status').textContent().catch(() => '');
    await deniedCtx.close();
  } finally {
    await browser.close();
    if (srv) srv.kill();
  }

  fs.writeFileSync(path.join(OUT_DIR, 'phase0-browser-audit.json'), JSON.stringify(report, null, 2));
  console.log('Saved docs/evidence/phase0-browser-audit.json');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
