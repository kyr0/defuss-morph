# Patterns

Start from these four patterns. Each runs live on https://morph.defuss.org/#patterns, from the sources in the repository's `docs/demos/` folder.

## Reactive rendering

One store, three ways to bind it. The store (defuss-store):

```ts
import { createStore } from "defuss-store";

export const cart = createStore({ items: [{ id: "tea", name: "Tea", qty: 1 }] });
export const add = (id: string) =>
  cart.update(({ items }) => ({ items: items.map((item) => (item.id === id ? { ...item, qty: item.qty + 1 } : item)) }));
```

### JSX: `<Reactive>`

```tsx
import { Reactive, morph } from "defuss-morph";

const CartList = () => (
  <Reactive tag="ul" store={cart} render={() =>
    cart.value.items.map((item) => (
      <li key={item.id}>
        {item.name} × {item.qty}
        <input placeholder="note" />
        <button type="button" onClick={() => add(item.id)}>+1</button>
      </li>
    ))
  } />
);

morph(app, <CartList />);
```

The wrapper is `<ul>`; each store change morphs the new rows in. A note typed into a row stays, and moves with the row when the order changes, because the rows are keyed and the input has no `value` in the markup.

### HTML: `reactive()`

```ts
import { reactive } from "defuss-morph";

const esc = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// one listener on the container: HTML strings carry no handlers
app.addEventListener("click", (event) => {
  const id = (event.target as Element).closest<HTMLElement>("[data-add]")?.dataset.add;
  if (id) add(id);
});

const dispose = reactive({
  store: cart,
  render: () => `<ol>${cart.value.items.map((item) =>
    `<li key="${item.id}">${esc(item.name)} × ${item.qty} <button type="button" data-add="${item.id}">+1</button></li>`).join("")}</ol>`,
}, app);
```

Call `dispose()` when the region goes away. `reactive()` renders synchronously: when `cart.set()` returns, the DOM shows the change.

### defuss-query: `df$(selector).reactive()`

```js
import df$ from "defuss-query";
import { installReactive } from "defuss-morph";

installReactive(df$);

const stop = new AbortController();
df$("[data-ref=cart-total]").reactive({
  store: cart,
  render: () => `<strong>${cart.value.items.reduce((sum, item) => sum + item.qty, 0)}</strong> items`,
  signal: stop.signal, // stop.abort() ends the binding; the method returns the selection
});
```

In TypeScript, `reactive(config, df$(selector))` is the typed form of the same call.

### Several stores, derived values

`store: [a, b]` re-renders on a change in either. `computed(store, (value) => value.name)` from defuss-store notifies only when its result changes: pass it as the store when a region depends on one field of a large store.

## Ref

```tsx
import { createRef, morph } from "defuss-morph";

const field = createRef<HTMLInputElement>();

const Search = () => (
  <form>
    <input ref={field} name="q" />
    <button type="button" onClick={() => field.current?.focus()}>Focus</button>
  </form>
);

morph(app, <Search />);
field.current?.select(); // set: morph assigns refs while it renders
```

A morph that keeps the `<input>` keeps `field.current` on the same node. In the component body, `field.current` still holds the previous render's element (or `null` on the first render): use it in handlers, in `onMount`, or after `morph()` returns.

A ref is also a `reactive()` target: `reactive({ store, render }, field)` reads `field.current` on each render.

## forwardRef

```tsx
import { Reactive, type Ref, createRef, morph } from "defuss-morph";
import { createStore } from "defuss-store";

const createStepper = () => {
  const count = createStore({ n: 0 });
  return { count, increment: () => count.set("n", count.value.n + 1), reset: () => count.set("n", 0) };
};
export type StepperApi = ReturnType<typeof createStepper>;

const Stepper = ({ label, ref = createRef<HTMLElement, StepperApi>() }: { label: string; ref?: Ref<HTMLElement, StepperApi> }) => {
  const api = (ref.state ??= createStepper());
  return (
    <Reactive ref={ref} store={api.count} render={() => (
      <>
        {label}: <output>{api.count.value.n}</output>
        <button type="button" onClick={api.increment}>+1</button>
      </>
    )} />
  );
};

const steps = createRef<HTMLElement, StepperApi>();
morph(app, (
  <div>
    <Stepper label="Steps" ref={steps} />
    <button type="button" onClick={() => steps.state?.reset()}>Reset</button>
  </div>
));
```

- The default `createRef()` makes the component work without a parent ref.
- The API and the state live on `ref.state`, created on the first render (`??=`), so a parent re-render, which calls `Stepper` again, keeps the count. A component without a parent ref gets a fresh ref, and so fresh state, on each parent render.
- `ref.current` is the wrapper element; `ref.state` is the API.

## Query references (HTML-first pages)

When the markup comes from a server, a CMS or a template, do not re-create it in JavaScript. Name its parts and select each once:

```html
<input type="search" data-ref="filter" aria-label="Filter">
<ul data-ref="list">
  <li key="ts">TypeScript</li>
  <li key="py">Python</li>
</ul>
<p data-ref="count">2 of 2</p>
```

```js
import df$ from "defuss-query";

const ui = { filter: df$("[data-ref=filter]"), list: df$("[data-ref=list]"), count: df$("[data-ref=count]") };
const items = ui.list.find("li").map((li) => ({ key: li.getAttribute("key"), name: li.textContent }));
const esc = (text) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

ui.filter.on("input", function () {
  const shown = items.filter((item) => item.name.toLowerCase().includes(this.value.toLowerCase()));
  ui.list.html(shown.map((item) => `<li key="${item.key}">${esc(item.name)}</li>`).join(""));
  ui.count.text(`${shown.length} of ${items.length}`);
});
```

- `key` attributes in server markup are read by morph, so the server-rendered items match the re-rendered ones.
- A selection is a snapshot Array: select once at start for parts that are never replaced, select again for parts a morph creates.
- Buttons rendered from HTML strings get one listener on a stable container, dispatching on `data-action` or `data-*` attributes.

## Without a build step

All of the above works in a plain page with the CDN bundle. JSX becomes `h()`:

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/defuss-morph@latest/dist/all.min.js"></script>
<script type="module">
  import { createStore } from "https://cdn.jsdelivr.net/npm/defuss-store@0.1.0/dist/browser.min.js";
  const { h, Reactive, morph } = df$;
  const counter = createStore({ n: 0 });
  morph(document.getElementById("app"), h(Reactive, {
    store: counter,
    render: () => h("button", { type: "button", onClick: () => counter.set("n", counter.value.n + 1) }, `clicked ${counter.value.n}`),
  }));
</script>
```

The repository's `examples/reactive-html.html` and `examples/reactive-jsx.html` are complete pages.
