// The entry of docs/bench.html: puts the benchmark (bench.ts) on `window.bench` for the page that embeds the frame
// (bench-ui.ts) and for `make bench` (scripts/bench.mjs). Module scripts run before the load event, so `bench` is
// there once the frame has loaded. VERIFIED: bench-ui.ts and scripts/bench.mjs read it after the load event (e2e, make bench).
import { morph } from "defuss-morph";
import { type BenchApi, METHODS, OPS, build, markup, run } from "./bench";

const tbody = document.querySelector<HTMLElement>("[data-ref=rows]")!;
let busy = false;

// something to look at before the first run
morph(tbody, markup(build(1000), true, "html"));

const api: BenchApi = {
  ops: OPS.map(({ id, label }) => ({ id, label })),
  methods: METHODS.map(({ id, label }) => ({ id, label })),
  run: async (options) => {
    if (busy) throw new Error("bench: a run is in progress");
    busy = true;
    try {
      return await run(tbody, options);
    } finally {
      busy = false;
    }
  },
};

(window as unknown as { bench: BenchApi }).bench = api;
