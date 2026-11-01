// Browser e2e: the website (docs/) and every example page in real Chromium, against the built files they load
// (docs/assets/defuss-morph.mjs = dist/index.mjs, checked by check-dist; examples load ../dist/all.js).
// Fails on console errors, page errors and failed requests. Evidence: output/e2e-browser.json + screenshots.
// VERIFIED: it needs the network, because docs/ loads defuss-shadcn from jsDelivr and a failed request fails the run.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { createStaticServer } from '../serve.mjs';

const ROOT = join(import.meta.dirname, '..', '..');
const OUT = join(ROOT, 'output');
const log = (level, message) => console.log(`${new Date().toISOString()} ${level} e2e.browser ${message}`);

// the dev server's static handler (scripts/serve.mjs) on a free port
const server = createStaticServer(ROOT);
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: Boolean(ok), detail });
  log(ok ? 'INFO' : 'ERROR', `${ok ? 'pass' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
};

/**
 * Syntax colors as rendered (scripts/lib/highlight.ts): the token count, the lowest contrast of a token against the
 * nearest opaque background, and code blocks without tokens. A canvas converts every CSS color (shadcn uses oklch)
 * to sRGB bytes; contrast is the WCAG ratio, 4.5:1 being AA for normal text.
 */
const syntax = (page) =>
  page.evaluate(() => {
    const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    const rgba = (color) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = '#000';
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);
      return [...ctx.getImageData(0, 0, 1, 1).data];
    };
    const luminance = (rgb) => [0.2126, 0.7152, 0.0722].reduce((sum, weight, i) => {
      const c = rgb[i] / 255;
      return sum + weight * (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    }, 0);
    const background = (el) => {
      for (let node = el; node; node = node.parentElement) {
        const color = rgba(getComputedStyle(node).backgroundColor);
        if (color[3] === 255) return color;
      }
      return rgba(getComputedStyle(document.documentElement).backgroundColor);
    };
    const tokens = [...document.querySelectorAll('pre[data-lang] span[style], .dm-code span[style]')];
    let worst = { ratio: Number.POSITIVE_INFINITY, text: '' };
    for (const token of tokens) {
      const [a, b] = [luminance(rgba(getComputedStyle(token).color)), luminance(background(token))];
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      if (ratio < worst.ratio) worst = { ratio, text: token.textContent };
    }
    const plain = [...document.querySelectorAll('.mk-code-block pre, .dm-code pre')]
      .filter((pre) => pre.textContent.trim() !== '' && !pre.querySelector('span[style]'))
      .map((pre) => pre.outerHTML.slice(0, 80));
    return { tokens: tokens.length, worst, plain };
  });

const checkSyntax = (result, scheme) => {
  check(`docs: every code example is highlighted (${scheme})`, result.tokens > 0 && result.plain.length === 0, result.plain.join(' | '));
  check(`docs: every syntax token has at least 4.5:1 contrast (${scheme})`, result.worst.ratio >= 4.5, `${result.worst.ratio.toFixed(2)}:1 for "${result.worst.text}"`);
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });

/** Opens a page and records every console error, page error and failed request until `done()`. */
async function open(path) {
  const page = await context.newPage();
  const problems = [];
  page.on('console', (msg) => { if (msg.type() === 'error') problems.push(`console: ${msg.text()}`); });
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  page.on('requestfailed', (req) => problems.push(`requestfailed: ${req.url()} ${req.failure()?.errorText}`));
  page.on('response', (res) => { if (res.status() >= 400) problems.push(`http ${res.status()}: ${res.url()}`); });
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
  return { page, problems };
}

try {
  // ---- website -------------------------------------------------------------------------------------------------------
  const { page, problems } = await open('/docs/');
  check('docs: defuss-shadcn styles loaded (SRI ok)', await page.evaluate(() => getComputedStyle(document.querySelector('.mk-header')).position !== 'static'));

  const stats = JSON.parse(readFileSync(join(ROOT, 'dist', 'stats.json'), 'utf8'));
  const shown = await page.$$eval('[data-stat]', (els) => els.map((el) => [el.dataset.stat, el.textContent]));
  check('docs: every size figure matches dist/stats.json', shown.length > 0 && shown.every(([key, text]) => {
    const [file, kind] = key.split(':');
    return text === `${(stats.files[`dist/${file}`][kind] / 1024).toFixed(1)} kB`;
  }), `${shown.length} figures`);

  const verdict = () => page.textContent('#verdict');
  // keyed list, morph(): a typed note and focus survive the reorder
  await page.fill('[aria-label="Milk note"]', 'two litres');
  await page.click('#apply');
  await page.waitForFunction(() => document.getElementById('verdict').textContent.includes('fields you changed'));
  check('docs: morph() keeps typed input in a keyed reorder', (await verdict()).includes('1 of 1 fields you changed kept your input'), await verdict());
  check('docs: the note moved with its item', await page.inputValue('[aria-label="Milk note"]') === 'two litres');

  // keyed list, innerHTML: the same input is lost
  await page.click('[data-engine="innerHTML"]');
  await page.click('#reset');
  await page.fill('[aria-label="Milk note"]', 'two litres');
  await page.click('#apply');
  await page.waitForFunction(() => document.getElementById('verdict').textContent.includes('fields you changed'));
  check('docs: innerHTML loses the same input', (await verdict()).includes('0 of 1 fields you changed'), await verdict());

  // the switchers show the choice; defuss-shadcn's scripts own that state, and a second handler once cleared it
  const choice = () => page.evaluate(() => `${document.querySelector('#scenarios [aria-selected="true"]')?.dataset.scenario} ${
    [...document.querySelectorAll('#engines [aria-pressed="true"]')].map((b) => b.dataset.engine).join()}`);
  check('docs: the scenario tab and the engine show the choice', await choice() === 'list innerHTML', await choice());
  await page.click('[data-engine="innerHTML"]');
  check('docs: a second click keeps the engine chosen', await choice() === 'list innerHTML', await choice());

  // form state, morph(): typed name, ticked box and chosen plan survive
  await page.click('[data-engine="morph"]');
  await page.click('[data-scenario="form"]');
  await page.fill('#f-name', 'Ada');
  await page.check('#f-news');
  await page.selectOption('#f-plan', 'Team');
  await page.focus('#f-name');
  await page.click('#apply');
  await page.waitForFunction(() => document.getElementById('verdict').textContent.includes('fields you changed'));
  check('docs: morph() keeps form state', (await verdict()).includes('3 of 3 fields you changed kept your input'), await verdict());
  check('docs: morph() keeps focus in the edited field', (await verdict()).includes('still has focus'), await verdict());
  check('docs: the label changed around the kept field', (await page.textContent('#stage label')).includes('Full name'));

  // change-set, reached with the keyboard: diff mode patches by key and keeps the unnamed jobs
  await page.focus('[data-scenario="form"]');
  await page.keyboard.press('ArrowRight');
  check('docs: arrow keys switch the scenario tab', await choice() === 'diff morph' && (await page.textContent('#stage')).includes('deploy'), await choice());
  await page.click('#apply');
  await page.waitForFunction(() => document.getElementById('st-kept').textContent !== '0');
  const jobs = await page.$$eval('#stage li', (els) => els.map((el) => `${el.textContent}`));
  check('docs: diff mode patches build/test and keeps deploy', jobs.join('|') === 'builddone|testrunning|deployqueued', jobs.join('|'));

  // transition: the awaited morph ends on the next card
  await page.click('[data-scenario="transition"]');
  await page.selectOption('#transition-type', 'slide-left');
  await page.click('#apply');
  await page.waitForFunction(() => !document.getElementById('apply').disabled);
  check('docs: a transition morph ends on the next state', (await page.textContent('#stage h4')) === 'Step 2 of 3');

  // the next-state editor: Shiki colors what you type (loaded when the playground came near the viewport)
  await page.waitForSelector('#next-editor[data-painted]');
  await page.fill('#next-html', '<p class="note">typed</p>');
  check('docs: the next-state editor colors what you type', await page.evaluate(() => {
    const paint = document.getElementById('next-paint');
    return paint.textContent === `${document.getElementById('next-html').value}\n` && paint.querySelectorAll('span[style]').length > 2;
  }));

  // theme switch; syntax colors are measured in both schemes
  const dark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  checkSyntax(await syntax(page), dark ? 'dark' : 'light');
  await page.click('label.swap');
  check('docs: the theme switch toggles dark mode', await page.evaluate(() => document.documentElement.classList.contains('dark')) !== dark);
  checkSyntax(await syntax(page), dark ? 'light' : 'dark');
  await page.screenshot({ path: join(OUT, 'e2e-docs.png'), fullPage: true });

  // phone width: every tab label in full, no sideways scrolling
  await page.setViewportSize({ width: 375, height: 800 });
  const cut = await page.$$eval('.tab-trigger', (tabs) => tabs.filter((t) => t.scrollWidth > t.clientWidth).map((t) => t.textContent));
  check('docs: no tab label is cut at 375 px', cut.length === 0, cut.join(', '));
  check('docs: no horizontal scroll at 375 px', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.setViewportSize({ width: 1280, height: 900 });
  check('docs: no console errors or failed requests', problems.length === 0, problems.join('; '));
  await page.close();

  // ---- examples: every page loads the built bundle; every button runs without an error ---------------------------------
  for (const name of readdirSync(join(ROOT, 'examples')).filter((f) => f.endsWith('.html')).sort()) {
    const example = await open(`/examples/${name}`);
    check(`${name}: df$ registered by dist/all.js`, await example.page.evaluate(() => typeof window.df$?.morph === 'function'));
    const buttons = await example.page.$$('button');
    for (const button of buttons) {
      if (await button.isVisible() && await button.isEnabled()) await button.click();
      await example.page.waitForTimeout(50);
    }
    await example.page.waitForTimeout(800); // let transitions started by the clicks settle
    check(`${name}: ${buttons.length} buttons clicked without errors`, example.problems.length === 0, example.problems.join('; '));
    await example.page.close();
  }
} finally {
  await browser.close();
  server.close();
}

const failed = results.filter((r) => !r.ok).length;
writeFileSync(join(OUT, 'e2e-browser.json'), `${JSON.stringify({ timestamp: new Date().toISOString(), browser: 'chromium', results }, null, 2)}\n`);
log(failed ? 'ERROR' : 'INFO', `${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
