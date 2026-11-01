// make coverage, second step: writes the unit test coverage (coverage/coverage-summary.json, from vitest's
// json-summary reporter) and the number of test runs (coverage/tests.json, vitest's json reporter) into the website
// (docs/index.html, between <!-- coverage:start --> and <!-- coverage:end -->). The same numbers give the same block,
// so a repeated run leaves the page as it is. VERIFIED: a second `make coverage` logged "unchanged" (2026-11-01).
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { coverageBlock, replaceBlock } from "./lib/bench-page.ts";

const ROOT = join(import.meta.dirname, "..");
const PAGE = join(ROOT, "docs", "index.html");
const read = (path: string) => JSON.parse(readFileSync(join(ROOT, path), "utf8"));

const summary = read("coverage/coverage-summary.json");
const tests = read("coverage/tests.json") as { numTotalTests: number; numFailedTests: number; success: boolean };
if (!tests.success || tests.numFailedTests > 0) throw new Error("coverage-page: the test run failed; docs/index.html left unchanged");

const before = readFileSync(PAGE, "utf8");
const after = replaceBlock(before, "coverage", coverageBlock(summary, tests.numTotalTests));
if (after !== before) writeFileSync(PAGE, after);
console.log(
  `${new Date().toISOString()} INFO coverage-page ${after === before ? "unchanged" : "wrote"} docs/index.html lines_pct=${summary.total.lines.pct} test_runs=${tests.numTotalTests}`,
);
