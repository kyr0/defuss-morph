#!/usr/bin/env bun
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DOCS_COPIES, DOCS_PAGE, DOCS_SHIKI, buildDocsShiki, renderDocsPage } from './lib/docs.ts';
import { computeStats } from './lib/stats.ts';

/**
 * Why: refreshes the website from the current build: copies the built files
 * into docs/assets/ and rewrites the size figures in docs/index.html from the
 * measured dist/ sizes (see lib/docs.ts), highlights its code examples
 * with shiki (lib/highlight.ts) and bundles the playground's highlighter
 * (lib/shiki-browser.ts). Runs in `make build` after stats.ts.
 * VERIFIED: scripts/e2e/browser.mjs compares every rendered figure with dist/stats.json.
 */

const ROOT = join(import.meta.dirname, '..');

for (const [from, to] of DOCS_COPIES) copyFileSync(join(ROOT, from), join(ROOT, to));
writeFileSync(join(ROOT, DOCS_SHIKI), await buildDocsShiki(ROOT));

const page = join(ROOT, DOCS_PAGE);
writeFileSync(page, await renderDocsPage(readFileSync(page, 'utf8'), computeStats(ROOT)));

console.log(`docs: ${[...DOCS_COPIES.map(([, to]) => to), DOCS_SHIKI].join(', ')} + ${DOCS_PAGE} sizes refreshed, code highlighted`);
