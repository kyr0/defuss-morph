// Browser e2e: the website (docs/) and every example page in real Chromium, and the built library also in Firefox, against
// the built files they load
// (docs/assets/defuss-morph.mjs = dist/index.mjs, checked by check-dist; examples load ../dist/all.js).
// Fails on console errors, page errors and failed requests. Evidence: output/e2e-browser.json + screenshots.
// VERIFIED: it needs the network, because docs/ loads defuss-shadcn from jsDelivr and a failed request fails the run.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, firefox } from 'playwright';
import { createStaticServer } from '../serve.mjs';

const ROOT = join(import.meta.dirname, '..', '..');
const OUT = join(ROOT, 'output');
const VERSION = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
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
async function open(path, inContext = context) {
  const page = await inContext.newPage();
  const problems = [];
  page.on('console', (msg) => { if (msg.type() === 'error') problems.push(`console: ${msg.text()}`); });
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  page.on('requestfailed', (req) => problems.push(`requestfailed: ${req.url()} ${req.failure()?.errorText}`));
  page.on('response', (res) => { if (res.status() >= 400) problems.push(`http ${res.status()}: ${res.url()}`); });
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
  return { page, problems };
}

/**
 * Per example page: drives what the page demonstrates and returns [label, passed] pairs. The page's text says what
 * should happen; these check that it does.
 */
const settleTransition = (page) => page.waitForTimeout(700);
const EXAMPLE_SCENARIOS = {
  'cdn-global.html': async (page) => {
    const kept = await page.evaluate(async () => {
      const bold = document.querySelector('#app b');
      document.getElementById('rename').click();
      const items = [...document.querySelectorAll('#list li')];
      document.getElementById('shuffle').click();
      const after = [...document.querySelectorAll('#list li')];
      document.getElementById('uncheck').click();
      const watched = document.getElementById('watched');
      watched.click();
      document.getElementById('relabel').click();
      document.getElementById('watched').click();
      return {
        bold: document.querySelector('#app b') === bold && bold.className === 'hot' && bold.textContent === 'df$',
        reversed: after.length === 5 && after.every((li, i) => li === items[4 - i]),
        unchecked: document.getElementById('cb').checked === false,
        clicks: document.getElementById('watched') === watched && watched.textContent === 'Click me (2)',
      };
    });
    await page.click('#fade-btn');
    await settleTransition(page);
    return [['morph() patches the <b> in place', kept.bold], ['a keyed reverse moves the same five items', kept.reversed],
      ['updateDomWithVdom unchecks the box', kept.unchecked], ['a delegated handler survives a morph of its button', kept.clicks],
      ['the fade transition ends on the next state', (await page.textContent('#fade')).includes('Faded over!')]];
  },
  'controlled-form-state.html': async (page) => {
    await page.click('#try-uncheck');
    await page.click('#uncheck');
    const unchecked = await page.isChecked('#c2');
    await page.click('#check');
    await page.fill('#t1', 'typed');
    await page.click('#soft');
    const soft = await page.inputValue('#t1');
    await page.click('#hard');
    return [['an HTML string cannot uncheck the box', (await page.textContent('#html-result')).includes('still checked: true') && await page.isChecked('#c1')],
      ['checked: false in a VNode unchecks it, true checks it again', unchecked === false && await page.isChecked('#c2')],
      ['markup without value keeps the typed text; value: "reset" overrides it', soft === 'typed' && await page.inputValue('#t1') === 'reset']];
  },
  'diff-mode.html': async (page) => {
    await page.click('#patch-b');
    const patched = `${await page.textContent('#out')} ${await page.textContent('[key="b"]')}`;
    await page.click('#append-d');
    const appended = await page.textContent('#out');
    await page.click('#no-key');
    await page.click('#full');
    return [['a diff patches b and keeps a with its attribute', patched.includes('a still has data-secret: true') && patched.includes('patched via diff')],
      ['a diff appends d and removes nothing', appended.includes('rows now: a, b, c, d')],
      ['a key-less item throws', (await page.textContent('#err-out')).includes('threw:')],
      ['a full morph removes the unmentioned rows', (await page.textContent('#out')).includes('rows now: b —')]];
  },
  'event-listener-preservation.html': async (page) => {
    const logs = [];
    page.on('console', (message) => logs.push(message.text()));
    const result = await page.evaluate(() => {
      const btn = document.getElementById('btn');
      document.getElementById('morph-native').click();
      document.getElementById('btn').click();
      const dbtn = document.getElementById('dbtn');
      document.getElementById('morph-delegated').click();
      document.getElementById('dbtn').click();
      document.getElementById('morph-away').click();
      document.getElementById('probe').click();
      return {
        native: document.getElementById('btn') === btn && btn.textContent === 'Clicks: 1',
        delegated: document.getElementById('dbtn') === dbtn && dbtn.textContent === 'Delegated clicks: 1',
        removed: !document.getElementById('gone'),
      };
    });
    return [['a native listener survives a morph of its button', result.native],
      ['a delegated handler survives two morphs and fires once per click', result.delegated],
      ['a removed button\'s handler is torn down', result.removed && logs.some((log) => log === 'handler calls after removal: 0')]];
  },
  'reactive-html.html': async (page) => {
    const summary = () => page.textContent('#summary');
    const first = await summary();
    await page.fill('[aria-label="Note for Write the docs"]', 'chapter 2');
    await sameNodeIn(page, '#todos li:first-child');
    await page.fill('[aria-label="New todo"]', 'Buy milk');
    await page.click('#add button');
    const added = await summary();
    await page.check('[data-toggle="3"]');
    const ticked = await summary();
    await page.click('#sort');
    const order = await page.$$eval('#todos li label', (labels) => labels.map((label) => label.textContent.trim()));
    await page.click('#stop');
    await page.fill('[aria-label="New todo"]', '<b>bold</b>');
    await page.click('#add button');
    return [['reactive() renders the store and df$().reactive() its summary', first === '1 of 2 done'],
      ['adding re-renders both and keeps the note in its row', added === '1 of 3 done' && await stillSameIn(page, '#todos li:first-child')
        && await page.inputValue('[aria-label="Note for Write the docs"]') === 'chapter 2'],
      ['ticking updates the summary through the delegated listener', ticked === '2 of 3 done'],
      ['sorting moves the rows with their notes', order.join('|') === 'Write the docs|Ship 0.3.0|Buy milk'
        && await page.inputValue('[aria-label="Note for Write the docs"]') === 'chapter 2'],
      ['an aborted signal stops the summary; the list goes on', await summary() === '2 of 3 done' && (await page.$$('#todos li')).length === 4],
      ['the user\'s text is escaped, not parsed', (await page.$$('#todos b')).length === 0 && (await page.textContent('#todos')).includes('<b>bold</b>')]];
  },
  'reactive-jsx.html': async (page) => {
    await sameNodeIn(page, '#increment');
    await page.click('#increment');
    await page.click('#increment');
    const counted = (await page.textContent('#counter')).includes('clicked 2 times') && await stillSameIn(page, '#increment');
    await page.click('#focus');
    const focused = await page.evaluate(() => document.activeElement?.id === 'name');
    await page.click('.disclosure button');
    const opened = (await page.textContent('.disclosure .body')).includes('Every node that matches') && await page.getAttribute('.disclosure button', 'aria-expanded') === 'true';
    await page.click('#close');
    return [['<Reactive> via h() re-renders the counter into the same button', counted],
      ['ref.current.focus() focuses the input', focused],
      ['the component opens itself', opened],
      ['the parent closes it through ref.state', (await page.$$('.disclosure .body')).length === 0 && await page.getAttribute('.disclosure button', 'aria-expanded') === 'false']];
  },
  'transition-await.html': async (page) => {
    await page.click('#race');
    await settleTransition(page);
    const race = await page.textContent('#stage');
    await page.click('#seq');
    await settleTransition(page);
    const seq = await page.textContent('#stage');
    await page.click('#spam');
    // three queued transitions of two 250 ms phases each
    const queued = await page.waitForFunction(() => document.getElementById('stage').textContent.includes('queued update 3'), null, { timeout: 5000 })
      .then(() => true, () => false);
    return [['latest-wins: the transition ends on C', race.includes('State C')],
      ['await sequences B, then C', seq.includes('State C (applied right after')],
      ['a queue plays every update in order', queued]];
  },
};
/** Node identity across a re-render: remember the element a selector finds now, then ask whether it still finds that one. */
const sameNodeIn = (page, selector) => page.evaluate((sel) => { (window.__seen ??= new Map()).set(sel, document.querySelector(sel)); }, selector);
const stillSameIn = (page, selector) => page.evaluate((sel) => window.__seen.get(sel) === document.querySelector(sel) && window.__seen.get(sel) !== null, selector);

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
  const applied = () => page.waitForFunction(() => !document.getElementById('apply').disabled && document.getElementById('st-kept').textContent !== '0');

  // Apply runs exactly the editor's markup and leaves it there: no prepared state is applied or loaded behind
  // the user's back (it once was, on every click)
  const start = await page.inputValue('#next-html');
  check('docs: the editor starts with the stage markup', start.includes('key="bread"') && (await page.textContent('#stage')).includes('Bread'));
  const edited = start.replace('>Bread<', '>Butter<');
  await page.fill('#next-html', edited);
  await page.click('#apply');
  await applied();
  check('docs: Apply runs exactly the edited markup', (await page.textContent('#stage')).includes('Butter') && await page.inputValue('#next-html') === edited);
  await page.click('#apply');
  await applied();
  check('docs: applying the same markup again changes nothing', await page.textContent('#st-created') === '0' && await page.textContent('#st-removed') === '0' && await page.inputValue('#next-html') === edited);

  // keyed list, morph(): a typed note and focus survive the example reorder
  await page.click('#reset');
  await page.fill('[aria-label="Milk note"]', 'two litres');
  await page.click('#example');
  check('docs: Example edit only fills the editor', (await page.inputValue('#next-html')).includes('key="coffee"') && !(await page.textContent('#stage')).includes('Coffee'));
  await page.click('#apply');
  await page.waitForFunction(() => document.getElementById('verdict').textContent.includes('fields you changed'));
  check('docs: morph() keeps typed input in a keyed reorder', (await verdict()).includes('1 of 1 fields you changed kept your input'), await verdict());
  check('docs: the note moved with its item', await page.inputValue('[aria-label="Milk note"]') === 'two litres');

  // keyed list, morph(): the item you type in is itself moved (Eggs goes first) and keeps focus and caret
  await page.click('#reset');
  await page.click('[aria-label="Eggs note"]');
  await page.keyboard.type('six');
  await page.click('#example');
  await page.click('#apply');
  await page.waitForFunction(() => document.getElementById('verdict').textContent.includes('fields you changed'));
  check('docs: morph() keeps focus in a moved item', (await verdict()).includes('still has focus')
    && await page.evaluate(() => document.activeElement?.getAttribute('aria-label')) === 'Eggs note'
    && (await page.$$eval('#stage li', (els) => els.map((el) => el.getAttribute('key'))))[0] === 'eggs', await verdict());
  await page.keyboard.type('!');
  check('docs: typing continues in the moved field', await page.inputValue('[aria-label="Eggs note"]') === 'six!');

  // keyed list, innerHTML: the same input is lost
  await page.click('[data-engine="innerHTML"]');
  await page.click('#reset');
  await page.fill('[aria-label="Milk note"]', 'two litres');
  await page.click('#example');
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
  await page.click('#example');
  await page.click('#apply');
  await page.waitForFunction(() => document.getElementById('verdict').textContent.includes('fields you changed'));
  check('docs: morph() keeps form state', (await verdict()).includes('3 of 3 fields you changed kept your input'), await verdict());
  check('docs: morph() keeps focus in the edited field', (await verdict()).includes('still has focus'), await verdict());
  check('docs: the label changed around the kept field', (await page.textContent('#stage label')).includes('Full name'));

  // change-set, reached with the keyboard: diff mode patches by key and keeps the unnamed jobs
  await page.focus('[data-scenario="form"]');
  await page.keyboard.press('ArrowRight');
  check('docs: arrow keys switch the scenario tab', await choice() === 'diff morph' && (await page.textContent('#stage')).includes('deploy'), await choice());
  await page.click('#example');
  await page.click('#apply');
  await page.waitForFunction(() => document.getElementById('st-kept').textContent !== '0');
  const jobs = await page.$$eval('#stage li', (els) => els.map((el) => `${el.textContent}`));
  check('docs: diff mode patches build/test and keeps deploy', jobs.join('|') === 'builddone|testrunning|deployqueued', jobs.join('|'));

  // transition: the awaited morph ends on the next card
  await page.click('[data-scenario="transition"]');
  await page.selectOption('#transition-type', 'slide-left');
  await page.click('#example');
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

  // ---- patterns: each demo does what its panel says, through the copy of the library the site serves -------------
  const sameNode = (selector) => sameNodeIn(page, selector);
  const stillSame = (selector) => stillSameIn(page, selector);
  const text = async (selector) => (await page.textContent(selector))?.replace(/\s+/g, ' ').trim();
  const rowNames = (selector) => page.$$eval(selector, (rows) => rows.map((row) => row.textContent.trim().split(/\s/)[0]));

  await page.click('#ptab-reactive');
  await page.fill('#live-cart-jsx [aria-label="Milk note"]', 'oat milk');
  await sameNode('#live-cart-jsx li:nth-child(2)');
  await page.click('#live-cart-jsx li:nth-child(2) button');
  check('patterns: <Reactive> re-renders on a store change and keeps the row and its note',
    (await text('#live-cart-jsx li:nth-child(2) span')) === 'Milk × 3' && await stillSame('#live-cart-jsx li:nth-child(2)')
    && await page.inputValue('#live-cart-jsx [aria-label="Milk note"]') === 'oat milk');
  check('patterns: reactive() with an HTML string and df$().reactive() follow the same store',
    (await text('#live-cart-html li:nth-child(2)')).startsWith('Milk × 3') && await text('[data-ref=cart-total]') === '5 items in total');
  await page.click('#live-cart-html [data-action=reverse]');
  check('patterns: the HTML view\'s delegated listener reverses the cart; keyed JSX rows move with the note',
    (await rowNames('#live-cart-jsx li')).join() === 'Bread,Milk,Tea' && (await rowNames('#live-cart-html li')).join() === 'Bread,Milk,Tea'
    && await page.inputValue('#live-cart-jsx [aria-label="Milk note"]') === 'oat milk', (await rowNames('#live-cart-jsx li')).join());
  await page.click('#live-cart-html [data-add=tea]');
  check('patterns: a click in the HTML view re-renders all three views', (await text('#live-cart-jsx li:nth-child(3) span')) === 'Tea × 2'
    && await text('[data-ref=cart-total]') === '6 items in total');

  await page.click('#ptab-ref');
  await page.fill('#live-ref input', 'hello');
  await sameNode('#live-ref input');
  await page.click('#live-ref button:has-text("Render again")');
  check('patterns: a ref keeps pointing at the same input across renders, with its text',
    await text('#live-ref output') === '2 renders' && await stillSame('#live-ref input') && await page.inputValue('#live-ref input') === 'hello');
  await page.click('#live-ref button:has-text("Focus via ref")');
  check('patterns: ref.current.focus() focuses the rendered input', await page.evaluate(() => document.activeElement?.getAttribute('aria-label')) === 'Search');

  await page.click('#ptab-forward');
  const stepper = (label) => text(`#live-forward-ref .dm-stepper:has-text("${label}") output`);
  await page.click('#live-forward-ref .dm-stepper:has-text("Steps") button');
  await page.click('#live-forward-ref .dm-stepper:has-text("Steps") button');
  await page.click('#live-forward-ref .dm-stepper:has-text("On its own") button');
  check('patterns: forwardRef components count on their own', await stepper('Steps') === '2' && await stepper('On its own') === '1');
  await page.click('#live-forward-ref button:has-text("Reset Steps from the parent")');
  check('patterns: the parent resets the component through ref.state, the other one is untouched',
    await stepper('Steps') === '0' && await stepper('On its own') === '1');

  await page.click('#ptab-query');
  await sameNode('[data-ref=lang-list] li[key=ts]');
  await page.fill('[data-ref=lang-filter]', 'script');
  check('patterns: df$ references filter the server-rendered list; kept items are the same nodes',
    (await page.$$eval('[data-ref=lang-list] li', (els) => els.map((el) => el.textContent))).join() === 'TypeScript,JavaScript'
    && await text('[data-ref=lang-count]') === '2 of 5' && await stillSame('[data-ref=lang-list] li[key=ts]'));
  await page.fill('[data-ref=lang-filter]', '');
  check('patterns: clearing the filter restores every item', await text('[data-ref=lang-count]') === '5 of 5'
    && (await page.$$('[data-ref=lang-list] li')).length === 5 && await stillSame('[data-ref=lang-list] li[key=ts]'));

  // ---- integrations ---------------------------------------------------------------------------------------------------
  await page.click('#itab-query');
  await sameNode('[data-ref=tag-list] li:first-child');
  await page.fill('[data-ref=tag-form] input', 'store');
  await page.click('[data-ref=tag-form] button');
  await page.fill('[data-ref=tag-form] input', '<b>bold</b>');
  await page.click('[data-ref=tag-form] button');
  check('integrations: defuss-query .html() morphs the tags; the user\'s markup stays text',
    (await page.$$eval('[data-ref=tag-list] li', (els) => els.map((el) => el.textContent))).join() === 'morph,query,store,<b>bold</b>'
    && (await page.$$('[data-ref=tag-list] b')).length === 0 && await stillSame('[data-ref=tag-list] li:first-child')
    && await page.inputValue('[data-ref=tag-form] input') === '');

  await page.click('#itab-store');
  await page.click('[data-ref=visit]');
  await page.click('[data-ref=visit]');
  check('integrations: a computed defuss-store store does not re-render for an unrelated change',
    await text('[data-ref=visits]') === '2 visits' && await text('[data-ref=greeting]') === 'Hello, Ada (render 1)', await text('[data-ref=greeting]'));
  await page.click('[data-ref=rename]');
  check('integrations: it re-renders when its result changes', await text('[data-ref=greeting]') === 'Hello, Grace (render 2)', await text('[data-ref=greeting]'));

  await page.click('#itab-i18n');
  await page.fill('#live-i18n [aria-label="Delivery note"]', 'leave at the door');
  await sameNode('#live-i18n input');
  await page.click('#live-i18n [data-locale=de]');
  check('integrations: defuss-i18n switches to German in place and keeps the typed note',
    await text('#live-i18n h3') === 'Ihre Bestellung' && await stillSame('#live-i18n input')
    && await page.inputValue('#live-i18n input') === 'leave at the door' && await page.getAttribute('#live-i18n input', 'placeholder') === 'Lieferhinweis');
  await page.click('#live-i18n [data-locale=en]');
  check('integrations: and back to English', await text('#live-i18n h3') === 'Your order' && await page.getAttribute('#live-i18n input', 'placeholder') === 'Delivery note');

  await page.click('#itab-router');
  const frame = page.frameLocator('#in-router iframe');
  await frame.locator('main h2').waitFor();
  check('integrations: the routed frame starts on its home view', await frame.locator('main h2').textContent() === 'Projects');
  check('integrations: the frame shows its URL, the route after the #', await frame.locator('.address').textContent() === '/docs/router.html#/');
  await frame.locator('nav a:has-text("Project 7")').click();
  await frame.locator('main h2:has-text("Project 7")').waitFor();
  await frame.locator('main input').fill('ask about the budget');
  await frame.locator('main a:has-text("notes")').click();
  await frame.locator('main p:has-text("Showing notes")').waitFor();
  check('integrations: defuss-dom-router + morph: a tab switch keeps the note typed into the view',
    await frame.locator('main input').inputValue() === 'ask about the budget');
  check('integrations: the address shows the route with its query, the nav marks the current project',
    await frame.locator('.address').textContent() === '/docs/router.html#/projects/7?tab=notes'
    && await frame.locator('header nav a[aria-current=page]').textContent() === 'Project 7', await frame.locator('.address').textContent());
  await frame.locator('nav a:has-text("Project 8")').click();
  await frame.locator('main h2:has-text("Project 8")').waitFor();
  check('integrations: another record (another root key) starts with an empty note', await frame.locator('main input').inputValue() === '');
  await frame.locator('body').evaluate(() => history.back());
  await frame.locator('main h2:has-text("Project 7")').waitFor();
  check('integrations: Back returns to the previous route', (await frame.locator('main p').textContent()).includes('notes'));
  await frame.locator('body').evaluate(() => { location.hash = '#/projects/%3Cb%3Ex%3C%2Fb%3E'; });
  await frame.locator('main h2:has-text("Project <b>x</b>")').waitFor();
  check('integrations: a route param from the URL renders as text, never as markup', await frame.locator('main h2 b').count() === 0);

  // benchmark: one full run with HTML strings through the page, one quick run with VNodes through the frame's API
  // the recorded run (make bench) and the coverage rings (make coverage), written into the page
  const recorded = await page.evaluate(() => [...document.querySelectorAll('.dm-bench-recorded [role=tabpanel]')].map((panel) => ({
    id: panel.id,
    rows: [...panel.querySelectorAll('tr[data-op]')].map((tr) => [tr.dataset.op, ...[...tr.querySelectorAll('td')].map((td) => td.textContent)]),
  })));
  const NO_DIFF_RECORDED = ['replace', 'swap', 'remove', 'clear'];
  check('docs: the recorded run has a table per browser with a time in every cell, n/a where diff mode cannot express it',
    recorded.map((p) => p.id).join() === 'bench-panel-chromium,bench-panel-firefox,bench-panel-webkit' && recorded.every((p) => p.rows.length === 20
      && p.rows.every(([op, ...cells]) => cells.length === 4 && cells.every((c, i) => (i === 3 && NO_DIFF_RECORDED.includes(op) ? c === 'n/a' : /^\d+(\.\d)?$/.test(c))))),
    JSON.stringify(recorded.map((p) => [p.id, p.rows.length])));
  await page.locator('#bench-tab-webkit').scrollIntoViewIfNeeded();
  await page.click('#bench-tab-webkit');
  check('docs: the WebKit tab shows its recorded table', await page.isVisible('#bench-panel-webkit') && !(await page.isVisible('#bench-panel-chromium')));
  const rings = await page.$$eval('.dm-coverage .radial-progress', (els) => els.map((el) => Number(el.getAttribute('aria-valuenow'))));
  const testRuns = Number((await page.textContent('[data-fact=tests]')).replace(/,/g, ''));
  check('docs: the coverage rings show four percentages and the number of test runs', rings.length === 4 && rings.every((v) => v >= 60 && v <= 100) && testRuns > 1000,
    `${rings.join()} runs=${testRuns}`);
  const eyebrows = await page.evaluate(() => ({
    headers: document.querySelectorAll('.mk-section-header-copy, .mk-features-head').length,
    badges: document.querySelectorAll('.mk-section-header-copy > .badge.dm-eyebrow > svg use, .mk-features-head > .badge.dm-eyebrow > svg use').length,
    missingIcons: [...document.querySelectorAll('use[href^="#"]')].map((u) => u.getAttribute('href')).filter((href) => !document.querySelector(href)),
  }));
  const misaligned = await page.evaluate(() => [...document.querySelectorAll('.badge.dm-eyebrow')].flatMap((badge) => {
    const title = badge.parentElement.querySelector('h2');
    const [b, t] = [badge.getBoundingClientRect(), title.getBoundingClientRect()];
    const centred = getComputedStyle(title).textAlign === 'center';
    const off = centred ? Math.abs(b.left + b.width / 2 - (t.left + t.width / 2)) : Math.abs(b.left - t.left);
    return off > 2 ? [`${badge.textContent}: ${centred ? 'centre' : 'left edge'} off by ${off.toFixed(0)} px`] : [];
  }));
  check('docs: each section badge lines up with its title (centred over a centred title, else at its left edge)', misaligned.length === 0, misaligned.join('; '));
  check('docs: every section header starts with a badge with an icon, and every icon exists',
    eyebrows.headers > 5 && eyebrows.badges === eyebrows.headers && eyebrows.missingIcons.length === 0, JSON.stringify(eyebrows));

  await page.locator('#bench').scrollIntoViewIfNeeded();
  await page.click('[data-ref=bench-run]');
  await page.waitForFunction(() => /^(Done|Stopped)/.test(document.querySelector('[data-ref=bench-status]').value), null, { timeout: 180000 });
  const bench = await page.$$eval('[data-ref=bench-results] tr', (rows) => rows.map((tr) => [tr.dataset.op, ...[...tr.querySelectorAll('td')].map((td) => td.textContent)]));
  const NO_DIFF = ['replace', 'swap', 'remove', 'clear'];
  const opCount = await page.$eval('#bench iframe', (f) => f.contentWindow.bench.ops.length);
  const benchOk = opCount === 10 && bench.length === opCount && bench.every(([op, ...cells]) => cells.length === 4
    && cells.every((cell, i) => (i === 3 && NO_DIFF.includes(op) ? cell === 'n/a' : /^\d+(\.\d)?$/.test(cell))));
  check('benchmark: a run fills every cell with a time, n/a where diff mode cannot express the operation, no wrong table',
    benchOk && (await text('[data-ref=bench-status]')).startsWith('Done'), JSON.stringify(bench));
  const vnode = await page.$eval('#bench iframe', (f) => f.contentWindow.bench.run({ input: 'vnode', runs: 1, warmup: 0 }));
  check('benchmark: VNode input leaves the expected table after every operation', vnode.length === opCount * 4 && vnode.every((r) => r.ok),
    JSON.stringify(vnode.filter((r) => !r.ok)));

  // theme switch; syntax colors are measured in both schemes
  const dark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  checkSyntax(await syntax(page), dark ? 'dark' : 'light');
  await page.click('label.swap');
  check('docs: the theme switch toggles dark mode', await page.evaluate(() => document.documentElement.classList.contains('dark')) !== dark);
  const frameThemes = await page.$$eval('iframe', (frames) => frames.map((f) => f.contentDocument.documentElement.classList.contains('dark')));
  check('docs: the router and benchmark frames follow the theme switch', frameThemes.length === 2 && frameThemes.every((d) => d === !dark), JSON.stringify(frameThemes));
  checkSyntax(await syntax(page), dark ? 'light' : 'dark');
  await page.screenshot({ path: join(OUT, 'e2e-docs.png'), fullPage: true });

  // phone width: every tab label in full, no sideways scrolling
  await page.setViewportSize({ width: 375, height: 800 });
  const cut = await page.$$eval('.tab-trigger', (tabs) => tabs.filter((t) => t.scrollWidth > t.clientWidth).map((t) => t.textContent));
  check('docs: no tab label is cut at 375 px', cut.length === 0, cut.join(', '));
  check('docs: no horizontal scroll at 375 px', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  // the header at the widths around its breakpoints (menu up to 45rem, nav links, the npm button from 54rem)
  const crowded = [];
  for (const width of [375, 640, 664, 700, 740, 744, 800, 884, 888, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    if (await page.evaluate(() => { const inner = document.querySelector('.mk-header-inner'); return inner.scrollWidth > inner.clientWidth; })) crowded.push(width);
  }
  check('docs: the header fits from 375 to 1,440 px', crowded.length === 0, `overflows at ${crowded.join(', ')} px`);
  const npm = await page.evaluate(() => [...document.querySelectorAll('a[href="https://www.npmjs.com/package/defuss-morph"]')].map((a) => `${a.getClientRects().length > 0}:${a.textContent.replace(/\s+/g, ' ').trim()}`));
  check('docs: the header and the menu sheet link npm with the version', npm.length === 2 && npm[0] === `true:npm v${VERSION}` && npm[1].endsWith(`:npm v${VERSION}`), npm.join(' | '));
  await page.setViewportSize({ width: 1280, height: 900 });
  check('docs: no console errors or failed requests', problems.length === 0, problems.join('; '));
  await page.close();

  // ---- the built library in Chromium and Firefox: keyed reorders, moved with moveBefore and with insertBefore ---------
  const firefoxBrowser = await firefox.launch();
  try {
    for (const [engine, engineContext] of [['Chromium', context], ['Firefox', await firefoxBrowser.newContext()]]) {
      const lib = await open('/docs/bench.html', engineContext);
      check(`library (${engine}): the browser has moveBefore`, await lib.page.evaluate(() => typeof Element.prototype.moveBefore === 'function'));
      for (const moveBefore of [true, false]) {
        const matrix = await lib.page.evaluate(async (moveBefore) => {
          const [{ morph }, { reorderMatrix }] = await Promise.all([import('/docs/assets/defuss-morph.mjs'), import('/scripts/e2e/reorder-matrix.mjs')]);
          return reorderMatrix({ document, morph, moveBefore });
        }, moveBefore);
        for (const r of matrix) check(`library (${engine}): ${r.name}`, r.ok, r.detail);
      }
      const svg = await lib.page.evaluate(async () => {
        const { morph } = await import('/docs/assets/defuss-morph.mjs');
        const el = document.body.appendChild(document.createElement('div'));
        morph(el, '<svg viewBox="0 0 10 10"><defs><linearGradient id="e2e-g"><stop offset="0" stop-color="red"></stop></linearGradient><clipPath id="e2e-c"><rect width="5" height="5"></rect></clipPath></defs><rect width="10" height="10" fill="url(#e2e-g)" clip-path="url(#e2e-c)"></rect></svg>');
        const kinds = [...el.querySelectorAll('defs > *')].map((n) => n.constructor.name);
        el.remove();
        return kinds.join();
      });
      check(`library (${engine}): camelCase SVG elements from an HTML string are real SVG elements`, svg === 'SVGLinearGradientElement,SVGClipPathElement', svg);
      check(`library (${engine}): the reorders ran without errors`, lib.problems.length === 0, lib.problems.join('; '));
      await lib.page.close();
    }
  } finally {
    await firefoxBrowser.close();
  }

  // ---- examples: each page's own scenario, then every button once, without an error ---------------------------------
  const examples = readdirSync(join(ROOT, 'examples')).filter((f) => f.endsWith('.html')).sort();
  check('examples: every page has a scenario', examples.every((name) => EXAMPLE_SCENARIOS[name]), examples.filter((name) => !EXAMPLE_SCENARIOS[name]).join());
  for (const name of examples) {
    const scenario = await open(`/examples/${name}`);
    for (const [label, ok] of await EXAMPLE_SCENARIOS[name]?.(scenario.page) ?? []) check(`${name}: ${label}`, ok);
    check(`${name}: the scenario ran without errors`, scenario.problems.length === 0, scenario.problems.join('; '));
    await scenario.page.close();

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
