# defuss-morph

Morph an HTML string or JSX into an existing DOM tree. `defuss-morph` compares the new markup with the live DOM and patches only the difference with native DOM calls, so a node that exists before and after stays the same node: focus, the text in an input and its event listeners survive the update. It is the DOM morphing engine of [defuss](https://github.com/kyr0/defuss), packaged on its own with no dependencies.

Website with a live playground: [morph.defuss.org](https://morph.defuss.org/)

What it does:

- Key-aware and id-aware matching: matched nodes are moved, never recreated.
- In-place attribute patching for elements with the same tag.
- Uncontrolled form state survives: an input keeps its typed `value` and `checked` state unless the new markup sets them.
- JSX handlers (`onClick`, ...) listen on the element itself, so propagation is native (order, `stopPropagation()`, `currentTarget`, non-bubbling events such as `toggle`, `load`, `error`). Handlers of removed elements are torn down.
- HTML comments are matched and patched like text: `morph(el, el.innerHTML)` changes no node.
- Partial updates (diff mode) for streamed or AI-generated changes.
- Transitions: fade, slide-left, slide-right, shake or your own styles.
- Works next to any framework or none, in the browser and on the server (happy-dom). No virtual DOM, no build step.
- ESM and CommonJS builds with type declarations, plus a one-file bundle for the CDN.

## Quick start from the CDN

The CDN bundle registers the whole API as the global `window.df$` when it loads:

```html
<body>
  <div id="app">Old content</div>

  <script type="module" src="https://cdn.jsdelivr.net/npm/defuss-morph@latest/dist/all.min.js"></script>
  <script type="module">
    df$.morph(document.getElementById("app"), "<p>Hello from the CDN</p>", {
      transition: { type: "fade", duration: 200 },
    });
  </script>
</body>
```

An existing `df$` object or function (for example from defuss-query) is kept and extended with the API instead of being replaced.

The same file also works as an ES module, without the global:

```html
<script type="module">
  import { morph } from "https://cdn.jsdelivr.net/npm/defuss-morph@latest/dist/all.min.js";

  morph(document.getElementById("app"), "<p>Hello from the CDN</p>");
</script>
```

Good for prototypes, demos and AI-generated pages. The page then depends on the CDN being reachable; replace `@latest` with a version to pin it.

## Without a CDN

Download the repository as a ZIP ([`main`](https://github.com/kyr0/defuss-morph/archive/refs/heads/main.zip)), or the built file from the [website](https://morph.defuss.org/#install), and copy `dist/all.min.js` into your assets:

```text
project/
├── assets/
│   └── js/
│       └── defuss-morph/
│           └── all.min.js
└── index.html
```

```html
<script type="module">
  import { morph } from "./assets/js/defuss-morph/all.min.js";

  morph(document.getElementById("app"), "<p>Hello from local assets</p>");
</script>
```

This works offline and pins the version you ship; updating means downloading again.

## With a package manager

For applications with a bundler: the version is pinned in your lockfile and the bundler can tree-shake. The package entries (`index.mjs`, `index.cjs`) register no global.

```bash
bun add defuss-morph
# or: npm install defuss-morph
```

```ts
import { morph } from "defuss-morph";

const appEl = document.getElementById("app")!;

morph(appEl, `<ul>
  <li key="a">Alpha</li>
  <li key="b">Beta</li>
</ul>`);

// b moves in front of a; neither node is recreated, so both keep
// their focus, selection, scroll position and listeners
morph(appEl, `<ul>
  <li key="b">Beta (updated)</li>
  <li key="a">Alpha</li>
</ul>`);
```

## API

### `morph(el, newContent, options?)`

```ts
morph(el: Element, newContent: RenderInput, options?: MorphOptions): void | Promise<void>
```

Makes the children of `el` match `newContent`: an HTML string, a VNode, an array of VNodes or plain text. Without a `transition` option the morph is synchronous and returns `undefined`; with one it returns a Promise that resolves when the transition has finished.

- HTML strings are parsed with the `DOMParser` of the element's own document (`el.ownerDocument`), so the call works in a browser, in happy-dom and across windows. Fragments are parsed in template mode, so context-dependent tags such as `<tr>`, `<td>` and `<option>` survive at the top level.
- Children are matched by `key`, then by `id`, then by tag. A matched node is moved with `moveBefore()`, which keeps focus, the selection and other live state (where the browser lacks it, `insertBefore()` moves it and `morph()` puts focus and the text selection back), and patched in place; a child without a match is created; unclaimed nodes are removed.
- The `key` is stored on the element for matching and is not written to the DOM as an attribute.
- An element with an open shadow root is morphed inside the shadow root. Custom elements (a hyphen in the tag name) keep their light DOM as the target, for slotted content.
- Native listeners added with `addEventListener` stay on surviving nodes. An HTML string cannot declare handlers, so registered JSX handlers stay as well, the same rule as for uncontrolled form state.
- A morph started from inside another morph on the same element or a descendant (for example from a lifecycle callback) is queued; the latest request runs when the active morph returns.

### Morphing JSX (VNodes)

`morph()` accepts JSX or VNodes with the same algorithm. A VNode is `{ type, attributes, children }`, as any JSX factory produces it; an HTML comment is `{ type: "#comment", value }` (`COMMENT_TYPE`).

```tsx
import { morph } from "defuss-morph";

// JSX (e.g. with defuss: import { jsx } from "defuss")
morph(
  document.getElementById("app")!,
  <ul>
    <li key="a">Alpha</li>
    <li key="b">Beta</li>
  </ul>,
);
```

Unlike an HTML string, a VNode carries JavaScript values: explicit booleans (`checked: false`), live values (`value: ""`), event handlers (`onClick={...}`), refs and the lifecycle hooks `onMount` and `onUnmount`. Controlled state and JSX event props only work through VNodes. `onUnmount` runs once when the element leaves the document, with the handler of the latest render.

### Partial updates (diff mode)

By default `morph()` reconciles the complete next state: anything the input does not describe is removed. With `{ diff: true }` the input is a change-set for the direct children of `el`, each item addressed by `key` (preferred) or `id`.

Current DOM:

```html
<ul id="listEl">
  <li key="a" data-x="1">A</li>
  <li key="b">B</li>
  <li key="c">C</li>
</ul>
```

The change-set names only the nodes that change:

```ts
const listEl = document.getElementById("listEl")!;

morph(listEl, `
  <li key="b">B (updated)</li>
  <li key="d">D (new)</li>
`, { diff: true });
```

New DOM:

```html
<ul id="listEl">
  <li key="a" data-x="1">A</li>   <!-- untouched -->
  <li key="b">B (updated)</li>    <!-- patched in place, attributes merged -->
  <li key="c">C</li>              <!-- untouched -->
  <li key="d">D (new)</li>        <!-- appended -->
</ul>
```

`a` and `c` keep identity, `data-x`, order, focus and listeners although the change-set never mentions them. `b` is patched: its text changes, declared attributes are merged in and undeclared ones stay. `d` is appended. Diff mode never removes and never moves anything, so addressing stays unambiguous:

- Items must carry a `key` or `id`; plain text and items without either throw an `Error`.
- Only new (unmatched) items need a tag. A VNode item without `type` borrows the tag of the node it addresses.
- Deleting or reordering needs a regular full `morph()`.
- Declared children are morphed into the node; without declared children the node's children stay untouched (with VNodes, `children: []` clears them).
- A different tag on an addressed node replaces that node.
- Top-level comments in a change-set are skipped; comments inside items are morphed.

Runnable demo: [`examples/diff-mode.html`](examples/diff-mode.html).

### Transitions

```ts
await morph(appEl, "<p>Faded in</p>", {
  transition: { type: "fade", duration: 200 }, // slide-left | slide-right | shake | none
});
```

| Option | Default | Meaning |
| --- | --- | --- |
| `type` | `"fade"` | `fade` cross-fades a snapshot of the old content; the others animate out, morph, then animate in. `none` keeps the call synchronous. |
| `duration` | `300` | Milliseconds per phase. |
| `easing` | `"ease-in-out"` | Any CSS timing function. |
| `delay` | `0` | Milliseconds before the transition starts. |
| `target` | `"parent"` | Animate the parent or the element itself (`"self"`). With `"parent"`, an element without a parent is morphed without animation. |
| `styles` | by type | Your own `{ enter, enterActive, exit, exitActive }` style maps (not used by `fade`). |

Overlapping updates resolve to the latest content: a plain `morph()` issued while a transition runs applies at once and also replaces the content that transition will apply, so the transition never ends on stale markup. `await` the returned Promise, or chain morphs, to play animations one after another; see [`examples/transition-await.html`](examples/transition-await.html).

### Low-level primitives

The building blocks are exported for framework integration; defuss-query is built on them:

```ts
import {
  updateDomWithVdom,   // guarded VNode morph entry point; 4th argument mode: "replace" | "diff"
  replaceDomWithVdom,  // remove all children (with handler teardown), render from scratch
  htmlStringToVNodes,  // HTML string to VNode[]
  domNodeToVNode,      // DOM node to VNode
  getRenderer,         // VNode to DOM renderer
  registerDelegatedEvent, removeDelegatedEvent, clearDelegatedEventsDeep,
  onClearDelegatedEvents, // hook: release your own listeners whenever morph
                          // removes or replaces an element
} from "defuss-morph";

// the third `globals` argument is optional everywhere; it is derived
// from the element's own document when omitted
updateDomWithVdom(el, [{ type: "p", attributes: {}, children: ["hi"] }]);
```

## Limitations of HTML strings

Markup that does not mention something means "leave it alone". Three rules follow from that.

**HTML cannot unset `checked` or a live `value`.** An HTML string cannot say "explicitly unchecked", so absent form attributes are treated as uncontrolled and the live state is kept. That is what lets form state survive unrelated morphs. To set the state explicitly, send a VNode in diff mode: address the node by `id` (or `key`) and send only the new value. The node exists, so no tag is needed.

```ts
import { morph } from "defuss-morph";

const appEl = document.getElementById("app")!;

morph(appEl, `<input type="checkbox" id="c" checked>`);
morph(appEl, `<input type="checkbox" id="c">`); // still checked: "no checked attribute" means "don't touch"

morph(appEl, [{ attributes: { id: "c", checked: false } }], { diff: true }); // unchecked
```

Runnable demos: [`examples/controlled-form-state.html`](examples/controlled-form-state.html) and [`examples/diff-mode.html`](examples/diff-mode.html).

**Inline `on*` attributes are never removed.** An attribute such as `onclick="..."` stays when a later morph leaves it out. Attach behaviour with `addEventListener` or JSX handlers instead.

**Diff mode cannot delete.** A change-set only patches and appends.

## Security

`morph()` renders its input; it does not sanitize it. Elements are created with `document.createElement`, so a `<script>` inside an HTML string runs when it is morphed in (with `innerHTML` it would not), and attributes such as `onclick` are applied as given. Never morph untrusted HTML without sanitizing it first.

## Examples

Zero-build pages that load the freshly built `dist/all.js`. `make start` serves them at `http://127.0.0.1:4173/examples/<name>.html`:

| Example | What it shows |
| --- | --- |
| [`examples/cdn-global.html`](examples/cdn-global.html) | The `df$` global end to end: morphing, keyed lists, controlled form state, delegated events, transitions |
| [`examples/controlled-form-state.html`](examples/controlled-form-state.html) | The "HTML can't uncheck" limitation and its fix with `df$.updateDomWithVdom` |
| [`examples/event-listener-preservation.html`](examples/event-listener-preservation.html) | Native and delegated listeners surviving morphs; handler cleanup on removal |
| [`examples/transition-await.html`](examples/transition-await.html) | Transitions: latest content wins, `await` and queue patterns for sequencing animations |
| [`examples/diff-mode.html`](examples/diff-mode.html) | Diff mode: partial change-sets by key or id, merge-patch, append, untouched siblings |

## Size

`make build` measures the built files and rewrites this table (and the website's figures) from `dist/stats.json`:

<!-- bundle-size:start -->
| File | Size | Gzipped | Purpose |
| --- | ---: | ---: | --- |
| `index.mjs` | 39.8 kB | 9.8 kB | ESM/library build; used when installing via npm/bun |
| `index.cjs` | 40.9 kB | 10.0 kB | CommonJS build |
| `all.js` | 41.4 kB | 10.1 kB | Self-contained ESM bundle for CDN and `<script>` use, readable for debugging; registers `df$` |
| `all.min.js` | 19.2 kB | **7.0 kB** | Minified `all.js`; the file to load from a CDN when no bundler is used |
<!-- bundle-size:end -->

`index.cjs` serves `require()` on older toolchains (CommonJS Jest configurations, bundlers that resolve `main`). Node 20.19 and 22.12 or newer can `require()` the ESM build directly.

## Development

Requirements: [Bun](https://bun.sh) (version pinned in `packageManager`) and Node.js 20 or newer. `make` lists every target.

```bash
make setup     # bun install --frozen-lockfile, Playwright Chromium
make build     # pkgroll, CDN bundle, minify, sizes, website copies, dist consistency check
make verify    # what CI runs: lint, test, coverage, e2e
make start     # dev server: website at http://127.0.0.1:4173/docs/, examples under /examples/
```

The dev server (`scripts/serve.mjs`) serves the repository read-only with caching off, so after `make build` a reload shows the new build. It runs in the background: `make status` prints its URL, `make log` its request log, `make stop` ends it, and `PORT=8080 make start` picks another port.

| Target | What it checks |
| --- | --- |
| `make lint` | oxlint with warnings as errors, then a strict `tsc` type check |
| `make test` | Every test file in real Chromium (Playwright), and all but the browser-only ones in happy-dom |
| `make coverage` | The same run with merged v8 coverage |
| `make e2e` | Packs the package, installs the tarball in a clean project and uses it from Node (ESM and CommonJS, happy-dom), then drives the website and every example page in Chromium; results land in `output/` |

`dist/` is committed so the ZIP download and jsDelivr's GitHub URLs serve the built files; `make build` rewrites it, and `docs/` (the website, served by GitHub Pages at morph.defuss.org) with it. After `npm publish`, `make purge-cdn` refreshes jsDelivr's `@latest` cache. Design notes: [ARCH.md](ARCH.md).

## License

[MIT](LICENSE)
