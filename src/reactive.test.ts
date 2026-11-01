import { describe, expect, it } from "vitest";
import { computed, createStore } from "defuss-store";
import { createDf$ } from "defuss-query/core";
import { createDomI18n, createI18n } from "defuss-i18n/core";
import * as morphApi from "./index.js";
import {
  type ReactiveQueryMethod,
  type Ref,
  Reactive,
  createRef,
  h,
  installReactive,
  morph,
  reactive,
} from "./index.js";
import { recorder } from "./test-recorder.js";

// morph runs onMount in a microtask; an unmount is seen by a MutationObserver, then confirmed in a microtask
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const container = () => {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
};

describe("reactive()", () => {
  it("renders at once, then morphs every store change into the same nodes", () => {
    const cart = createStore({ count: 1 });
    const el = container();
    reactive({ store: cart, render: () => `<p>${cart.value.count} items</p><input class="note">` }, el);

    const p = el.querySelector("p")!;
    const input = el.querySelector("input")!;
    expect(p.textContent).toBe("1 items");
    input.value = "typed by the user";

    cart.set("count", 2);
    expect(el.querySelector("p")).toBe(p);
    expect(p.textContent).toBe("2 items");
    expect(el.querySelector("input")).toBe(input);
    expect(input.value).toBe("typed by the user");
  });

  it("renders VNodes with handlers; the handler of the latest render runs", () => {
    const counter = createStore({ n: 0 });
    const el = container();
    reactive(
      {
        store: counter,
        render: () => h("button", { onClick: () => counter.set("n", counter.value.n + 1) }, `clicked ${counter.value.n}`),
      },
      el,
    );
    const button = el.querySelector("button")!;
    button.click();
    button.click();
    expect(el.querySelector("button")).toBe(button);
    expect(button.textContent).toBe("clicked 2");
  });

  it("re-renders when any of several stores changes, also for computed() stores", () => {
    const first = createStore({ name: "Ada" });
    const items = createStore({ list: [1, 2] });
    const total = computed(items, (value) => value.list.length);
    const el = container();
    reactive({ store: [first, total], render: () => `${first.value.name}: ${total.value}` }, el);
    expect(el.textContent).toBe("Ada: 2");
    first.set("name", "Grace");
    expect(el.textContent).toBe("Grace: 2");
    items.set("list", [1, 2, 3]);
    expect(el.textContent).toBe("Grace: 3");
  });

  it("the dispose function unsubscribes and runs cleanup once", () => {
    const store = createStore({ n: 1 });
    const cleanup = recorder();
    const el = container();
    const dispose = reactive({ store, render: () => String(store.value.n), cleanup }, el);
    dispose();
    dispose();
    store.set("n", 2);
    expect(el.textContent).toBe("1");
    expect(cleanup.calls).toHaveLength(1);
  });

  it("an aborted signal disposes; an already aborted one renders nothing", () => {
    const store = createStore({ n: 1 });
    const cleanup = recorder();
    const el = container();
    const abort = new AbortController();
    reactive({ store, render: () => String(store.value.n), cleanup, signal: abort.signal }, el);
    abort.abort();
    store.set("n", 2);
    expect(el.textContent).toBe("1");
    expect(cleanup.calls).toHaveLength(1);

    const late = container();
    reactive({ store, render: () => "never", cleanup, signal: abort.signal }, late);
    expect(late.textContent).toBe("");
    expect(cleanup.calls).toHaveLength(1);
  });

  it("reads a ref on every render, and refuses a ref that has no element yet", () => {
    const store = createStore({ n: 1 });
    const ref = createRef<HTMLDivElement>();
    expect(() => reactive({ store, render: () => "x" }, ref)).toThrow(/no element yet/);

    const el = container();
    morph(el, h("div", { ref, class: "target" }));
    reactive({ store, render: () => `<b>${store.value.n}</b>` }, ref);
    expect(ref.current!.innerHTML).toBe("<b>1</b>");
    store.set("n", 2);
    expect(el.innerHTML).toBe('<div class="target"><b>2</b></div>');
  });

  it("renders into every element of a list; an empty list renders and subscribes nothing", () => {
    const store = createStore({ n: 1 });
    const el = container();
    morph(el, `<p></p><p></p>`);
    reactive({ store, render: () => `<i>${store.value.n}</i>` }, el.querySelectorAll("p"));
    store.set("n", 2);
    expect(el.innerHTML).toBe("<p><i>2</i></p><p><i>2</i></p>");

    let renders = 0;
    reactive({ store, render: () => String(++renders) }, el.querySelectorAll("nothing"));
    store.set("n", 3);
    expect(renders).toBe(0);
  });

  it("rejects a store without subscribe() before it subscribes to any", () => {
    const good = createStore({ n: 1 });
    let renders = 0;
    const el = container();
    expect(() => reactive({ store: [good, {} as never], render: () => String(++renders) }, el)).toThrow(/store 1 has no subscribe/);
    good.set("n", 2);
    expect(renders).toBe(0);
    expect(() => reactive({ store: good, render: "x" as never }, el)).toThrow(/render must be a function/);
    expect(() => reactive({ store: good, render: () => "x" }, {} as never)).toThrow(/must be an element, a ref or a list/);
  });

  it("accepts stores whose subscribe() returns an object with unsubscribe()", () => {
    // an observable in the RxJS shape, written out
    const listeners = new Set<() => void>();
    let value = "a";
    const observable = {
      subscribe(listener: () => void) {
        listeners.add(listener);
        return { unsubscribe: () => listeners.delete(listener) };
      },
    };
    const el = container();
    const dispose = reactive({ store: observable, render: () => value }, el);
    value = "b";
    for (const listener of listeners) listener();
    expect(el.textContent).toBe("b");
    dispose();
    expect(listeners.size).toBe(0);
  });
});

describe("<Reactive />", () => {
  it("renders its wrapper with the first render inside, and re-renders once mounted", async () => {
    const counter = createStore({ n: 1 });
    const el = container();
    morph(el, h(Reactive, { tag: "section", className: "counter", "data-x": "1", store: counter, render: () => h("p", null, `n=${counter.value.n}`) }));

    const section = el.querySelector("section")!;
    expect(section.outerHTML).toBe('<section class="counter" data-x="1"><p>n=1</p></section>');

    await settle();
    const p = section.querySelector("p");
    counter.set("n", 2);
    expect(section.querySelector("p")).toBe(p);
    expect(section.textContent).toBe("n=2");
  });

  it("picks up a store change made before its mount callback ran", async () => {
    const counter = createStore({ n: 1 });
    const el = container();
    morph(el, h(Reactive, { store: counter, render: () => `n=${counter.value.n}` }));
    counter.set("n", 5);
    await settle();
    expect(el.textContent).toBe("n=5");
  });

  it("a parent re-render keeps one subscription per wrapper, on the latest render function", async () => {
    const counter = createStore({ n: 1 });
    const renders: string[] = [];
    const view = (label: string) =>
      h(Reactive, { key: "r", store: counter, render: () => (renders.push(label), `${label} ${counter.value.n}`) });
    const el = container();
    morph(el, view("first"));
    await settle();
    const wrapper = el.firstElementChild;
    morph(el, view("second"));
    await settle();
    expect(el.firstElementChild).toBe(wrapper);

    renders.length = 0;
    counter.set("n", 2);
    expect(renders).toEqual(["second"]);
    expect(el.textContent).toBe("second 2");
  });

  it("leaving the document ends the subscription, runs cleanup and the element's onUnmount", async () => {
    const counter = createStore({ n: 1 });
    const cleanup = recorder();
    const onUnmount = recorder<[Element]>();
    let renders = 0;
    const el = container();
    morph(el, h(Reactive, { tag: "aside", store: counter, cleanup, onUnmount, render: () => String(++renders) }));
    await settle();
    const aside = el.querySelector("aside");

    morph(el, "<p>gone</p>");
    await settle();
    await settle();
    const before = renders;
    counter.set("n", 2);
    expect(renders).toBe(before);
    expect(cleanup.calls).toHaveLength(1);
    // the element that left (morph called onUnmount without it before 0.3.0)
    expect(onUnmount.calls).toEqual([[aside]]);
  });

  it("forwardRef pattern: a parent's ref reaches the wrapper and the API the component puts on ref.state", async () => {
    type StepperApi = { increment(): void };
    const Stepper = ({ ref = createRef<HTMLElement, StepperApi>() }: { ref?: Ref<HTMLElement, StepperApi> }) => {
      const value = createStore({ n: 0 });
      ref.state = { increment: () => value.set("n", value.value.n + 1) };
      return h(Reactive, { ref, tag: "output", store: value, render: () => String(value.value.n) });
    };

    const stepper = createRef<HTMLElement, StepperApi>();
    const el = container();
    morph(el, h(Stepper, { ref: stepper }));
    await settle();
    expect(stepper.current).toBe(el.querySelector("output"));
    stepper.state!.increment();
    expect(stepper.current!.textContent).toBe("1");
  });

  it("renders plain text without a DOMParser; markup without one is refused with a reason", () => {
    const store = createStore({ n: 7 });
    const globals = globalThis as { DOMParser?: typeof DOMParser };
    const Parser = globals.DOMParser;
    delete globals.DOMParser; // a server: Node with happy-dom's Window not installed as globals
    try {
      expect(Reactive({ store, render: () => String(store.value.n) }).children).toEqual(["7"]);
      expect(() => Reactive({ store, render: () => "<b>7</b>" })).toThrow(/needs a global DOMParser/);
    } finally {
      globals.DOMParser = Parser;
    }
  });

  it("rejects a missing render function or store", () => {
    const store = createStore({});
    expect(() => Reactive({ store, render: undefined as never })).toThrow(/render prop must be a function/);
    expect(() => Reactive({ store: undefined as never, render: () => "" })).toThrow(/has no subscribe/);
  });
});

describe("refs", () => {
  it("a ref keeps pointing at the same node across morphs", () => {
    const field = createRef<HTMLInputElement>();
    const form = () => h("form", null, h("input", { ref: field, name: "q" }));
    const el = container();
    morph(el, form());
    const first = field.current;
    expect(first?.tagName).toBe("INPUT");
    morph(el, form());
    expect(field.current).toBe(first);
  });
});

describe("defuss-query: installReactive()", () => {
  it("adds .reactive() to selections: it renders into each element, returns the selection and ends on abort", () => {
    const df$ = installReactive(createDf$(morphApi));
    const el = container();
    el.id = "query-target";
    morph(el, `<p class="out"></p><p class="out"></p>`);

    const store = createStore({ n: 1 });
    const abort = new AbortController();
    const selection = df$("#query-target .out") as ReturnType<typeof df$> & ReactiveQueryMethod;
    expect(selection.reactive({ store, render: () => `<b>${store.value.n}</b>`, signal: abort.signal })).toBe(selection);
    store.set("n", 2);
    expect(el.innerHTML).toBe('<p class="out"><b>2</b></p><p class="out"><b>2</b></p>');
    abort.abort();
    store.set("n", 3);
    expect(el.textContent).toBe("22");
  });

  it("is idempotent and rejects anything that is not defuss-query's df$", () => {
    const df$ = createDf$(morphApi);
    expect(installReactive(installReactive(df$))).toBe(df$);
    expect(() => installReactive({})).toThrow(TypeError);
    expect(() => installReactive(morphApi)).toThrow(TypeError);
  });
});

describe("defuss-i18n on defuss-query and this morph", () => {
  it("a language switch translates the region and keeps what the user typed", () => {
    const df$ = createDf$(morphApi);
    const { bind } = createDomI18n(df$);
    const el = container();
    morph(
      el,
      `<section data-i18n-component>
        <h2 data-i18n-target="title">Hello</h2>
        <template data-i18n-for="title" data-i18n-locale="en">Hello</template>
        <template data-i18n-for="title" data-i18n-locale="de">Hallo</template>
        <input name="note">
      </section>`,
    );
    const locale = createI18n({ locale: "en", fallback: ["en"] });
    const binding = bind(el.querySelector("section")!, locale);
    const heading = el.querySelector("h2");
    const input = el.querySelector("input")!;
    input.value = "typed";

    locale.setLocale("de");
    expect(el.querySelector("h2")).toBe(heading);
    expect(heading!.textContent).toBe("Hallo");
    expect(el.querySelector("input")).toBe(input);
    expect(input.value).toBe("typed");
    binding.dispose();
  });
});
