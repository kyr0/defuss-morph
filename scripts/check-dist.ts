#!/usr/bin/env bun
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { docsDrift } from './lib/docs.ts';
import {
  README_SIZE_END,
  README_SIZE_START,
  computeStats,
  renderReadmeBlock,
} from './lib/stats.ts';

/**
 * Why: static consistency gate for the shipped artifacts. Fails the build when
 * the pkgroll entries, the CDN bundle (+ maps), dist/stats.json, the README
 * bundle-size block or the website's copies and size figures are missing or
 * stale. Runs as the last step of `make build`, standalone via
 * `bun run check:dist`.
 * VERIFIED: one stale size figure in docs/index.html makes it exit 1.
 */

const ROOT = join(import.meta.dirname, '..');

let failed = false;
const fail = (msg: string) => {
  console.error(`check-dist: ${msg}`);
  failed = true;
};

// 1. all shipped artifacts exist and are non-empty
const ARTIFACTS = [
  'dist/index.mjs',
  'dist/index.cjs',
  'dist/index.d.ts',
  'dist/all.js',
  'dist/all.js.map',
  'dist/all.min.js',
  'dist/all.min.js.map',
  'dist/stats.json',
];
for (const rel of ARTIFACTS) {
  const path = join(ROOT, rel);
  if (!existsSync(path)) {
    fail(`${rel} missing — run the build pipeline first`);
    continue;
  }
  if (readFileSync(path).byteLength === 0) fail(`${rel} is empty`);
}

// 2. the CDN bundle is self-contained (no unresolved module graph)
const allJs = readFileSync(join(ROOT, 'dist', 'all.js'), 'utf8');
if (/^\s*(import|export)\s[^'"]*from\s*['"]/m.test(allJs)) {
  fail('dist/all.js still contains module imports/exports-from — it must be self-contained for jsDelivr loading');
}
if (!allJs.trimEnd().endsWith('//# sourceMappingURL=all.js.map')) {
  fail('dist/all.js is missing its sourceMappingURL comment');
}
const allMinJs = readFileSync(join(ROOT, 'dist', 'all.min.js'), 'utf8');
if (!allMinJs.trimEnd().endsWith('//# sourceMappingURL=all.min.js.map')) {
  fail('dist/all.min.js is missing its sourceMappingURL comment');
}

// 3. the df$ global registration ships in the CDN bundle ONLY — the library
//    entries (index.mjs/.cjs, used by SSR and by defuss) must stay clean.
//    The bundle must also keep the public export names (mangle guards this).
if (!allJs.includes('df$') || !allMinJs.includes('df$')) {
  fail('dist/all.js / all.min.js are missing the df$ global registration');
}
for (const name of ['updateDomWithVdom', 'replaceDomWithVdom', 'registerDelegatedEvent']) {
  if (!allJs.includes(name) || !allMinJs.includes(name)) {
    fail(`dist/all.js / all.min.js lost the public export name "${name}"`);
  }
}
// The registration assigns a df$ property (`g.df$ = …`, `Object.assign(g.df$, …)`); the entries may still name
// df$ in text, e.g. installReactive(df$), which takes defuss-query's df$ as an argument. VERIFIED: it matches
// dist/all.js and all.min.js and neither index entry (2026-11-01).
const REGISTRATION = /\.df\$\s*=(?!=)|Object\.assign\(\s*[\w$]+\.df\$/;
for (const rel of ['dist/index.mjs', 'dist/index.cjs']) {
  if (REGISTRATION.test(readFileSync(join(ROOT, rel), 'utf8'))) {
    fail(`${rel} must not contain the df$ global registration (SSR-safe library entry)`);
  }
}

// 4. dist/stats.json is fresh (byte-for-byte against recomputed sizes)
const expected = computeStats(ROOT);
const actual = JSON.parse(readFileSync(join(ROOT, 'dist', 'stats.json'), 'utf8'));
if (JSON.stringify(actual) !== JSON.stringify(expected)) {
  fail('dist/stats.json is stale — re-run `bun run stats`');
}

// 4b. the README bundle-size block matches the recomputed table
const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
const start = readme.indexOf(README_SIZE_START);
const end = readme.indexOf(README_SIZE_END);
if (start === -1 || end === -1) {
  fail('README.md is missing the bundle-size markers');
} else {
  const block = readme.slice(start, end + README_SIZE_END.length);
  if (block !== renderReadmeBlock(expected)) {
    fail('README.md bundle-size block is stale — re-run `bun run stats`');
  }
}

// 5. the website serves the built files and states their current sizes
for (const problem of await docsDrift(ROOT, expected)) fail(`${problem} — re-run \`bun run docs\``);

if (failed) process.exit(1);
console.log(`check-dist: ${ARTIFACTS.length} artifacts present; stats.json, README.md and docs/ fresh`);
