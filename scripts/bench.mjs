// make bench: the website's benchmark (docs/demos/bench.ts) in headless Chromium, on docs/bench.html as `make build`
// wrote it, once with HTML strings and once with VNodes. One log line per operation and method, then a table;
// output/bench.json keeps the run with the browser version. The numbers describe this machine and this run only.
// VERIFIED: four runs on one machine differed by up to 28% in a cell (ARCH.md).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { createStaticServer } from './serve.mjs';

const ROOT = join(import.meta.dirname, '..');
const OUT = join(ROOT, 'output');
const log = (level, message) => console.log(`${new Date().toISOString()} ${level} bench ${message}`);

const server = createStaticServer(ROOT);
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch();
const errors = [];

try {
  const page = await browser.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));
  await page.goto(`http://127.0.0.1:${server.address().port}/docs/bench.html`);
  await page.waitForFunction(() => window.bench);
  const { ops, methods } = await page.evaluate(() => ({ ops: window.bench.ops, methods: window.bench.methods }));

  const report = { date: new Date().toISOString(), browser: `Chromium ${browser.version()}`, inputs: {} };
  for (const input of ['html', 'vnode']) {
    const started = Date.now();
    const results = await page.evaluate((input) => window.bench.run({ input }), input);
    report.inputs[input] = results;
    for (const r of results) {
      log(r.ok ? 'INFO' : 'ERROR', `input=${input} op=${r.op} method=${r.method} ${r.median === null ? 'supported=false' : `median_ms=${r.median.toFixed(2)} min_ms=${r.min.toFixed(2)} max_ms=${r.max.toFixed(2)} ok=${r.ok}`}`);
    }
    log('INFO', `input=${input} done seconds=${((Date.now() - started) / 1000).toFixed(1)}`);

    const cell = (r) => (r.median === null ? 'n/a' : r.ok ? r.median.toFixed(2) : 'wrong');
    const width = Math.max(...ops.map((op) => op.label.length));
    console.log(`\n${report.browser}, input: ${input === 'html' ? 'HTML strings' : 'VNodes'}, median ms`);
    console.log(['operation'.padEnd(width), ...methods.map((m) => m.label.padStart(18))].join(' '));
    for (const op of ops) {
      const row = methods.map((m) => cell(results.find((r) => r.op === op.id && r.method === m.id)).padStart(18));
      console.log([op.label.padEnd(width), ...row].join(' '));
    }
    console.log('');
  }

  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'bench.json'), `${JSON.stringify(report, null, 2)}\n`);
  log('INFO', 'wrote output/bench.json');
  const wrong = Object.values(report.inputs).flat().filter((r) => !r.ok);
  if (errors.length > 0 || wrong.length > 0) {
    log('ERROR', `errors=${errors.length} wrong=${wrong.length} ${errors.join(' | ')}`);
    process.exitCode = 1;
  }
} finally {
  await browser.close();
  server.close();
}
