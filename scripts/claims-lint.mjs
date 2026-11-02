#!/usr/bin/env node
/**
 * T0.6 claims lint. Fails (exit 1) when shipped copy contains a banned claim (H4), or when a landing/benchmark component
 * shows a number with a unit that is not tied to a file under docs/evidence.
 *
 *   node scripts/claims-lint.mjs            check the repo
 *   node scripts/claims-lint.mjs --list     print every finding, then exit 0 (for working through them)
 *
 * Boundary wording is fine: "not a doctor or therapist", "does not treat ADHD", "never diagnoses".
 * Test files that check the ban are skipped. A line can opt out with `claims-lint-allow: <reason>` (user vocabulary Stay listens for,
 * or the title of a published paper); the reason is required.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const ROOT = process.cwd();
const SCOPE = ['src', 'public', 'README.md', 'HACKATHON_SUBMISSION.md', 'docs/SUBMISSION_PACK.md'];
const TEXT = new Set(['.ts', '.tsx', '.js', '.mjs', '.json', '.md', '.html', '.txt', '.vtt', '.webmanifest']);
/** raw measurement output lives in one of these; a number must point at a file or folder inside them */
const EVIDENCE_ROOTS = ['docs/evidence/', 'docs/bench-results/'];
/** a line may say why it is exempt: user vocabulary that Stay listens for, or the title of a published paper. Never copy that Stay says about itself. */
const ALLOW = /claims-lint-allow:\s*\S+/;
const SKIP_DIR = new Set(['node_modules', '.next', '.git']);
const SKIP_FILE = /\.(?:test|spec)\.[tj]sx?$/;
const LIST = process.argv.includes('--list');

/** [name, pattern, allowedWhenNegated] */
const BANNED = [
  ['AGI', /\bAGI\b/, false],
  ['best in the world', /best in the world/i, false],
  ['beats/better/faster than a named product', /\b(?:beats?|better than|faster than|outperforms?)\s+(?:chat\s?gpt|gemini|dessa)\b/i, false],
  ['Dessa-level', /\bdessa[- ]level\b/i, false],
  ['human-level', /\bhuman[- ]level\b/i, false],
  ['gapless', /\bgapless\b/i, false],
  // prose only: "100% private". CSS such as "width: 100%;" or "calc(100% - 4px)" is not followed by a word
  ['100% as a claim', /(?<![\w:.(])100\s?%\s+(?=[A-Za-z])/, false],
  ['production-ready', /\bproduction[- ]ready\b/i, false],
  ['clinically proven', /\bclinically (?:proven|validated|tested)\b/i, true],
  ['therapist', /\btherapists?\b/i, true],
  ['therapy', /\btherapy\b/i, true],
  ['treats ADHD', /\btreats?\s+adhd\b/i, true],
  ['diagnoses', /\bdiagnoses\b/i, true],
  ['real microphone tested', /\breal[- ]mic(?:rophone)?[- ]tested\b/i, false],
  ['won', /\bwon\b(?!['’]|&apos;|&#39;|&rsquo;)/i, false],
  ['winner', /\bwinner\b/i, false],
];

/** words just before a match that make it boundary wording ("not a doctor or therapist") */
const NEGATION = /\b(?:not|n['’]t|never|no|isn['’]t|aren['’]t|without|instead of|nor|neither|cannot|can['’]t|does not|do not|doesn['’]t|don['’]t|won['’]t|avoid|avoids|ban|banned|bans)\b[^.!?\n]{0,60}$/i;

function* walk(p) {
  const abs = join(ROOT, p);
  if (!existsSync(abs)) return;
  const st = statSync(abs);
  if (st.isFile()) return yield abs;
  for (const name of readdirSync(abs)) {
    if (SKIP_DIR.has(name)) continue;
    yield* walk(join(p, name));
  }
}

const findings = [];
const add = (file, line, rule, text) => findings.push({ file: relative(ROOT, file).replace(/\\/g, '/'), line, rule, text: text.trim().slice(0, 140) });

for (const entry of SCOPE) {
  for (const file of walk(entry)) {
    if (!TEXT.has(extname(file)) || SKIP_FILE.test(file)) continue;
    if (statSync(file).size > 600_000) continue;
    const lines = readFileSync(file, 'utf8').split(/\r?\n/);
    lines.forEach((line, i) => {
      if (ALLOW.test(line)) return;
      for (const [name, re, negatable] of BANNED) {
        const m = re.exec(line);
        if (!m) continue;
        if (negatable) {
          // look at the same sentence before the match, and the line before when the sentence wraps
          const before = (i > 0 ? lines[i - 1].slice(-60) + ' ' : '') + line.slice(0, m.index);
          if (NEGATION.test(before)) continue;
        }
        add(file, i + 1, name, line);
      }
    });
  }
}

// ---- numbers shown on the landing page and benchmark board must point at a file in docs/evidence ----
const NUMBER_FILES = [
  ...['src/components/landing'].flatMap((d) => [...walk(d)]),
  ...['BenchmarkBoard.tsx', 'ProofStrip.tsx'].flatMap((f) => [...walk(`src/components/${f}`), ...walk(`src/components/landing/${f}`)]),
  join(ROOT, 'src/app/page.tsx'),
].filter((f, i, a) => a.indexOf(f) === i && /\.tsx?$/.test(f) && existsSync(f) && !SKIP_FILE.test(f));
const UNIT_NUMBER = /(?<![\w#.-])\d[\d,]*(?:\.\d+)?\s?(?:ms|s\b|sec\b|seconds?|%|x\b|×|k\b|minutes?|min\b)(?![\w-])/;
const EVIDENCE_REF = /evidence:\s*(docs\/(?:evidence|bench-results)\/[\w./-]+)/;

for (const file of NUMBER_FILES) {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  const fileRef = lines.map((l) => EVIDENCE_REF.exec(l)?.[1]).find(Boolean);
  lines.forEach((line, i) => {
    const code = line.replace(/\/\/.*$/, '');
    if (/^\s*(?:import|export \* from)\b/.test(line) || ALLOW.test(line)) return;
    if (/--[a-z]/.test(code)) return; // CSS custom properties are drawing, not facts
    if (/\b(?:className|style|viewBox|transition|duration|delay|animation|width|height|rotate|translate|opacity|blur|inset|top|left|right|bottom|margin|padding|gap|rx|ry|cx|cy|stroke|fill|clip|scale|ease|threshold|rootMargin|setTimeout|setInterval)\b/.test(code) && !/>\s*[^<>]*\d/.test(code)) return;
    const m = UNIT_NUMBER.exec(code);
    if (!m) return;
    const ref = EVIDENCE_REF.exec(line)?.[1] ?? EVIDENCE_REF.exec(lines[i - 1] ?? '')?.[1] ?? fileRef;
    if (!ref) return add(file, i + 1, 'number without evidence reference', line);
    if (!EVIDENCE_ROOTS.some((r) => ref.startsWith(r)) || !existsSync(join(ROOT, ref))) add(file, i + 1, `evidence path missing: ${ref}`, line);
  });
}

if (findings.length === 0) {
  console.log('claims-lint: clean');
  process.exit(0);
}
for (const f of findings) console.log(`${f.file}:${f.line}  [${f.rule}]  ${f.text}`);
console.log(`\nclaims-lint: ${findings.length} finding${findings.length === 1 ? '' : 's'}`);
process.exit(LIST ? 0 : 1);
