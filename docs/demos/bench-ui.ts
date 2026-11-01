// The website's benchmark panel (index.html#benchmark): runs the benchmark in the bench.html frame and renders the
// results table with morph as they arrive. Not shown on the page; the methods' code is (bench.ts#methods).
import { morph } from "defuss-morph";
import { type BenchApi, type Input, METHODS, OPS, type Result } from "./bench";

// VERIFIED: without cross-origin isolation Chromium rounds performance.now() to 0.1 ms (every value in a probe run was a
// multiple of it), so one decimal at most
const ms = (value: number) => (value < 100 ? value.toFixed(1) : String(Math.round(value)));

const cell = (result: Result | undefined, best: boolean) => {
  if (!result) return "";
  if (result.median === null) return `<span class="dm-bench-na" title="Diff mode never removes or moves rows">n/a</span>`;
  if (!result.ok) return `<span class="dm-bench-wrong">wrong</span>`;
  const range = `${ms(result.min!)} to ${ms(result.max!)} ms`;
  return `<span title="${range}"${best ? ' class="dm-bench-best"' : ""}>${ms(result.median)}</span>`;
};

const rows = (results: Map<string, Result>) =>
  OPS.map((op) => {
    const measured = METHODS.map((method) => results.get(`${op.id}/${method.id}`)).filter((r) => r?.median != null && r.ok);
    const best = measured.length > 1 ? Math.min(...measured.map((r) => r!.median!)) : null;
    return `<tr class="table-row" key="${op.id}" data-op="${op.id}"><th class="table-cell" scope="row">${op.label}</th>${METHODS.map((method) => {
      const result = results.get(`${op.id}/${method.id}`);
      return `<td class="table-cell" data-method="${method.id}">${cell(result, best !== null && result?.median === best)}</td>`;
    }).join("")}</tr>`;
  }).join("");

/** The frame's benchmark, once the frame has loaded (its module has run by then). */
const stage = (frame: HTMLIFrameElement) =>
  new Promise<BenchApi>((resolve, reject) => {
    const take = () => {
      const bench = (frame.contentWindow as (Window & { bench?: BenchApi }) | null)?.bench;
      if (bench) resolve(bench);
      else reject(new Error("the benchmark frame has no benchmark"));
    };
    if (frame.contentDocument?.readyState === "complete" && frame.contentWindow?.location.href !== "about:blank") take();
    else frame.addEventListener("load", take, { once: true });
  });

export const mountBench = (root: HTMLElement) => {
  const body = root.querySelector<HTMLElement>("[data-ref=bench-results]")!;
  const status = root.querySelector<HTMLOutputElement>("[data-ref=bench-status]")!;
  const runButton = root.querySelector<HTMLButtonElement>("[data-ref=bench-run]")!;
  const toggles = [...root.querySelectorAll<HTMLButtonElement>("[data-input]")];
  const frame = root.querySelector<HTMLIFrameElement>("iframe")!;
  const results = new Map<string, Result>();

  morph(body, rows(results));

  runButton.addEventListener("click", async () => {
    const input = (toggles.find((t) => t.getAttribute("aria-pressed") === "true")?.dataset.input ?? "html") as Input;
    const inputName = input === "html" ? "HTML strings" : "VNodes";
    results.clear();
    morph(body, rows(results));
    runButton.disabled = true;
    for (const toggle of toggles) toggle.disabled = true;
    const started = performance.now();
    try {
      const bench = await stage(frame);
      await bench.run({
        input,
        onResult: (result, done, total) => {
          results.set(`${result.op}/${result.method}`, result);
          morph(body, rows(results));
          status.value = `Measuring with ${inputName}: ${done} of ${total}`;
        },
      });
      status.value = `Done in ${((performance.now() - started) / 1000).toFixed(1)} s with ${inputName}.`;
    } catch (error) {
      status.value = `Stopped: ${(error as Error).message}`;
    } finally {
      runButton.disabled = false;
      for (const toggle of toggles) toggle.disabled = false;
    }
  });
};
