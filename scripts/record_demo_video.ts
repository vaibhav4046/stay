import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { spawn, execFileSync } from 'child_process';

const TIMELINE_PATH = path.resolve(__dirname, 'video_build/timeline.json');
const VIDEO_TMP_DIR = path.resolve(__dirname, 'video_build/raw_video');

interface TurnItem {
  id: string;
  speaker: 'stay' | 'user';
  action: string;
  caption: string;
  text: string;
  start_sec: number;
  duration_sec: number;
  end_sec: number;
  pause_after_sec: number;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function injectSubtitleAndOverlayHelper(page: any) {
  await page.evaluate(() => {
    if (document.getElementById('stay-demo-hud')) return;

    const hud = document.createElement('div');
    hud.id = 'stay-demo-hud';
    hud.style.cssText = `
      position: fixed;
      bottom: 22px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 999999;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      pointer-events: none;
      width: 90%;
      max-width: 960px;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    hud.innerHTML = `
      <div id="stay-demo-pill" style="
        display: inline-flex;
        align-items: center;
        gap: 10px;
        background: rgba(12, 16, 23, 0.88);
        backdrop-filter: blur(16px);
        color: #f8fafc;
        padding: 12px 24px;
        border-radius: 9999px;
        border: 1px solid rgba(56, 189, 248, 0.35);
        box-shadow: 0 20px 45px rgba(0, 0, 0, 0.45);
        font-size: 16px;
        line-height: 1.45;
        text-align: center;
        transition: all 0.25s ease;
      ">
        <span id="stay-demo-badge" style="
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          background: rgba(16, 185, 129, 0.2);
          color: #34d399;
          border: 1px solid rgba(16, 185, 129, 0.4);
          white-space: nowrap;
        ">STAY AI</span>
        <span id="stay-demo-text" style="font-weight: 500; color: #f1f5f9;">Hi, I am Stay.</span>
      </div>
    `;
    document.body.appendChild(hud);
  });
}

async function setSubtitle(page: any, speaker: 'stay' | 'user', text: string) {
  await page.evaluate(
    ({ spk, txt }: { spk: string; txt: string }) => {
      const badge = document.getElementById('stay-demo-badge');
      const textEl = document.getElementById('stay-demo-text');
      const pill = document.getElementById('stay-demo-pill');
      if (!badge || !textEl || !pill) return;

      if (spk === 'user') {
        badge.textContent = '🎙️ USER (VAIBHAV)';
        badge.style.background = 'rgba(245, 158, 11, 0.22)';
        badge.style.color = '#fbbf24';
        badge.style.borderColor = 'rgba(245, 158, 11, 0.45)';
        pill.style.borderColor = 'rgba(245, 158, 11, 0.45)';
      } else {
        badge.textContent = '✨ STAY COMPANION';
        badge.style.background = 'rgba(14, 165, 233, 0.22)';
        badge.style.color = '#38bdf8';
        badge.style.borderColor = 'rgba(14, 165, 233, 0.45)';
        pill.style.borderColor = 'rgba(56, 189, 248, 0.45)';
      }
      textEl.textContent = txt;
    },
    { spk: speaker, txt: text }
  );
}

async function showArchitectureOverlay(page: any) {
  await page.evaluate(() => {
    const existing = document.getElementById('stay-arch-card');
    if (existing) existing.remove();

    const card = document.createElement('div');
    card.id = 'stay-arch-card';
    card.style.cssText = `
      position: fixed;
      top: 76px;
      right: 32px;
      z-index: 999998;
      width: 440px;
      background: rgba(15, 23, 42, 0.94);
      backdrop-filter: blur(20px);
      color: #f8fafc;
      border-radius: 20px;
      padding: 22px 24px;
      border: 1px solid rgba(56, 189, 248, 0.35);
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.6);
      font-family: system-ui, -apple-system, sans-serif;
    `;
    card.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <span style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#38bdf8;background:rgba(56,189,248,0.12);padding:4px 10px;border-radius:999px;border:1px solid rgba(56,189,248,0.3);">
          Full-Duplex Voice & AI Stack
        </span>
        <span style="font-family:monospace;font-size:12px;color:#34d399;">&lt;1s Turn Latency</span>
      </div>
      <h3 style="margin:0 0 10px 0;font-size:18px;font-weight:700;color:#fff;">
        AssemblyAI Universal-3 Pro + Groq 120B
      </h3>
      <div style="display:grid;gap:10px;font-size:13px;color:#cbd5e1;">
        <div style="background:rgba(30,41,59,0.75);padding:10px 12px;border-radius:12px;border:1px solid rgba(148,163,184,0.15);">
          <strong style="color:#38bdf8;display:block;margin-bottom:2px;">🎙️ AssemblyAI Universal-3 Pro Voice Agent</strong>
          Single-WebSocket 24kHz PCM speech-to-speech · 32-language auto-detection · Live barge-in · Keyterm boosting
        </div>
        <div style="background:rgba(30,41,59,0.75);padding:10px 12px;border-radius:12px;border:1px solid rgba(148,163,184,0.15);">
          <strong style="color:#a78bfa;display:block;margin-bottom:2px;">⚡ Groq (openai/gpt-oss-120b) + Executive Engine</strong>
          Time Reality Calculator · 3-Angle Brainstorm · 3-Phase Path · Deterministic offline CBT fallback
        </div>
        <div style="background:rgba(30,41,59,0.75);padding:10px 12px;border-radius:12px;border:1px solid rgba(148,163,184,0.15);">
          <strong style="color:#34d399;display:block;margin-bottom:2px;">🛡️ Hard Clinical & Crisis Safety Gates</strong>
          Pre-LLM crisis interception (999/111/Samaritans) · Medication dosing suppression · Clinician PDF Export
        </div>
      </div>
    `;
    document.body.appendChild(card);
  });
}

async function showClosingBrandCard(page: any) {
  await page.evaluate(() => {
    const arch = document.getElementById('stay-arch-card');
    if (arch) arch.remove();

    const existing = document.getElementById('stay-closing-card');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'stay-closing-card';
    modal.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 999990;
      background: radial-gradient(circle at center, rgba(15, 23, 42, 0.88) 0%, rgba(7, 10, 18, 0.96) 100%);
      backdrop-filter: blur(18px);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px;
      color: #f8fafc;
      font-family: system-ui, -apple-system, sans-serif;
      text-align: center;
    `;
    modal.innerHTML = `
      <div style="
        width: 96px;
        height: 96px;
        border-radius: 999px;
        background: radial-gradient(circle at 35% 30%, #67e8f9, #0284c7 55%, #1e1b4b 100%);
        box-shadow: 0 0 60px rgba(56, 189, 248, 0.55), inset 0 0 24px rgba(255,255,255,0.6);
        margin-bottom: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="width:76px;height:76px;border-radius:999px;border:1.5px solid rgba(255,255,255,0.45);"></div>
      </div>

      <span style="font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#38bdf8;margin-bottom:10px;">
        Voice-First Point-of-Performance ADHD Companion
      </span>
      <h1 style="font-size:44px;font-weight:800;margin:0 0 12px 0;letter-spacing:-0.02em;color:#ffffff;">
        STAY — From Frozen to Started in 60 Seconds
      </h1>
      <p style="font-size:17px;color:#cbd5e1;max-width:680px;margin:0 0 28px 0;line-height:1.5;">
        Powered by <strong>AssemblyAI Universal-3 Pro</strong> (32 Languages · Full-Duplex Speech-to-Speech) &amp; <strong>Groq gpt-oss-120b</strong> · Deterministic Safety · 60fps GLSL Topic-Morphing Orb
      </p>

      <!-- Platform Availability SVG Pills -->
      <div style="display:flex;flex-wrap:wrap;gap:14px;justify-content:center;margin-bottom:28px;">
        <div style="display:flex;align-items:center;gap:10px;background:rgba(30,41,59,0.9);border:1px solid rgba(148,163,184,0.25);padding:10px 18px;border-radius:14px;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
          <span style="font-weight:600;font-size:14px;">Web App (Live Now)</span>
        </div>
        <div style="display:flex;align-items:center;gap:10px;background:rgba(30,41,59,0.9);border:1px solid rgba(148,163,184,0.25);padding:10px 18px;border-radius:14px;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
          <span style="font-weight:600;font-size:14px;">iOS &amp; Android Installable PWA</span>
        </div>
        <div style="display:flex;align-items:center;gap:10px;background:rgba(30,41,59,0.9);border:1px solid rgba(148,163,184,0.25);padding:10px 18px;border-radius:14px;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          <span style="font-weight:600;font-size:14px;">Desktop Body-Double Mode</span>
        </div>
      </div>

      <!-- Links & GitHub Repository -->
      <div style="display:flex;flex-wrap:wrap;gap:18px;justify-content:center;">
        <div style="background:rgba(14,165,233,0.18);border:1.5px solid #38bdf8;padding:12px 24px;border-radius:14px;font-family:monospace;font-size:15px;color:#e0f2fe;">
          🌐 https://stay-two-swart.vercel.app
        </div>
        <div style="background:rgba(16,185,129,0.18);border:1.5px solid #34d399;padding:12px 24px;border-radius:14px;font-family:monospace;font-size:15px;color:#d1fae5;">
          💻 github.com/vaibhav4046/stay
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  });
}

async function runAction(page: any, action: string) {
  try {
    if (action === 'act1_orb_intro') {
      // Pure Living Orb screen — pre-seeded onboarding completed so the Living Orb is front and center
      await injectSubtitleAndOverlayHelper(page);
    } else if (action === 'act1_orb_mission') {
      // Gently pulse the Orb into therapeutic ripple mode during intro mission statement
      const input = page.getByTestId('task-input');
      if (await input.count()) {
        await input.fill('therapeutic calm body double');
        await sleep(2200);
        await input.fill('');
      }
    } else if (action === 'act2_user_wake') {
      // User says "Hi Stay"
      const input = page.getByTestId('task-input');
      if (await input.count()) {
        await input.fill('Hey Stay');
        await input.press('Enter');
      }
    } else if (action === 'act2_stay_greet') {
      // Stay greets warmly
    } else if (action === 'act2_type_letters_task') {
      // User speaks/types the tax letters task -> Orb morphs into Mode 2 (Crystalline Letterforms)
      const input = page.getByTestId('task-input');
      const task = 'Write letters to landlord and finish quarterly VAT tax paperwork';
      await input.fill(task);
      await sleep(1500);
      await input.press('Enter');
    } else if (action === 'act2_show_reality_and_angles') {
      // Show Time Reality Calculator first, then open 3 Angles tab
      await sleep(3500);
      const brainstormBtn = page.getByTestId('orb-exec-brainstorm');
      if (await brainstormBtn.count()) {
        await brainstormBtn.click();
      }
    } else if (action === 'act2_select_angle_and_therapeutic') {
      // Select Angle 0 ("The 3-Bullet Draft") and type therapeutic calm
      const angle0 = page.getByTestId('orb-angle-0');
      if (await angle0.count()) {
        await angle0.click();
      }
      await sleep(1200);
      const input = page.getByTestId('task-input');
      await input.fill('therapeutic calm breathing');
    } else if (action === 'act2_ice_cream_and_memory_extract') {
      // Morph from Lotus Calm -> Ice Cream Reward Swirl, and save memory fact
      await sleep(2500);
      const input = page.getByTestId('task-input');
      await input.fill('I love ice cream as a reward after finishing taxes');
      await sleep(2000);
      await input.press('Enter');
    } else if (action === 'act2_voice_cmd_memory_and_history') {
      // Voice command: "show me memory"
      const input = page.getByTestId('task-input');
      await input.fill('show me memory');
      await input.press('Enter');
    } else if (action === 'act2_close_modals_and_path') {
      // Show memory for 2.5s -> switch to chat history for 2.5s -> close panel -> show 3-Phase Path
      await sleep(2600);
      const input = page.getByTestId('task-input');
      await input.fill('close panel');
      await input.press('Enter');
      await sleep(700);
      await input.fill('show me chat history');
      await input.press('Enter');
      await sleep(2600);
      await input.fill('close panel');
      await input.press('Enter');
      await sleep(600);
      const pathBtn = page.getByTestId('orb-exec-path');
      if (await pathBtn.count()) {
        await pathBtn.click();
      }
    } else if (action === 'act2_multilingual_and_timer') {
      // Voice command: "switch to Spanish"
      const input = page.getByTestId('task-input');
      await input.fill('switch to Spanish');
      await input.press('Enter');
    } else if (action === 'act2_timer_running') {
      // Start 20-minute Halo Sprint timer!
      const startBtn = page.getByTestId('start-halo-timer');
      if (await startBtn.count()) {
        await startBtn.click();
      } else {
        const input = page.getByTestId('task-input');
        await input.fill('start 20 minutes');
        await input.press('Enter');
      }
    } else if (action === 'act3_architecture_reports') {
      // Navigate to Clinician Reports & show Architecture Overlay
      await page.goto('http://localhost:3000/app/reports');
      await injectSubtitleAndOverlayHelper(page);
      await showArchitectureOverlay(page);
    } else if (action === 'act3_orb_diagnostic_and_safety') {
      // Navigate to 60fps GLSL Signal Orb Diagnostic page & show Architecture Overlay
      await page.goto('http://localhost:3000/demo/orb-diagnostic');
      await injectSubtitleAndOverlayHelper(page);
      await showArchitectureOverlay(page);
    } else if (action === 'act3_closing_card') {
      // Show full-screen Hackathon Closing Card with platform SVGs & GitHub link
      await injectSubtitleAndOverlayHelper(page);
      await showClosingBrandCard(page);
    }
  } catch (err) {
    console.warn(`Non-fatal UI action warning on ${action}:`, err);
  }
}

async function waitForServer(url: string, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // retry
    }
    await sleep(400);
  }
  throw new Error('Server did not start in time');
}

async function main() {
  const timelineRaw = fs.readFileSync(TIMELINE_PATH, 'utf-8');
  const timeline = JSON.parse(timelineRaw) as {
    total_duration_sec: number;
    master_wav: string;
    turns: TurnItem[];
  };

  if (fs.existsSync(VIDEO_TMP_DIR)) {
    fs.rmSync(VIDEO_TMP_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(VIDEO_TMP_DIR, { recursive: true });

  console.log('Ensuring Next.js production server is running on http://localhost:3000...');
  let serverProc: ReturnType<typeof spawn> | null = null;
  try {
    const check = await fetch('http://localhost:3000');
    if (!check.ok) throw new Error('not up');
  } catch {
    serverProc = spawn('npm', ['run', 'start'], {
      cwd: path.resolve(__dirname, '..'),
      shell: true,
      stdio: 'ignore',
    });
    await waitForServer('http://localhost:3000');
  }

  try {
    console.log('Launching Chromium for 1280x720 HD live Playwright recording...');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      recordVideo: {
        dir: VIDEO_TMP_DIR,
        size: { width: 1280, height: 720 },
      },
    });

    const page = await context.newPage();

    // Pre-seed onboarding & realistic session history BEFORE starting our timeline clock
    await page.goto('http://localhost:3000/app/today');
    await page.evaluate(() => {
      localStorage.setItem(
        'stay_v1_profile',
        JSON.stringify({
          userId: 'vaibhav-demo',
          careContext: 'waitlisted',
          interactionMode: 'voice_and_text',
          proactiveCheckins: true,
          onboardingCompleted: true,
          updatedAt: new Date().toISOString(),
        })
      );
      localStorage.setItem(
        'stay_v1_user_memory',
        JSON.stringify({
          name: 'Vaibhav',
          preferredLanguage: 'en-GB',
          facts: [
            {
              id: 'mem-1',
              category: 'trigger',
              text: 'Gets executive freeze on multi-page tax and landlord paperwork',
              createdAt: new Date().toISOString(),
            },
            {
              id: 'mem-2',
              category: 'coping_strategy',
              text: 'Starts best with 60-second 3-bullet messy drafts and therapeutic calm music',
              createdAt: new Date().toISOString(),
            },
          ],
          recentSessionsSummary: [
            {
              date: new Date().toISOString(),
              task: 'Reply to landlord lease renewal',
              outcome: 'started',
              strategy: 'Task Shrinking',
            },
          ],
          updatedAt: new Date().toISOString(),
        })
      );
      localStorage.setItem(
        'stay_v1_coach_sessions',
        JSON.stringify([
          {
            id: 'sess-demo-1',
            userId: 'vaibhav-demo',
            createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
            completedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
            mode: 'voice',
            careContext: 'waitlisted',
            taskText: 'Reply to landlord about lease renewal',
            barrierType: 'overwhelm',
            strategyKey: 'task_shrinking',
            firstStep: 'Write 3 messy bullet points in a blank reply',
            plannedMinutes: 20,
            actualSeconds: 1200,
            outcome: 'started',
            helpfulRating: 5,
            crisisTriggered: false,
          },
          {
            id: 'sess-demo-2',
            userId: 'vaibhav-demo',
            createdAt: new Date(Date.now() - 86400000).toISOString(),
            completedAt: new Date(Date.now() - 86400000).toISOString(),
            mode: 'voice',
            careContext: 'waitlisted',
            taskText: 'Organize NHS ADHD clinic referral forms',
            barrierType: 'perfectionism_or_fear',
            strategyKey: 'implementation_intention',
            firstStep: 'Open folder and rename one PDF file',
            plannedMinutes: 15,
            actualSeconds: 900,
            outcome: 'started',
            helpfulRating: 5,
            crisisTriggered: false,
          },
        ])
      );
    });
    await page.reload();
    await injectSubtitleAndOverlayHelper(page);

    const startWall = Date.now();

    for (const turn of timeline.turns) {
      const nowElapsed = (Date.now() - startWall) / 1000;
      const waitToStart = (turn.start_sec - nowElapsed) * 1000;
      if (waitToStart > 0) {
        await sleep(waitToStart);
      }

      console.log(`[${turn.start_sec.toFixed(1)}s] (${turn.speaker.toUpperCase()}) ${turn.id}: ${turn.caption}`);
      await injectSubtitleAndOverlayHelper(page);
      await setSubtitle(page, turn.speaker, turn.text);
      await runAction(page, turn.action);

      const afterActionElapsed = (Date.now() - startWall) / 1000;
      const waitToEnd = (turn.end_sec - afterActionElapsed) * 1000;
      if (waitToEnd > 0) {
        await sleep(waitToEnd);
      }
    }

    // Wait until full total_duration_sec
    const finalElapsed = (Date.now() - startWall) / 1000;
    const remainingMs = (timeline.total_duration_sec - finalElapsed) * 1000;
    if (remainingMs > 0) {
      await sleep(remainingMs);
    }

    const videoObj = page.video();
    await context.close();
    await browser.close();

    const webmPath = await videoObj?.path();
    console.log('Recorded raw WebM video at:', webmPath);

    if (webmPath && fs.existsSync(webmPath)) {
      const ffmpegExe =
        'C:\\Users\\lalwa\\AppData\\Local\\Programs\\Python\\Python313\\Lib\\site-packages\\imageio_ffmpeg\\binaries\\ffmpeg-win-x86_64-v7.1.exe';
      const outPublicMp4 = path.resolve(__dirname, '../public/stay-hackathon-demo.mp4');
      console.log('Muxing video + dual-voice & therapeutic BGM audio into MP4...');
      execFileSync(
        ffmpegExe,
        [
          '-y',
          '-i',
          webmPath,
          '-i',
          timeline.master_wav,
          '-c:v',
          'libx264',
          '-preset',
          'fast',
          '-crf',
          '21',
          '-pix_fmt',
          'yuv420p',
          '-c:a',
          'aac',
          '-b:a',
          '192k',
          '-shortest',
          outPublicMp4,
        ],
        { stdio: 'inherit' }
      );
      console.log('Successfully created final demo video:', outPublicMp4);
    }
  } finally {
    if (serverProc && serverProc.pid) {
      try {
        execFileSync('taskkill', ['/pid', String(serverProc.pid), '/T', '/F'], { stdio: 'ignore' });
      } catch {
        // ignore
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
