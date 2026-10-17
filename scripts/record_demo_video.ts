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
          from { opacity: 0; transform: translateY(10px) scale(0.98); }
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
      max-width: 1020px;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    hud.innerHTML = `
      <!-- Top Context / Artifact Telemetry Strip -->
      <div id="stay-demo-caption-strip" style="
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: rgba(15, 23, 42, 0.9);
        backdrop-filter: blur(12px);
        color: #38bdf8;
        padding: 4px 14px;
        border-radius: 9999px;
        border: 1px solid rgba(56, 189, 248, 0.35);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.03em;
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.35);
      ">
        <span style="width:7px;height:7px;border-radius:999px;background:#34d399;display:inline-block;"></span>
        <span id="stay-demo-caption-text">LIVE DEMO · STAY VOICE-FIRST ADHD COMPANION</span>
      </div>

      <!-- Broadcast Subtitle Box -->
      <div id="stay-demo-pill" style="
        position: relative;
        overflow: hidden;
        display: flex;
        align-items: center;
        gap: 14px;
        background: rgba(9, 13, 22, 0.92);
        backdrop-filter: blur(20px);
        color: #f8fafc;
        padding: 13px 24px;
        border-radius: 20px;
        border: 1.5px solid rgba(56, 189, 248, 0.45);
        box-shadow: 0 24px 48px rgba(0, 0, 0, 0.55);
        font-size: 16.5px;
        line-height: 1.42;
        text-align: left;
        width: 100%;
        transition: border-color 0.25s ease;
      ">
        <div id="stay-demo-badge" style="
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 13px;
          border-radius: 12px;
          font-size: 11.5px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          background: rgba(14, 165, 233, 0.2);
          color: #38bdf8;
          border: 1px solid rgba(56, 189, 248, 0.45);
          white-space: nowrap;
          flex-shrink: 0;
        ">
          <svg width="16" height="14" viewBox="0 0 16 14" fill="currentColor">
            <rect x="1" y="3" width="2" height="8" rx="1" style="transform-origin:center;animation:stayWavePulse 0.6s infinite ease-in-out;" />
            <rect x="5" y="1" width="2" height="12" rx="1" style="transform-origin:center;animation:stayWavePulse 0.45s infinite ease-in-out 0.1s;" />
            <rect x="9" y="2" width="2" height="10" rx="1" style="transform-origin:center;animation:stayWavePulse 0.55s infinite ease-in-out 0.2s;" />
            <rect x="13" y="4" width="2" height="6" rx="1" style="transform-origin:center;animation:stayWavePulse 0.5s infinite ease-in-out 0.15s;" />
          </svg>
          <span id="stay-demo-speaker-label">✨ STAY AI</span>
        </div>
        <span id="stay-demo-text" style="font-weight: 500; color: #f8fafc; flex: 1;">Hi, I am Stay.</span>
        <div id="stay-demo-progress" style="
          position: absolute;
          bottom: 0;
          left: 0;
          height: 3px;
          background: linear-gradient(90deg, #38bdf8, #34d399, #a78bfa);
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
        speakerLabel.textContent = '🎙️ VAIBHAV (ADHD USER)';
        badge.style.background = 'rgba(245, 158, 11, 0.22)';
        badge.style.color = '#fbbf24';
        badge.style.borderColor = 'rgba(245, 158, 11, 0.5)';
        pill.style.borderColor = 'rgba(245, 158, 11, 0.5)';
      } else {
        speakerLabel.textContent = '✨ STAY COMPANION';
        badge.style.background = 'rgba(14, 165, 233, 0.22)';
        badge.style.color = '#38bdf8';
        badge.style.borderColor = 'rgba(14, 165, 233, 0.5)';
        pill.style.borderColor = 'rgba(56, 189, 248, 0.5)';
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
      top: 72px;
      right: 24px;
      z-index: 999995;
      width: 350px;
      background: rgba(15, 23, 42, 0.93);
      backdrop-filter: blur(16px);
      color: #f8fafc;
      border-radius: 18px;
      padding: 16px 18px;
      border: 1px solid rgba(56, 189, 248, 0.4);
      box-shadow: 0 20px 45px rgba(0,0,0,0.55);
      font-family: system-ui, -apple-system, sans-serif;
      animation: stayCardSlideIn 0.3s ease-out;
    `;
    card.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <span style="font-size:10.5px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#38bdf8;">
          SVG + GLSL Real-Time Morph Engine
        </span>
        <span style="font-size:11px;font-family:monospace;color:#34d399;">60 FPS</span>
      </div>
      <div style="font-size:14px;font-weight:700;margin-bottom:10px;color:#ffffff;">
        Topic-Reactive Silhouette Geometry
      </div>
      <svg viewBox="0 0 320 92" width="100%" height="92" style="background:rgba(30,41,59,0.65);border-radius:12px;border:1px solid rgba(148,163,184,0.2);">
        <!-- 1. Lotus -->
        <g transform="translate(42, 40)">
          <circle r="22" fill="rgba(20,184,166,0.2)" stroke="#2dd4bf" stroke-width="1.6" stroke-dasharray="3 2"/>
          <path d="M0,-20 C6,-12 6,12 0,20 C-6,12 -6,-12 0,-20 Z" fill="rgba(45,212,191,0.35)" stroke="#5eead4" stroke-width="1.2"/>
          <path d="M-20,0 C-12,-6 12,-6 20,0 C12,6 -12,6 -20,0 Z" fill="rgba(45,212,191,0.35)" stroke="#5eead4" stroke-width="1.2"/>
          <text x="0" y="36" text-anchor="middle" fill="#99f6e4" font-size="9.5" font-weight="700">🪷 Lotus</text>
        </g>
        <!-- 2. Letterform Gem -->
        <g transform="translate(118, 40)">
          <polygon points="0,-22 16,-16 22,0 16,16 0,22 -16,16 -22,0 -16,-16" fill="rgba(59,130,246,0.25)" stroke="#60a5fa" stroke-width="1.6"/>
          <line x1="-10" y1="-6" x2="10" y2="-6" stroke="#bfdbfe" stroke-width="1.5"/>
          <line x1="-10" y1="0" x2="6" y2="0" stroke="#bfdbfe" stroke-width="1.5"/>
          <line x1="-10" y1="6" x2="10" y2="6" stroke="#bfdbfe" stroke-width="1.5"/>
          <text x="0" y="36" text-anchor="middle" fill="#bfdbfe" font-size="9.5" font-weight="700">✒️ Gem</text>
        </g>
        <!-- 3. Ice Cream Cone -->
        <g transform="translate(196, 40)">
          <path d="M-14,-2 L0,21 L14,-2 Z" fill="rgba(245,158,11,0.4)" stroke="#fbbf24" stroke-width="1.5"/>
          <circle cx="0" cy="-7" r="12" fill="rgba(244,114,182,0.45)" stroke="#f472b6" stroke-width="1.6"/>
          <circle cx="0" cy="-19" r="4" fill="#fb7185"/>
          <text x="0" y="36" text-anchor="middle" fill="#fbcfe8" font-size="9.5" font-weight="700">🍦 Reward</text>
        </g>
        <!-- 4. Creative Star -->
        <g transform="translate(274, 40)">
          <polygon points="0,-22 6,-7 21,-7 9,3 14,19 0,10 -14,19 -9,3 -21,-7 -6,-7" fill="rgba(168,85,247,0.3)" stroke="#c084fc" stroke-width="1.5"/>
          <text x="0" y="36" text-anchor="middle" fill="#e9d5ff" font-size="9.5" font-weight="700">🎨 Star</text>
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
      top: 72px;
      right: 24px;
      z-index: 999995;
      width: 375px;
      background: rgba(15, 23, 42, 0.94);
      backdrop-filter: blur(16px);
      color: #f8fafc;
      border-radius: 18px;
      padding: 16px 18px;
      border: 1px solid rgba(45, 212, 191, 0.45);
      box-shadow: 0 20px 45px rgba(0,0,0,0.55);
      font-family: system-ui, -apple-system, sans-serif;
      animation: stayCardSlideIn 0.3s ease-out;
    `;
    card.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <span style="font-size:10.5px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#2dd4bf;">
          ADHD Chaos-to-Clarity NLU Engine
        </span>
        <span style="font-size:11px;font-family:monospace;color:#fbbf24;">De-Jargoned Live</span>
      </div>
      <svg viewBox="0 0 340 165" width="100%" height="165" style="display:block;">
        <!-- Box 1: Chaotic Input -->
        <rect x="4" y="4" width="332" height="44" rx="10" fill="rgba(239,68,68,0.14)" stroke="rgba(248,113,113,0.45)" stroke-width="1.2"/>
        <text x="14" y="21" fill="#fca5a5" font-size="10" font-weight="800">1. RAW UNORGANIZED ADHD BRAIN-DUMP</text>
        <text x="14" y="37" fill="#f1f5f9" font-size="10.5" font-family="monospace">"uhh brain is fried, 10 tabs, landlord + VAT taxes..."</text>

        <!-- Arrow 1 -->
        <path d="M170,49 L170,62" stroke="#38bdf8" stroke-width="2"/>
        <polygon points="165,59 175,59 170,65" fill="#38bdf8"/>

        <!-- Box 2: De-Jargoning + Orb Grounding -->
        <rect x="4" y="66" width="332" height="42" rx="10" fill="rgba(14,165,233,0.15)" stroke="rgba(56,189,248,0.45)" stroke-width="1.2"/>
        <text x="14" y="83" fill="#7dd3fc" font-size="10" font-weight="800">2. PANIC FILTER + VISUAL GROUNDING</text>
        <text x="14" y="99" fill="#f1f5f9" font-size="10.5">🪷 Auto-Lotus Calm → ✒️ Target: Landlord &amp; VAT Letter</text>

        <!-- Arrow 2 -->
        <path d="M170,109 L170,121" stroke="#34d399" stroke-width="2"/>
        <polygon points="165,118 175,118 170,124" fill="#34d399"/>

        <!-- Box 3: Time Reality Compression -->
        <rect x="4" y="125" width="332" height="36" rx="10" fill="rgba(16,185,129,0.16)" stroke="rgba(52,211,153,0.5)" stroke-width="1.2"/>
        <text x="14" y="147" fill="#6ee7b7" font-size="11.5" font-weight="800">⏱️ 180m Dread → 45s Micro-Entry (86% Momentum)</text>
      </svg>
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
      width: 470px;
      background: rgba(11, 17, 30, 0.95);
      backdrop-filter: blur(22px);
      color: #f8fafc;
      border-radius: 22px;
      padding: 20px 22px;
      border: 1.5px solid rgba(56, 189, 248, 0.45);
      box-shadow: 0 25px 55px -12px rgba(0,0,0,0.68);
      font-family: system-ui, -apple-system, sans-serif;
      animation: stayCardSlideIn 0.3s ease-out;
    `;
    card.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <span style="font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#38bdf8;background:rgba(56,189,248,0.14);padding:4px 10px;border-radius:999px;border:1px solid rgba(56,189,248,0.35);">
          Full-Duplex System Architecture SVG
        </span>
        <span style="font-family:monospace;font-size:12px;color:#34d399;font-weight:700;">24kHz PCM · &lt;1s Latency</span>
      </div>

      <!-- Interactive SVG Architecture Diagram -->
      <svg viewBox="0 0 426 155" width="100%" height="155" style="background:rgba(15,23,42,0.8);border-radius:14px;border:1px solid rgba(148,163,184,0.2);margin-bottom:12px;">
        <!-- Node 1: User Mic & Orb -->
        <rect x="10" y="16" width="112" height="54" rx="10" fill="rgba(14,165,233,0.18)" stroke="#38bdf8" stroke-width="1.5"/>
        <text x="66" y="38" text-anchor="middle" fill="#e0f2fe" font-size="10.5" font-weight="800">🎙️ Browser Worklet</text>
        <text x="66" y="54" text-anchor="middle" fill="#7dd3fc" font-size="9.5">24kHz PCM + Barge-In</text>

        <!-- Bi-directional arrow 1 -->
        <line x1="122" y1="43" x2="154" y2="43" stroke="#38bdf8" stroke-width="2"/>
        <polygon points="150,39 157,43 150,47" fill="#38bdf8"/>
        <polygon points="126,39 119,43 126,47" fill="#38bdf8"/>

        <!-- Node 2: AssemblyAI Universal-3 Pro -->
        <rect x="157" y="12" width="132" height="62" rx="10" fill="rgba(16,185,129,0.18)" stroke="#34d399" stroke-width="1.6"/>
        <text x="223" y="33" text-anchor="middle" fill="#d1fae5" font-size="10.5" font-weight="800">AssemblyAI</text>
        <text x="223" y="47" text-anchor="middle" fill="#6ee7b7" font-size="10" font-weight="700">Universal-3 Pro</text>
        <text x="223" y="62" text-anchor="middle" fill="#a7f3d0" font-size="8.8">32 Langs · Keyterm Boost</text>

        <!-- Arrow to Groq -->
        <line x1="289" y1="43" x2="316" y2="43" stroke="#a78bfa" stroke-width="2"/>
        <polygon points="312,39 319,43 312,47" fill="#a78bfa"/>

        <!-- Node 3: Groq 120B -->
        <rect x="319" y="16" width="97" height="54" rx="10" fill="rgba(139,92,246,0.2)" stroke="#a78bfa" stroke-width="1.5"/>
        <text x="367" y="36" text-anchor="middle" fill="#ede9fe" font-size="10.5" font-weight="800">⚡ Groq 120B</text>
        <text x="367" y="52" text-anchor="middle" fill="#ddd6fe" font-size="9">gpt-oss-120b</text>

        <!-- Bottom Layer: Deterministic Safety + GLSL/SVG Orb + Clinician PDF -->
        <rect x="10" y="92" width="195" height="48" rx="10" fill="rgba(244,63,94,0.15)" stroke="#fb7185" stroke-width="1.3"/>
        <text x="107" y="112" text-anchor="middle" fill="#ffe4e6" font-size="10" font-weight="800">🛡️ Pre-LLM Hard Safety Gate</text>
        <text x="107" y="128" text-anchor="middle" fill="#fda4af" font-size="9">Crisis (999/111) &amp; Rx Dosing Guard</text>

        <rect x="219" y="92" width="197" height="48" rx="10" fill="rgba(245,158,11,0.15)" stroke="#fbbf24" stroke-width="1.3"/>
        <text x="317" y="112" text-anchor="middle" fill="#fef3c7" font-size="10" font-weight="800">🪷 60fps GLSL/SVG + PDF Export</text>
        <text x="317" y="128" text-anchor="middle" fill="#fde68a" font-size="9">5 Morph Geometries · Clinician Report</text>
      </svg>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;color:#cbd5e1;">
        <div style="background:rgba(30,41,59,0.75);padding:8px 10px;border-radius:10px;border:1px solid rgba(148,163,184,0.15);">
          <strong style="color:#38bdf8;display:block;">🎙️ Single-Socket Speech-to-Speech</strong>
          Zero stitched STT→LLM→TTS lag
        </div>
        <div style="background:rgba(30,41,59,0.75);padding:8px 10px;border-radius:10px;border:1px solid rgba(148,163,184,0.15);">
          <strong style="color:#34d399;display:block;">🧠 Persistent Cognitive Memory</strong>
          Remembers triggers, rewards &amp; wins
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
      background: radial-gradient(circle at center, rgba(15, 23, 42, 0.92) 0%, rgba(7, 10, 18, 0.98) 100%);
      backdrop-filter: blur(20px);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 36px;
      color: #f8fafc;
      font-family: system-ui, -apple-system, sans-serif;
      text-align: center;
    `;
    modal.innerHTML = `
      <!-- Morphed SVG Emblem Row -->
      <div style="display:flex;align-items:center;gap:18px;margin-bottom:20px;">
        <div style="width:68px;height:68px;border-radius:20px;background:rgba(20,184,166,0.16);border:1.5px solid #2dd4bf;display:flex;align-items:center;justify-content:center;font-size:30px;box-shadow:0 0 30px rgba(45,212,191,0.3);">🪷</div>
        <div style="width:84px;height:84px;border-radius:999px;background:radial-gradient(circle at 35% 30%, #67e8f9, #0284c7 55%, #1e1b4b 100%);box-shadow:0 0 55px rgba(56, 189, 248, 0.6), inset 0 0 22px rgba(255,255,255,0.65);display:flex;align-items:center;justify-content:center;">
          <div style="width:64px;height:64px;border-radius:999px;border:1.5px solid rgba(255,255,255,0.5);"></div>
        </div>
        <div style="width:68px;height:68px;border-radius:20px;background:rgba(244,114,182,0.16);border:1.5px solid #f472b6;display:flex;align-items:center;justify-content:center;font-size:30px;box-shadow:0 0 30px rgba(244,114,182,0.3);">🍦</div>
      </div>

      <span style="font-size:12px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:#38bdf8;margin-bottom:8px;">
        Voice-First Point-of-Performance ADHD Companion
      </span>
      <h1 style="font-size:42px;font-weight:800;margin:0 0 10px 0;letter-spacing:-0.02em;color:#ffffff;">
        STAY — From Chaotic Freeze to Started in 60 Seconds
      </h1>
      <p style="font-size:16.5px;color:#cbd5e1;max-width:720px;margin:0 0 24px 0;line-height:1.5;">
        Powered by <strong>AssemblyAI Universal-3 Pro</strong> (32 Languages · Single-Socket 24kHz Speech-to-Speech) &amp; <strong>Groq gpt-oss-120b</strong> · Deterministic Safety · Topic-Reactive SVG &amp; GLSL Shape Morphing
      </p>

      <!-- Platform Availability SVG Pills -->
      <div style="display:flex;flex-wrap:wrap;gap:14px;justify-content:center;margin-bottom:24px;">
        <div style="display:flex;align-items:center;gap:10px;background:rgba(30,41,59,0.9);border:1px solid rgba(56,189,248,0.35);padding:10px 18px;border-radius:14px;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
          <span style="font-weight:700;font-size:14px;">Web App (Live Now)</span>
        </div>
        <div style="display:flex;align-items:center;gap:10px;background:rgba(30,41,59,0.9);border:1px solid rgba(52,211,153,0.35);padding:10px 18px;border-radius:14px;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
          <span style="font-weight:700;font-size:14px;">iOS &amp; Android Installable PWA</span>
        </div>
        <div style="display:flex;align-items:center;gap:10px;background:rgba(30,41,59,0.9);border:1px solid rgba(167,139,250,0.35);padding:10px 18px;border-radius:14px;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          <span style="font-weight:700;font-size:14px;">Desktop Body-Double Mode</span>
        </div>
      </div>

      <!-- Links & GitHub Repository -->
      <div style="display:flex;flex-wrap:wrap;gap:18px;justify-content:center;">
        <div style="background:rgba(14,165,233,0.2);border:1.5px solid #38bdf8;padding:12px 24px;border-radius:14px;font-family:monospace;font-size:15px;font-weight:700;color:#e0f2fe;">
          🌐 https://stay-two-swart.vercel.app
        </div>
        <div style="background:rgba(16,185,129,0.2);border:1.5px solid #34d399;padding:12px 24px;border-radius:14px;font-family:monospace;font-size:15px;font-weight:700;color:#d1fae5;">
          💻 github.com/vaibhav4046/stay
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
      // Show SVG Morph Engine Diagram & visibly cycle the Orb through Lotus -> Letterform Gem -> Ice Cream Cone -> Creative Star
      await showMorphSvgArtifactCard(page);
      await sleep(900);
      await clickShapeBtn(page, 4); // 🪷 8-Petal Lotus
      await sleep(3200);
      await clickShapeBtn(page, 2); // ✒️ Crystalline Letterform Gem
      await sleep(3200);
      await clickShapeBtn(page, 1); // 🍦 Ice Cream Swirl
      await sleep(3200);
      await clickShapeBtn(page, 3); // 🎨 5-Lobe Creative Star
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
      // Gentle Lotus pulse to invite messy brain-dump
      await clickShapeBtn(page, 4);
    } else if (action === 'act2_chaotic_brain_dump') {
      // Chaotic, unorganized ADHD brain-dump!
      const input = page.getByTestId('task-input');
      const chaoticText =
        "Ugh honestly my brain is completely fried right now, I have like 10 tabs open, landlord lease letter and overdue VAT taxes, idk where to start";
      await input.fill(chaoticText);
      await page.evaluate(() => window.scrollTo(0, 0));
      await sleep(2200);
      await input.press('Enter');
      await page.evaluate(() => window.scrollTo(0, 0));
    } else if (action === 'act2_lotus_to_letterform_reality') {
      // Show Chaos-to-Clarity SVG diagram, morph Lotus -> Letterform Gem, then open 3 Angles
      await showChaosToClaritySvgCard(page);
      await clickShapeBtn(page, 4); // 🪷 Lotus first to calm breathing
      await sleep(3800);
      await clickShapeBtn(page, 2); // ✒️ Crystalline Letterform Gem
      await sleep(3500);
      const brainstormBtn = page.getByTestId('orb-exec-brainstorm');
      if (await brainstormBtn.count()) {
        await brainstormBtn.click();
      }
      await page.evaluate(() => window.scrollTo(0, 0));
    } else if (action === 'act2_select_angle_and_ice_cream') {
      // Select Angle 0 ("The 3-Bullet Draft") and type ice cream reward
      const angle0 = page.getByTestId('orb-angle-0');
      if (await angle0.count()) {
        await angle0.click();
      }
      await sleep(1000);
      // Collapse 3 Angles tab so the Living Orb stays front and center for the Ice Cream morph!
      const brainstormBtn = page.getByTestId('orb-exec-brainstorm');
      if (await brainstormBtn.count()) {
        await brainstormBtn.click();
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      const input = page.getByTestId('task-input');
      await input.fill('I want ice cream as a reward after finishing these 3 bullets');
      await page.evaluate(() => window.scrollTo(0, 0));
    } else if (action === 'act2_ice_cream_and_memory_extract') {
      // Visibly morph into 🍦 Ice Cream Cone & Swirl right at the top of the screen and save memory
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
    } else if (action === 'act2_close_modals_and_path') {
      await sleep(2500);
      const input = page.getByTestId('task-input');
      await input.fill('close panel');
      await input.press('Enter');
      await sleep(600);
      await input.fill('show me chat history');
      await input.press('Enter');
      await sleep(2500);
      await input.fill('close panel');
      await input.press('Enter');
      await sleep(500);
      const pathBtn = page.getByTestId('orb-exec-path');
      if (await pathBtn.count()) {
        await pathBtn.click();
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
              text: 'Gets executive freeze when 10+ browser tabs and tax/landlord paperwork pile up',
              createdAt: new Date().toISOString(),
            },
            {
              id: 'mem-2',
              category: 'coping_strategy',
              text: 'Breaks freeze with 45-second 3-bullet messy drafts + lotus grounding',
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
