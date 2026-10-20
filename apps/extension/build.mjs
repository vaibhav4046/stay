/* Copies the extension to dist/ (production origin) or dist-dev/ (--dev: also runs on a local Stay at http://localhost or
 * http://127.0.0.1, for testing against `next start`). Load the folder with chrome://extensions > Developer mode > Load unpacked. */
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dev = process.argv.includes('--dev');
const out = join(here, dev ? 'dist-dev' : 'dist');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const p of ['src', 'icons', 'popup.html']) cpSync(join(here, p), join(out, p), { recursive: true });

const manifest = JSON.parse(readFileSync(join(here, 'manifest.json'), 'utf8'));
if (dev) {
  const local = ['http://localhost/*', 'http://127.0.0.1/*'];
  manifest.name += ' (dev)';
  manifest.host_permissions.push(...local);
  manifest.content_scripts[0].matches.push(...local);
  // the local origin is what the service worker opens and the content script trusts
  const shared = join(out, 'src', 'shared.js');
  const origin = process.env.STAY_EXT_ORIGIN || 'http://127.0.0.1:3100';
  writeFileSync(shared, readFileSync(shared, 'utf8').replace("'https://stay-two-swart.vercel.app'", JSON.stringify(origin)));
}
writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`built ${dev ? 'dev' : 'production'} extension -> ${out}`);
