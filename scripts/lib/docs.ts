import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEMO_PAGES, VENDOR_COPIES, buildDemos, includeSources, renderImportMap } from './demos.ts';
import { highlightPage } from './highlight.ts';
import { type StatsFile, kb } from './stats.ts';

/**
 * Why: docs/ is a static site (GitHub Pages) that runs the real library and
 * quotes its sizes. It serves byte-for-byte copies of the built files instead
 * of a CDN URL, so the page always shows the commit it was built from, and the
 * size figures are rewritten from dist/stats.json instead of typed by hand.
 * The code examples are highlighted at build time too (highlight.ts), and the
 * playground's editor gets a Shiki bundle built from the installed release
 * (shiki-browser.ts). docs.ts writes all four; check-dist.ts fails while any drifts
 * (VERIFIED: a hand-edited figure fails it with exit 1).
 */

/** [built file, website copy]: the page imports the side-effect-free ESM entry;
 *  the CDN bundle is offered as the one-file download; the demos import the sibling packages (demos.ts) */
export const DOCS_COPIES = [
  ['dist/index.mjs', 'docs/assets/defuss-morph.mjs'],
  ['dist/all.min.js', 'docs/assets/defuss-morph.min.js'],
  ...VENDOR_COPIES,
] as const;

export const DOCS_PAGE = 'docs/index.html';

/** The playground's highlighter, built from scripts/lib/shiki-browser.ts. */
export const DOCS_SHIKI = 'docs/assets/shiki.js';

/**
 * The bytes of docs/assets/shiki.js. VERIFIED: Bun.build gives identical bytes on every run, so check-dist can compare.
 * A browser has no environment: `process.env` is defined as an empty object, so the TextMate engine's debug
 * switch inside reads nothing (VERIFIED: the bundle then holds no `process.env` read).
 */
export const buildDocsShiki = async (root: string): Promise<Uint8Array> => {
  const result = await Bun.build({
    entrypoints: [join(root, 'scripts/lib/shiki-browser.ts')],
    minify: true,
    target: 'browser',
    format: 'esm',
    define: { 'process.env': '{}' },
  });
  if (!result.success) throw new AggregateError(result.logs, 'docs: shiki bundle failed');
  return new Uint8Array(await result.outputs[0].arrayBuffer());
};

/** `<span data-stat="all.min.js:gzip">6.8 kB</span>`: file name in dist/, then bytes|gzip */
const STAT = /(<[a-z]+ [^>]*data-stat="([\w.]+):(bytes|gzip)"[^>]*>)([^<]*)(<\/)/g;

export const renderDocsStats = (html: string, stats: StatsFile): string =>
  html.replace(STAT, (_all, open: string, file: string, kind: 'bytes' | 'gzip', _old: string, close: string) => {
    const entry = stats.files[`dist/${file}`];
    if (!entry) throw new Error(`docs: data-stat names unknown file dist/${file}`);
    return `${open}${kb(entry[kind])}${close}`;
  });

/** A page as docs.ts writes it: current size figures, import map, code blocks filled from their sources and highlighted. */
export const renderDocsPage = async (html: string, stats: StatsFile, root: string, page: string = DOCS_PAGE): Promise<string> =>
  highlightPage(includeSources(renderImportMap(renderDocsStats(html, stats), page), root));

/** Every way docs/ differs from what docs.ts would write now. */
export const docsDrift = async (root: string, stats: StatsFile): Promise<string[]> => {
  const problems: string[] = [];
  for (const [from, to] of DOCS_COPIES) {
    let copy: Buffer;
    try {
      copy = readFileSync(join(root, to));
    } catch {
      problems.push(`${to} missing`);
      continue;
    }
    if (!copy.equals(readFileSync(join(root, from)))) problems.push(`${to} differs from ${from}`);
  }
  let shiki: Buffer | undefined;
  try {
    shiki = readFileSync(join(root, DOCS_SHIKI));
  } catch {
    problems.push(`${DOCS_SHIKI} missing`);
  }
  if (shiki && !shiki.equals(await buildDocsShiki(root))) problems.push(`${DOCS_SHIKI} differs from a fresh build of scripts/lib/shiki-browser.ts`);
  for (const [path, bytes] of await buildDemos(root)) {
    let built: Buffer | undefined;
    try {
      built = readFileSync(join(root, path));
    } catch {
      problems.push(`${path} missing`);
    }
    if (built && !built.equals(bytes)) problems.push(`${path} differs from a fresh build of docs/demos/`);
  }
  const html = readFileSync(join(root, DOCS_PAGE), 'utf8');
  if (!html.match(STAT)) problems.push(`${DOCS_PAGE} quotes no data-stat size`);
  if (renderDocsStats(html, stats) !== html) problems.push(`${DOCS_PAGE} size figures are stale`);
  for (const page of DEMO_PAGES) {
    const current = readFileSync(join(root, page), 'utf8');
    if ((await renderDocsPage(current, stats, root, page)) !== current) {
      problems.push(`${page} differs from what make build writes (import map, code from docs/demos/, shiki colors)`);
    }
  }
  return problems;
};
