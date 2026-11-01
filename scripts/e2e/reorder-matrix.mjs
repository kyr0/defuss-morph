// Keyed reorders end to end: the everyday list operations morphed with the published package, from HTML strings and
// from VNodes, each checked for the row order, the reused nodes, typed values, focus with its selection, listeners
// and the removed rows, and that only the rows out of order moved. `make e2e` runs it in the clean consumer (happy-dom: no moveBefore, so insertBefore moves) and
// in Chromium on the built bundle (browser.mjs), with moveBefore and without it. VERIFIED: the move check
// counts what Chromium's moveBefore() reports too; the unit move counts it mirrors failed against the earlier placement (2026-11-01).

const ROWS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** The operations of js-framework-benchmark and the other everyday edits: the row ids after, from ROWS. */
export const OPS = [
  ['unchanged', ROWS],
  ['swap rows 2 and 9', [1, 9, 3, 4, 5, 6, 7, 8, 2, 10]],
  ['swap neighbours', [2, 1, 3, 4, 5, 6, 7, 8, 9, 10]],
  ['reverse', [...ROWS].reverse()],
  ['first to last', [2, 3, 4, 5, 6, 7, 8, 9, 10, 1]],
  ['last to first', [10, 1, 2, 3, 4, 5, 6, 7, 8, 9]],
  ['move 3 behind 8', [1, 2, 4, 5, 6, 7, 8, 3, 9, 10]],
  ['insert at the front', [11, ...ROWS]],
  ['insert in the middle', [1, 2, 3, 4, 5, 11, 6, 7, 8, 9, 10]],
  ['remove the first', ROWS.slice(1)],
  ['remove the middle', [1, 2, 3, 4, 6, 7, 8, 9, 10]],
  ['remove the last', ROWS.slice(0, -1)],
  ['remove two, insert one elsewhere', [1, 3, 4, 11, 5, 6, 7, 9, 10]],
  ['interleave new rows', [1, 11, 2, 12, 3, 13, 4, 5, 6, 7, 8, 9, 10]],
  ['shuffle', [7, 3, 10, 1, 9, 2, 5, 8, 4, 6]],
  ['shuffle, remove and insert', [12, 7, 3, 11, 1, 9, 5, 8, 4]],
  ['replace all', [11, 12, 13, 14, 15, 16, 17, 18, 19, 20]],
  ['append five', [...ROWS, 11, 12, 13, 14, 15]],
  ['clear', []],
];

const rowHtml = (id, text) => `<li key="r${id}" data-id="${id}"><input aria-label="note ${id}"><button type="button">${text}</button></li>`;
const rowVNode = (id, text) => ({
  type: 'li',
  attributes: { key: `r${id}`, 'data-id': String(id) },
  children: [
    { type: 'input', attributes: { 'aria-label': `note ${id}` }, children: [] },
    { type: 'button', attributes: { type: 'button' }, children: [text] },
  ],
});
const list = (ids, input, suffix = '') =>
  input === 'html'
    ? `<ul>${ids.map((id) => rowHtml(id, `row ${id}${suffix}`)).join('')}</ul>`
    : [{ type: 'ul', attributes: {}, children: ids.map((id) => rowVNode(id, `row ${id}${suffix}`)) }];

/** The kept rows that must move: all but a longest run already in order (quadratic, independent of morph). */
const minimalMoves = (after) => {
  const old = after.filter((id) => ROWS.includes(id)).map((id) => id - 1);
  const best = old.map(() => 1);
  for (let i = 0; i < old.length; i++) for (let j = 0; j < i; j++) if (old[j] < old[i]) best[i] = Math.max(best[i], best[j] + 1);
  return old.length - Math.max(0, ...best);
};

/** Every operation once: the first mismatch per operation, or nothing. */
const runOp = (document, morph, input, moveBefore, after) => {
  const el = document.createElement('div');
  document.body.appendChild(el);
  try {
    morph(el, list(ROWS, input));
    const ul = el.querySelector('ul');
    if (!moveBefore) Object.defineProperty(ul, 'moveBefore', { value: undefined, configurable: true });
    const rows = new Map([...ul.children].map((li) => [Number(li.dataset.id), li]));
    const clicks = new Map();
    for (const [id, li] of rows) {
      li.querySelector('input').value = `typed ${id}`;
      li.querySelector('button').addEventListener('click', () => clicks.set(id, (clicks.get(id) ?? 0) + 1));
    }
    // focus the kept row the operation moves furthest (row id - 1 is its index before)
    const distance = (id) => Math.abs(after.indexOf(id) - (id - 1));
    const focusId = after.filter((id) => rows.has(id)).sort((a, b) => distance(b) - distance(a))[0];
    const focused = focusId === undefined ? null : rows.get(focusId).querySelector('input');
    focused?.focus();
    focused?.setSelectionRange(2, 5, 'backward');

    // moves: children before the morph that were inserted again (moveBefore reports its moves the same way)
    const observer = new document.defaultView.MutationObserver(() => {});
    observer.observe(ul, { childList: true });
    morph(el, list(after, input, '!'));
    const moved = observer.takeRecords().flatMap((r) => [...r.addedNodes]).filter((node) => [...rows.values()].includes(node)).length;
    observer.disconnect();

    const now = [...ul.children];
    const ids = now.map((li) => Number(li.dataset.id));
    if (ids.join() !== after.join()) return `order ${ids.join()}`;
    for (const li of now) {
      const id = Number(li.dataset.id);
      if (li.querySelector('button').textContent !== `row ${id}!`) return `row ${id} not patched`;
      if (!rows.has(id)) continue;
      if (li !== rows.get(id)) return `row ${id} is a new node`;
      if (li.querySelector('input').value !== `typed ${id}`) return `row ${id} lost its typed value`;
      li.querySelector('button').click();
      if (clicks.get(id) !== 1) return `row ${id} listener fired ${clicks.get(id) ?? 0} times`;
    }
    for (const [id, li] of rows) if (!after.includes(id) && li.isConnected) return `removed row ${id} still connected`;
    if (moved !== minimalMoves(after)) return `moved ${moved} rows, ${minimalMoves(after)} are out of order`;
    if (focused) {
      const state = [focused.selectionStart, focused.selectionEnd, focused.selectionDirection].join();
      if (document.activeElement !== focused) return `row ${focusId} lost focus`;
      if (state !== '2,5,backward') return `row ${focusId} selection ${state}`;
    }
    return '';
  } finally {
    el.remove();
  }
};

/** Runs every operation with both inputs; one result per input: the operations that failed, with why. */
export const reorderMatrix = ({ document, morph, moveBefore }) =>
  ['html', 'vnode'].map((input) => {
    const failed = OPS.map(([name, after]) => [name, runOp(document, morph, input, moveBefore, after)]).filter(([, why]) => why);
    return {
      name: `keyed reorders: ${OPS.length} operations keep the order, nodes, typed values, focus and listeners and move only the rows out of order (${input}, ${moveBefore ? 'moveBefore' : 'insertBefore'})`,
      ok: failed.length === 0,
      detail: failed.map(([name, why]) => `${name}: ${why}`).join('; '),
    };
  });
