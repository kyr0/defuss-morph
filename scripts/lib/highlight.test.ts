// @vitest-environment node
// The docs highlighter (scripts/lib/highlight.ts) with the real shiki.
import { highlightPage } from "./highlight.ts";

const block = (lang: string, lines: string) => `<pre data-lang="${lang}"><code>${lines}</code></pre>`;
const text = (html: string) => html.replace(/<[^>]+>/g, "");

describe("highlightPage", () => {
  it("colors each line, keeps line attributes and the source text, and is a no-op on its own output", async () => {
    const page = `<p>intro</p>${block("ts", `<span>const a = 1;</span><span></span><span data-highlight>morph(el, '&lt;p&gt;');</span>`)}`;
    const once = await highlightPage(page);
    expect(once.startsWith("<p>intro</p>")).toBe(true);
    expect(once).toMatch(/<span style="color:#[0-9A-F]{6}">const<\/span>/i);
    expect(once).toContain("<span></span>");
    expect(once).toMatch(/<span data-highlight><span style=/);
    expect(text(once)).toBe(text(page));
    expect(await highlightPage(once)).toBe(once);
  });

  it("keeps a bare < in code as text", async () => {
    const out = await highlightPage(block("ts", "<span>if (a < 3) go();</span>"));
    expect(out).toContain("&lt;");
    expect(out).not.toContain("< 3");
  });

  it("leaves code blocks without data-lang alone", async () => {
    const plain = `<pre><code><span>make build</span></code></pre>`;
    expect(await highlightPage(plain)).toBe(plain);
  });

  it("rejects an unknown language and markup other than line spans", async () => {
    await expect(highlightPage(block("cobol", "<span>x</span>"))).rejects.toThrow(/data-lang="cobol"/);
    await expect(highlightPage(block("ts", "<span><b>x</b></span>"))).rejects.toThrow(/unexpected <b>/);
  });
});
