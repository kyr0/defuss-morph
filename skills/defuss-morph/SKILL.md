---
name: defuss-morph
description: Write DOM updates with defuss-morph - morph an HTML string or JSX into the live DOM instead of assigning innerHTML, so focus, typed input and event listeners survive; re-render a region from a store with reactive(), <Reactive> or df$(selector).reactive(); refs and the forwardRef pattern; defuss-query, defuss-store, defuss-i18n and defuss-dom-router together. Use when code renders or updates HTML in the browser or on a server with happy-dom, in a bundled app or a standalone HTML page, without a virtual DOM.
---

# defuss-morph 0.3.0 - Agent Skill

defuss-morph compares new content (an HTML string, JSX or VNodes) with the children of a live element and patches only the difference with native DOM calls. A node that exists before and after stays the same node, so its focus, caret, typed value, scroll position and listeners survive. There is no component tree, no scheduler and no virtual DOM: each call reads the live DOM as the previous state.

`reactive()`, `<Reactive>`, `installReactive()`, `createRef()` and the JSX runtime exist since 0.3.0. Check the installed version (`node_modules/defuss-morph/package.json`) before using them.

## 1. Install: pick one path

**A package manager** (the project has a `package.json`): `bun add defuss-morph` (or the project's own manager). Add `defuss-store` for stores, `defuss-query` for `df$`, `defuss-i18n` and `defuss-dom-router` as the task needs them. For JSX, set the compiler's import source; TypeScript:

```json
{ "compilerOptions": { "jsx": "react-jsx", "jsxImportSource": "defuss-morph" } }
```

Bun, esbuild and Vite read the same two options. `defuss-morph/jsx-runtime` resolves to the package entry, so a bundle holds one copy.

**A standalone HTML page** (no build step): one module script registers the whole API as `window.df$`. Load defuss-query after it when the page uses `df$(selector)`:

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/defuss-morph@latest/dist/all.min.js"></script>
<script type="module" src="https://cdn.jsdelivr.net/npm/defuss-query@0.2.0/dist/all.min.js"></script>
<script type="module">
  import { createStore } from "https://cdn.jsdelivr.net/npm/defuss-store@0.1.0/dist/browser.min.js";
  df$.installReactive(df$); // morph loaded before query: give selections .reactive()
  df$.morph(document.getElementById("app"), "<p>Hello</p>");
</script>
```

Module scripts run in document order, so the inline module sees both. Without a compiler, write JSX as `h()` calls: `h("button", { onClick }, "Save")` is `<button onClick={onClick}>Save</button>`.

## 2. Rules

1. **Re-render by morphing the complete next state** into a container: `morph(container, next)`. Never assign `innerHTML` to update a region; it rebuilds every node and loses focus, typed input and listeners.
2. **Key every list item** with a stable ID: `key="..."` in HTML, `key={item.id}` in JSX, never the index. Keyed nodes move; unkeyed siblings match by tag in order and can swap content.
3. **A component's `key` lands on the element it returns**, so `items.map((item) => <Row key={item.id} item={item} />)` is keyed.
4. **Markup that omits something means "leave it alone".** An HTML string cannot uncheck a box, clear a typed `value` or remove a handler. To set such state, send a VNode: `morph(form, [{ attributes: { id: "terms", checked: false } }], { diff: true })`.
5. **Escape text you put into an HTML string**, or pass it as a VNode child (`h("li", null, userText)`, defuss-query's `.text()`). morph renders its input and does not sanitize it; a `<script>` in an HTML string runs.
6. **Diff mode (`{ diff: true }`) patches and appends only**: every item needs a `key` or `id`; it never removes or reorders. Use a full `morph()` for that.
7. **`morph()` is synchronous**, unless it has a `transition` option: then it returns a Promise. `await` it before the next animated morph.
8. **A component function runs again on every render.** There are no hooks. State that must outlive a render lives in a store created outside the component, or on the component's ref (`ref.state`).
9. **Lifecycle timing.** morph sets refs while it renders, so `ref.current` is set when `morph()` returns. `onMount` runs in a microtask after insertion, and again after each morph that patches the element with an `onMount`. `onUnmount` runs once the element leaves the document and receives the element.
10. **One copy of defuss-morph per page.** Your code, defuss-query and defuss-i18n must share it (one bundle, or one import map for ES modules); each copy keeps its own handler registry, and a second copy does not tear down the first one's handlers.

## 3. The four patterns

Full examples with JSX and HTML variants: [references/patterns.md](references/patterns.md).

**Reactive rendering.** `reactive({ store, render }, target)` renders `render()` into `target` now and morphs it in again after every store change. `target` is an element, a ref or a list of elements. It returns `dispose()`.

```ts
import { reactive } from "defuss-morph";
import { createStore } from "defuss-store";

const cart = createStore({ count: 0 });
const dispose = reactive({ store: cart, render: () => `<p>${cart.value.count} items</p>` }, cartEl);
cart.set("count", 2); // the same <p>, new text
```

In JSX, `<Reactive store={cart} render={() => <p>{cart.value.count}</p>} />` renders a wrapper (`tag`, default `div`) and stays subscribed while the wrapper is in the document. For markup already in the page, `df$("#cart").reactive({ store, render, signal })` after `installReactive(df$)`; end it with an `AbortController`.

**Ref.** `const field = createRef<HTMLInputElement>()`, then `<input ref={field} />`; morph puts the element into `field.current` and keeps it there while the element survives.

**forwardRef.** There is no `forwardRef()` function. A component takes an optional `ref` prop with a default and puts its API on `ref.state`:

```tsx
const Stepper = ({ ref = createRef<HTMLElement, StepperApi>() }: { ref?: Ref<HTMLElement, StepperApi> }) => {
  // createStepper() returns { count: createStore({ n: 0 }), increment, reset }: references/patterns.md
  const api = (ref.state ??= createStepper()); // state on the ref outlives a parent re-render
  return <Reactive ref={ref} store={api.count} render={() => <output>{api.count.value.n}</output>} />;
};
```

**Query references (HTML-first pages).** Name the parts with `data-ref` and select each once: `const list = df$("[data-ref=list]")`. `list.html(markup)` morphs; `.on()` listens natively; one listener on a container serves buttons rendered from HTML strings (`data-action` attributes), because an HTML string cannot carry handlers.

## 4. Integrations

Details and the CDN variants: [references/integrations.md](references/integrations.md).

- **defuss-store**: `createStore(initial)`, `.value`, `.set(path, value)`, `.update(fn)`, `.subscribe()`; `computed(store, fn)` notifies only when its result changes. Any object with `subscribe(listener)` returning an unsubscribe function works as a store.
- **defuss-query**: `import df$ from "defuss-query"`; `.html()`, `.text()`, `.morph()` morph; `.form()` returns `FormData`; `installReactive(df$)` adds `.reactive()`.
- **defuss-i18n**: translations are `<template data-i18n-for data-i18n-locale>` beside the markup; `bindI18n(root, createI18n({ locale: "en", fallback: ["en"] }))`, then `setLocale("de")` morphs the marked parts and keeps typed input.
- **defuss-dom-router**: `createRouter({ routes, prepare: ({ to }) => ({ commit: () => morph(outlet, view(to)) }) })`, `router.attachLinks(document)`, `await router.start()`. Give each view's root a key per record (`key="project-7"`), so another record does not inherit typed input.

## 5. Check your work

- Unit tests run in happy-dom: `morph(el, html)` works on any element of a happy-dom `Window`; `reactive()` re-renders as soon as the store notifies (defuss-store notifies synchronously); `<Reactive>` subscribes in a microtask, so `await new Promise((r) => setTimeout(r, 0))` before changing a store in a test.
- Assert identity, not only text: keep a reference to a node, morph, and check the node is still the one in the DOM.
- In a browser test, type into an input, trigger the re-render, and check the value and `document.activeElement`.

## 6. References

- [references/api.md](references/api.md): every export with its signature and options.
- [references/patterns.md](references/patterns.md): reactive rendering, ref, forwardRef and query references, in JSX and HTML.
- [references/integrations.md](references/integrations.md): defuss-query, defuss-store, defuss-i18n, defuss-dom-router; bundler and CDN setups.
- [references/pitfalls.md](references/pitfalls.md): mistakes that compile and run but break state, and their fixes.
- Website with live demos of every pattern: https://morph.defuss.org/
