import { describe, expect, it } from "vitest";
import { type BenchReport, benchBlock, coverageBlock, formatMs, replaceBlock } from "./bench-page.ts";

const ops = [
  { id: "create", label: "create 1,000 rows" },
  { id: "swap", label: "swap rows 2 and 999" },
];
const methods = [
  { id: "innerHTML", label: "innerHTML" },
  { id: "keyed", label: "morph, keyed" },
  { id: "diff", label: "morph diff, keyed" },
];
const results = (scale: number) =>
  ops.flatMap((op) =>
    methods.map((m, i) => ({ op: op.id, method: m.id, median: op.id === "swap" && m.id === "diff" ? null : (i + 1) * scale, ok: true })),
  );
const report: BenchReport = {
  date: "2026-11-01T19:00:00.000Z",
  machine: "Apple M5 Max (darwin arm64)",
  version: "0.3.0",
  ops,
  methods,
  browsers: [
    { id: "chromium", name: "Chromium", version: "156.0.8078.4", inputs: { html: results(1.25), vnode: results(1.5) } },
    { id: "webkit", name: "WebKit", version: "27.2", inputs: { html: results(2), vnode: results(3) } },
  ],
};

describe("bench-page", () => {
  it("formats one decimal below 100 ms, whole numbers above and for whole-millisecond timers", () => {
    expect([formatMs(1.25), formatMs(12.04), formatMs(8), formatMs(123.6), formatMs(60, true)]).toEqual(["1.3", "12.0", "8.0", "124", "60"]);
  });

  it("keeps one decimal in a fine-timer table even for whole medians, and none in WebKit's", () => {
    const html = benchBlock(report);
    const chromium = html.slice(html.indexOf('id="bench-panel-chromium"'), html.indexOf('id="bench-panel-webkit"'));
    const webkit = html.slice(html.indexOf('id="bench-panel-webkit"'));
    expect(chromium).toContain('data-method="keyed">3.0</td>'); // 2 x 1.5, VNodes
    expect(webkit).toContain('data-method="keyed">4</td>');
  });

  it("renders one tab and panel per browser, the first selected, the others hidden", () => {
    const html = benchBlock(report);
    expect(html.match(/role="tab"/g)).toHaveLength(2);
    expect(html).toContain('id="bench-tab-chromium">Chromium<span class="dm-tab-version"> 156.0</span>');
    expect(html).toContain('aria-selected="true" aria-controls="bench-panel-chromium"');
    expect(html).toContain('id="bench-panel-webkit" aria-labelledby="bench-tab-webkit" tabindex="0" hidden>');
    expect(html).not.toContain('id="bench-panel-chromium" aria-labelledby="bench-tab-chromium" tabindex="0" hidden');
  });

  it("has a row per operation and input, n/a where a method cannot express it, the fastest in bold", () => {
    const html = benchBlock(report);
    expect(html.match(/data-op="/g)).toHaveLength(2 * 2 * 2); // ops x inputs x browsers
    expect(html).toContain('<tr class="table-row" data-op="create" data-input="html"><th class="table-cell" scope="row">create 1,000 rows</th><td class="table-cell" data-method="innerHTML"><span class="dm-bench-best">1.3</span></td><td class="table-cell" data-method="keyed">2.5</td>');
    expect(html).toContain('data-op="swap" data-input="vnode"');
    expect(html.match(/>n\/a</g)).toHaveLength(4);
    expect(html).toContain('scope="colgroup">JSX (VNodes)</th>');
  });

  it("states the date, machine, version and browsers in the note, and WebKit's coarse timer", () => {
    const html = benchBlock(report);
    expect(html).toContain("on 2026-11-01, Apple M5 Max (darwin arm64), against defuss-morph 0.3.0, in Chromium 156.0.8078.4 and WebKit 27.2");
    expect(html).toContain("WebKit counts whole milliseconds.");
    const firefox = { ...report.browsers[1], id: "firefox", name: "Firefox", version: "157.0" };
    expect(benchBlock({ ...report, browsers: [report.browsers[0], firefox, report.browsers[1]] })).toContain(
      "in Chromium 156.0.8078.4, Firefox 157.0 and WebKit 27.2 (Playwright, headless).",
    );
    expect(benchBlock({ ...report, browsers: [firefox, report.browsers[1]] })).toContain("Firefox and WebKit count whole milliseconds.");
  });

  it("refuses a report with a wrong or missing result, so a broken run never reaches the page", () => {
    const broken = structuredClone(report);
    broken.browsers[0].inputs.html[0].ok = false;
    expect(() => benchBlock(broken)).toThrow(/no correct result/);
    expect(() => benchBlock({ ...report, browsers: [] })).toThrow(/no browser/);
  });

  it("renders four coverage rings with levels and the number of test runs", () => {
    const html = coverageBlock({ total: { lines: { pct: 97.74 }, branches: { pct: 92.92 }, functions: { pct: 80 }, statements: { pct: 65.5 } } }, 1265);
    expect(html).toContain('data-level="high" aria-valuenow="97" aria-valuemin="0" aria-valuemax="100" aria-label="Lines coverage" style="--value: 97; --size: 6rem">97%</div>');
    expect(html).toContain('data-level="mid" aria-valuenow="80"');
    expect(html).toContain('data-level="low" aria-valuenow="65"');
    expect(html).toContain('<span data-fact="tests">1,265</span> test runs');
    expect(html).toContain('also runs every browser test in real Firefox');
    expect(() => coverageBlock({ total: { lines: { pct: 101 } } } as never, 1)).toThrow(/no lines coverage/);
  });

  it("replaces only what lies between a block's markers, and throws without them", () => {
    const page = "a\n    <!-- bench:start -->\nold\n    <!-- bench:end -->\nb";
    const once = replaceBlock(page, "bench", "new");
    expect(once).toBe("a\n    <!-- bench:start -->\nnew\n    <!-- bench:end -->\nb");
    expect(replaceBlock(once, "bench", "new")).toBe(once);
    expect(() => replaceBlock(page, "coverage", "x")).toThrow(/lacks <!-- coverage:start -->/);
  });
});
