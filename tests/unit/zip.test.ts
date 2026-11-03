import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildZip, crc32 } from '@/lib/export/zip';

describe('zip writer', () => {
  it('crc32 matches the standard check value', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });
  it('a real unzip tool reads it back: names (with a folder and non-ASCII) and contents intact', () => {
    const files = [{ path: 'Stay.md', content: '# Stay vault\n[[Memory]]\n' }, { path: 'Blocks/2026-11-03 Reply to my landlord.md', content: 'Cuéntame: ¿por dónde empiezo? नमस्ते\n' }];
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stay-zip-'));
    const zip = path.join(dir, 'v.zip');
    fs.writeFileSync(zip, buildZip(files));
    const py = "import zipfile,sys,json; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; print(json.dumps({n:z.read(n).decode('utf8') for n in z.namelist()}))";
    const r = spawnSync('python', ['-c', py, zip], { encoding: 'utf8' });
    expect(r.status, r.stderr).toBe(0);
    const got = JSON.parse(r.stdout);
    for (const f of files) expect(got[f.path]).toBe(f.content);
  });
});
