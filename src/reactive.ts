import { morph } from "./api.js";
import { htmlStringToVNodes } from "./html.js";
import { isRef } from "./ref.js";
import type { RefLike, RenderInput, VNode, VNodeChild } from "./types.js";

/**
 * Why: re-rendering a region whenever a store changes is the loop most pages need, and morph makes the naive
 * version correct: render the whole region again and morph it in, and every node that stays keeps its focus, typed
 * input and listeners. Three entry points share one core, as in defuss: `reactive()` for a known element or ref,
 * `<Reactive />` for a JSX tree, and defuss-query's `df$(selector).reactive()` for markup already in the page.
 */

/**
 * What `reactive()` subscribes to: a defuss-store store (`createStore()`, `computed()`), or anything whose
 * `subscribe(listener)` returns an unsubscribe function or an object with `unsubscribe()`.
 */
export interface Subscribable {
  subscribe(listener: (...args: any[]) => unknown): unknown;
}

/** Configuration of {@link reactive} and {@link Reactive}. */
export interface ReactiveConfig {
  /** One store, or several: a change in any of them re-renders. */
  store: Subscribable | readonly Subscribable[];
  /** Returns the region's next content: JSX/VNodes or an HTML string. Keep it pure; it may run more often than the stores change. */
  render: () => RenderInput;
  /** Runs once, when the region is disposed (the returned function, `signal` or the `<Reactive>` element's unmount). */
  cleanup?: () => void;
  /** Disposes the region when aborted: the way to end a `df$(...).reactive()` binding, which returns the selection. */
  signal?: AbortSignal;
}

/** Where {@link reactive} renders: an element, a ref to one, or a list of elements (a defuss-query selection, a NodeList). */
export type ReactiveTarget = Element | RefLike | ArrayLike<Element>;

const isElement = (value: unknown): value is Element =>
  typeof value === "object" && value !== null && (value as Node).nodeType === 1;

/** The stores as a list, each checked before any subscription starts, so a bad entry leaks nothing. */
const toStores = (store: ReactiveConfig["store"] | undefined, caller: string): readonly Subscribable[] => {
  const stores = Array.isArray(store) ? store : [store];
  stores.forEach((candidate, index) => {
    if (typeof (candidate as Subscribable | undefined)?.subscribe !== "function") {
      throw new TypeError(`${caller}: store${Array.isArray(store) ? ` ${index}` : ""} has no subscribe() method`);
    }
  });
  return stores as readonly Subscribable[];
};

/** Subscribes `update` to every store; the result unsubscribes from all of them. */
const listen = (stores: readonly Subscribable[], update: () => void): (() => void) => {
  const unsubscribes = stores.map((store) => {
    const result = store.subscribe(() => update());
    if (typeof result === "function") return result as () => unknown;
    return () => (result as { unsubscribe?: () => unknown } | undefined)?.unsubscribe?.();
  });
  return () => {
    for (const unsubscribe of unsubscribes) unsubscribe();
  };
};

/** The elements a target names at render time: a ref is read on every render, a list is a snapshot. */
const resolveTarget = (target: ReactiveTarget): (() => Element[]) => {
  if (isElement(target)) return () => [target];
  if (isRef(target)) {
    if (!isElement(target.current)) {
      throw new TypeError(
        "reactive: the ref has no element yet; call reactive() after the element is rendered (in onMount or later)",
      );
    }
    return () => (isElement(target.current) ? [target.current] : []);
  }
  if (target && typeof (target as ArrayLike<Element>).length === "number") {
    const elements = Array.from(target as ArrayLike<Element>).filter(isElement);
    return () => elements;
  }
  throw new TypeError("reactive: the target must be an element, a ref or a list of elements");
};

/**
 * Renders `config.render()` into `target` now, then again whenever a store changes, by morphing it in: nodes that
 * stay keep their identity, focus, typed input and listeners. The first render runs before the subscriptions start.
 * Returns the dispose function: it unsubscribes from every store and runs `config.cleanup` once.
 *
 * @example
 * ```ts
 * import { reactive } from "defuss-morph";
 * import { createStore } from "defuss-store";
 *
 * const cart = createStore({ count: 0 });
 * const dispose = reactive({ store: cart, render: () => `<p>${cart.value.count} items</p>` }, cartEl);
 * cart.set("count", 2); // <p>2 items</p>, the same <p> as before
 * ```
 */
export function reactive(config: ReactiveConfig, target: ReactiveTarget): () => void {
  const stores = toStores(config?.store, "reactive");
  if (typeof config.render !== "function") throw new TypeError("reactive: config.render must be a function");
  const elements = resolveTarget(target);
  if (config.signal?.aborted || elements().length === 0) return () => {};

  // one render per element: VNodes carry refs and handlers, which must not be shared between two elements
  const update = () => {
    for (const el of elements()) morph(el, config.render());
  };
  update();

  const unsubscribe = listen(stores, update);
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    unsubscribe();
    config.signal?.removeEventListener("abort", dispose);
    config.cleanup?.();
  };
  config.signal?.addEventListener("abort", dispose, { once: true });
  return dispose;
}

/** Props of {@link Reactive}: the {@link ReactiveConfig}, the wrapper's tag and any attribute for the wrapper. */
export interface ReactiveProps extends Omit<ReactiveConfig, "signal"> {
  /** The wrapper element's tag. Default: `"div"`. */
  tag?: string;
  /** Set to the wrapper element. */
  ref?: RefLike;
  [attribute: string]: unknown;
}

/** The live subscription of each mounted `<Reactive>` wrapper, with the cleanup of its latest render. */
const mounted = new WeakMap<Element, { unsubscribe: () => void; cleanup?: () => void }>();

/**
 * A render result as wrapper children; an HTML string is parsed like morph() parses it. Text without `<` or `&`
 * parses to itself, so it needs no parser: `render={() => String(count)}` also works on a server without a global
 * DOMParser (VERIFIED: the packed-tarball consumer in Node threw there before).
 */
const toChildren = (content: RenderInput): VNodeChild[] => {
  if (typeof content === "string") {
    if (!/[<&]/.test(content)) return content === "" ? [] : [content];
    const Parser = (globalThis as { DOMParser?: typeof DOMParser }).DOMParser;
    if (!Parser) {
      throw new TypeError("Reactive: rendering an HTML string needs a global DOMParser; return JSX/VNodes, or call reactive()");
    }
    return htmlStringToVNodes(content, Parser);
  }
  return Array.isArray(content) ? ((content as unknown[]).flat(Infinity) as VNodeChild[]) : [content as VNodeChild];
};

/**
 * A JSX component that re-renders its content whenever a store changes. It renders a wrapper element (`tag`,
 * default `div`) whose children are `render()`; other props go to the wrapper. The subscription starts when the
 * wrapper is mounted and ends when it leaves the document, which also runs `cleanup`. A parent re-render passes the
 * latest `render` and `store`, and the children it produces are morphed in like any other render.
 *
 * @example
 * ```tsx
 * import { Reactive } from "defuss-morph";
 * import { createStore } from "defuss-store";
 *
 * const counter = createStore({ count: 0 });
 *
 * <Reactive tag="section" store={counter} render={() => (
 *   <button onClick={() => counter.set("count", counter.value.count + 1)}>{counter.value.count}</button>
 * )} />
 * ```
 */
export function Reactive(props: ReactiveProps): VNode {
  const { store, render, cleanup, tag = "div", onMount, onUnmount, children: _children, ...attributes } = props;
  const stores = toStores(store, "Reactive");
  if (typeof render !== "function") throw new TypeError("Reactive: the render prop must be a function");

  return {
    type: tag,
    attributes: {
      ...attributes,
      // morph runs onMount in a microtask after inserting the wrapper, and again after every patch of it by a
      // parent re-render: the subscription moves to this render's stores and render function, and one render here
      // picks up a store change made between the render that built the wrapper and this callback. VERIFIED:
      // reactive.test.ts ("picks up a store change made before its mount callback ran", "keeps one subscription")
      onMount: (el: Element) => {
        mounted.get(el)?.unsubscribe();
        mounted.set(el, { unsubscribe: listen(stores, () => morph(el, render())), cleanup });
        morph(el, render());
        if (typeof onMount === "function") onMount(el);
      },
      onUnmount: (el: Element) => {
        const entry = mounted.get(el);
        mounted.delete(el);
        entry?.unsubscribe();
        entry?.cleanup?.();
        if (typeof onUnmount === "function") onUnmount(el);
      },
    },
    children: toChildren(render()),
  };
}

/** The `.reactive()` method {@link installReactive} adds to every defuss-query selection. */
export interface ReactiveQueryMethod {
  /** Calls {@link reactive} with this selection as the target and returns the selection; end it with `config.signal`. */
  reactive(config: ReactiveConfig): this;
}

/**
 * Adds `.reactive(config)` to defuss-query's selections (`df$.fn`, the shared prototype), so markup already in the
 * page becomes reactive by selector: `df$("#cart").reactive({ store, render })`. Idempotent; returns `df$`. The CDN
 * bundle calls it itself when it loads after defuss-query; with defuss-morph loaded first, call
 * `df$.installReactive(df$)` once defuss-query has loaded.
 */
// Why a property on df$.fn and not a wrapper around df$: every selection defuss-query creates inherits from df$.fn,
// so selections from df$(), .find() and .children() all get the method, and df$ itself stays defuss-query's object.
// VERIFIED: reactive.test.ts installs it on createDf$(morph) from defuss-query/core.
export const installReactive = <Q>(df$: Q): Q => {
  const fn = (df$ as { fn?: unknown } | null | undefined)?.fn;
  if (typeof fn !== "object" || fn === null) {
    throw new TypeError("installReactive: expected defuss-query's df$ (a df$ with a df$.fn prototype)");
  }
  Object.defineProperty(fn, "reactive", {
    configurable: true,
    writable: true,
    value: function (this: ArrayLike<Element>, config: ReactiveConfig) {
      reactive(config, this);
      return this;
    },
  });
  return df$;
};
