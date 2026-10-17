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
    if (!document.getElementById('stay-demo-keyframes')) {
      const style = document.createElement('style');
      style.id = 'stay-demo-keyframes';
      style.textContent = `
        @keyframes stayWavePulse {
          0%, 100% { transform: scaleY(0.35); }
          50% { transform: scaleY(1); }
        }
        @keyframes stayCardSlideIn {
          from { opacity: 0; transform: translateY(10px) scale(0.985); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `;
      document.head.appendChild(style);
    }

    if (document.getElementById('stay-demo-hud')) return;

    const hud = document.createElement('div');
    hud.id = 'stay-demo-hud';
    hud.style.cssText = `
      position: fixed;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 999999;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      pointer-events: none;
      width: 92%;
      max-width: 1000px;
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', system-ui, sans-serif;
      -webkit-font-smoothing: antialiased;
    `;
    hud.innerHTML = `
      <!-- Sleek Apple Keynote Frosted Alabaster Context Capsule -->
      <div id="stay-demo-caption-strip" style="
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: rgba(255, 255, 255, 0.88);
        backdrop-filter: saturate(180%) blur(24px);
        -webkit-backdrop-filter: saturate(180%) blur(24px);
        color: #1d1d1f;
        padding: 4px 14px;
        border-radius: 9999px;
        border: 1px solid rgba(0, 0, 0, 0.08);
        font-size: 11.5px;
        font-weight: 600;
        letter-spacing: -0.01em;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
      ">
        <span style="width:7px;height:7px;border-radius:999px;background:#006A67;display:inline-block;"></span>
        <span id="stay-demo-caption-text">Stay · 24/7 Living Voice-First ADHD Companion</span>
      </div>

      <!-- Apple TV+ / Apple Keynote Translucent Graphite Cinema Subtitle Bar -->
      <div id="stay-demo-pill" style="
        position: relative;
        overflow: hidden;
        display: flex;
        align-items: center;
        gap: 14px;
        background: rgba(28, 28, 30, 0.86);
        backdrop-filter: saturate(180%) blur(28px);
        -webkit-backdrop-filter: saturate(180%) blur(28px);
        color: #f5f5f7;
        padding: 12px 22px;
        border-radius: 22px;
        border: 1px solid rgba(255, 255, 255, 0.14);
        box-shadow: 0 20px 48px rgba(0, 0, 0, 0.22);
        font-size: 15.5px;
        line-height: 1.42;
        letter-spacing: -0.01em;
        text-align: left;
        width: 100%;
      ">
        <div id="stay-demo-badge" style="
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 5px 12px;
          border-radius: 9999px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.02em;
          background: rgba(255, 255, 255, 0.14);
          color: #ffffff;
          border: 1px solid rgba(255, 255, 255, 0.18);
          white-space: nowrap;
          flex-shrink: 0;
        ">
          <svg width="14" height="12" viewBox="0 0 16 14" fill="currentColor">
            <rect x="1" y="3" width="2" height="8" rx="1" style="transform-origin:center;animation:stayWavePulse 0.6s infinite ease-in-out;" />
            <rect x="5" y="1" width="2" height="12" rx="1" style="transform-origin:center;animation:stayWavePulse 0.45s infinite ease-in-out 0.1s;" />
            <rect x="9" y="2" width="2" height="10" rx="1" style="transform-origin:center;animation:stayWavePulse 0.55s infinite ease-in-out 0.2s;" />
            <rect x="13" y="4" width="2" height="6" rx="1" style="transform-origin:center;animation:stayWavePulse 0.5s infinite ease-in-out 0.15s;" />
          </svg>
          <span id="stay-demo-speaker-label">Stay</span>
        </div>
        <span id="stay-demo-text" style="font-weight: 500; color: #f5f5f7; flex: 1;">Hi, I am Stay.</span>
        <div id="stay-demo-progress" style="
          position: absolute;
          bottom: 0;
          left: 0;
          height: 2.5px;
          background: linear-gradient(90deg, #5EEAD4, #ffffff);
          width: 0%;
        "></div>
      </div>
    `;
    document.body.appendChild(hud);
  });
}

async function setSubtitle(
  page: any,
  speaker: 'stay' | 'user',
  text: string,
  caption: string,
  durationSec: number
) {
  await page.evaluate(
    ({
      spk,
      txt,
      cap,
      dur,
    }: {
      spk: string;
      txt: string;
      cap: string;
      dur: number;
    }) => {
      const badge = document.getElementById('stay-demo-badge');
      const speakerLabel = document.getElementById('stay-demo-speaker-label');
      const textEl = document.getElementById('stay-demo-text');
      const captionEl = document.getElementById('stay-demo-caption-text');
      const pill = document.getElementById('stay-demo-pill');
      const prog = document.getElementById('stay-demo-progress');
      if (!badge || !speakerLabel || !textEl || !pill) return;

      if (captionEl && cap) {
        captionEl.textContent = cap;
      }

      if (spk === 'user') {
        speakerLabel.textContent = 'Vaibhav';
        badge.style.background = 'rgba(255, 255, 255, 0.92)';
        badge.style.color = '#1d1d1f';
        badge.style.borderColor = 'rgba(255, 255, 255, 0.95)';
      } else {
        speakerLabel.textContent = 'Stay';
        badge.style.background = 'rgba(13, 148, 136, 0.38)';
        badge.style.color = '#f0fdfa';
        badge.style.borderColor = 'rgba(94, 234, 212, 0.45)';
      }
      textEl.textContent = txt;

      if (prog) {
        prog.style.transition = 'none';
        prog.style.width = '0%';
        void prog.offsetWidth;
        prog.style.transition = `width ${Math.max(1, dur)}s linear`;
        prog.style.width = '100%';
      }
    },
    { spk: speaker, txt: text, cap: caption, dur: durationSec }
  );
}

async function clearSideCards(page: any) {
  await page.evaluate(() => {
    for (const id of ['stay-svg-card', 'stay-arch-card']) {
      const el = document.getElementById(id);
      if (el) el.remove();
    }
  });
}

async function showMorphSvgArtifactCard(page: any) {
  await page.evaluate(() => {
    const existing = document.getElementById('stay-svg-card');
    if (existing) existing.remove();

    const card = document.createElement('div');
    card.id = 'stay-svg-card';
    card.style.cssText = `
      position: fixed;
      top: 76px;
      right: 24px;
      z-index: 999995;
      width: 345px;
      background: rgba(255, 255, 255, 0.90);
      backdrop-filter: saturate(180%) blur(28px);
      -webkit-backdrop-filter: saturate(180%) blur(28px);
      color: #1d1d1f;
      border-radius: 24px;
      padding: 18px 20px;
      border: 1px solid rgba(0, 0, 0, 0.08);
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.08);
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', sans-serif;
      animation: stayCardSlideIn 0.35s cubic-bezier(0.22, 1, 0.36, 1);
    `;
    card.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
        <span style="font-size:10px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#006A67;">
          Spring-Physics Parametric Engine
        </span>
        <span style="font-size:10.5px;font-weight:600;color:#6e6e73;background:rgba(0,0,0,0.04);padding:2px 8px;border-radius:999px;">60 FPS · 120 Vertices</span>
      </div>
      <div style="font-size:15px;font-weight:700;margin-bottom:12px;color:#1d1d1f;letter-spacing:-0.015em;">
        Real-Time Topic Geometry
      </div>
      <svg viewBox="0 0 310 92" width="100%" height="92" style="background:#F7F6F2;border-radius:16px;border:1px solid rgba(0,0,0,0.06);">
        <!-- 1. 8-Petal Botanical Lotus -->
        <g transform="translate(40, 40)">
          <circle r="21" fill="rgba(13,148,136,0.10)" stroke="#0D9488" stroke-width="1.4"/>
          <path d="M0,-19 C6,-10 6,10 0,19 C-6,10 -6,-10 0,-19 Z" fill="rgba(13,148,136,0.22)" stroke="#0F766E" stroke-width="1.2"/>
          <path d="M-19,0 C-10,-6 10,-6 19,0 C10,6 -10,6 -19,0 Z" fill="rgba(13,148,136,0.22)" stroke="#0F766E" stroke-width="1.2"/>
          <circle r="4" fill="#F59E0B"/>
          <text x="0" y="36" text-anchor="middle" fill="#1d1d1f" font-size="9.5" font-weight="600">🪷 Lotus</text>
        </g>
        <!-- 2. Crystalline Letterform Gem -->
        <g transform="translate(115, 40)">
          <polygon points="0,-21 15,-15 21,0 15,15 0,21 -15,15 -21,0 -15,-15" fill="rgba(0,113,227,0.12)" stroke="#0071E3" stroke-width="1.5"/>
          <rect x="-9" y="-11" width="18" height="22" rx="2.5" fill="#ffffff" stroke="#0071E3" stroke-width="1.1"/>
          <line x1="-5" y1="-5" x2="5" y2="-5" stroke="#0071E3" stroke-width="1.3"/>
          <line x1="-5" y1="0" x2="3" y2="0" stroke="#0071E3" stroke-width="1.3"/>
          <line x1="-5" y1="5" x2="5" y2="5" stroke="#0071E3" stroke-width="1.3"/>
          <text x="0" y="36" text-anchor="middle" fill="#1d1d1f" font-size="9.5" font-weight="600">✒️ Gem</text>
        </g>
        <!-- 3. Ice Cream Cone & Swirl -->
        <g transform="translate(192, 40)">
          <path d="M-12,-1 L0,20 L12,-1 Z" fill="#F59E0B" stroke="#B45309" stroke-width="1.3"/>
          <circle cx="0" cy="-7" r="11" fill="#FB7185" stroke="#E11D48" stroke-width="1.4"/>
          <circle cx="0" cy="-18" r="3.5" fill="#E11D48"/>
          <text x="0" y="36" text-anchor="middle" fill="#1d1d1f" font-size="9.5" font-weight="600">🍦 Cone</text>
        </g>
        <!-- 4. 5-Fold Creative Star -->
        <g transform="translate(268, 40)">
          <polygon points="0,-21 5,-7 20,-7 8,2 13,18 0,9 -13,18 -8,2 -20,-7 -5,-7" fill="rgba(124,58,237,0.16)" stroke="#7C3AED" stroke-width="1.4"/>
          <text x="0" y="36" text-anchor="middle" fill="#1d1d1f" font-size="9.5" font-weight="600">🎨 Star</text>
        </g>
      </svg>
    `;
    document.body.appendChild(card);
  });
}

async function showChaosToClaritySvgCard(page: any) {
  await page.evaluate(() => {
    const existing = document.getElementById('stay-svg-card');
    if (existing) existing.remove();

    const card = document.createElement('div');
    card.id = 'stay-svg-card';
    card.style.cssText = `
      position: fixed;
      top: 76px;
      right: 24px;
      z-index: 999995;
      width: 360px;
      background: rgba(255, 255, 255, 0.92);
      backdrop-filter: saturate(180%) blur(28px);
      -webkit-backdrop-filter: saturate(180%) blur(28px);
      color: #1d1d1f;
      border-radius: 24px;
      padding: 18px 20px;
      border: 1px solid rgba(0, 0, 0, 0.08);
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.08);
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', sans-serif;
      animation: stayCardSlideIn 0.35s cubic-bezier(0.22, 1, 0.36, 1);
    `;
    card.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <span style="font-size:10px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#006A67;">
          24/7 Autonomous ADHD Pipeline
        </span>
        <span style="font-size:10.5px;font-weight:600;color:#0071E3;background:rgba(0,113,227,0.08);padding:2px 8px;border-radius:999px;">Live Execution</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        <div style="background:#F7F6F2;border-radius:14px;padding:10px 12px;border:1px solid rgba(0,0,0,0.06);">
          <div style="font-size:10px;font-weight:700;color:#86868b;text-transform:uppercase;">1. Raw Chaotic Brain-Dump</div>
          <div style="font-size:12px;font-weight:500;color:#1d1d1f;margin-top:2px;">"uhh brain is fried, 10 tabs, landlord + VAT taxes..."</div>
        </div>
        <div style="background:rgba(0,113,227,0.06);border-radius:14px;padding:10px 12px;border:1px solid rgba(0,113,227,0.15);">
          <div style="font-size:10px;font-weight:700;color:#0071E3;text-transform:uppercase;">2. Autonomous Agent Pre-Draft</div>
          <div style="font-size:12px;font-weight:600;color:#1d1d1f;margin-top:2px;">✨ Drafted Landlord &amp; Q3 VAT Reply + 3 Micro-Checkboxes</div>
        </div>
        <div style="background:rgba(0,106,103,0.07);border-radius:14px;padding:10px 12px;border:1px solid rgba(0,106,103,0.18);">
          <div style="font-size:10px;font-weight:700;color:#006A67;text-transform:uppercase;">3. Longitudinal Brain Study</div>
          <div style="font-size:12px;font-weight:600;color:#1d1d1f;margin-top:2px;">🧬 180m Dread → 45s Entry · Working Memory 7 → 1 Slot</div>
        </div>
      </div>
    `;
    document.body.appendChild(card);
  });
}

async function showArchitectureOverlay(page: any) {
  await page.evaluate(() => {
    const existing = document.getElementById('stay-arch-card');
    if (existing) existing.remove();

    const card = document.createElement('div');
    card.id = 'stay-arch-card';
    card.style.cssText = `
      position: fixed;
      top: 68px;
      right: 28px;
      z-index: 999998;
      width: 475px;
      background: rgba(255, 255, 255, 0.94);
      backdrop-filter: saturate(180%) blur(30px);
      -webkit-backdrop-filter: saturate(180%) blur(30px);
      color: #1d1d1f;
      border-radius: 28px;
      padding: 22px 24px;
      border: 1px solid rgba(0, 0, 0, 0.08);
      box-shadow: 0 28px 70px rgba(0, 0, 0, 0.12);
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', sans-serif;
      animation: stayCardSlideIn 0.35s cubic-bezier(0.22, 1, 0.36, 1);
    `;
    card.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <span style="font-size:10.5px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#006A67;background:rgba(0,106,103,0.08);padding:4px 10px;border-radius:999px;">
          Apple-Grade Full-Duplex System Architecture
        </span>
        <span style="font-size:11.5px;color:#1d1d1f;font-weight:600;">24kHz PCM · &lt;1s Turn Latency</span>
      </div>

      <!-- Precision Apple Keynote Architecture Vector Diagram -->
      <svg viewBox="0 0 426 152" width="100%" height="152" style="background:#F7F6F2;border-radius:18px;border:1px solid rgba(0,0,0,0.06);margin-bottom:12px;">
        <!-- Node 1: Browser AudioWorklet -->
        <rect x="10" y="14" width="112" height="54" rx="12" fill="#ffffff" stroke="rgba(0,0,0,0.12)" stroke-width="1.2"/>
        <text x="66" y="36" text-anchor="middle" fill="#1d1d1f" font-size="10.5" font-weight="700">🎙️ AudioWorklet</text>
        <text x="66" y="52" text-anchor="middle" fill="#6e6e73" font-size="9.2">24kHz PCM · Barge-In</text>

        <!-- Bi-directional arrow 1 -->
        <line x1="122" y1="41" x2="154" y2="41" stroke="#006A67" stroke-width="1.8"/>
        <polygon points="150,37 157,41 150,45" fill="#006A67"/>
        <polygon points="126,37 119,41 126,45" fill="#006A67"/>

        <!-- Node 2: AssemblyAI Universal-3 Pro -->
        <rect x="157" y="10" width="132" height="62" rx="12" fill="#006A67" stroke="#00524F" stroke-width="1.2"/>
        <text x="223" y="31" text-anchor="middle" fill="#ffffff" font-size="10.5" font-weight="700">AssemblyAI</text>
        <text x="223" y="45" text-anchor="middle" fill="#99F6E4" font-size="10" font-weight="600">Universal-3 Pro</text>
        <text x="223" y="59" text-anchor="middle" fill="#E6FFFA" font-size="8.8">32 Langs · Keyterm Boost</text>

        <!-- Arrow to Groq -->
        <line x1="289" y1="41" x2="316" y2="41" stroke="#0071E3" stroke-width="1.8"/>
        <polygon points="312,37 319,41 312,45" fill="#0071E3"/>

        <!-- Node 3: Groq 120B -->
        <rect x="319" y="14" width="97" height="54" rx="12" fill="#ffffff" stroke="#0071E3" stroke-width="1.4"/>
        <text x="367" y="35" text-anchor="middle" fill="#0071E3" font-size="10.5" font-weight="700">⚡ Groq 120B</text>
        <text x="367" y="50" text-anchor="middle" fill="#6e6e73" font-size="9">gpt-oss-120b</text>

        <!-- Bottom Layer: 24/7 Agent + 1775-2024 Clinical Engine + Pre-LLM Safety -->
        <rect x="10" y="88" width="198" height="50" rx="12" fill="#ffffff" stroke="rgba(0,0,0,0.1)" stroke-width="1.2"/>
        <text x="109" y="109" text-anchor="middle" fill="#1d1d1f" font-size="10" font-weight="700">🛡️ Pre-LLM Safety &amp; 24/7 Agent</text>
        <text x="109" y="125" text-anchor="middle" fill="#6e6e73" font-size="9">999/111 Crisis Gate · Auto-Draft Work</text>

        <rect x="218" y="88" width="198" height="50" rx="12" fill="#ffffff" stroke="rgba(0,0,0,0.1)" stroke-width="1.2"/>
        <text x="317" y="109" text-anchor="middle" fill="#1d1d1f" font-size="10" font-weight="700">🧬 1775–2024 Clinical &amp; 60fps Orb</text>
        <text x="317" y="125" text-anchor="middle" fill="#6e6e73" font-size="9">ADHD Phenotyping · Clinician PDF</text>
      </svg>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:11.5px;color:#1d1d1f;">
        <div style="background:#F7F6F2;padding:9px 11px;border-radius:12px;border:1px solid rgba(0,0,0,0.06);">
          <strong style="color:#006A67;display:block;">🎙️ Single-Socket Speech-to-Speech</strong>
          <span style="color:#6e6e73;">Zero stitched STT→LLM→TTS lag</span>
        </div>
        <div style="background:#F7F6F2;padding:9px 11px;border-radius:12px;border:1px solid rgba(0,0,0,0.06);">
          <strong style="color:#0071E3;display:block;">🧠 Longitudinal Brain Study</strong>
          <span style="color:#6e6e73;">Tracks triggers, dopamine &amp; wins</span>
        </div>
      </div>
    `;
    document.body.appendChild(card);
  });
}

async function showClosingBrandCard(page: any) {
  await page.evaluate(() => {
    for (const id of ['stay-svg-card', 'stay-arch-card', 'stay-closing-card']) {
      const el = document.getElementById(id);
      if (el) el.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'stay-closing-card';
    modal.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 999990;
      background: radial-gradient(120% 100% at 50% 0%, #FFFFFF 0%, #F7F6F2 60%, #EFECE6 100%);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 36px;
      color: #1d1d1f;
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', sans-serif;
      text-align: center;
      animation: stayCardSlideIn 0.4s cubic-bezier(0.22, 1, 0.36, 1);
    `;
    modal.innerHTML = `
      <!-- Apple Keynote Sculpted Emblem Row -->
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:22px;">
        <div style="width:64px;height:64px;border-radius:20px;background:#ffffff;border:1px solid rgba(0,0,0,0.08);display:flex;align-items:center;justify-content:center;font-size:28px;box-shadow:0 12px 32px rgba(0,0,0,0.06);">🪷</div>
        <div style="width:82px;height:82px;border-radius:999px;background:radial-gradient(circle at 35% 30%, #5EEAD4, #006A67 62%, #003634 100%);box-shadow:0 18px 45px rgba(0, 106, 103, 0.28), inset 0 0 18px rgba(255,255,255,0.65);display:flex;align-items:center;justify-content:center;">
          <div style="width:62px;height:62px;border-radius:999px;border:1.5px solid rgba(255,255,255,0.55);"></div>
        </div>
        <div style="width:64px;height:64px;border-radius:20px;background:#ffffff;border:1px solid rgba(0,0,0,0.08);display:flex;align-items:center;justify-content:center;font-size:28px;box-shadow:0 12px 32px rgba(0,0,0,0.06);">🍦</div>
      </div>

      <span style="font-size:11.5px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#006A67;margin-bottom:8px;">
        24/7 Living Voice-First ADHD Companion &amp; Autonomous Agent
      </span>
      <h1 style="font-size:42px;font-weight:700;margin:0 0 12px 0;letter-spacing:-0.03em;color:#1d1d1f;">
        Stay. From Freeze to Started in 60 Seconds.
      </h1>
      <p style="font-size:16px;color:#6e6e73;max-width:740px;margin:0 0 26px 0;line-height:1.5;">
        Powered by <strong style="color:#1d1d1f;">AssemblyAI Universal-3 Pro</strong> (32 Languages · 24kHz Single-WebSocket) &amp; <strong style="color:#1d1d1f;">Groq gpt-oss-120b</strong> · 60fps Spring-Physics Parametric Sculpture · 1775–2024 Clinical Neuroscience
      </p>

      <!-- Apple Bento Pills -->
      <div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center;margin-bottom:24px;">
        <div style="background:#ffffff;border:1px solid rgba(0,0,0,0.08);padding:10px 18px;border-radius:999px;font-weight:600;font-size:13.5px;color:#1d1d1f;box-shadow:0 4px 14px rgba(0,0,0,0.04);">
          🌐 Web &amp; Desktop Body-Double
        </div>
        <div style="background:#ffffff;border:1px solid rgba(0,0,0,0.08);padding:10px 18px;border-radius:999px;font-weight:600;font-size:13.5px;color:#1d1d1f;box-shadow:0 4px 14px rgba(0,0,0,0.04);">
          📱 iOS &amp; Android Installable PWA
        </div>
        <div style="background:#ffffff;border:1px solid rgba(0,0,0,0.08);padding:10px 18px;border-radius:999px;font-weight:600;font-size:13.5px;color:#1d1d1f;box-shadow:0 4px 14px rgba(0,0,0,0.04);">
          📄 Clinician PDF &amp; Hard Safety Gates
        </div>
      </div>

      <!-- Links -->
      <div style="display:flex;flex-wrap:wrap;gap:14px;justify-content:center;">
        <div style="background:#006A67;color:#ffffff;padding:12px 24px;border-radius:999px;font-size:14.5px;font-weight:600;box-shadow:0 8px 24px rgba(0,106,103,0.22);">
          stay-two-swart.vercel.app
        </div>
        <div style="background:#1d1d1f;color:#ffffff;padding:12px 24px;border-radius:999px;font-size:14.5px;font-weight:600;box-shadow:0 8px 24px rgba(0,0,0,0.14);">
          github.com/vaibhav4046/stay
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  });
}

async function clickShapeBtn(page: any, id: number) {
  const btn = page.getByTestId(`orb-shape-btn-${id}`);
  if (await btn.count()) {
    await btn.click();
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }));
  }
}

async function runAction(page: any, action: string) {
  try {
    if (action === 'act1_orb_intro') {
      await injectSubtitleAndOverlayHelper(page);
      await clickShapeBtn(page, 0);
    } else if (action === 'act1_orb_morph_showcase') {
      // Show Apple Bento Morph Card & smoothly cycle the 60fps Spring-Physics Sculpture through Lotus -> Letterform Gem -> Ice Cream Cone -> Creative Star
      await showMorphSvgArtifactCard(page);
      await sleep(800);
      await clickShapeBtn(page, 4); // 🪷 8-Petal Botanical Lotus
      await sleep(3000);
      await clickShapeBtn(page, 2); // ✒️ Crystalline Letterform Gem
      await sleep(3000);
      await clickShapeBtn(page, 1); // 🍦 Ice Cream Cone & Swirl
      await sleep(3000);
      await clickShapeBtn(page, 3); // 🎨 5-Fold Creative Star
    } else if (action === 'act2_user_wake') {
      await clearSideCards(page);
      await clickShapeBtn(page, 0);
      const input = page.getByTestId('task-input');
      if (await input.count()) {
        await input.fill('Hey Stay');
        await input.press('Enter');
      }
      await page.evaluate(() => window.scrollTo(0, 0));
    } else if (action === 'act2_stay_greet') {
      await clickShapeBtn(page, 4);
    } else if (action === 'act2_chaotic_brain_dump') {
      const input = page.getByTestId('task-input');
      const chaoticText =
        "Ugh honestly my brain is completely fried right now, I have like 10 tabs open, landlord lease letter and overdue VAT taxes, idk where to start";
      await input.fill(chaoticText);
      await page.evaluate(() => window.scrollTo(0, 0));
      await sleep(2200);
      await input.press('Enter');
      await page.evaluate(() => window.scrollTo(0, 0));
    } else if (action === 'act2_lotus_to_artifact_and_clinical') {
      // Show Apple Bento pipeline card, morph Lotus -> Letterform Gem, then showcase 24/7 Auto-Drafted Work tab and Live Brain Study tab!
      await showChaosToClaritySvgCard(page);
      await clickShapeBtn(page, 4); // 🪷 Lotus first
      await sleep(2600);
      await clickShapeBtn(page, 2); // ✒️ Crystalline Letterform Gem
      await sleep(2200);
      const artifactBtn = page.getByTestId('orb-exec-artifact');
      if (await artifactBtn.count()) {
        await artifactBtn.click();
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await sleep(3400);
      const clinicalBtn = page.getByTestId('orb-exec-clinical');
      if (await clinicalBtn.count()) {
        await clinicalBtn.click();
      }
      await page.evaluate(() => window.scrollTo(0, 0));
    } else if (action === 'act2_select_angle_and_ice_cream') {
      // Collapse bottom tab so the centerpiece Sculpture is front-and-center for the Ice Cream Cone morph!
      const clinicalBtn = page.getByTestId('orb-exec-clinical');
      if (await clinicalBtn.count()) {
        await clinicalBtn.click();
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await sleep(800);
      const input = page.getByTestId('task-input');
      await input.fill('I want ice cream as a reward after sending this pre-drafted email');
      await page.evaluate(() => window.scrollTo(0, 0));
    } else if (action === 'act2_ice_cream_and_memory_extract') {
      // Smoothly morph into 🍦 Sculpted Ice Cream Cone & Swirl right at the top of the viewport!
      await clickShapeBtn(page, 1);
      await page.evaluate(() => window.scrollTo(0, 0));
      await sleep(1800);
      const input = page.getByTestId('task-input');
      await input.fill('I love ice cream as a reward after finishing taxes');
      await input.press('Enter');
      await clickShapeBtn(page, 1);
      await page.evaluate(() => window.scrollTo(0, 0));
    } else if (action === 'act2_voice_cmd_memory_and_history') {
      await clearSideCards(page);
      const input = page.getByTestId('task-input');
      await input.fill('show me memory');
      await input.press('Enter');
    } else if (action === 'act2_close_modals_and_science') {
      await sleep(2200);
      const input = page.getByTestId('task-input');
      await input.fill('close panel');
      await input.press('Enter');
      await sleep(500);
      await input.fill('show me chat history');
      await input.press('Enter');
      await sleep(2200);
      await input.fill('close panel');
      await input.press('Enter');
      await sleep(500);
      // Open the 1775-2024 ADHD Clinical Research & Personal Brain Study modal!
      const scienceBtn = page.getByTestId('orb-science-btn');
      if (await scienceBtn.count()) {
        await scienceBtn.click();
      }
      await sleep(2600);
      const closeModalBtn = page.getByTestId('orb-science-modal').getByRole('button', { name: 'Close' });
      if (await closeModalBtn.count()) {
        await closeModalBtn.click();
      }
      await page.evaluate(() => window.scrollTo(0, 0));
    } else if (action === 'act2_multilingual_and_timer') {
      const input = page.getByTestId('task-input');
      await input.fill('switch to Spanish');
      await input.press('Enter');
      await page.evaluate(() => window.scrollTo(0, 0));
    } else if (action === 'act2_timer_running') {
      const startBtn = page.getByTestId('start-halo-timer');
      if (await startBtn.count()) {
        await startBtn.click();
      } else {
        const input = page.getByTestId('task-input');
        await input.fill('start 20 minutes');
        await input.press('Enter');
      }
      await page.evaluate(() => window.scrollTo(0, 0));
    } else if (action === 'act3_architecture_reports') {
      await page.goto('http://localhost:3000/app/reports');
      await injectSubtitleAndOverlayHelper(page);
      await showArchitectureOverlay(page);
    } else if (action === 'act3_orb_diagnostic_and_safety') {
      await page.goto('http://localhost:3000/demo/orb-diagnostic');
      await injectSubtitleAndOverlayHelper(page);
      await showArchitectureOverlay(page);
    } else if (action === 'act3_closing_card') {
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
              text: 'Gets executive freeze when 10+ browser tabs and tax/landlord paperwork pile up',
              createdAt: new Date().toISOString(),
            },
            {
              id: 'mem-2',
              category: 'coping_strategy',
              text: 'Breaks freeze when Stay pre-drafts correspondence + 45s entry',
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
            firstStep: 'Review Stay pre-drafted email and click send',
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
      await setSubtitle(page, turn.speaker, turn.text, turn.caption, turn.duration_sec);
      await runAction(page, turn.action);
      await injectSubtitleAndOverlayHelper(page);
      await setSubtitle(page, turn.speaker, turn.text, turn.caption, turn.duration_sec);

      const afterActionElapsed = (Date.now() - startWall) / 1000;
      const waitToEnd = (turn.end_sec - afterActionElapsed) * 1000;
      if (waitToEnd > 0) {
        await sleep(waitToEnd);
      }
    }

    const finalElapsed = (Date.now() - startWall) / 1000;
    const remainingMs = (timeline.total_duration_sec - finalElapsed) * 1000;
    if (remainingMs > 0) {
      await sleep(remainingMs);
    }

    const videoObj = page.video();
    await context.close();
    await browser.close();

    const rawWebmPath = await videoObj?.path();
    if (!rawWebmPath || !fs.existsSync(rawWebmPath)) {
      throw new Error('Playwright video file was not generated');
    }

    console.log(`Raw Playwright video recorded: ${rawWebmPath}`);
    const outMp4 = path.resolve(__dirname, '../public/stay-hackathon-demo.mp4');

    const ffmpegPath = execFileSync('python', [
      '-c',
      'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe().strip())',
    ])
      .toString()
      .trim();

    console.log('Muxing video + therapeutic BGM & voiceover into H.264 MP4...');
    execFileSync(
      ffmpegPath,
      [
        '-y',
        '-i',
        rawWebmPath,
        '-i',
        timeline.master_wav,
        '-c:v',
        'libx264',
        '-preset',
        'fast',
        '-crf',
        '20',
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-b:a',
        '192k',
        '-shortest',
        outMp4,
      ],
      { stdio: 'inherit' }
    );

    console.log(`SUCCESS! Final Apple Keynote demo video written to: ${outMp4}`);
  } finally {
    if (serverProc) {
      serverProc.kill();
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
