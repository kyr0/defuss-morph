// docs/demos/bench-stage.ts
import { morph as morph2 } from "defuss-morph";

// docs/demos/bench.ts
import { morph } from "defuss-morph";
var ADJECTIVES = ["pretty", "large", "big", "small", "tall", "short", "long", "handsome", "plain", "quaint", "clean", "elegant", "easy", "angry", "crazy", "helpful", "mushy", "odd", "unsightly", "adorable", "important", "inexpensive", "cheap", "expensive", "fancy"];
var COLOURS = ["red", "yellow", "blue", "green", "pink", "brown", "purple", "white", "black", "orange"];
var NOUNS = ["table", "chair", "house", "bbq", "desk", "car", "pony", "cookie", "sandwich", "burger", "pizza", "mouse", "keyboard"];
var build = (count, from = 1) => Array.from({ length: count }, (_, i) => {
  const id = from + i;
  return { id, label: `${ADJECTIVES[id * 7 % ADJECTIVES.length]} ${COLOURS[id * 3 % COLOURS.length]} ${NOUNS[id * 11 % NOUNS.length]}` };
});
var thousand = () => build(1000);
var RERENDERS = 500;
var smallViewSteps = (rows) => Array.from({ length: RERENDERS }, (_, step) => rows.map((row, i) => i === step % rows.length ? { ...row, label: `${row.label} ${step}` } : row));
var OPS = [
  { id: "create", label: "create 1,000 rows", before: () => [], after: () => thousand(), changes: (_, after) => after },
  { id: "replace", label: "replace all 1,000 rows", before: thousand, after: () => build(1000, 1001) },
  {
    id: "update",
    label: "update every 10th row",
    before: thousand,
    after: (rows) => rows.map((row, i) => i % 10 === 0 ? { ...row, label: `${row.label} !!!` } : row),
    changes: (_, after) => after.filter((_, i) => i % 10 === 0)
  },
  {
    id: "select",
    label: "select a row",
    before: thousand,
    after: (rows) => rows.map((row, i) => i === 499 ? { ...row, selected: true } : row),
    changes: (_, after) => [after[499]]
  },
  {
    id: "swap",
    label: "swap rows 2 and 999",
    before: thousand,
    after: (rows) => {
      const next = rows.slice();
      [next[1], next[998]] = [next[998], next[1]];
      return next;
    }
  },
  { id: "remove", label: "remove a row", before: thousand, after: (rows) => rows.filter((_, i) => i !== 499) },
  {
    id: "append",
    label: "append 1,000 rows",
    before: thousand,
    after: (rows) => [...rows, ...build(1000, 1001)],
    changes: (before, after) => after.slice(before.length)
  },
  { id: "clear", label: "clear 1,000 rows", before: thousand, after: () => [] },
  { id: "create-10k", label: "create 10,000 rows", before: () => [], after: () => build(1e4), changes: (_, after) => after, runs: 3 },
  {
    id: "rerender",
    label: `re-render 10 rows ${RERENDERS} times`,
    before: () => build(10),
    after: (rows) => smallViewSteps(rows).at(-1),
    steps: smallViewSteps,
    changes: (before, after) => after.filter((row, i) => row.label !== before[i].label)
  }
];
var rowHtml = (row, keyed) => `<tr${keyed ? ` key="${row.id}"` : ""}${row.selected ? ' class="selected"' : ""}><td>${row.id}</td><td><a>${row.label}</a></td><td><button type="button" aria-label="Remove">×</button></td></tr>`;
var rowVNode = (row, keyed) => ({
  type: "tr",
  attributes: { ...keyed ? { key: row.id } : {}, ...row.selected ? { class: "selected" } : {} },
  children: [
    { type: "td", attributes: {}, children: [String(row.id)] },
    { type: "td", attributes: {}, children: [{ type: "a", attributes: {}, children: [row.label] }] },
    { type: "td", attributes: {}, children: [{ type: "button", attributes: { type: "button", "aria-label": "Remove" }, children: ["×"] }] }
  ]
});
var markup = (rows, keyed, input) => input === "html" ? rows.map((row) => rowHtml(row, keyed)).join("") : rows.map((row) => rowVNode(row, keyed));
var METHODS = [
  {
    id: "innerHTML",
    label: "innerHTML",
    setup: (tbody, rows) => {
      tbody.innerHTML = markup(rows, false, "html");
    },
    prepare: (tbody, _op, _before, after) => {
      const html = markup(after, false, "html");
      return () => {
        tbody.innerHTML = html;
      };
    }
  },
  {
    id: "keyed",
    label: "morph, keyed",
    setup: (tbody, rows, input) => morph(tbody, markup(rows, true, input)),
    prepare: (tbody, _op, _before, after, input) => {
      const content = markup(after, true, input);
      return () => morph(tbody, content);
    }
  },
  {
    id: "non-keyed",
    label: "morph, non-keyed",
    setup: (tbody, rows, input) => morph(tbody, markup(rows, false, input)),
    prepare: (tbody, _op, _before, after, input) => {
      const content = markup(after, false, input);
      return () => morph(tbody, content);
    }
  },
  {
    id: "diff",
    label: "morph diff, keyed",
    setup: (tbody, rows, input) => morph(tbody, markup(rows, true, input)),
    prepare: (tbody, op, before, after, input) => {
      if (!op.changes)
        return null;
      const content = markup(op.changes(before, after), true, input);
      return () => morph(tbody, content, { diff: true });
    }
  }
];
var matches = (tbody, rows) => {
  const trs = tbody.children;
  if (trs.length !== rows.length)
    return false;
  for (let i = 0;i < rows.length; i++) {
    const tr = trs[i];
    const row = rows[i];
    if (tr.children[0]?.textContent !== String(row.id) || tr.children[1]?.textContent !== row.label)
      return false;
    if (tr.classList.contains("selected") !== Boolean(row.selected))
      return false;
  }
  return true;
};
var median = (values) => {
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
var tick = () => new Promise((resolve) => setTimeout(resolve, 0));
var run = async (tbody, options = {}) => {
  const { input = "html", runs = 7, warmup = 2, onResult } = options;
  const results = [];
  const total = OPS.length * METHODS.length;
  for (const op of OPS) {
    for (const method of METHODS) {
      const times = [];
      let ok = true;
      let supported = true;
      const count = Math.min(runs, op.runs ?? runs);
      for (let i = 0;i < warmup + count && supported; i++) {
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
        tbody.offsetHeight;
        const start = performance.now();
        for (const update of updates)
          update();
        tbody.offsetHeight;
        const time = performance.now() - start;
        if (i >= warmup)
          times.push(time);
        ok &&= matches(tbody, after);
        await tick();
      }
      const result = supported ? { op: op.id, method: method.id, median: median(times), min: Math.min(...times), max: Math.max(...times), ok } : { op: op.id, method: method.id, median: null, min: null, max: null, ok: true };
      results.push(result);
      onResult?.(result, results.length, total);
    }
  }
  return results;
};

// docs/demos/bench-stage.ts
var tbody = document.querySelector("[data-ref=rows]");
var busy = false;
morph2(tbody, markup(build(1000), true, "html"));
var api = {
  ops: OPS.map(({ id, label }) => ({ id, label })),
  methods: METHODS.map(({ id, label }) => ({ id, label })),
  run: async (options) => {
    if (busy)
      throw new Error("bench: a run is in progress");
    busy = true;
    try {
      return await run(tbody, options);
    } finally {
      busy = false;
    }
  }
};
window.bench = api;
