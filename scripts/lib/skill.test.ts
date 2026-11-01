import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as api from "../../src/index.ts";

/**
 * Why: the Agent Skill in skills/defuss-morph/ is what a coding agent reads instead of the source, so it must not
 * name an export that does not exist or describe another release. The plugin manifests (Claude Code, Codex, the
 * agent-plugins file) carry the version an agent installs.
 */
const ROOT = join(import.meta.dirname, "..", "..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");
const version = JSON.parse(read("package.json")).version as string;
const SKILL = "skills/defuss-morph";
const pages = ["SKILL.md", ...readdirSync(join(ROOT, SKILL, "references")).map((file) => `references/${file}`)];

describe("skills/defuss-morph", () => {
  it("SKILL.md has the front matter agents load it by", () => {
    const front = /^---\nname: ([\w-]+)\ndescription: (.+)\n---\n/.exec(read(`${SKILL}/SKILL.md`));
    expect(front?.[1]).toBe("defuss-morph");
    expect(front?.[2].length).toBeLessThanOrEqual(1024);
    expect(read(`${SKILL}/SKILL.md`)).toContain(`# defuss-morph ${version}`);
  });

  it("every plugin manifest carries the package version and points at skills/", () => {
    for (const path of [".claude-plugin/plugin.json", ".codex-plugin/plugin.json", "plugin.json"]) {
      const manifest = JSON.parse(read(path));
      expect(manifest.version, path).toBe(version);
      expect(manifest.skills, path).toBe("./skills/");
    }
    expect(JSON.parse(read(".claude-plugin/marketplace.json")).plugins[0].name).toBe("defuss-morph");
    expect(JSON.parse(read("package.json")).files).toContain("skills");
  });

  it("every name the skill imports from defuss-morph is an export", () => {
    const missing: string[] = [];
    for (const page of pages) {
      const text = read(`${SKILL}/${page}`);
      for (const [, names] of text.matchAll(/import\s*\{([^}]*)\}\s*from\s*["']defuss-morph["']/g)) {
        for (const name of names.split(",").map((part) => part.replace(/^\s*type\s+/, "").trim()).filter(Boolean)) {
          if (!(name in api) && !["Ref", "RefLike", "VNode", "RenderInput", "ReactiveConfig", "Component", "JSX"].includes(name)) {
            missing.push(`${page}: ${name}`);
          }
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("links between the skill's pages resolve", () => {
    const files = new Set(pages);
    for (const page of pages) {
      const base = page.includes("/") ? "references/" : "";
      for (const [, target] of read(`${SKILL}/${page}`).matchAll(/\]\(((?:references\/)?[\w-]+\.md)\)/g)) {
        const resolved = target.startsWith("references/") ? target : `${base}${target}`;
        expect(files.has(resolved), `${page} → ${target}`).toBe(true);
      }
    }
  });
});
