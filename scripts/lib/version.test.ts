import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Why: the website states the release in its hero badge and its footer, and a version bump touches package.json,
 * the plugin manifests and SKILL.md (skill.test.ts) but not the page. VERIFIED: the page still said 0.2.0 after
 * package.json moved to 0.3.0 (2026-11-01).
 */
const ROOT = join(import.meta.dirname, "..", "..");
const version = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version as string;
const page = readFileSync(join(ROOT, "docs/index.html"), "utf8");

describe("the website's release version", () => {
  it("is the package version in the hero badge and the footer note", () => {
    expect(/data-size="sm">v(\d+\.\d+\.\d+)<\/span>/.exec(page)?.[1]).toBe(version);
    expect(/class="mk-cta-note">MIT licensed · (\d+\.\d+\.\d+) ·/.exec(page)?.[1]).toBe(version);
  });
});
