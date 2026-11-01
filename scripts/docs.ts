#!/usr/bin/env bun
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DEMO_PAGES, buildDemos } from './lib/demos.ts';
import { DOCS_COPIES, DOCS_SHIKI, buildDocsShiki, renderDocsPage } from './lib/docs.ts';
import { computeStats } from './lib/stats.ts';

/**
 * Why: refreshes the website from the current build: copies the built files
 * into docs/assets/ and rewrites the size figures in docs/index.html from the
 * measured dist/ sizes (see lib/docs.ts), highlights its code examples
 * with shiki (lib/highlight.ts), bundles the playground's highlighter
 * (lib/shiki-browser.ts) and the demos with their vendored packages and
 * import map (lib/demos.ts). Runs in `make build` after stats.ts.
 * VERIFIED: scripts/e2e/browser.mjs compares every rendered figure with dist/stats.json.
 */

const ROOT = join(import.meta.dirname, '..');

for (const [from, to] of DOCS_COPIES) {
  mkdirSync(dirname(join(ROOT, to)), { recursive: true });
  copyFileSync(join(ROOT, from), join(ROOT, to));
}
writeFileSync(join(ROOT, DOCS_SHIKI), await buildDocsShiki(ROOT));
const demos = await buildDemos(ROOT);
for (const [path, bytes] of demos) writeFileSync(join(ROOT, path), bytes);

const stats = computeStats(ROOT);
for (const page of DEMO_PAGES) {
  writeFileSync(join(ROOT, page), await renderDocsPage(readFileSync(join(ROOT, page), 'utf8'), stats, ROOT, page));
}

console.log(`docs: ${DOCS_COPIES.length} copies, ${DOCS_SHIKI}, ${[...demos.keys()].join(', ')} + ${DEMO_PAGES.join(', ')} (sizes, import map, sources, colors)`);
