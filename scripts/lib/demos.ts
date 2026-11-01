import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Why: the website's pattern and integration demos are the code a visitor reads, so the page shows their sources
 * and runs those same sources. docs/demos/ holds them as a user would write them, importing `defuss-morph`,
 * `defuss-store`, `defuss-query`, `defuss-i18n` and `defuss-dom-router` by name; `make build` (scripts/docs.ts)
 *
 * - bundles them with Bun.build into docs/assets/demos.js, router-demo.js and bench.js, compiling JSX for
 *   `jsxImportSource: "defuss-morph"` and leaving the package imports bare,
 * - copies the sibling packages' published browser files from node_modules into docs/assets/vendor/ (the
 *   versions bun.lock pins, the ones the tests run against),
 * - writes the import map that resolves the bare names to those files and to docs/assets/defuss-morph.mjs, into
 *   every page that loads a demo, so all demos and defuss-query share one copy of morph,
 * - fills each `<pre data-src="...">` code block with the source it names before highlighting.
 *
 * check-dist.ts fails while any of these differs from what this module would write now.
 */

/** [installed file, website copy] for the sibling packages; their LICENSE files travel with them. */
export const VENDOR_COPIES = [
  ...['index.js', 'query.js', 'dom.js'].map((file) => [`node_modules/defuss-query/dist/${file}`, `docs/assets/vendor/defuss-query/${file}`]),
  ['node_modules/defuss-store/dist/browser.js', 'docs/assets/vendor/defuss-store/browser.js'],
  ...['index.js', 'core.js'].map((file) => [`node_modules/defuss-i18n/dist/${file}`, `docs/assets/vendor/defuss-i18n/${file}`]),
  ['node_modules/defuss-dom-router/dist/index.js', 'docs/assets/vendor/defuss-dom-router/index.js'],
  ...['defuss-query', 'defuss-store', 'defuss-i18n', 'defuss-dom-router'].map((name) => [`node_modules/${name}/LICENSE`, `docs/assets/vendor/${name}/LICENSE`]),
] as const;

/** The pages that load demos, relative to the repository root; each carries the import map. */
export const DEMO_PAGES = ['docs/index.html', 'docs/router.html', 'docs/bench.html'] as const;

/** Bare module name to URL, relative to the pages (both live in docs/). */
export const IMPORT_MAP = {
  imports: {
    'defuss-morph': './assets/defuss-morph.mjs',
    // the package maps its jsx-runtime subpaths to the same entry, so this is the same module, not a copy
    'defuss-morph/jsx-runtime': './assets/defuss-morph.mjs',
    'defuss-query': './assets/vendor/defuss-query/index.js',
    'defuss-store': './assets/vendor/defuss-store/browser.js',
    'defuss-i18n': './assets/vendor/defuss-i18n/index.js',
    'defuss-dom-router': './assets/vendor/defuss-dom-router/index.js',
  },
};

/** [entry point, bundle] of the demos. */
export const DEMO_BUNDLES = [
  ['docs/demos/index.ts', 'docs/assets/demos.js'],
  ['docs/demos/router.ts', 'docs/assets/router-demo.js'],
  ['docs/demos/bench-stage.ts', 'docs/assets/bench.js'],
] as const;

/**
 * The bundles' bytes by output path. VERIFIED: Bun.build writes identical bytes on every run (it does for
 * docs/assets/shiki.js), so check-dist can compare. Unminified: a visitor can read them in the browser.
 */
export const buildDemos = async (root: string): Promise<Map<string, Uint8Array>> => {
  const bundles = new Map<string, Uint8Array>();
  for (const [entry, output] of DEMO_BUNDLES) {
    const result = await Bun.build({
      entrypoints: [join(root, entry)],
      root: join(root, 'docs/demos'),
      format: 'esm',
      target: 'browser',
      minify: false,
      external: Object.keys(IMPORT_MAP.imports),
      jsx: { runtime: 'automatic', importSource: 'defuss-morph', development: false },
    });
    if (!result.success) throw new AggregateError(result.logs, `demos: bundling ${entry} failed`);
    bundles.set(output, new Uint8Array(await result.outputs[0].arrayBuffer()));
  }
  return bundles;
};

const IMPORT_MAP_TAG = /<script type="importmap">[\s\S]*?<\/script>/;

/** `html` with its import map rewritten; a page without one is an error, because its demos would not load. */
export const renderImportMap = (html: string, page: string): string => {
  if (!IMPORT_MAP_TAG.test(html)) throw new Error(`demos: ${page} has no <script type="importmap">`);
  const json = JSON.stringify(IMPORT_MAP, null, 2).replace(/\n/g, '\n  ');
  return html.replace(IMPORT_MAP_TAG, `<script type="importmap">\n  ${json}\n  </script>`);
};

const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The lines between `start` and `end` markers named `name`, or all lines without a name; common indent removed. */
function sourceLines(text: string, name: string | undefined, where: string): string[] {
  let lines = text.replace(/\n$/, '').split('\n');
  if (name !== undefined) {
    const start = lines.findIndex((line) => new RegExp(`(?://|<!--) #region ${name}\\b`).test(line));
    const end = lines.findIndex((line, i) => i > start && /(?:\/\/|<!--) #endregion\b/.test(line));
    if (start < 0 || end < 0) throw new Error(`demos: no "#region ${name}" … "#endregion" in ${where}`);
    lines = lines.slice(start + 1, end);
  }
  const indent = Math.min(...lines.filter((line) => line.trim()).map((line) => /^ */.exec(line)![0].length));
  return lines.map((line) => line.slice(Number.isFinite(indent) ? indent : 0));
}

const SOURCE_BLOCK = /(<pre\b[^>]*\bdata-src="([^"#]*)(?:#([\w-]+))?"[^>]*><code>)[\s\S]*?(<\/code><\/pre>)/g;

/**
 * Fills every `<pre data-src="file#region"><code>` in `html` with that source as one plain `<span>` per line, for
 * highlight.ts to color. `file` is relative to docs/ (`demos/ref.tsx`); an empty file names a region of the page
 * itself (`data-src="#i18n-markup"`, between `<!-- #region i18n-markup -->` and `<!-- #endregion -->`), so the
 * markup of a live demo is shown as it is in the page.
 */
export const includeSources = (html: string, root: string): string =>
  html.replace(SOURCE_BLOCK, (_all, open: string, file: string, region: string | undefined, close: string) => {
    const where = file ? `docs/${file}` : 'the page';
    const text = file ? readFileSync(join(root, 'docs', file), 'utf8') : html;
    const lines = sourceLines(text, region, where);
    return `${open}${lines.map((line) => `<span>${escape(line)}</span>`).join('')}${close}`;
  });
