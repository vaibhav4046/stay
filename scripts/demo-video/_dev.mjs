import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
import { chromium } from '@playwright/test'; import sharp from 'sharp'; import { pathToFileURL } from 'node:url';
const out = path.join(os.tmpdir(), 'storywork', 'dev'); fs.mkdirSync(out, { recursive: true });
const story = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const times = process.argv.slice(3).map(Number);
const b = await chromium.launch(); const pg = await b.newPage();
pg.on('pageerror', (e) => console.log('PAGEERROR', String(e).slice(0, 300))); pg.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 300)); });
await pg.goto(pathToFileURL(path.resolve('scripts/demo-video/story-scene.html')).href);
await pg.evaluate((s) => window.setStory(s), story);
const tiles = [];
for (const t of times) { const b64 = await pg.evaluate((t) => { window.render(t); return window.frameB64(); }, t); const png = await sharp(Buffer.from(b64, 'base64'), { raw: { width: 320, height: 134, channels: 4 } }).resize(960, 402, { kernel: 'nearest' }).png().toBuffer(); tiles.push(png); fs.writeFileSync(path.join(out, `f_${t}.png`), png); }
await b.close(); console.log('done', times.length);
