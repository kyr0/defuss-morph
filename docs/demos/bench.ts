// The benchmark: typical operations on a table of rows, after js-framework-benchmark, each timed with every way of
// updating the table. It runs inside docs/bench.html (bench-stage.ts puts it on `window.bench`), which the website
// embeds and drives (bench-ui.ts) and `make bench` opens in headless Chromium, Firefox and WebKit (scripts/bench.mjs). The frame keeps the
// table's style and layout work apart from the website's own large page. VERIFIED: scripts/e2e/browser.mjs runs it
// with HTML strings and with VNodes and checks the table after every run.
import { type VNode, morph } from "defuss-morph";

export interface Row {
  id: number;
  label: string;
  selected?: boolean;
}

/** The markup the methods render: an HTML string, or the VNodes JSX compiles to. */
export type Input = "html" | "vnode";

export interface Op {
  id: string;
  label: string;
  /** The table before the operation; rendered untimed, the same way the method renders. */
  before: () => Row[];
  /** The table after it. */
  after: (rows: Row[]) => Row[];
  /** The rows diff mode sends. Absent: diff mode cannot express the operation (it never removes and never moves). */
  changes?: (before: Row[], after: Row[]) => Row[];
  /** Timed runs (median of these); fewer for the large ones. */
  runs?: number;
  /**
   * The states one timed run morphs through, one morph each, the last one `after`. Absent: the single state `after`.
   * A small view re-rendered over and over is the work of a reactive() region.
   */
  steps?: (before: Row[]) => Row[][];
}

const ADJECTIVES = ["pretty", "large", "big", "small", "tall", "short", "long", "handsome", "plain", "quaint", "clean", "elegant", "easy", "angry", "crazy", "helpful", "mushy", "odd", "unsightly", "adorable", "important", "inexpensive", "cheap", "expensive", "fancy"];
const COLOURS = ["red", "yellow", "blue", "green", "pink", "brown", "purple", "white", "black", "orange"];
const NOUNS = ["table", "chair", "house", "bbq", "desk", "car", "pony", "cookie", "sandwich", "burger", "pizza", "mouse", "keyboard"];

/** `count` rows with ids from `from`; the labels depend only on the ids, so every method gets the same work. */
export const build = (count: number, from = 1): Row[] =>
  Array.from({ length: count }, (_, i) => {
    const id = from + i;
    return { id, label: `${ADJECTIVES[(id * 7) % ADJECTIVES.length]} ${COLOURS[(id * 3) % COLOURS.length]} ${NOUNS[(id * 11) % NOUNS.length]}` };
  });

const thousand = () => build(1000);

/** 500 states of a 10-row view; each changes the label of one row, as a store update would. */
const RERENDERS = 500;
const smallViewSteps = (rows: Row[]) =>
  Array.from({ length: RERENDERS }, (_, step) => rows.map((row, i) => (i === step % rows.length ? { ...row, label: `${row.label} ${step}` } : row)));

export const OPS: readonly Op[] = [
  { id: "create", label: "create 1,000 rows", before: () => [], after: () => thousand(), changes: (_, after) => after },
  { id: "replace", label: "replace all 1,000 rows", before: thousand, after: () => build(1000, 1001) },
  {
    id: "update",
    label: "update every 10th row",
    before: thousand,
    after: (rows) => rows.map((row, i) => (i % 10 === 0 ? { ...row, label: `${row.label} !!!` } : row)),
    changes: (_, after) => after.filter((_, i) => i % 10 === 0),
  },
  {
    id: "select",
    label: "select a row",
    before: thousand,
    after: (rows) => rows.map((row, i) => (i === 499 ? { ...row, selected: true } : row)),
    changes: (_, after) => [after[499]],
  },
  {
    id: "swap",
    label: "swap rows 2 and 999",
    before: thousand,
    after: (rows) => {
      const next = rows.slice();
      [next[1], next[998]] = [next[998], next[1]];
      return next;
    },
  },
  { id: "remove", label: "remove a row", before: thousand, after: (rows) => rows.filter((_, i) => i !== 499) },
  {
    id: "append",
    label: "append 1,000 rows",
    before: thousand,
    after: (rows) => [...rows, ...build(1000, 1001)],
    changes: (before, after) => after.slice(before.length),
  },
  { id: "clear", label: "clear 1,000 rows", before: thousand, after: () => [] },
  { id: "create-10k", label: "create 10,000 rows", before: () => [], after: () => build(10000), changes: (_, after) => after, runs: 3 },
  {
    id: "rerender",
    label: `re-render 10 rows ${RERENDERS} times`,
    before: () => build(10),
    after: (rows) => smallViewSteps(rows).at(-1)!,
    steps: smallViewSteps,
    changes: (before, after) => after.filter((row, i) => row.label !== before[i].label),
  },
];

// #region methods
const rowHtml = (row: Row, keyed: boolean) =>
  `<tr${keyed ? ` key="${row.id}"` : ""}${row.selected ? ' class="selected"' : ""}><td>${row.id}</td><td><a>${row.label}</a></td><td><button type="button" aria-label="Remove">×</button></td></tr>`;

const rowVNode = (row: Row, keyed: boolean): VNode => ({
  type: "tr",
  attributes: { ...(keyed ? { key: row.id } : {}), ...(row.selected ? { class: "selected" } : {}) },
  children: [
    { type: "td", attributes: {}, children: [String(row.id)] },
    { type: "td", attributes: {}, children: [{ type: "a", attributes: {}, children: [row.label] }] },
    { type: "td", attributes: {}, children: [{ type: "button", attributes: { type: "button", "aria-label": "Remove" }, children: ["×"] }] },
  ],
});

export const markup = (rows: Row[], keyed: boolean, input: Input) =>
  input === "html" ? rows.map((row) => rowHtml(row, keyed)).join("") : rows.map((row) => rowVNode(row, keyed));

export interface Method {
  id: string;
  label: string;
  /** Renders `rows` into the empty `tbody` the way this method keeps it; untimed. */
  setup: (tbody: HTMLElement, rows: Row[], input: Input) => void;
  /** The timed update from `before` to `after`, its input built in advance; `null` if the method cannot express it. */
  prepare: (tbody: HTMLElement, op: Op, before: Row[], after: Row[], input: Input) => (() => void) | null;
}

export const METHODS: readonly Method[] = [
  {
    // the baseline: rebuild every row from an HTML string (loses focus, typed input and listeners)
    id: "innerHTML",
    label: "innerHTML",
    setup: (tbody, rows) => {
      tbody.innerHTML = markup(rows, false, "html") as string;
    },
    prepare: (tbody, _op, _before, after) => {
      const html = markup(after, false, "html") as string;
      return () => {
        tbody.innerHTML = html;
      };
    },
  },
  {
    // the whole list, every row with a key: rows are matched by key and moved
    id: "keyed",
    label: "morph, keyed",
    setup: (tbody, rows, input) => morph(tbody, markup(rows, true, input)),
    prepare: (tbody, _op, _before, after, input) => {
      const content = markup(after, true, input);
      return () => morph(tbody, content);
    },
  },
  {
    // the whole list without keys: rows are matched by position and patched
    id: "non-keyed",
    label: "morph, non-keyed",
    setup: (tbody, rows, input) => morph(tbody, markup(rows, false, input)),
    prepare: (tbody, _op, _before, after, input) => {
      const content = markup(after, false, input);
      return () => morph(tbody, content);
    },
  },
  {
    // only the changed rows, by key: diff mode patches them and appends new ones
    id: "diff",
    label: "morph diff, keyed",
    setup: (tbody, rows, input) => morph(tbody, markup(rows, true, input)),
    prepare: (tbody, op, before, after, input) => {
      if (!op.changes) return null;
      const content = markup(op.changes(before, after), true, input);
      return () => morph(tbody, content, { diff: true });
    },
  },
];
// #endregion methods

export interface Result {
  op: string;
  method: string;
  /** Median of the timed runs in ms; `null` when the method cannot express the operation. */
  median: number | null;
  min: number | null;
  max: number | null;
  /** False when a run left the table different from the expected rows. */
  ok: boolean;
}

export interface RunOptions {
  input?: Input;
  /** Timed runs per operation and method (default 7; an operation's own `runs` caps it). */
  runs?: number;
  /** Untimed runs first, to let the JIT settle (default 2). */
  warmup?: number;
  onResult?: (result: Result, done: number, total: number) => void;
}

/** True when `tbody` holds exactly `rows`: ids, labels and the selected class. */
const matches = (tbody: HTMLElement, rows: Row[]) => {
  const trs = tbody.children;
  if (trs.length !== rows.length) return false;
  for (let i = 0; i < rows.length; i++) {
    const tr = trs[i];
    const row = rows[i];
    if (tr.children[0]?.textContent !== String(row.id) || tr.children[1]?.textContent !== row.label) return false;
    if (tr.classList.contains("selected") !== Boolean(row.selected)) return false;
  }
  return true;
};

const median = (values: number[]) => {
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * Times every operation with every method, operation by operation, so a slower phase of the machine hits all methods
 * alike. One run: empty the table, render `before` with the method (untimed), build the method's input for every state
 * (untimed), then time the updates plus the layout they cause, and check the table against `after`. The last run's
 * table stays.
 */
export const run = async (tbody: HTMLElement, options: RunOptions = {}): Promise<Result[]> => {
  const { input = "html", runs = 7, warmup = 2, onResult } = options;
  const results: Result[] = [];
  const total = OPS.length * METHODS.length;
  for (const op of OPS) {
    for (const method of METHODS) {
      const times: number[] = [];
      let ok = true;
      let supported = true;
      const count = Math.min(runs, op.runs ?? runs);
      for (let i = 0; i < warmup + count && supported; i++) {
        tbody.textContent = "";
        const before = op.before();
        const after = op.after(before);
        method.setup(tbody, before, input);
        const states = op.steps?.(before) ?? [after];
        const updates = states.map((state, s) => method.prepare(tbody, op, s === 0 ? before : states[s - 1], state, input));
        if (updates.includes(null)) {
          supported = false;
          break;
        }
        void tbody.offsetHeight;
        const start = performance.now();
        for (const update of updates) update!();
        void tbody.offsetHeight; // the layout the update caused belongs to its cost
        const time = performance.now() - start;
        if (i >= warmup) times.push(time);
        ok &&= matches(tbody, after);
        await tick();
      }
      const result: Result = supported
        ? { op: op.id, method: method.id, median: median(times), min: Math.min(...times), max: Math.max(...times), ok }
        : { op: op.id, method: method.id, median: null, min: null, max: null, ok: true };
      results.push(result);
      onResult?.(result, results.length, total);
    }
  }
  return results;
};

/** What docs/bench.html puts on `window.bench`, for the website and for `make bench`. */
export interface BenchApi {
  ops: readonly Pick<Op, "id" | "label">[];
  methods: readonly Pick<Method, "id" | "label">[];
  run: (options?: RunOptions) => Promise<Result[]>;
}
