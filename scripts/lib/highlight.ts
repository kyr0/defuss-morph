import { createHighlighter, getTokenStyleObject, stringifyTokenStyle, type ThemedToken } from 'shiki';

/**
 * Why: syntax colors for the code examples in docs/index.html, computed by
 * shiki when `make build` runs (scripts/docs.ts), as on the defuss-query site.
 * The page ships colored spans as static markup instead of loading a
 * highlighter in the visitor's browser: no extra script, no flash of plain code.
 *
 * Highlighted: `<pre data-lang="L"><code>…</code></pre>`, where each top-level
 * `<span>` of the code is one line (the defuss-shadcn code-block format that
 * the copy button and line numbers read). A line keeps its attributes, such as
 * `data-highlight`. The text of highlighted markup is its source, so running
 * again is a no-op; to edit an example, replace a line's content with plain
 * escaped text and run `make build`.
 *
 * One theme: VERIFIED: every code block on the page is dark in both color
 * schemes (background oklch(0.17 0.01 260), Chromium). scripts/e2e/browser.mjs
 * measures at least 4.5:1 contrast for every token in both schemes.
 */

const THEME = 'github-dark-default';
const LANGS = ['html', 'ts', 'tsx', 'js', 'json', 'sh'] as const;
type Lang = (typeof LANGS)[number];

let highlighter: ReturnType<typeof createHighlighter> | undefined;

const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decode = (text: string) =>
  text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, name: string) =>
    name[0] === '#'
      ? String.fromCodePoint(Number(name[1].toLowerCase() === 'x' ? `0${name.slice(1)}` : name.slice(1)))
      : (ENTITIES[name] ?? match),
  );

/**
 * The lines of code-block markup: each top-level `<span>` is a line, with its
 * attribute string; nested spans are dropped and entities decoded. A `<` that
 * starts no tag is text, as in HTML. Any tag but `<span>` is an error.
 */
function linesOf(markup: string): { attrs: string; text: string }[] {
  const lines: { attrs: string; text: string }[] = [];
  let depth = 0;
  for (const [tag, close, name, attrs, chunk] of markup.matchAll(/<(\/?)([a-z]+)([^>]*)>|([^<]+|<)/g)) {
    if (chunk !== undefined) {
      if (depth > 0) lines[lines.length - 1].text += decode(chunk);
      else if (chunk.trim()) throw new Error(`highlight: text outside a line <span>: ${chunk.slice(0, 60)}`);
    } else if (name !== 'span') throw new Error(`highlight: unexpected ${tag} in a code example`);
    else if (close) depth--;
    else if (depth++ === 0) lines.push({ attrs, text: '' });
  }
  return lines;
}

/** One line of tokens as spans; neighbors with the same style share a span. */
function lineMarkup(tokens: ThemedToken[]): string {
  let markup = '';
  let style = '';
  let text = '';
  for (const token of tokens) {
    const next = stringifyTokenStyle(getTokenStyleObject(token));
    if (next !== style && text) {
      markup += `<span style="${style}">${escape(text)}</span>`;
      text = '';
    }
    style = next;
    text += token.content;
  }
  return text ? `${markup}<span style="${style}">${escape(text)}</span>` : markup;
}

async function highlightLines(code: string, lang: string): Promise<string[]> {
  if (!LANGS.includes(lang as Lang)) throw new Error(`highlight: data-lang="${lang}" is not one of ${LANGS.join(', ')}`);
  highlighter ??= createHighlighter({ themes: [THEME], langs: [...LANGS] });
  return (await highlighter).codeToTokens(code, { lang: lang as Lang, theme: THEME }).tokens.map(lineMarkup);
}

const BLOCK = /(<pre\b[^>]*\bdata-lang="([^"]*)"[^>]*><code>)([\s\S]*?)(<\/code><\/pre>)/g;

/** `html` with every `<pre data-lang>` code block highlighted. */
export async function highlightPage(html: string): Promise<string> {
  let result = '';
  let last = 0;
  for (const match of html.matchAll(BLOCK)) {
    const [all, open, lang, inner, close] = match;
    const lines = linesOf(inner);
    const colored = await highlightLines(lines.map((line) => line.text).join('\n'), lang);
    result += html.slice(last, match.index) + open + lines.map((line, i) => `<span${line.attrs}>${colored[i]}</span>`).join('') + close;
    last = match.index + all.length;
  }
  return result + html.slice(last);
}
