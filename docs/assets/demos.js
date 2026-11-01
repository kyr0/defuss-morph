// docs/demos/bench-ui.ts
import { morph as morph2 } from "defuss-morph";

// docs/demos/bench.ts
import { morph } from "defuss-morph";
var ADJECTIVES = ["pretty", "large", "big", "small", "tall", "short", "long", "handsome", "plain", "quaint", "clean", "elegant", "easy", "angry", "crazy", "helpful", "mushy", "odd", "unsightly", "adorable", "important", "inexpensive", "cheap", "expensive", "fancy"];
var COLOURS = ["red", "yellow", "blue", "green", "pink", "brown", "purple", "white", "black", "orange"];
var NOUNS = ["table", "chair", "house", "bbq", "desk", "car", "pony", "cookie", "sandwich", "burger", "pizza", "mouse", "keyboard"];
var build = (count, from = 1) => Array.from({ length: count }, (_, i) => {
  const id = from + i;
  return { id, label: `${ADJECTIVES[id * 7 % ADJECTIVES.length]} ${COLOURS[id * 3 % COLOURS.length]} ${NOUNS[id * 11 % NOUNS.length]}` };
});
var thousand = () => build(1000);
var RERENDERS = 500;
var smallViewSteps = (rows) => Array.from({ length: RERENDERS }, (_, step) => rows.map((row, i) => i === step % rows.length ? { ...row, label: `${row.label} ${step}` } : row));
var OPS = [
  { id: "create", label: "create 1,000 rows", before: () => [], after: () => thousand(), changes: (_, after) => after },
  { id: "replace", label: "replace all 1,000 rows", before: thousand, after: () => build(1000, 1001) },
  {
    id: "update",
    label: "update every 10th row",
    before: thousand,
    after: (rows) => rows.map((row, i) => i % 10 === 0 ? { ...row, label: `${row.label} !!!` } : row),
    changes: (_, after) => after.filter((_, i) => i % 10 === 0)
  },
  {
    id: "select",
    label: "select a row",
    before: thousand,
    after: (rows) => rows.map((row, i) => i === 499 ? { ...row, selected: true } : row),
    changes: (_, after) => [after[499]]
  },
  {
    id: "swap",
    label: "swap rows 2 and 999",
    before: thousand,
    after: (rows) => {
      const next = rows.slice();
      [next[1], next[998]] = [next[998], next[1]];
      return next;
    }
  },
  { id: "remove", label: "remove a row", before: thousand, after: (rows) => rows.filter((_, i) => i !== 499) },
  {
    id: "append",
    label: "append 1,000 rows",
    before: thousand,
    after: (rows) => [...rows, ...build(1000, 1001)],
    changes: (before, after) => after.slice(before.length)
  },
  { id: "clear", label: "clear 1,000 rows", before: thousand, after: () => [] },
  { id: "create-10k", label: "create 10,000 rows", before: () => [], after: () => build(1e4), changes: (_, after) => after, runs: 3 },
  {
    id: "rerender",
    label: `re-render 10 rows ${RERENDERS} times`,
    before: () => build(10),
    after: (rows) => smallViewSteps(rows).at(-1),
    steps: smallViewSteps,
    changes: (before, after) => after.filter((row, i) => row.label !== before[i].label)
  }
];
var rowHtml = (row, keyed) => `<tr${keyed ? ` key="${row.id}"` : ""}${row.selected ? ' class="selected"' : ""}><td>${row.id}</td><td><a>${row.label}</a></td><td><button type="button" aria-label="Remove">×</button></td></tr>`;
var rowVNode = (row, keyed) => ({
  type: "tr",
  attributes: { ...keyed ? { key: row.id } : {}, ...row.selected ? { class: "selected" } : {} },
  children: [
    { type: "td", attributes: {}, children: [String(row.id)] },
    { type: "td", attributes: {}, children: [{ type: "a", attributes: {}, children: [row.label] }] },
    { type: "td", attributes: {}, children: [{ type: "button", attributes: { type: "button", "aria-label": "Remove" }, children: ["×"] }] }
  ]
});
var markup = (rows, keyed, input) => input === "html" ? rows.map((row) => rowHtml(row, keyed)).join("") : rows.map((row) => rowVNode(row, keyed));
var METHODS = [
  {
    id: "innerHTML",
    label: "innerHTML",
    setup: (tbody, rows) => {
      tbody.innerHTML = markup(rows, false, "html");
    },
    prepare: (tbody, _op, _before, after) => {
      const html = markup(after, false, "html");
      return () => {
        tbody.innerHTML = html;
      };
    }
  },
  {
    id: "keyed",
    label: "morph, keyed",
    setup: (tbody, rows, input) => morph(tbody, markup(rows, true, input)),
    prepare: (tbody, _op, _before, after, input) => {
      const content = markup(after, true, input);
      return () => morph(tbody, content);
    }
  },
  {
    id: "non-keyed",
    label: "morph, non-keyed",
    setup: (tbody, rows, input) => morph(tbody, markup(rows, false, input)),
    prepare: (tbody, _op, _before, after, input) => {
      const content = markup(after, false, input);
      return () => morph(tbody, content);
    }
  },
  {
    id: "diff",
    label: "morph diff, keyed",
    setup: (tbody, rows, input) => morph(tbody, markup(rows, true, input)),
    prepare: (tbody, op, before, after, input) => {
      if (!op.changes)
        return null;
      const content = markup(op.changes(before, after), true, input);
      return () => morph(tbody, content, { diff: true });
    }
  }
];

// docs/demos/bench-ui.ts
var ms = (value) => value < 100 ? value.toFixed(1) : String(Math.round(value));
var cell = (result, best) => {
  if (!result)
    return "";
  if (result.median === null)
    return `<span class="dm-bench-na" title="Diff mode never removes or moves rows">n/a</span>`;
  if (!result.ok)
    return `<span class="dm-bench-wrong">wrong</span>`;
  const range = `${ms(result.min)} to ${ms(result.max)} ms`;
  return `<span title="${range}"${best ? ' class="dm-bench-best"' : ""}>${ms(result.median)}</span>`;
};
var rows = (results) => OPS.map((op) => {
  const measured = METHODS.map((method) => results.get(`${op.id}/${method.id}`)).filter((r) => r?.median != null && r.ok);
  const best = measured.length > 1 ? Math.min(...measured.map((r) => r.median)) : null;
  return `<tr class="table-row" key="${op.id}" data-op="${op.id}"><th class="table-cell" scope="row">${op.label}</th>${METHODS.map((method) => {
    const result = results.get(`${op.id}/${method.id}`);
    return `<td class="table-cell" data-method="${method.id}">${cell(result, best !== null && result?.median === best)}</td>`;
  }).join("")}</tr>`;
}).join("");
var stage = (frame) => new Promise((resolve, reject) => {
  const take = () => {
    const bench = frame.contentWindow?.bench;
    if (bench)
      resolve(bench);
    else
      reject(new Error("the benchmark frame has no benchmark"));
  };
  if (frame.contentDocument?.readyState === "complete" && frame.contentWindow?.location.href !== "about:blank")
    take();
  else
    frame.addEventListener("load", take, { once: true });
});
var mountBench = (root) => {
  const body = root.querySelector("[data-ref=bench-results]");
  const status = root.querySelector("[data-ref=bench-status]");
  const runButton = root.querySelector("[data-ref=bench-run]");
  const toggles = [...root.querySelectorAll("[data-input]")];
  const frame = root.querySelector("iframe");
  const results = new Map;
  morph2(body, rows(results));
  runButton.addEventListener("click", async () => {
    const input = toggles.find((t) => t.getAttribute("aria-pressed") === "true")?.dataset.input ?? "html";
    const inputName = input === "html" ? "HTML strings" : "VNodes";
    results.clear();
    morph2(body, rows(results));
    runButton.disabled = true;
    for (const toggle of toggles)
      toggle.disabled = true;
    const started = performance.now();
    try {
      const bench = await stage(frame);
      await bench.run({
        input,
        onResult: (result, done, total) => {
          results.set(`${result.op}/${result.method}`, result);
          morph2(body, rows(results));
          status.value = `Measuring with ${inputName}: ${done} of ${total}`;
        }
      });
      status.value = `Done in ${((performance.now() - started) / 1000).toFixed(1)} s with ${inputName}.`;
    } catch (error) {
      status.value = `Stopped: ${error.message}`;
    } finally {
      runButton.disabled = false;
      for (const toggle of toggles)
        toggle.disabled = false;
    }
  });
};

// docs/demos/cart-html.ts
import { reactive } from "defuss-morph";

// docs/demos/cart.ts
import { createStore } from "defuss-store";
var cart = createStore({
  items: [
    { id: "tea", name: "Tea", qty: 1 },
    { id: "milk", name: "Milk", qty: 2 },
    { id: "bread", name: "Bread", qty: 1 }
  ]
});
var add = (id) => cart.update(({ items }) => ({
  items: items.map((item) => item.id === id ? { ...item, qty: item.qty + 1 } : item)
}));
var reverse = () => cart.update(({ items }) => ({ items: [...items].reverse() }));
var total = () => cart.value.items.reduce((sum, item) => sum + item.qty, 0);
var esc = (text) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// docs/demos/cart-html.ts
function mountCartHtml(app) {
  app.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (button?.dataset.add)
      add(button.dataset.add);
    if (button?.dataset.action === "reverse")
      reverse();
  });
  return reactive({
    store: cart,
    render: () => `
      <ol class="dm-cart">${cart.value.items.map((item) => `
        <li key="${item.id}">${esc(item.name)} × ${item.qty}
          <button type="button" class="btn" data-size="sm" data-add="${item.id}">+1</button></li>`).join("")}
      </ol>
      <p>${total()} items <button type="button" class="btn" data-variant="outline" data-size="sm" data-action="reverse">Reverse</button></p>`
  }, app);
}

// docs/demos/cart-jsx.tsx
import { Reactive, morph as morph3 } from "defuss-morph";
import { jsx, jsxs } from "defuss-morph/jsx-runtime";
var CartList = () => /* @__PURE__ */ jsx(Reactive, {
  tag: "ul",
  class: "dm-cart",
  store: cart,
  render: () => cart.value.items.map((item) => /* @__PURE__ */ jsxs("li", {
    children: [
      /* @__PURE__ */ jsxs("span", {
        children: [
          item.name,
          " × ",
          item.qty
        ]
      }),
      /* @__PURE__ */ jsx("input", {
        class: "input",
        "data-size": "sm",
        placeholder: "note",
        "aria-label": `${item.name} note`
      }),
      /* @__PURE__ */ jsx("button", {
        type: "button",
        class: "btn",
        "data-size": "sm",
        onClick: () => add(item.id),
        children: "+1"
      })
    ]
  }, item.id))
});
var mountCartJsx = (app) => morph3(app, /* @__PURE__ */ jsx(CartList, {}));

// docs/demos/cart-query.js
import df$ from "defuss-query";
import { installReactive } from "defuss-morph";
installReactive(df$);
var mountCartQuery = () => df$("[data-ref=cart-total]").reactive({
  store: cart,
  render: () => `<strong>${total()}</strong> items in total`
});

// docs/demos/forward-ref.tsx
import { Reactive as Reactive2, createRef, morph as morph4 } from "defuss-morph";
import { createStore as createStore2 } from "defuss-store";
import { jsx as jsx2, jsxs as jsxs2, Fragment } from "defuss-morph/jsx-runtime";
var createStepper = () => {
  const count = createStore2({ n: 0 });
  return {
    count,
    increment: () => count.set("n", count.value.n + 1),
    reset: () => count.set("n", 0)
  };
};
var Stepper = ({ label, ref = createRef() }) => {
  const api = ref.state ??= createStepper();
  return /* @__PURE__ */ jsx2(Reactive2, {
    ref,
    class: "dm-stepper",
    store: api.count,
    render: () => /* @__PURE__ */ jsxs2(Fragment, {
      children: [
        /* @__PURE__ */ jsxs2("span", {
          children: [
            label,
            ": ",
            /* @__PURE__ */ jsx2("output", {
              children: api.count.value.n
            })
          ]
        }),
        /* @__PURE__ */ jsx2("button", {
          type: "button",
          class: "btn",
          "data-size": "sm",
          onClick: api.increment,
          children: "+1"
        })
      ]
    })
  });
};
var steps = createRef();
var mountForwardRef = (app) => morph4(app, /* @__PURE__ */ jsxs2("div", {
  class: "dm-stack",
  children: [
    /* @__PURE__ */ jsx2(Stepper, {
      label: "Steps",
      ref: steps
    }),
    /* @__PURE__ */ jsx2(Stepper, {
      label: "On its own"
    }),
    /* @__PURE__ */ jsx2("button", {
      type: "button",
      class: "btn",
      "data-variant": "outline",
      onClick: () => steps.state?.reset(),
      children: "Reset Steps from the parent"
    })
  ]
}));

// docs/demos/query-refs.js
import df$2 from "defuss-query";
var ui = {
  filter: df$2("[data-ref=lang-filter]"),
  list: df$2("[data-ref=lang-list]"),
  count: df$2("[data-ref=lang-count]")
};
var languages = ui.list.find("li").map((li) => ({ key: li.getAttribute("key"), name: li.textContent }));
var esc2 = (text) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
var mountQueryRefs = () => ui.filter.on("input", function() {
  const query = this.value.trim().toLowerCase();
  const shown = languages.filter((lang) => lang.name.toLowerCase().includes(query));
  ui.list.html(shown.map((lang) => `<li key="${lang.key}">${esc2(lang.name)}</li>`).join(""));
  ui.count.text(`${shown.length} of ${languages.length}`);
});

// docs/demos/ref.tsx
import { createRef as createRef2, morph as morph5 } from "defuss-morph";
import { jsx as jsx3, jsxs as jsxs3 } from "defuss-morph/jsx-runtime";
var field = createRef2();
var Search = ({ renders, onRender }) => /* @__PURE__ */ jsxs3("form", {
  class: "dm-row",
  onSubmit: (event) => event.preventDefault(),
  children: [
    /* @__PURE__ */ jsx3("input", {
      ref: field,
      class: "input",
      name: "q",
      placeholder: "Type, then render again",
      "aria-label": "Search"
    }),
    /* @__PURE__ */ jsx3("button", {
      type: "button",
      class: "btn",
      "data-variant": "outline",
      onClick: () => field.current?.focus(),
      children: "Focus via ref"
    }),
    /* @__PURE__ */ jsx3("button", {
      type: "button",
      class: "btn",
      onClick: onRender,
      children: "Render again"
    }),
    /* @__PURE__ */ jsx3("output", {
      children: renders === 1 ? "1 render" : `${renders} renders`
    })
  ]
});
function mountRef(app) {
  let renders = 0;
  const render = () => morph5(app, /* @__PURE__ */ jsx3(Search, {
    renders: ++renders,
    onRender: render
  }));
  render();
}

// docs/demos/with-i18n.ts
import { bindI18n, createI18n } from "defuss-i18n";
var locale = createI18n({ locale: "en", fallback: ["en"] });
function mountWithI18n(app) {
  bindI18n(app.querySelector("[data-i18n-component]"), locale);
  app.addEventListener("click", (event) => {
    const tag = event.target.closest("[data-locale]")?.dataset.locale;
    if (tag)
      locale.setLocale(tag);
  });
}

// docs/demos/with-query.js
import df$3 from "defuss-query";
var tags = ["morph", "query"];
var list = df$3("[data-ref=tag-list]");
var render = () => list.html(tags.map((tag) => ({ type: "li", attributes: { key: tag, class: "badge", "data-variant": "secondary" }, children: [tag] })));
function mountWithQuery() {
  render();
  df$3("[data-ref=tag-form]").on("submit", function(event) {
    event.preventDefault();
    const tag = String(df$3(this).form().get("tag") ?? "").trim();
    if (tag && !tags.includes(tag))
      tags.push(tag);
    df$3(this).find("input").val("");
    render();
  });
}

// docs/demos/with-store.ts
import { reactive as reactive2 } from "defuss-morph";
import { computed, createStore as createStore3 } from "defuss-store";
var profile = createStore3({ name: "Ada", visits: 0 });
var greeting = computed(profile, (value) => `Hello, ${value.name}`);
function mountWithStore(app) {
  const part = (name) => app.querySelector(`[data-ref=${name}]`);
  let renders = 0;
  reactive2({ store: greeting, render: () => `${esc(greeting.value)} <small>(render ${++renders})</small>` }, part("greeting"));
  reactive2({ store: profile, render: () => `${profile.value.visits} visits` }, part("visits"));
  part("visit").addEventListener("click", () => profile.set("visits", profile.value.visits + 1));
  part("rename").addEventListener("click", () => profile.set("name", profile.value.name === "Ada" ? "Grace" : "Ada"));
}

// docs/demos/index.ts
var byId = (id) => document.getElementById(id);
mountCartJsx(byId("live-cart-jsx"));
mountCartHtml(byId("live-cart-html"));
mountCartQuery();
mountRef(byId("live-ref"));
mountForwardRef(byId("live-forward-ref"));
mountQueryRefs();
mountWithQuery();
mountWithStore(byId("live-store"));
mountWithI18n(byId("live-i18n"));
mountBench(byId("bench"));
