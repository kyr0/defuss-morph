# Integrations

Each package does one job and leaves rendering to defuss-morph. defuss-morph 0.3.0 is tested with defuss-query 0.2.0, defuss-store 0.1.0, defuss-i18n 0.2.0 and defuss-dom-router 0.1.1 (`devDependencies` in its `package.json`); the website runs all four.

## Setup

**With a bundler**: install what the task needs and import by name. The bundle then holds one copy of defuss-morph, which defuss-query and defuss-i18n import too.

```sh
bun add defuss-morph defuss-store defuss-query defuss-i18n defuss-dom-router
```

defuss-i18n 0.2.0 declares peer ranges older than these releases (`defuss-morph ^0.1.1`, `defuss-query ^0.1.0`); the package manager warns, and it works with defuss-morph 0.3.0 and defuss-query 0.2.0 in the tests.

**ES modules without a bundler**: an import map gives every package one URL, so all of them share one copy of defuss-morph. The website does this with copies of the published files:

```html
<script type="importmap">
{ "imports": {
  "defuss-morph": "./assets/defuss-morph.mjs",
  "defuss-morph/jsx-runtime": "./assets/defuss-morph.mjs",
  "defuss-query": "./assets/vendor/defuss-query/index.js",
  "defuss-store": "./assets/vendor/defuss-store/browser.js",
  "defuss-i18n": "./assets/vendor/defuss-i18n/index.js",
  "defuss-dom-router": "./assets/vendor/defuss-dom-router/index.js"
} }
</script>
```

**Classic CDN globals**: defuss-morph's `all.min.js` first, then defuss-query's `all.min.js` (it turns `window.df$` into the query function and keeps morph's API on it), then `df$.installReactive(df$)`. Loaded the other way round, defuss-morph installs `.reactive()` itself.

## defuss-store

```ts
import { computed, createStore } from "defuss-store";

const profile = createStore({ name: "Ada", visits: 0 });
profile.value.name;                  // read
profile.set("visits", 1);            // path write, notifies synchronously
profile.update((p) => ({ ...p, name: "Grace" }));
const greeting = computed(profile, (p) => `Hello, ${p.name}`); // notifies only when the string changes

reactive({ store: greeting, render: () => `<p>${esc(greeting.value)}</p>` }, el);
```

- Snapshots are immutable: write with `set` or `update`, never mutate `store.value`.
- `reactive()` accepts any `{ subscribe(listener) }` that returns an unsubscribe function, so another store library works as well.
- ESM only; Node 22.12 or newer on the server.

## defuss-query

```js
import df$ from "defuss-query";

df$("#list").html(markup);                         // morph; returns the selection
await df$("#card").html(next, { transition: { type: "fade", duration: 200, target: "self" } });
df$("#list").html(tags.map((tag) => ({ type: "li", attributes: { key: tag }, children: [tag] }))); // user text as text
df$("#form").on("submit", function (event) { event.preventDefault(); const data = df$(this).form(); });
df$("#name").text(userInput);                      // literal text, never parsed
```

- `df$(selector)` returns a snapshot Array of elements; `.find()`, `.closest()`, `.attr()`, `.prop()`, `.val()`, `.addClass()` work as in jQuery.
- `.on()` listens on each element natively; inside the handler use `this` for the element.
- `installReactive(df$)` from defuss-morph adds `.reactive(config)`.

## defuss-i18n

```html
<section data-i18n-component>
  <h2 data-i18n-target="title">Your order</h2>
  <template data-i18n-for="title" data-i18n-locale="en">Your order</template>
  <template data-i18n-for="title" data-i18n-locale="de">Ihre Bestellung</template>
  <input placeholder="Delivery note" data-i18n-placeholder-en="Delivery note" data-i18n-placeholder-de="Lieferhinweis">
</section>
```

```ts
import { bindI18n, createI18n } from "defuss-i18n";

const locale = createI18n({ locale: "en", fallback: ["en"] });
const binding = bindI18n(document.querySelector("[data-i18n-component]")!, locale);
locale.setLocale("de"); // synchronous: the <h2> and the placeholder are German, the typed note is kept
binding.dispose();       // when the component leaves the page
```

- Templates sit beside their target, never inside it.
- Attributes translate through `data-i18n-{attribute}-{locale}`.
- Markup that holds i18n templates may itself be rendered by morph: morph keeps a `<template>`'s content in `.content` (since 0.3.0).

## defuss-dom-router

```ts
import { morph } from "defuss-morph";
import { createRouter } from "defuss-dom-router";

const outlet = document.querySelector<HTMLElement>("main")!;
const esc = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const router = createRouter({
  routes: [{ id: "home", path: "/" }, { id: "project", path: "/projects/:id" }, { id: "missing", path: "*" }],
  prepare: ({ to }) => {
    const id = esc(to.params.id ?? ""); // params come from the URL: escape them like any user input
    const markup = to.routeId === "project"
      ? `<section key="project-${id}"><h1>Project ${id}</h1><input aria-label="Note"></section>`
      : `<section key="${to.routeId}"><h1>${to.routeId}</h1></section>`;
    return { commit: () => morph(outlet, markup) };
  },
});
router.attachLinks(document); // <a data-router-link href="/projects/7">
await router.start();
```

- `prepare()` builds the next view without touching the page; `commit()` renders it.
- The router catches what `prepare()` and `commit()` throw and reports it only to `onError`: pass one, or a view that throws fails without a trace.
- The view's root key names the record: query-only changes (`?tab=files`) keep typed input, another record gets fresh fields.
- Without a server that answers deep links with the app's HTML, use `mode: "hash"` and `href="#/projects/7"`.
- Keep UI that outlives routes (header, search) outside the outlet.
