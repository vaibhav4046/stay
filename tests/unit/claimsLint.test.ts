import { afterEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const SCRIPT = resolve(__dirname, '../../scripts/claims-lint.mjs');
const dirs: string[] = [];

/** a tiny repo with the given files; returns the lint's exit code and output */
function lint(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), 'claims-'));
  dirs.push(root);
  for (const [name, body] of Object.entries(files)) {
    const full = join(root, name);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, body);
  }
  const r = spawnSync(process.execPath, [SCRIPT], { cwd: root, encoding: 'utf8' });
  return { code: r.status, out: r.stdout };
}

afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

describe('T0.6 claims lint', () => {
  it.each([
    'Stay is a step toward AGI.',
    'The best in the world at voice.',
    'Stay is faster than ChatGPT.',
    'It beats Gemini on speed.',
    'Dessa-level voice',
    'human-level conversation',
    'a gapless voice',
    'Stay is 100% private.',
    'production-ready today',
    'clinically proven to help',
    'Your AI therapist',
    'a kind of therapy',
    'It treats ADHD',
    'Stay diagnoses focus problems',
    'real microphone tested',
    'Stay won the hackathon',
    'the winner',
  ])('flags: %s', (text) => {
    const r = lint({ 'src/a.tsx': `export const t = "${text}";\n` });
    expect(r.code, r.out).toBe(1);
  });

  it.each([
    'Not a doctor or therapist. No medication advice.',
    'Stay does not treat ADHD.',
    'This is not therapy.',
    'Stay never diagnoses anything.',
    'It won&apos;t diagnose you.',
    "It won't give dosing advice.",
    'width: 100%;',
    'calc(100% - 4px)',
  ])('allows: %s', (text) => {
    const r = lint({ 'src/a.tsx': `export const t = "${text}";\n` });
    expect(r.code, r.out).toBe(0);
  });

  it('skips test files, and honours an allow marker that gives a reason', () => {
    expect(lint({ 'src/a.test.ts': 'expect(x).not.toContain("AGI");\n' }).code).toBe(0);
    expect(lint({ 'src/a.ts': 'const w = ["therapist"]; // claims-lint-allow: words a person might say\n' }).code).toBe(0);
    expect(lint({ 'src/a.ts': 'const w = ["therapist"]; // claims-lint-allow:\n' }).code).toBe(1);
  });

  it('checks README.md and the submission files too', () => {
    expect(lint({ 'README.md': 'Stay is AGI.\n' }).code).toBe(1);
    expect(lint({ 'HACKATHON_SUBMISSION.md': 'Stay is the winner.\n' }).code).toBe(1);
    expect(lint({ 'docs/SUBMISSION_PACK.md': 'Stay is production-ready.\n' }).code).toBe(1);
  });

  it('a landing number needs an evidence file that exists', () => {
    const page = (ref: string) => `${ref}\nexport const A = () => <p>Replies in 640 ms</p>;\n`;
    expect(lint({ 'src/components/landing/A.tsx': page('') }).code).toBe(1);
    expect(lint({ 'src/components/landing/A.tsx': page('// evidence: docs/evidence/run.json') }).code).toBe(1); // file missing
    const ok = lint({ 'src/components/landing/A.tsx': page('// evidence: docs/evidence/run.json'), 'docs/evidence/run.json': '{}' });
    expect(ok.code, ok.out).toBe(0);
  });

  it('the real repository is clean', () => {
    const r = spawnSync(process.execPath, [SCRIPT], { cwd: resolve(__dirname, '../..'), encoding: 'utf8' });
    expect(r.status, r.stdout).toBe(0);
  });
});
