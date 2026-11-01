# defuss-morph API

Everything below is exported from `defuss-morph` (ES module and CommonJS) and, in the CDN bundle, assigned to `window.df$`. Declarations: `node_modules/defuss-morph/dist/index.d.ts`.

## morph

```ts
morph(el: Element, content: RenderInput, options?: MorphOptions): void | Promise<void>
```

Makes the children of `el` match `content`: an HTML string, a VNode, an array of VNodes, or text. Without `transition` it finishes synchronously and returns `undefined`; with one it returns a Promise that resolves when the animation has ended.

- Strings are parsed with the `DOMParser` of `el.ownerDocument`, as `<template>` content, so `<tr>`, `<td>` and `<option>` survive at the top level. A full document (starting with a doctype, `<html>`, `<head>` or `<body>`) is parsed as a document.
- Children match by `key`, then `id`, then tag. Only matches out of order move (the longest run already in order stays). A match is moved with `moveBefore()` where the browser has it (focus and selection stay), else `insertBefore()` with focus and selection put back, and patched in place. Unmatched new children are created; unclaimed old ones are removed after their handlers are torn down.
- `key` is stored on the element and not written to the DOM.
- An element with an open shadow root is morphed inside it; a custom element (hyphen in the tag) keeps its light DOM as the target. A `<template>` is morphed in its `.content`.
- A morph started during another morph on the same element or a descendant is queued; the latest request runs when the active one returns.

| Option | Type | Default | Meaning |
| --- | --- | --- | --- |
| `diff` | `boolean` | `false` | The input is a change-set for the direct children: items addressed by `key` or `id` are patched (attributes merged), unmatched ones appended. Never removes or moves. An item without `key`/`id` throws. |
| `transition.type` | `"fade" \| "slide-left" \| "slide-right" \| "shake" \| "none"` | `"fade"` | `none` keeps the call synchronous. |
| `transition.duration` | `number` (ms) | `300` | Per phase. |
| `transition.easing` | `string` | `"ease-in-out"` | Any CSS timing function. |
| `transition.delay` | `number` (ms) | `0` | Before the transition starts. |
| `transition.target` | `"parent" \| "self"` | `"parent"` | The animated element. |
| `transition.styles` | `{ enter, enterActive, exit, exitActive }` | by type | Own style maps (not used by `fade`). |

## VNodes and JSX

A VNode is `{ type, attributes, children }`; a comment is `{ type: "#comment", value }`. Attributes a VNode can carry that HTML cannot: explicit booleans (`checked: false`), live values (`value: ""`), event props (`onClick`, `onClickCapture`), `ref`, `key`, `onMount`, `onUnmount`, `className`, `class` as an array, `style` as an object, `dangerouslySetInnerHTML`.

| Export | Use |
| --- | --- |
| `jsx(type, props, key?)`, `jsxs`, `jsxDEV`, `Fragment` | The automatic runtime for `jsxImportSource: "defuss-morph"`. `defuss-morph/jsx-runtime` and `defuss-morph/jsx-dev-runtime` resolve to the package entry. |
| `h(type, props, ...children)` | The classic factory: `jsxFactory: "h"`, or pages without a build step. |
| `type Component<P>` | `(props: P) => RenderInput`. Called at once by `jsx()`; a `key` given to it lands on the element it returns. |
| `namespace JSX` | Loose JSX types: any tag, any attribute; a JSX expression is a `RenderInput`. |

Event props listen on the element itself (one listener per element, event and phase), so propagation is native: order, `stopPropagation()`, `currentTarget`, non-bubbling events such as `toggle`. A morph that drops an event prop removes the handler; an HTML string never removes registered handlers, because it cannot declare them.

## Reactive rendering

```ts
reactive(config: ReactiveConfig, target: Element | RefLike | ArrayLike<Element>): () => void
```

Renders `config.render()` into each target element now, then again after every store change. Returns `dispose()`: it unsubscribes from every store and runs `cleanup` once. A ref target is read on every render and must hold an element when `reactive()` is called (otherwise a `TypeError`); a list is a snapshot; an empty list renders and subscribes nothing.

| Config | Type | Meaning |
| --- | --- | --- |
| `store` | `Subscribable \| Subscribable[]` | A change in any of them renders again. `Subscribable` is `{ subscribe(listener): unsubscribe }`; a returned object with `unsubscribe()` works too. |
| `render` | `() => RenderInput` | JSX, VNodes or an HTML string. Pure: it may run more often than the stores change. |
| `cleanup?` | `() => void` | Runs once when the region is disposed. |
| `signal?` | `AbortSignal` | Disposes on abort. An already aborted signal renders nothing. |

```tsx
<Reactive store={store} render={() => …} tag="section" className="x" ref={ref} cleanup={…} {...attributes} />
```

`Reactive(props)` returns a VNode: the wrapper element with the first `render()` result as its children. Once morph has mounted the wrapper (`onMount`, a microtask later) it subscribes and renders once more; a parent re-render moves the subscription to the latest `render` and `store`; leaving the document unsubscribes and runs `cleanup`. A plain-text render needs no `DOMParser`; an HTML string inside `<Reactive>` needs a global one (any browser).

`installReactive(df$)` adds `.reactive(config)` to defuss-query's selections (`df$.fn`) and returns `df$`. The method calls `reactive(config, selection)` and returns the selection. The CDN bundle calls it itself when it loads after defuss-query.

## Refs

```ts
createRef<T extends Element = HTMLElement, S = unknown>(state?: S): Ref<T, S> // { current: T | null, state?: S }
isRef(value): value is RefLike
```

morph sets `current` when it creates or patches the element that carries `ref={…}`.

## Low-level primitives

For framework integration (defuss-query is built on them); `globals` is optional everywhere and derived from the element's document.

| Export | What it does |
| --- | --- |
| `updateDomWithVdom(el, vnodes, globals?, mode?)` | The guarded VNode morph; `mode` is `"replace"` or `"diff"`. |
| `replaceDomWithVdom(el, vnodes, globals?)` | Removes every child (with handler teardown) and renders from scratch. |
| `htmlStringToVNodes(html, DOMParser)`, `domNodeToVNode(node)` | Markup or a DOM node as VNodes. |
| `getRenderer(document)` | Creates DOM from VNodes. |
| `registerDelegatedEvent(el, type, handler, options?)`, `removeDelegatedEvent`, `clearDelegatedEventsDeep` | The handler registry JSX event props use. |
| `onClearDelegatedEvents(hook)` | Runs `hook(element)` whenever morph removes or replaces an element; returns an unregister function. |
| `performTransition(el, update, config)` | The transition runner. |
