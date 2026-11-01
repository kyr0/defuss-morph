# Pitfalls

Mistakes that compile and run, and break state. Each has a fix.

| Symptom | Cause | Fix |
| --- | --- | --- |
| Typed text jumps to another row after a reorder | List items without `key`; morph matched them by tag in order | `key` with a stable ID on the outermost element of each item; in JSX on the component call |
| A ticked box stays ticked after the markup drops `checked` | HTML cannot say "unchecked"; absent means "leave it" | A VNode: `morph(el, [{ attributes: { id: "c", checked: false } }], { diff: true })`, or JSX with `checked={false}` |
| An input keeps an old value although the markup changed | Same rule: markup without `value` leaves the live value | Send `value` in a VNode, or give the input a new `key` to recreate it |
| Another record shows the previous record's typed input | The view's root matched the old one (same tag, no key) | Key the view root by record: `<section key="project-7">` |
| `onclick="…"` stays after a morph that omits it | Inline `on*` attributes are never removed | `addEventListener`, or JSX event props |
| A diff change-set does not delete or reorder | Diff mode only patches and appends | A full `morph()` of the parent |
| `TypeError: morph diff: patch items must be elements with a key or id` | A change-set item without `key`/`id`, or plain text | Address every item |
| A component's counter resets on a parent render | Component functions run on every render; there are no hooks | A store outside the component, or state on `ref.state` |
| `ref.current` is `null` in the component body | The element does not exist yet in this render | Read it in a handler, in `onMount` or after `morph()` returns |
| `reactive(config, ref)` throws "the ref has no element yet" | `reactive()` ran before the element was rendered | Call it after the `morph()` that renders the element, or in its `onMount` |
| A store change right after `morph(app, <Reactive …/>)` is applied a microtask later | `<Reactive>` subscribes in `onMount`, a microtask after insertion; it renders once there to catch up | In tests, await a macrotask (`setTimeout(r, 0)`) before asserting; in apps nothing is lost |
| A handler stays after a re-render that dropped its event prop | Two copies of defuss-morph on one page (a CDN bundle and a bundled copy, or two bundles); each keeps its own handler registry and cannot remove the other's handlers | One copy: one bundle, or an import map; defuss-query and defuss-i18n import the same one |
| `df$(selector).reactive is not a function` | defuss-morph loaded before defuss-query, or a bundled `df$` | `installReactive(df$)` once |
| `.reactive()` binding never ends | It returns the selection, not a dispose function | Pass `signal` from an `AbortController` and abort it |
| A `<script>` in morphed HTML runs; an attribute runs code | morph renders, it does not sanitize | Never morph untrusted HTML without a sanitizer; put user text in as VNode text or `.text()` |
| Typed text is lost after a re-render | The region was rebuilt with `innerHTML`, or the element was recreated by a tag or key change | `morph()`; keep tag and key stable for elements that hold state |
| An animated morph and the next morph run out of order | A transition morph returns a Promise | `await` it, or chain the calls |

## Not supported

- Async components: `jsx()` calls a component and uses what it returns; resolve data before the render.
- Hooks or a component instance tree: state belongs in stores and on refs.
- Server-side HTML strings inside `<Reactive>` without a `DOMParser`: return JSX/VNodes there (plain text is fine), or use `reactive()` with the server document's element.
