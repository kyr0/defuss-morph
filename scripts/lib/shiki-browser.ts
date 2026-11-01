/**
 * Why: the website's playground lets visitors edit HTML, and edited code can
 * only be colored in the browser. This entry is bundled by `make build`
 * (scripts/docs.ts) into docs/assets/shiki.js: the same Shiki release, theme
 * and colors as the build-time highlighting of the static examples
 * (highlight.ts), served from the site itself, so the page needs no third-party
 * module host. defuss-shadcn's own editable code component (code-example) also
 * paints with Shiki, imported on first use; site.js does the same.
 *
 * Only the HTML grammar is loaded; it embeds JavaScript and CSS, which the
 * call line uses. The JavaScript regex engine avoids a WASM download.
 * VERIFIED: the minified bundle is about 466 kB, 97 kB gzipped (Bun.build, 2026-11-01).
 */
import { createHighlighterCore } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import html from 'shiki/langs/html.mjs';
import theme from 'shiki/themes/github-dark-default.mjs';

const highlighter = await createHighlighterCore({ themes: [theme], langs: [html], engine: createJavaScriptRegexEngine() });

/** `code` as colored spans, one `<span class="line">` per line joined by newlines (no `<pre>` or `<code>` wrapper). */
export function highlight(code: string, lang: 'html' | 'javascript'): string {
  const markup = highlighter.codeToHtml(code, { lang, theme: 'github-dark-default' });
  return /<code[^>]*>([\s\S]*)<\/code>/.exec(markup)?.[1] ?? '';
}
