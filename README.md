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
- Store-driven rendering: `reactive()`, the `<Reactive>` component and defuss-query's `df$(selector).reactive()` re-render a region whenever a store changes, by morphing it.
- A JSX runtime (`jsxImportSource: "defuss-morph"`, or `h()` without a build step), refs and the forwardRef pattern.
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
- Children are matched by `key`, then by `id`, then by tag. Only nodes out of order move (swapping two rows moves two, removing one moves none). A matched node is moved with `moveBefore()`, which keeps focus, the selection and other live state (where the browser lacks it, `insertBefore()` moves it and `morph()` puts focus and the text selection back), and patched in place; a child without a match is created; unclaimed nodes are removed.
- The `key` is stored on the element for matching and is not written to the DOM as an attribute.
- An element with an open shadow root is morphed inside the shadow root. Custom elements (a hyphen in the tag name) keep their light DOM as the target, for slotted content. A `<template>` is morphed in its `.content`, where the HTML parser puts its markup.
- Native listeners added with `addEventListener` stay on surviving nodes. An HTML string cannot declare handlers, so registered JSX handlers stay as well, the same rule as for uncontrolled form state.
- A morph started from inside another morph on the same element or a descendant (for example from a lifecycle callback) is queued; the latest request runs when the active morph returns.

### Morphing JSX (VNodes)

`morph()` accepts JSX or VNodes with the same algorithm. A VNode is `{ type, attributes, children }`, as any JSX factory produces it; an HTML comment is `{ type: "#comment", value }` (`COMMENT_TYPE`).

```tsx
import { morph } from "defuss-morph";

// JSX compiled with jsxImportSource: "defuss-morph" (see JSX runtime below);
// defuss's own jsx() produces the same VNodes
morph(
  document.getElementById("app")!,
  <ul>
    <li key="a">Alpha</li>
    <li key="b">Beta</li>
  </ul>,
);
```

Unlike an HTML string, a VNode carries JavaScript values: explicit booleans (`checked: false`), live values (`value: ""`), event handlers (`onClick={...}`), refs and the lifecycle hooks `onMount` and `onUnmount`. Controlled state and JSX event props only work through VNodes. `onMount` runs in a microtask after the element is inserted, and again after each morph that patches it with an `onMount`. `onUnmount` runs once when the element leaves the document, with the handler of the latest render, and receives the element.

### JSX runtime

defuss-morph ships the runtime a JSX compiler calls. Set the import source once:

```json
{ "compilerOptions": { "jsx": "react-jsx", "jsxImportSource": "defuss-morph" } }
```

TypeScript, Bun, esbuild and Vite read these options. `defuss-morph/jsx-runtime` and `defuss-morph/jsx-dev-runtime` resolve to the package entry, so a bundle holds one copy of morph. The runtime returns plain VNodes and calls function components at once: there is no component tree and there are no hooks, so a component runs again on every render. A `key` given to a component lands on the element it returns, so `items.map((item) => <Row key={item.id} item={item} />)` is keyed.

Without a build step, `h(type, props, ...children)` builds the same VNodes: `h("button", { onClick: save }, "Save")`.

### Reactive rendering

`reactive(config, target)` renders `config.render()` into `target` at once, and morphs it in again whenever a store changes. Nodes that stay keep their focus, typed input and listeners, so rendering the whole region again is safe.

```ts
import { reactive } from "defuss-morph";
import { createStore } from "defuss-store";

const cart = createStore({ count: 1 });
const dispose = reactive({ store: cart, render: () => `<p>${cart.value.count} items</p>` }, cartEl);

cart.set("count", 2); // the same <p>, now "2 items"
dispose();            // unsubscribes and runs config.cleanup once
```

| Config | Meaning |
| --- | --- |
| `store` | One store or an array; a change in any of them renders again. A store is anything with `subscribe(listener)` that returns an unsubscribe function (or an object with `unsubscribe()`), such as [defuss-store](https://www.npmjs.com/package/defuss-store)'s `createStore()` and `computed()`. |
| `render` | Returns JSX, VNodes or an HTML string. Keep it pure: it may run more often than the stores change. |
| `cleanup` | Runs once when the region is disposed. |
| `signal` | An `AbortSignal`; aborting disposes. |

`target` is an element, a ref (read on every render; it must hold an element when `reactive()` is called) or a list of elements such as a NodeList. The first render runs before the subscriptions start; a change renders as soon as the store notifies, which defuss-store does synchronously.

In JSX, `<Reactive>` does the same for its own wrapper element:

```tsx
import { Reactive, morph } from "defuss-morph";

const counter = createStore({ n: 0 });

morph(appEl, (
  <Reactive tag="section" class="counter" store={counter} render={() => (
    <button onClick={() => counter.set("n", counter.value.n + 1)}>clicked {counter.value.n}</button>
  )} />
));
```

The wrapper (`tag`, default `div`) gets every other prop, including `ref`, and the first `render()` result as its children. Once morph has mounted it, `<Reactive>` subscribes; a parent re-render moves the subscription to the latest `render` and `store`; when the wrapper leaves the document it unsubscribes and runs `cleanup`.

With [defuss-query](https://www.npmjs.com/package/defuss-query), `installReactive(df$)` adds `.reactive(config)` to every selection, for markup that is already in the page. The method returns the selection; end the binding with `signal`:

```js
import df$ from "defuss-query";
import { installReactive } from "defuss-morph";

installReactive(df$);
df$("#cart-total").reactive({ store: cart, render: () => `${cart.value.count} items`, signal: controller.signal });
```

The CDN bundle installs it itself when it loads after defuss-query; loaded before it (defuss-query's recommended order), call `df$.installReactive(df$)` once.

### Refs and the forwardRef pattern

`createRef()` returns `{ current: null, state: undefined }`. morph sets `current` to the element that carries `ref={...}` while it renders, and a morph that keeps the element keeps the ref on that node. In a component body, `current` still holds the previous render's element, so read it in handlers, in `onMount` or after `morph()` returns.

There is no `forwardRef()` function: a component takes an optional `ref` prop with a default, passes it to its root and puts its API on `ref.state`. Alone, the component uses its own ref; a parent that passes one calls the API.

```tsx
import { Reactive, type Ref, createRef, morph } from "defuss-morph";
import { createStore } from "defuss-store";

const createStepper = () => {
  const count = createStore({ n: 0 });
  return { count, reset: () => count.set("n", 0) };
};

const Stepper = ({ ref = createRef<HTMLElement, ReturnType<typeof createStepper>>() }: { ref?: Ref<HTMLElement, ReturnType<typeof createStepper>> }) => {
  const api = (ref.state ??= createStepper()); // state on the ref outlives a parent re-render
  return <Reactive ref={ref} store={api.count} render={() => <output>{api.count.value.n}</output>} />;
};

const stepper = createRef<HTMLElement, ReturnType<typeof createStepper>>();
morph(appEl, <Stepper ref={stepper} />);
stepper.state?.reset();
```

The website runs each pattern with its source next to it: [morph.defuss.org/#patterns](https://morph.defuss.org/#patterns).

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

## Integrations

defuss-morph renders; the other defuss packages each do one job around it. The website demonstrates each one live: [morph.defuss.org/#integrations](https://morph.defuss.org/#integrations).

| Package | With defuss-morph |
| --- | --- |
| [defuss-query](https://www.npmjs.com/package/defuss-query) | `df$`, a jQuery-shaped facade: `.html()`, `.text()` and `.morph()` morph; `installReactive(df$)` adds `.reactive()`. |
| [defuss-store](https://www.npmjs.com/package/defuss-store) | Stores for `reactive()` and `<Reactive>`; `computed()` re-renders a region only when its result changes. |
| [defuss-i18n](https://i18n.defuss.org/) | Translations as `<template>`s beside the markup; `setLocale()` morphs the translated parts and keeps typed input. |
| [defuss-dom-router](https://dom-router.defuss.org/) | Resolves URLs and orders navigations; a view's `commit()` calls `morph()`. Key a view's root by record, so another record gets fresh fields. |

Use one copy of defuss-morph per page: with a bundler that happens by itself; ES modules without one share it through an import map. defuss-i18n 0.2.0 declares older peer ranges (`defuss-morph ^0.1.1`, `defuss-query ^0.1.0`); it works with defuss-morph 0.3.0 and defuss-query 0.2.0 in this repository's tests.

## Agent skill

`skills/defuss-morph/` is an Agent Skill: what a coding agent needs to use defuss-morph without reading its source, namely when to morph, the rules, the four patterns, the integrations and the pitfalls. It ships in the npm package too (`node_modules/defuss-morph/skills/`).

```bash
# Claude Code
claude plugin marketplace add kyr0/defuss-morph
claude plugin install defuss-morph@defuss-morph

# Codex, Cursor, Gemini CLI, GitHub Copilot, Windsurf and others (skills CLI)
npx skills add kyr0/defuss-morph --skill defuss-morph            # asks which agents
npx skills add kyr0/defuss-morph --skill defuss-morph --agent codex
```

Start a new session afterwards. The agent loads the skill when a task matches its description; to call it by name, write `/defuss-morph:defuss-morph` in Claude Code or `$defuss-morph` in Codex. `npx skills update` and `claude plugin marketplace update defuss-morph` fetch new versions.

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

Zero-build pages that load the freshly built `dist/all.js` (the two reactive ones load defuss-store and defuss-query from jsDelivr). `make start` serves them at `http://127.0.0.1:4173/examples/<name>.html`; `make e2e` runs each one's scenario in Chromium:

| Example | What it shows |
| --- | --- |
| [`examples/cdn-global.html`](examples/cdn-global.html) | The `df$` global end to end: morphing, keyed lists, controlled form state, delegated events, transitions |
| [`examples/controlled-form-state.html`](examples/controlled-form-state.html) | The "HTML can't uncheck" limitation and its fix with `df$.updateDomWithVdom` |
| [`examples/event-listener-preservation.html`](examples/event-listener-preservation.html) | Native and delegated listeners surviving morphs; handler cleanup on removal |
| [`examples/transition-await.html`](examples/transition-await.html) | Transitions: latest content wins, `await` and queue patterns for sequencing animations |
| [`examples/diff-mode.html`](examples/diff-mode.html) | Diff mode: partial change-sets by key or id, merge-patch, append, untouched siblings |
| [`examples/reactive-html.html`](examples/reactive-html.html) | `reactive()` with HTML strings and defuss-store; `df$(selector).reactive()` with defuss-query, ended by an `AbortSignal` |
| [`examples/reactive-jsx.html`](examples/reactive-jsx.html) | JSX without a build step through `h()`: `<Reactive>`, a ref and the forwardRef pattern |

## Size

`make build` measures the built files and rewrites this table (and the website's figures) from `dist/stats.json`:

<!-- bundle-size:start -->
| File | Size | Gzipped | Purpose |
| --- | ---: | ---: | --- |
| `index.mjs` | 47.7 kB | 12.1 kB | ESM/library build; used when installing via npm/bun |
| `index.cjs` | 49.0 kB | 12.3 kB | CommonJS build |
| `all.js` | 49.3 kB | 12.3 kB | Self-contained ESM bundle for CDN and `<script>` use, readable for debugging; registers `df$` |
| `all.min.js` | 23.2 kB | **8.5 kB** | Minified `all.js`; the file to load from a CDN when no bundler is used |
<!-- bundle-size:end -->

`index.cjs` serves `require()` on older toolchains (CommonJS Jest configurations, bundlers that resolve `main`). Node 20.19 and 22.12 or newer can `require()` the ESM build directly.

## Benchmark

The website's Benchmark section times typical operations on a table of rows, after [js-framework-benchmark](https://github.com/krausest/js-framework-benchmark), in the visitor's browser. It creates, replaces, appends and clears 1,000 rows, updates every 10th row, selects one row, swaps two, removes one, creates 10,000 rows, and re-renders a 10-row view 500 times, one changed row each time, the work of a `reactive()` region. Each operation runs four ways:

- `innerHTML`, the baseline
- `morph()` of the whole list, with keys
- `morph()` of the whole list, without keys
- diff mode, sending only the changed rows (n/a for replace, swap, remove and clear: diff mode never removes or moves)

`make bench` runs the same suite (`docs/demos/bench.ts`) in headless Chromium, Firefox and WebKit, with HTML strings and with VNodes. It prints a table per browser and input, writes `output/bench.json`, and writes the run into the website's recorded table with its date, machine and browser versions. `make coverage` writes the unit test coverage into the website the same way.

A cell is the median of 7 timed runs (3 for 10,000 rows), after 2 untimed ones. A run times the update and the layout it causes; building the input is not timed. After every run the table is checked against the expected rows. This README states no numbers, because they depend on the machine and the browser; the website's recorded table names the run it shows.

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
| `make test` | Every test file in real Chromium and real Firefox (Playwright), and all but the browser-only ones in happy-dom |
| `make coverage` | The happy-dom and Chromium runs with merged V8 coverage (V8 cannot measure in Firefox); writes the website's coverage rings |
| `make bench` | The website's benchmark in headless Chromium, Firefox and WebKit, with HTML strings and VNodes; tables on stdout, `output/bench.json` and the website's recorded run |
| `make e2e` | Packs the package, installs the tarball in a clean project and uses it from Node (ESM and CommonJS, happy-dom, with defuss-store), then drives the website, every demo on it and every example page in Chromium, and the built library in Chromium and Firefox; results land in `output/` |

`dist/` is committed so the ZIP download and jsDelivr's GitHub URLs serve the built files; `make build` rewrites it, and `docs/` (the website, served by GitHub Pages at morph.defuss.org) with it: the demos in `docs/demos/` are bundled into `docs/assets/demos.js` (and the frames' `router-demo.js` and `bench.js`), the sibling packages are copied from `node_modules` into `docs/assets/vendor/`, and every code block names the demo source it shows. After `npm publish`, `make purge-cdn` refreshes jsDelivr's `@latest` cache. Design notes: [ARCH.md](ARCH.md). Release notes: [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE)
