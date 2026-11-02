#!/usr/bin/env node
/**
 * Builds the demo video: the real recorded call (screen recording + Stay's real voice + the simulated speaker) on the right,
 * Pix, an original pixel-art character who is the person using Stay, on the left.
 *
 *   1. node scripts/real-voice-e2e.mjs        (DEMO=1, no NO_VIDEO)  ->  docs/evidence/real-e2e/{demo-silent.webm,captions.json,demo/}
 *   2. node scripts/build-demo-assets.mjs                            ->  captions (vtt), chapters, transcript
 *   3. node scripts/demo-video/compose.mjs                           ->  public/demo/stay-demo.mp4 (+ poster) and
 *                                                                        docs/submission/stay-submission.mp4 (burned-in captions)
 * Needs ffmpeg. Everything shown on the right is the real app; Pix and the captions are layered on top.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const IN = 'docs/evidence/real-e2e';
const OUT_DIR = 'docs/submission';
const WORK = `${IN}/demo`;
mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(WORK, { recursive: true });

const caps = JSON.parse(readFileSync(`${IN}/captions.json`, 'utf8'));
const meta = JSON.parse(readFileSync(`${WORK}/audio-meta.json`, 'utf8'));
const vtt = readFileSync('public/demo/stay-demo.vtt', 'utf8');
const ff = (args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });
const probe = (f) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim());

// ---- the cues, read back from the captions the landing page uses ----
const toSec = (h, m, s) => Number(h) * 3600 + Number(m) * 60 + Number(s);
const cues = [...vtt.matchAll(/(\d\d):(\d\d):(\d\d\.\d{3}) --> (\d\d):(\d\d):(\d\d\.\d{3})\n([^\n]+)/g)].map((m) => {
  const label = /^(Stay|Typed|Simulated voice): /.exec(m[7])?.[1] ?? 'Stay';
  const text = m[7].replace(/^(Stay|Typed|Simulated voice): /, '');
  return { t: toSec(m[1], m[2], m[3]), end: toSec(m[4], m[5], m[6]), who: label === 'Stay' ? 'stay' : 'person', typed: label === 'Typed', kind: /screen|see|look/i.test(text) && label === 'Typed' ? 'screen' : label === 'Typed' ? 'type' : 'say', text: text.length > 90 ? text.slice(0, 87) + '...' : text };
});
const total = Math.ceil(probe(`${IN}/demo-silent.webm`)) + 1;
const firstTyped = cues.find((c) => c.typed);
const firstScreen = cues.find((c) => c.kind === 'screen');
const lastEnd = Math.max(...cues.map((c) => c.end));
const scene = {
  cues,
  happyAt: caps.happyAt ? (caps.happyAt - caps.recStart) / 1000 : null,
  titles: [
    { t: 0.4, end: 5.2, text: 'Meet Pix.', sub: 'He keeps putting things off.' },
    firstTyped && { t: firstTyped.t - 2.2, end: firstTyped.t - 0.2, text: 'Back in the chat', sub: 'He asks for things by typing.' },
    firstScreen && { t: firstScreen.t - 2.6, end: firstScreen.t - 0.3, text: 'Show Stay', sub: 'A screen, the camera or a picture.' },
    { t: Math.min(lastEnd + 0.6, total - 4), end: total, text: 'Stay. Start small.', sub: 'stay-two-swart.vercel.app' },
  ].filter(Boolean),
};

// ---- Pix: record the pixel scene in real time ----
const sceneVideo = `${WORK}/scene.webm`;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 640, height: 720 }, recordVideo: { dir: WORK, size: { width: 640, height: 720 } } });
const page = await ctx.newPage();
const recStart = Date.now();
await page.addInitScript((s) => { window.__SCENE = s; }, scene);
await page.goto(pathToFileURL('scripts/demo-video/scene.html').href);
const zeroWall = await page.evaluate(() => Date.now());
await page.waitForTimeout(total * 1000 + 500);
const video = await page.video().path();
await ctx.close();
await browser.close();
const lead = Math.max(0, (zeroWall - recStart) / 1000 - 0.05);
console.log(`scene recorded (${total} s, trim ${lead.toFixed(2)} s)`);

// ---- the bars: title on top, an honest note at the bottom ----
const bar = (h, text, size, y, fill = '#c5d6e6', weight = 600) =>
  sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="${h}"><rect width="100%" height="100%" fill="#070b11"/><text x="60" y="${y}" font-family="Arial" font-size="${size}" font-weight="${weight}" fill="${fill}">${text}</text></svg>`)).png().toBuffer();
writeFileSync(`${WORK}/top.png`, await bar(180, 'Stay: a voice companion that waits, answers and can see', 54, 112, '#eef6ff', 700));
writeFileSync(`${WORK}/bottom.png`, await bar(180, 'Screen recording of the real app. The speaker is a simulated AssemblyAI voice. Pix is original art. Real AssemblyAI speech.', 26, 160));

// ---- the sound: Stay's real voice and the simulated speaker, each at the moment it happened ----
const audioIn = [];
const delays = [];
for (const a of meta.pageAudio) { audioIn.push(`${IN}/${a.file}`); delays.push(Math.max(0, a.startedAt - meta.recStart)); }
for (const c of meta.speaker) { audioIn.push(`${IN}/${c.file}`); delays.push(Math.max(0, c.at - meta.recStart)); }
const n = audioIn.length;
const base = 3; // inputs 0 app video, 1 scene video, 2 .. bars use -loop below
const inputs = ['-i', `${IN}/demo-silent.webm`, '-ss', lead.toFixed(2), '-i', video, '-loop', '1', '-i', `${WORK}/top.png`, '-loop', '1', '-i', `${WORK}/bottom.png`, ...audioIn.flatMap((f) => ['-i', f])];
const aIdx = (i) => 4 + i;
const filters = [
  '[0:v]scale=1280:720,setsar=1[app]',
  '[1:v]scale=640:720:flags=neighbor,setsar=1[pix]',
  '[pix][app]hstack=inputs=2[row]',
  '[2:v][row][3:v]vstack=inputs=3[v]',
  ...audioIn.map((_, i) => `[${aIdx(i)}:a]adelay=${Math.round(delays[i])}|${Math.round(delays[i])},volume=${i < meta.pageAudio.length ? 1.0 : 0.9}[a${i}]`),
  `${audioIn.map((_, i) => `[a${i}]`).join('')}amix=inputs=${n}:normalize=0:duration=longest,alimiter=limit=0.95[aout]`,
].join(';');
void base;

const common = ['-filter_complex', filters, '-map', '[v]', '-map', '[aout]', '-t', String(total), '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-pix_fmt', 'yuv420p', '-r', '25', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart'];
mkdirSync('public/demo', { recursive: true });
ff([...inputs, ...common, 'public/demo/stay-demo.mp4']);

// the submission copy has the captions burned in (a social feed plays muted); the landing player shows the same words as a track
const sub = filters.replace('[v]', '[vv];[vv]subtitles=public/demo/stay-demo.vtt:force_style=\'FontName=Arial,FontSize=20,PrimaryColour=&H00FFFFFF,OutlineColour=&H00111111,BorderStyle=1,Outline=2,Alignment=2,MarginV=75\'[v]');
ff([...inputs, '-filter_complex', sub, '-map', '[v]', '-map', '[aout]', '-t', String(total), '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-pix_fmt', 'yuv420p', '-r', '25', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', `${OUT_DIR}/stay-submission.mp4`]);

const posterAt = Math.max(1, (cues.find((c) => c.who === 'stay')?.t ?? 3) + 1.5);
ff(['-ss', String(posterAt), '-i', 'public/demo/stay-demo.mp4', '-frames:v', '1', '-q:v', '3', 'public/demo/stay-demo-poster.jpg']);
console.log(`demo video: ${probe('public/demo/stay-demo.mp4').toFixed(1)} s, with sound; submission copy with captions: ${OUT_DIR}/stay-submission.mp4`);
void existsSync;
