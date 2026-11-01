// make bench: the website's benchmark (docs/demos/bench.ts) in headless Chromium and WebKit, on docs/bench.html as
// `make build` wrote it, once with HTML strings and once with VNodes. One log line per operation and method, then a
// table per browser and input; output/bench.json keeps the run, and the website's recorded table (docs/index.html,
// between <!-- bench:start --> and <!-- bench:end -->) is rewritten from it with the date, machine and versions.
// VERIFIED: four runs on one machine differed by up to 28% in a cell (ARCH.md), so the page says which run it shows.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { join } from 'node:path';
import { chromium, webkit } from 'playwright';
import { benchBlock, replaceBlock } from './lib/bench-page.ts';
import { createStaticServer } from './serve.mjs';

const ROOT = join(import.meta.dirname, '..');
const OUT = join(ROOT, 'output');
const PAGE = join(ROOT, 'docs', 'index.html');
const log = (level, message) => console.log(`${new Date().toISOString()} ${level} bench ${message}`);
const BROWSERS = [['chromium', 'Chromium', chromium], ['webkit', 'WebKit', webkit]];

const server = createStaticServer(ROOT);
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const errors = [];
const report = {
  date: new Date().toISOString(),
  machine: `${cpus()[0]?.model ?? 'unknown CPU'} (${process.platform} ${process.arch})`,
  version: JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version,
  ops: [],
  methods: [],
  browsers: [],
};

try {
  for (const [id, name, type] of BROWSERS) {
    let browser;
    try {
      browser = await type.launch();
    } catch (error) {
      throw new Error(`${name} is not installed for Playwright: run \`bunx playwright install ${id}\` (${error.message.split('\n')[0]})`);
    }
    try {
      const page = await browser.newPage();
      page.on('pageerror', (error) => errors.push(`${name}: ${error.message}`));
      page.on('console', (message) => message.type() === 'error' && errors.push(`${name}: ${message.text()}`));
      await page.goto(`http://127.0.0.1:${server.address().port}/docs/bench.html`);
      await page.waitForFunction(() => window.bench);
      Object.assign(report, await page.evaluate(() => ({ ops: window.bench.ops, methods: window.bench.methods })));
      const entry = { id, name, version: browser.version(), inputs: {} };
      for (const input of ['html', 'vnode']) {
        const started = Date.now();
        const results = await page.evaluate((input) => window.bench.run({ input }), input);
        entry.inputs[input] = results;
        for (const r of results) {
          log(r.ok ? 'INFO' : 'ERROR', `browser=${id} input=${input} op=${r.op} method=${r.method} ${r.median === null ? 'supported=false' : `median_ms=${r.median.toFixed(2)} min_ms=${r.min.toFixed(2)} max_ms=${r.max.toFixed(2)} ok=${r.ok}`}`);
        }
        log('INFO', `browser=${id} input=${input} done seconds=${((Date.now() - started) / 1000).toFixed(1)}`);

        const cell = (r) => (r.median === null ? 'n/a' : r.ok ? r.median.toFixed(2) : 'wrong');
        const width = Math.max(...report.ops.map((op) => op.label.length));
        console.log(`\n${name} ${entry.version}, input: ${input === 'html' ? 'HTML strings' : 'VNodes'}, median ms`);
        console.log(['operation'.padEnd(width), ...report.methods.map((m) => m.label.padStart(18))].join(' '));
        for (const op of report.ops) {
          const row = report.methods.map((m) => cell(results.find((r) => r.op === op.id && r.method === m.id)).padStart(18));
          console.log([op.label.padEnd(width), ...row].join(' '));
        }
        console.log('');
      }
      report.browsers.push(entry);
    } finally {
      await browser.close();
    }
  }

  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'bench.json'), `${JSON.stringify(report, null, 2)}\n`);
  log('INFO', 'wrote output/bench.json');
  const wrong = report.browsers.flatMap((b) => [...b.inputs.html, ...b.inputs.vnode]).filter((r) => !r.ok);
  if (errors.length > 0 || wrong.length > 0) {
    log('ERROR', `errors=${errors.length} wrong=${wrong.length} ${errors.join(' | ')}; docs/index.html left unchanged`);
    process.exitCode = 1;
  } else {
    writeFileSync(PAGE, replaceBlock(readFileSync(PAGE, 'utf8'), 'bench', benchBlock(report)));
    log('INFO', 'wrote the recorded run into docs/index.html');
  }
} finally {
  server.close();
}
