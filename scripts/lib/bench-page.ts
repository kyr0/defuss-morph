// The website's recorded numbers: the last `make bench` run (between <!-- bench:start --> and <!-- bench:end --> in
// docs/index.html) and the unit test coverage (between <!-- coverage:start --> and <!-- coverage:end -->). Pure
// renderers, tested without a browser; scripts/bench.mjs and scripts/coverage-page.ts write the blocks.
// Why recorded numbers next to the live benchmark: a reader sees typical figures without running anything, and the
// note states the machine, date and versions they belong to. VERIFIED: four runs on one machine differed by up to
// 28% in a cell (ARCH.md), so the figures describe that run only; the live benchmark measures the reader's machine.

export interface BenchResult {
  op: string;
  method: string;
  /** Median in ms; null when the method cannot express the operation. */
  median: number | null;
  ok: boolean;
}

export interface BenchBrowser {
  /** Playwright's name: chromium, webkit */
  id: string;
  name: string;
  version: string;
  inputs: { html: BenchResult[]; vnode: BenchResult[] };
}

export interface BenchReport {
  date: string;
  machine: string;
  /** The defuss-morph version measured. */
  version: string;
  ops: Array<{ id: string; label: string }>;
  methods: Array<{ id: string; label: string }>;
  browsers: BenchBrowser[];
}

const INPUTS = [
  ["html", "HTML strings"],
  ["vnode", "JSX (VNodes)"],
] as const;

const escape = (text: string) => text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

/** One decimal below 100 ms and whole numbers above; whole numbers throughout for a timer that counts whole milliseconds. */
export const formatMs = (ms: number, wholeMs = false) => (ms >= 100 || wholeMs ? String(Math.round(ms)) : ms.toFixed(1));

/** major.minor of a browser version: 156.0.8078.4 -> 156.0, 27.2 -> 27.2 */
const shortVersion = (version: string) => version.split(".").slice(0, 2).join(".");

const cell = (result: BenchResult | undefined, best: number | null, wholeMs: boolean) => {
  if (!result || !result.ok) throw new Error(`bench-page: no correct result for a cell (${result?.op}/${result?.method})`);
  if (result.median === null) return `<span class="dm-bench-na" title="Diff mode never removes or moves rows">n/a</span>`;
  const text = formatMs(result.median, wholeMs);
  return result.median === best ? `<span class="dm-bench-best">${text}</span>` : text;
};

/** True when every median of the browser is a whole number: its timer counts whole milliseconds (WebKit's does). */
const countsWholeMs = (browser: BenchBrowser) =>
  [...browser.inputs.html, ...browser.inputs.vnode].every((r) => r.median === null || Number.isInteger(r.median));

const panel = (report: BenchReport, browser: BenchBrowser, first: boolean) => {
  const wholeMs = countsWholeMs(browser);
  const head = report.methods.map((m) => `<th class="table-head" scope="col">${escape(m.label)}</th>`).join("");
  const groups = INPUTS.map(([input, label]) => {
    const rows = report.ops.map((op) => {
      const results = report.methods.map((m) => browser.inputs[input].find((r) => r.op === op.id && r.method === m.id));
      const times = results.flatMap((r) => (r?.median == null ? [] : [r.median]));
      const best = times.length > 1 ? Math.min(...times) : null;
      const cells = results.map((r, i) => `<td class="table-cell" data-method="${report.methods[i].id}">${cell(r, best, wholeMs)}</td>`).join("");
      return `              <tr class="table-row" data-op="${op.id}" data-input="${input}"><th class="table-cell" scope="row">${escape(op.label)}</th>${cells}</tr>`;
    });
    return [`              <tr class="table-row dm-group"><th class="table-cell" colspan="${report.methods.length + 1}" scope="colgroup">${label}</th></tr>`, ...rows].join("\n");
  }).join("\n");
  return `      <div class="tab-content" role="tabpanel" id="bench-panel-${browser.id}" aria-labelledby="bench-tab-${browser.id}" tabindex="0"${first ? "" : " hidden"}>
        <div class="table-container">
          <table class="table dm-table dm-bench-table">
            <thead><tr class="table-row"><th class="table-head" scope="col">Operation</th>${head}</tr></thead>
            <tbody>
${groups}
            </tbody>
          </table>
        </div>
      </div>`;
};

const list = (items: string[]) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`);

/** The tabs (one per browser) with the medians of every operation, method and input, and the note on the run. */
export const benchBlock = (report: BenchReport): string => {
  if (report.browsers.length === 0) throw new Error("bench-page: the report has no browser");
  const tabs = report.browsers
    .map((b, i) => `        <button class="tab-trigger" role="tab" aria-selected="${i === 0}" aria-controls="bench-panel-${b.id}" id="bench-tab-${b.id}"${i === 0 ? "" : ' tabindex="-1"'}>${escape(b.name)}<span class="dm-tab-version"> ${escape(shortVersion(b.version))}</span></button>`)
    .join("\n");
  const coarse = report.browsers.filter(countsWholeMs).map((b) => b.name);
  const browsers = list(report.browsers.map((b) => `${escape(b.name)} ${escape(b.version)}`));
  return `    <div class="tabs dm-api dm-bench-recorded">
      <div class="tab-list" role="tablist" aria-label="Browser">
${tabs}
      </div>
${report.browsers.map((b, i) => panel(report, b, i === 0)).join("\n")}
    </div>
    <p class="dm-figcaption">Measured with <code>make bench</code> on ${escape(report.date.slice(0, 10))}, ${escape(report.machine)}, against defuss-morph ${escape(report.version)}, in ${browsers} (Playwright, headless). Each time is the median of 7 runs in ms (3 for 10,000 rows), after 2 untimed ones, of the update and the layout it causes; the fastest of each row in bold.${coarse.length ? ` ${list(coarse)} count${coarse.length === 1 ? "s" : ""} whole milliseconds.` : ""} The figures differ by machine and from run to run; the benchmark below measures yours.</p>`;
};

export interface CoverageSummary {
  total: Record<"lines" | "branches" | "functions" | "statements", { pct: number }>;
}

const KINDS = [
  ["lines", "Lines"],
  ["branches", "Branches"],
  ["functions", "Functions"],
  ["statements", "Statements"],
] as const;

/** high from 90 %, mid from 70 %, below that low: the ring's colour */
const level = (pct: number) => (pct >= 90 ? "high" : pct >= 70 ? "mid" : "low");

/** Four rings (lines, branches, functions, statements) and the note on the test runs they come from. */
export const coverageBlock = (summary: CoverageSummary, testRuns: number): string => {
  const rings = KINDS.map(([kind, label]) => {
    const pct = summary.total[kind].pct;
    if (typeof pct !== "number" || pct < 0 || pct > 100) throw new Error(`bench-page: no ${kind} coverage in the summary`);
    // rounded down: the ring shows whole percentages, and rounding up would claim coverage that is not there
    const value = String(Math.floor(pct));
    return `        <div class="mk-stat"><div class="radial-progress" role="progressbar" data-tone="auto" data-level="${level(pct)}" aria-valuenow="${value}" aria-valuemin="0" aria-valuemax="100" aria-label="${label} coverage" style="--value: ${value}; --size: 6rem">${value}%</div><span class="mk-stat-label">${label}</span></div>`;
  }).join("\n");
  return `    <div class="mk-stats dm-coverage" style="width:100%">
      <div class="mk-stats-rings">
${rings}
      </div>
    </div>
    <p class="dm-figcaption">V8 measures the coverage of <code>src/</code> in <span data-fact="tests">${testRuns.toLocaleString("en-US")}</span> test runs, every test file in real Chromium and all but the browser-only ones in happy-dom, and merges both (<code>make coverage</code>). <code>make test</code> also runs every browser test in real Firefox, where V8 cannot measure.</p>`;
};

/** `html` with the block between `<!-- name:start -->` and `<!-- name:end -->` replaced; throws without both markers. */
export const replaceBlock = (html: string, name: string, block: string): string => {
  const start = `<!-- ${name}:start -->`;
  const end = `<!-- ${name}:end -->`;
  const from = html.indexOf(start);
  const to = html.indexOf(end);
  if (from < 0 || to < from) throw new Error(`bench-page: docs/index.html lacks ${start} … ${end}`);
  return `${html.slice(0, from + start.length)}\n${block}\n    ${html.slice(to)}`;
};
