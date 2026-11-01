// The landing page script. index.html loads defuss-shadcn (its own df$) from jsDelivr first; this module wires the page
// and runs the playground on the shipped library.
// VERIFIED: ./defuss-morph.mjs is dist/index.mjs byte for byte (scripts/check-dist.ts fails otherwise). It is the
// side-effect-free entry: the CDN bundle would extend defuss-shadcn's df$ with morph's API, which this page must not do.
import { morph } from './defuss-morph.mjs';

const $ = (id) => document.getElementById(id);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

// ---- theme ----------------------------------------------------------------------------------------------------------
const themeToggle = $('theme-toggle');
themeToggle.checked = document.documentElement.classList.contains('dark');
themeToggle.addEventListener('change', () => {
  const dark = themeToggle.checked;
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  try { localStorage.setItem('defuss-shadcn-theme', JSON.stringify(dark ? 'dark' : 'light')); } catch {}
});

// ---- in-page links: scroll to the layout offset, without a history entry per click -----------------------------------
document.addEventListener('click', (event) => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const anchor = event.target.closest('a[href^="#"]');
  let id = '';
  try { id = anchor ? decodeURIComponent(anchor.hash.slice(1)) : ''; } catch { return; }
  const target = id && document.getElementById(id);
  if (!target) return;
  event.preventDefault();
  // layout offsets, not scrollIntoView(): sections in their scroll-driven reveal are transformed, and the
  // transformed box would land the section off its margin
  let top = 0;
  for (let node = target; node; node = node.offsetParent) top += node.offsetTop;
  scrollTo({ top: top - parseFloat(getComputedStyle(target).scrollMarginTop || '0'), behavior: reducedMotion.matches ? 'auto' : 'smooth' });
  history.replaceState(history.state, '', anchor.hash);
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
});

// ---- copy buttons ---------------------------------------------------------------------------------------------------
async function copyText(text, status, label) {
  try {
    await navigator.clipboard.writeText(text);
    status.textContent = 'Copied';
  } catch {
    status.textContent = 'Copy failed';
  }
  if (!label) return;
  label.textContent = status.textContent;
  setTimeout(() => { label.textContent = 'Copy prompt'; }, 2000);
}
for (const button of document.querySelectorAll('.mk-code-block-copy')) {
  button.addEventListener('click', () => {
    const block = button.closest('.mk-code-block');
    const tab = block.querySelector('.mk-code-block-tabs input:checked')?.value;
    const pre = tab ? block.querySelector(`pre[data-tab="${tab}"]`) : block.querySelector('pre');
    const lines = [...pre.querySelectorAll('code > span')].map((line) => line.textContent);
    void copyText(lines.join('\n'), block.querySelector('.mk-code-block-status'));
  });
}
$('copy-prompt').addEventListener('click', () => void copyText(
  [...document.querySelectorAll('#agent-prompt pre:not([data-tone]) code')].map((code) => code.textContent).join('\n'),
  $('copy-prompt-status'), $('copy-prompt').querySelector('span')));

// ---- playground -----------------------------------------------------------------------------------------------------
// Each scenario renders `initial` with innerHTML (reset), then cycles through `states`. The same markup goes to
// morph() or to innerHTML, so the counters compare the two engines on identical input.
const job = (key, state) =>
  `<li key="${key}" data-state="${state}"><span class="dm-item-name">${key}</span><span class="badge" data-variant="${state === 'failed' ? 'destructive' : 'secondary'}">${state}</span></li>`;
const item = (key, label, extra = '') =>
  `  <li key="${key}"${extra}><input type="checkbox" class="checkbox" aria-label="${label} done"><span class="dm-item-name">${label}</span><input class="input" data-size="sm" placeholder="note" aria-label="${label} note"></li>`;
const form = (badge, nameLabel, newsLabel) => [
  '<form>',
  `  <p><span class="badge" data-variant="secondary">${badge}</span></p>`,
  `  <label class="label">${nameLabel} <input class="input" id="f-name" placeholder="Ada Lovelace"></label>`,
  `  <label class="label"><input type="checkbox" class="checkbox" id="f-news"> ${newsLabel}</label>`,
  '  <select class="select" id="f-plan" aria-label="Plan"><option>Free</option><option>Team</option><option>Enterprise</option></select>',
  '</form>',
].join('\n');
const card = (step, text) => `<div class="dm-card"><h4>Step ${step} of 3</h4><p>${text}</p></div>`;

const SCENARIOS = {
  list: {
    desc: 'Three items, each with a key. Write a note next to Milk and tick a box, then apply: the list is reordered, Bread is removed and Coffee is added. morph() moves Milk together with your note; innerHTML rebuilds every item and your note is gone.',
    initial: ['<ul>', item('milk', 'Milk'), item('bread', 'Bread'), item('eggs', 'Eggs'), '</ul>'].join('\n'),
    states: [
      ['<ul>', item('eggs', 'Eggs'), item('milk', 'Milk'), item('coffee', 'Coffee'), '</ul>'].join('\n'),
      ['<ul>', item('coffee', 'Coffee'), item('eggs', 'Eggs'), item('milk', 'Milk', ' class="dm-urgent"'), '</ul>'].join('\n'),
      ['<ul>', item('milk', 'Milk'), item('bread', 'Bread'), item('eggs', 'Eggs'), '</ul>'].join('\n'),
    ],
  },
  form: {
    desc: 'The labels and the status badge change with every state, the fields do not. Type a name, tick the box, pick a plan, then apply. The markup declares no value, so morph() leaves your input alone; innerHTML resets every field.',
    initial: form('Draft', 'Name', 'Send me the newsletter'),
    states: [
      form('Saved a moment ago', 'Full name', 'Send me the monthly newsletter'),
      form('Saved twice', 'Name on the invoice', 'Newsletter'),
      form('Draft', 'Name', 'Send me the newsletter'),
    ],
  },
  diff: {
    desc: 'A job list fed by change-sets, the way a stream or an AI agent sends updates. Each state names only the jobs that changed, by key, and morph() is called with { diff: true } on the list. innerHTML can only put the change-set in place of the whole list, so every job it does not name disappears.',
    target: (stage) => stage.querySelector('ul'),
    targetName: 'jobs',
    options: { diff: true },
    initial: ['<ul>', job('build', 'running'), job('test', 'queued'), job('deploy', 'queued'), '</ul>'].join('\n'),
    states: [
      [job('build', 'done'), job('test', 'running')].join('\n'),
      [job('test', 'failed'), job('retry', 'running')].join('\n'),
      [job('retry', 'done'), job('deploy', 'running')].join('\n'),
    ],
  },
  transition: {
    desc: 'A card swapped with an animation. morph() returns a Promise when a transition is set, and the counters cover the whole transition. Choose the type next to the engine switch.',
    transition: true,
    initial: card(1, 'Choose a transition type, then apply.'),
    states: [
      card(2, 'The old content animated out, the morph ran, the new content animated in.'),
      card(3, 'A morph issued during a transition wins: the transition ends on the latest content.'),
      card(1, 'Choose a transition type, then apply.'),
    ],
  },
};

const stage = $('stage');
const next = $('next-html');
const play = { scenario: 'list', engine: 'morph', step: 0, busy: false };

// The next state is a textarea over a painted copy with the same box metrics, the technique of defuss-shadcn's
// code-example: editing stays native (undo, selection, IME), the colors come from Shiki. docs/assets/shiki.js
// (the build's Shiki release and theme, 97 kB gzipped) loads when the playground comes near the viewport; until
// then, or if it fails to load, the text stays plain.
let highlight = null;
const escapeHtml = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const colored = (code, lang) => (highlight ? highlight(code, lang) : escapeHtml(code));
function paint() {
  // the trailing newline keeps the height of an empty last line, so the textarea above never outgrows its copy
  $('next-paint').innerHTML = `${colored(next.value, 'html')}\n`;
  $('call').innerHTML = colored(describeCall(), 'javascript');
}
new IntersectionObserver((entries, observer) => {
  if (!entries.some((entry) => entry.isIntersecting)) return;
  observer.disconnect();
  import('./shiki.js').then((module) => {
    highlight = module.highlight;
    $('next-editor').dataset.painted = '';
    paint();
  }, () => {});
}, { rootMargin: '600px' }).observe($('next-editor'));
next.addEventListener('input', paint);
const scenario = () => SCENARIOS[play.scenario];
const targetOf = (s) => (s.target ? s.target(stage) : stage);
const transitionOptions = () => ({ transition: { type: $('transition-type').value, duration: 350, target: 'self' } });

function describeCall() {
  const s = scenario();
  const target = s.targetName ?? 'stage';
  if (play.engine === 'innerHTML') return `${target}.innerHTML = nextState;`;
  if (s.transition) return `await morph(${target}, nextState, { transition: { type: '${$('transition-type').value}', duration: 350, target: 'self' } });`;
  if (s.options) return `morph(${target}, nextState, { diff: true });`;
  return `morph(${target}, nextState);`;
}

function render() {
  $('scenario-desc').textContent = scenario().desc;
  $('transition-field').hidden = !scenario().transition;
  next.value = scenario().states[play.step];
  paint();
}

function reset() {
  stage.innerHTML = scenario().initial;
  play.step = 0;
  for (const id of ['st-kept', 'st-created', 'st-removed', 'st-attrs', 'st-text']) {
    $(id).textContent = '0';
    delete $(id).dataset.tone;
  }
  $('verdict').textContent = 'Apply a state to see what changed.';
  render();
}

/** Form controls whose live state differs from their markup: what a user typed, ticked or chose. */
const editedControls = () => [...stage.querySelectorAll('input, select, textarea')].filter((el) =>
  (el.type === 'checkbox' ? el.checked !== el.defaultChecked
    : el.tagName === 'SELECT' ? [...el.options].some((o) => o.selected !== o.defaultSelected)
      : el.value !== el.defaultValue));
const controlState = (el) => (el.type === 'checkbox' ? el.checked : el.tagName === 'SELECT' ? el.selectedIndex : el.value);

async function apply() {
  if (play.busy) return;
  play.busy = true;
  $('apply').disabled = true;
  try {
    const s = scenario();
    const target = targetOf(s);
    const html = next.value;
    const before = new Set(stage.querySelectorAll('*'));
    const edited = editedControls().map((el) => [el, controlState(el)]);
    const focused = stage.contains(document.activeElement) ? document.activeElement : null;

    const observer = new MutationObserver(() => {});
    observer.observe(stage, { subtree: true, childList: true, attributes: true, characterData: true });
    if (play.engine === 'innerHTML') target.innerHTML = html;
    else await morph(target, html, s.transition ? transitionOptions() : s.options);
    // the transition animates the stage's own style attribute: that is the animation, not the morph
    const records = observer.takeRecords().filter((r) => !(r.target === stage && r.attributeName === 'style'));
    observer.disconnect();

    const after = new Set(stage.querySelectorAll('*'));
    const kept = [...after].filter((el) => before.has(el)).length;
    const created = [...after].filter((el) => !before.has(el));
    const removed = [...before].filter((el) => !after.has(el)).length;
    const show = (id, value, tone) => {
      $(id).textContent = String(value);
      if (tone) $(id).dataset.tone = tone; else delete $(id).dataset.tone;
    };
    show('st-kept', kept, kept ? 'good' : undefined);
    show('st-created', created.length);
    show('st-removed', removed);
    show('st-attrs', records.filter((r) => r.type === 'attributes').length);
    show('st-text', records.filter((r) => r.type === 'characterData').length);

    const survived = edited.filter(([el, state]) => el.isConnected && controlState(el) === state).length;
    const parts = [`<strong>${kept} of ${before.size}</strong> elements are the same nodes as before.`];
    if (edited.length) parts.push(`<strong>${survived} of ${edited.length}</strong> fields you changed kept your input.`);
    if (focused) parts.push(focused.isConnected && document.activeElement === focused ? 'The focused field still has focus.' : 'The focused field lost focus.');
    $('verdict').innerHTML = parts.join(' ');

    const ring = getComputedStyle(document.documentElement).getPropertyValue('--dm-good').trim();
    if (!reducedMotion.matches) {
      for (const el of created) el.animate([{ boxShadow: `0 0 0 2px ${ring}` }, { boxShadow: '0 0 0 2px transparent' }], { duration: 1200, easing: 'ease-out' });
    }

    play.step = (play.step + 1) % s.states.length;
    render();
  } finally {
    play.busy = false;
    $('apply').disabled = false;
  }
}

// The scenario switcher is a defuss-shadcn tablist: its script selects a tab on click and on arrow keys, so the
// page follows aria-selected instead of handling either. All four tabs control the one panel below them.
new MutationObserver(() => {
  const tab = $('scenarios').querySelector('[aria-selected="true"]');
  if (!tab || tab.dataset.scenario === play.scenario) return;
  play.scenario = tab.dataset.scenario;
  $('scenario-panel').setAttribute('aria-labelledby', tab.id);
  reset();
}).observe($('scenarios'), { subtree: true, attributeFilter: ['aria-selected'] });
// defuss-shadcn's toggle-group owns aria-pressed, and in single mode a click on the pressed toggle clears the group.
// An engine is always chosen, so the clicked one is pressed again; on the parent, this runs after the group's handler.
$('engines').parentElement.addEventListener('click', (event) => {
  const toggle = event.target.closest('#engines .toggle');
  if (!toggle) return;
  toggle.setAttribute('aria-pressed', 'true');
  play.engine = toggle.dataset.engine;
  paint();
});
$('transition-type').addEventListener('change', paint);
// a mouse click on Apply must not move focus out of the stage: keeping focus is one of the things being shown
$('apply').addEventListener('mousedown', (event) => event.preventDefault());
$('apply').addEventListener('click', () => void apply());
$('reset').addEventListener('click', reset);
reset();
