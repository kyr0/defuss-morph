/**
 * Lean structural types for the defuss morph engine.
 *
 * These are intentionally minimal (no JSX namespace, no store/ref machinery).
 * defuss's richer types are structurally assignable to these.
 */
type Globals = Performance & Window & typeof globalThis;
type DefussKey = string | number;
type MountHandler<T extends Element = Element> = (element: T) => void;
type UnmountHandler<T extends Element = Element> = (element: T) => void;
/**
 * Minimal ref shape: the morph engine only ever assigns `current`.
 * defuss's full `Ref` interface is structurally assignable to this.
 */
interface RefLike {
    current?: any;
    orphan?: boolean;
}
interface VNodeAttributes {
    ref?: RefLike;
    key?: DefussKey;
    onMount?: MountHandler<any>;
    onUnmount?: UnmountHandler<any>;
    [attributeName: string]: any;
}
type VNodeType = string | Function | any;
/**
 * A virtual node as JSX factories produce it: `type` is a tag name (or `"#comment"`), `attributes`
 * the props, `children` nested VNodes, text, numbers or values that render nothing.
 */
interface VNode<A = VNodeAttributes> {
    type?: VNodeType;
    attributes?: A;
    children?: VNodeChildren;
    /**
     * Comment data of a `{ type: "#comment" }` VNode (see `COMMENT_TYPE`).
     * VERIFIED: optional, so defuss core's VNode (no `value`) stays assignable.
     */
    value?: string;
    sourceInfo?: unknown;
    /** Original props passed to a function component (set by jsx runtime for SSG hydration). */
    componentProps?: Record<string, any>;
}
type VNodeChild = VNode<any> | object | string | number | boolean | null | undefined;
type VNodeChildren = VNodeChild[];
/**
 * Anything the morph engine accepts as new content.
 */
type RenderInput = VNode | object | string | number | boolean | null | undefined | RenderInput[];
/** The renderer contract returned by `getRenderer()`. */
interface DomAbstractionImpl {
    hasElNamespace(domElement: Element | Document): boolean;
    hasSvgNamespace(parentElement: Element | Document, type: string): boolean;
    createElementOrElements(virtualNode: RenderInput, parentDomElement?: Element | Document): Array<Element | Text | undefined> | Element | Text | undefined;
    createElement(virtualNode: RenderInput, parentDomElement?: Element | Document): Element | undefined;
    createTextNode(text: string, parentDomElement?: Element | Document): Text;
    createChildElements(virtualChildren: VNodeChildren, parentDomElement?: Element | Document): Array<Element | Text | undefined>;
    setAttribute(name: string, value: any, domElement: Element): void;
    setAttributes(virtualNode: VNode<VNodeAttributes>, domElement: Element): void;
}

/**
 * Wraps `cb` so each call runs it in a microtask, with the same arguments.
 * VERIFIED: renderer.test.ts asserts onMount has not run before that microtask.
 */
declare const queueCallback: <T extends any[]>(cb: (...args: T) => void) => (...args: T) => void;

type DelegatedPhase = "bubble" | "capture";
/** Options of {@link registerDelegatedEvent}. */
interface DelegatedEventOptions {
    capture?: boolean;
    /** If true, allows multiple handlers per element+type (Dequery mode) */
    multi?: boolean;
}
interface ParsedEventProp {
    eventType: string;
    capture: boolean;
}
/**
 * Events whose handlers are forced into the capture phase, so an ancestor's
 * handler also sees descendants' events (container onFocus/onBlur). Every
 * other non-bubbling event reaches only its target's handlers, natively.
 */
declare const CAPTURE_ONLY_EVENTS: Set<string>;
/**
 * Parses a JSX event prop name: `onClick` gives `{ eventType: "click", capture: false }`,
 * `onClickCapture` the capture phase. Case-insensitive; `null` for anything not starting with `on`.
 */
declare const parseEventPropName: (propName: string) => ParsedEventProp | null;
/**
 * Attaches `handler` to `element` the way JSX props do: one slot per event type and phase, so
 * registering again replaces the handler without adding a listener. With `{ multi: true }`
 * every handler becomes its own native listener (dequery-style `on()`). `focus`, `blur`,
 * `scroll`, `mouseenter` and `mouseleave` always use the capture phase.
 */
declare const registerDelegatedEvent: (element: HTMLElement, eventType: string, handler: EventListener, options?: DelegatedEventOptions) => void;
/**
 * Removes `handler` (from both phases), or every handler of `eventType` when no handler is given.
 */
declare const removeDelegatedEvent: (target: EventTarget, eventType: string, handler?: EventListener, _options?: DelegatedEventOptions) => void;
/**
 * Why: listeners a facade attaches natively (defuss-query's on()) live
 * outside this registry, yet must go whenever morph clears an element
 * (removal, replacement, clearDelegatedEventsDeep). A hook keeps morph
 * ignorant of who owns them, instead of morph also tracking native listeners.
 * Registering the same hook twice is a no-op; returns an unregister function.
 */
declare const onClearDelegatedEvents: (hook: (target: EventTarget) => void) => (() => void);
/** Removes every registered handler of one element and runs the {@link onClearDelegatedEvents} hooks for it. */
declare const clearDelegatedEvents: (target: EventTarget) => void;
/**
 * Clear delegated events for an element and all its descendants. Morph runs
 * it on every element it removes or replaces; facades call it before removing
 * nodes themselves (defuss-query does in its internal remove()).
 */
declare const clearDelegatedEventsDeep: (root: HTMLElement) => void;
/**
 * Get all event types currently registered on an element.
 * Used to detect which events need to be removed when vnode props change.
 */
declare const getRegisteredEventTypes: (element: HTMLElement) => Set<string>;
/**
 * Get all event keys with phases currently registered on an element.
 * Returns keys like "click:bubble", "click:capture" for precise phase-aware removal.
 */
declare const getRegisteredEventKeys: (element: HTMLElement) => Set<string>;
/**
 * Remove delegated event handler for a specific phase only.
 * Used by patchElementInPlace to precisely remove stale handlers when vnode changes from
 * onClick + onClickCapture → onClickCapture only.
 */
declare const removeDelegatedEventByKey: (element: HTMLElement, eventType: string, phase: "bubble" | "capture") => void;

declare const CLASS_ATTRIBUTE_NAME = "class";
declare const XLINK_ATTRIBUTE_NAME = "xlink";
declare const XMLNS_ATTRIBUTE_NAME = "xmlns";
declare const REF_ATTRIBUTE_NAME = "ref";
declare const DANGEROUSLY_SET_INNER_HTML_ATTRIBUTE = "dangerouslySetInnerHTML";
declare const nsMap: {
    xmlns: string;
    xlink: string;
    svg: string;
};
/**
 * Calls `onUnmount` once `domNode` leaves the document. A move (removal and re-insertion in the
 * same task) is not an unmount: the observer follows the node to its new parent. Throws when the
 * node has no parent; a no-op where `MutationObserver` does not exist (SSR).
 */
declare const observeUnmount: (domNode: Node, onUnmount: () => void) => void;
/**
 * Runs the pending `onMount` hook and arms the `onUnmount` observer of an
 * element that was just inserted or patched in place.
 *
 * Why one observer that reads `$onUnmount` when it fires: morph calls this on
 * every in-place patch, and each re-render sets a fresh `onUnmount` closure.
 * Arming one observer per call made a single removal run every handler ever
 * registered (VERIFIED: 1 render + 3 morphs fired onUnmount 10 times).
 */
declare const handleLifecycleEventsForOnMount: (newEl: HTMLElement) => void;
/**
 * Returns the VNode-to-DOM renderer for `document`: element and SVG creation, text and comment
 * nodes, attributes (class arrays, style objects, controlled form props, namespaced SVG
 * attributes), refs, JSX event props and the `onMount`/`onUnmount` hooks.
 */
declare const getRenderer: (document: Document) => DomAbstractionImpl;

/**
 * Compares two DOM nodes for equality with performance optimizations.
 * 1. Checks for reference equality.
 * 2. Compares node types.
 * 3. For Element nodes, compares tag names and attributes.
 * 4. For Text and Comment nodes, compares their data.
 */
declare const areDomNodesEqual: (oldNode: Node, newNode: Node) => boolean;
/********************************************************
 * 1) Define a "valid" child type & utilities
 ********************************************************/
type ValidChild = string | number | boolean | null | undefined | VNode<VNodeAttributes>;
/**
 * How top-level children are reconciled:
 * - `"replace"` (default): full reconciliation — unmentioned nodes are removed.
 * - `"diff"`: partial updates — only patch items addressed by `key`/`id` are
 *   applied (attributes merge, new items append, unmentioned nodes untouched).
 */
type MorphMode = "replace" | "diff";
/**
 * Resolve the render globals from an element's own document when not given
 * explicitly (isomorphic: browser window, happy-dom window, multi-document).
 */
declare const resolveGlobals: (el?: Element, globals?: Globals) => Globals;
/**
 * Guarded entry point for DOM morphing.
 *
 * If the target element (or an ancestor) is already being morphed,
 * the render is queued (latest-wins) and replayed after the active
 * morph finishes.  Morphs on unrelated subtrees proceed immediately
 * without blocking - conflict-free parallel rendering.
 *
 * `globals` is optional: it is derived from `parentElement.ownerDocument`
 * when omitted.
 *
 * `mode` defaults to `"replace"` (full reconciliation). Pass `"diff"` for
 * partial updates: only `key`/`id`-addressed patch items are applied
 * (attributes merged, new keyed items appended, unmentioned nodes untouched).
 */
declare function updateDomWithVdom(parentElement: Element, newVDOM: RenderInput, globals?: Globals, mode?: MorphMode): void;
/**
 * Directly blow away all children in `parentElement` and create new DOM
 * from `newVDOM`. This never skips or leaves behind stale nodes,
 * at the cost of losing partial update performance.
 *
 * `globals` is optional: it is derived from `parentElement.ownerDocument`
 * when omitted.
 */
declare function replaceDomWithVdom(parentElement: Element, newVDOM: RenderInput, globals?: Globals): void;

/**
 * Marks VNodes derived from existing DOM (HTML strings / DOM nodes).
 * Such VNodes cannot declare event handlers, so the morph engine must
 * preserve delegated handlers already attached to surviving elements
 * (same rationale as uncontrolled form-state preservation).
 */
declare const FROM_DOM_MARKER: unique symbol;
/**
 * VNode type of an HTML comment: `{ type: "#comment", value }`.
 * Why "#comment": it is the DOM's own nodeName for comments and can never
 * collide with a tag name ("#" is invalid there). The data lives in `value`,
 * not `children`, so generic tree walkers never mistake it for content.
 */
declare const COMMENT_TYPE = "#comment";
type CommentVNode = VNode & {
    type: typeof COMMENT_TYPE;
};
/** True for a comment VNode (`{ type: "#comment", value }`). */
declare const isCommentVNode: (value: unknown) => value is CommentVNode;
/** Parses `input` into a detached document with the given parser. */
declare function parseDOM(input: string, type: DOMParserSupportedType, Parser: typeof DOMParser): Document;
/** True when `input` parses as an SVG document (root element `<svg>`). */
declare function isSVG(input: string, Parser: typeof DOMParser): boolean;
/** True when `input` parses into at least one element besides the implied `<head>` and `<body>`. */
declare function isHTML(input: string, Parser: typeof DOMParser): boolean;
/** True when `input` contains a tag and parses as HTML or SVG. */
declare const isMarkup: (input: string, Parser: typeof DOMParser) => boolean;
/** Parses `markup` (HTML or SVG) and returns its top-level nodes, detached from any live document. */
declare function renderMarkup(markup: string, Parser: typeof DOMParser, doc?: Document): ChildNode[];
/** The `DOMParser` MIME type for `input`: `image/svg+xml` for SVG documents, else `text/html`. */
declare function getMimeType(input: string, Parser: typeof DOMParser): DOMParserSupportedType;
/**
 * The content fragment of a `<template>` element, where the parser puts its markup; `undefined` for other elements.
 * morph reads, creates and patches a template's children there, so markup such as defuss-i18n's translation
 * templates survives a morph.
 */
declare const templateContent: (element: Element) => DocumentFragment | undefined;
/**
 * Converts a DOM node to a VNode structure for use with updateDomWithVdom.
 * This allows us to leverage the sophisticated partial update system even for Node inputs.
 */
declare function domNodeToVNode(node: Node): VNode<VNodeAttributes> | string;
/**
 * Converts an HTML string to VNode structure for use with updateDomWithVdom.
 * This allows markup strings to benefit from the intelligent partial update system.
 */
declare function htmlStringToVNodes(html: string, Parser: typeof DOMParser): Array<VNode<VNodeAttributes> | string>;

type TransitionType = "fade" | "slide-left" | "slide-right" | "shake" | "none";
interface TransitionStyles {
    enter: Record<string, string>;
    enterActive: Record<string, string>;
    exit: Record<string, string>;
    exitActive: Record<string, string>;
}
type TransitionsEasing = "linear" | "ease" | "ease-in" | "ease-out" | "ease-in-out" | "step-start" | "step-end";
/** The `transition` option of `morph()`; every field is optional (see {@link DEFAULT_TRANSITION_CONFIG}). */
interface TransitionConfig {
    /** Built-in animation; `"none"` keeps `morph()` synchronous. Default `"fade"`. */
    type?: TransitionType;
    /** Own style maps for the four phases (not used by `"fade"`). */
    styles?: TransitionStyles;
    /** Milliseconds per phase. Default 300. */
    duration?: number;
    /** CSS timing function. Default `"ease-in-out"`. */
    easing?: TransitionsEasing | string;
    /** Milliseconds to wait before starting. Default 0. */
    delay?: number;
    /** Animate the morphed element's parent (default) or the element itself. */
    target?: "parent" | "self";
}
/** The four phase style maps of a built-in transition type (empty maps for an unknown type). */
declare const getTransitionStyles: (type: TransitionType, duration: number, easing?: string) => TransitionStyles;
/** Sets each CSS property of `styles` on `el` (`style.setProperty`). */
declare const applyStyles: (el: HTMLElement, styles: Record<string, string | number>) => void;
/** Defaults merged under every transition config. */
declare const DEFAULT_TRANSITION_CONFIG: TransitionConfig;
/**
 * Runs `updateCallback` inside a transition on `element`. `fade` cross-fades a snapshot of the old
 * content over the new one; the other types animate out, run the update, then animate in. Styles
 * the transition set are restored afterwards, also when the update throws (the error propagates).
 */
declare const performTransition: (element: HTMLElement, updateCallback: () => Promise<void>, config?: TransitionConfig) => Promise<void>;

/** Options of {@link morph}. */
interface MorphOptions {
    /**
     * Optional transition to apply around the morph.
     * When set (and `type !== "none"`), `morph()` returns a `Promise`
     * that resolves once the transition completed.
     */
    transition?: TransitionConfig;
    /**
     * Partial updates: apply only the given change-set instead of reconciling
     * the full child list. Every top-level item must be an element with a
     * `key` (preferred) or `id` — matched nodes are patched with attributes
     * *merged* (undeclared attributes and children stay untouched), unmatched
     * items are appended. Unmentioned siblings keep identity, order and state;
     * diff mode never removes and never moves, so addressing is unambiguous.
     *
     * Plain-text input and key-less items throw (they cannot be addressed).
     *
     * @example
     * ```ts
     * // update one row, append another — everything else is not re-sent:
     * morph(list, `
     *   <li key="b">B (updated)</li>
     *   <li key="c">C (new)</li>
     * `, { diff: true });
     * ```
     */
    diff?: boolean;
}
/**
 * Morphs the children of `el` to match the given HTML string or JSX/VNode input.
 *
 * A string is parsed into a DOM tree via the native `DOMParser`
 * of the element's own document (isomorphic: browser, happy-dom, ...);
 * any other `RenderInput` (JSX, VNodes, arrays, text) is used directly.
 * Both paths then morph into the existing DOM using the defuss morph algorithm:
 *
 * - key/id-aware node matching (`key` and `id` attributes)
 * - move-not-replace semantics (preserves node identity, focus, selection
 *   and event listeners)
 * - in-place attribute patching for same-tag elements
 * - uncontrolled form-state preservation (live input values survive
 *   unless the new HTML explicitly controls them)
 * - shadow DOM / custom element (light DOM) aware
 * - re-entrant morphs on the same or an ancestor element are queued
 *   latest-wins and replayed after the active morph finishes
 * - overlapping transitions are latest-wins too: a morph issued while a
 *   transition is in flight replaces the content that transition will apply
 *
 * Plain text input morphs as a text node.
 *
 * Unlike an HTML string, a VNode/JSX input can express explicit state
 * (`checked: false`, `value: ""`) and carry event handlers.
 *
 * @param el the element whose children (or shadow root) are morphed
 * @param newContent HTML string, JSX/VNode(s) or text describing the next children
 * @param options `transition` animates the swap; `diff` applies a partial change-set
 * @returns `undefined` without a transition (the morph is synchronous); with
 *   one, a Promise that resolves once the transition finished
 *
 * @example
 * ```ts
 * import { morph } from "defuss-morph";
 *
 * morph(document.getElementById("app")!, "<ul><li key='a'>Hello</li></ul>");
 *
 * // JSX / VNodes work too (same API, same algorithm):
 * morph(document.getElementById("app")!, <p>Hi</p>);
 *
 * // with a transition (async):
 * await morph(document.getElementById("app")!, "<p>Hi</p>", {
 *   transition: { type: "fade", duration: 200 },
 * });
 * ```
 */
declare const morph: (el: Element, newContent: RenderInput, options?: MorphOptions) => void | Promise<void>;

/**
 * Why: morph() takes VNodes, and JSX is the readable way to write them, but a JSX compiler needs a runtime to call.
 * Without one here, using `<Reactive>` or a ref meant installing the whole defuss framework for its `jsx()`. This
 * is the smallest runtime that fits morph: it returns plain `{ type, attributes, children }` objects, calls function
 * components at once (there is no component tree to keep, the next render is a new call) and has no state.
 *
 * - automatic runtime: `jsxImportSource: "defuss-morph"` (TypeScript, Bun, esbuild, Vite) imports `jsx`, `jsxs` and
 *   `Fragment` from `defuss-morph/jsx-runtime` (`jsxDEV` from `defuss-morph/jsx-dev-runtime`);
 * - classic runtime and pages without a build step: `h(type, props, ...children)`.
 *
 * VERIFIED: TypeScript, Bun, esbuild and Vite take `jsxImportSource` from tsconfig.json (probed 2026-11-01; Bun
 * imports `jsx-dev-runtime` by default, so both subpaths exist); scripts/e2e/consumer.tsx type-checks JSX against
 * the packed declarations in every `make e2e`.
 */
/** A function component: called with its props (including `children`, `ref` and `key`), returns what to render. */
type Component<P = any> = (props: P) => RenderInput;
type Props = {
    [name: string]: unknown;
    children?: unknown;
    key?: DefussKey;
};
/** `<>…</>`: its children, rendered in place of the fragment. */
declare const Fragment: (props: {
    children?: unknown;
}) => RenderInput;
/**
 * The automatic-runtime factory: `jsx(type, props, key)`. A tag name gives a VNode; a function component is called
 * with `props` (children included). A `key` given to a component lands on the element it returns, unless that
 * element has one, so `items.map((item) => <Row key={item.id} item={item} />)` is keyed for morph.
 */
declare function jsx(type: string | Component, props?: Props | null, key?: DefussKey): RenderInput;
/** Same as {@link jsx}; compilers call it for elements with several static children. */
declare const jsxs: typeof jsx;
/** Same as {@link jsx}; compilers call it in development mode. The extra source arguments are ignored. */
declare const jsxDEV: (type: string | Component, props?: Props | null, key?: DefussKey) => RenderInput;
/**
 * The classic factory, for `jsxFactory: "h"` and for pages without a build step:
 * `h("button", { onClick: save }, "Save")` is `<button onClick={save}>Save</button>`.
 */
declare function h(type: string | Component, props?: Props | null, ...children: unknown[]): RenderInput;
/**
 * JSX types for `jsxImportSource: "defuss-morph"`. Loose on purpose: any tag, any attribute. A JSX expression is a
 * `RenderInput` (a fragment is an array), and a component may return anything morph renders.
 */
declare namespace JSX {
    type Element = RenderInput;
    type ElementType = string | Component;
    interface ElementChildrenAttribute {
        children: {};
    }
    interface IntrinsicAttributes {
        key?: DefussKey;
    }
    interface IntrinsicElements {
        [tagName: string]: {
            [attribute: string]: any;
        };
    }
}

/**
 * Why a plain object and not defuss's store-backed Ref: morph only ever assigns `current`, and the forwardRef
 * pattern needs one free slot for a component's API, so `{ current, state }` is all a ref has to be; defuss's richer
 * Ref stays assignable to it (RefLike). VERIFIED: src/reactive.test.ts keeps `current` on the same node across
 * morphs and drives a component through `ref.state`.
 *
 * A reference to a rendered element. morph sets `current` when it creates or patches the element that carries
 * `ref={...}`; a morph that keeps the element keeps `current` pointing at the same node. `state` is free for the
 * component that owns the element: the forwardRef pattern puts the component's API there, for its parent to call.
 */
interface Ref<T extends Element = HTMLElement, S = unknown> extends RefLike {
    current: T | null;
    state?: S;
}
/**
 * Creates an empty {@link Ref}. `current` stays `null` until morph renders the element that carries it, so read it
 * in an event handler, in `onMount` or after the morph call, not in the component body.
 */
declare const createRef: <T extends Element = HTMLElement, S = unknown>(state?: S) => Ref<T, S>;
/** True for objects with a `current` property, the shape morph assigns refs to. */
declare const isRef: (value: unknown) => value is RefLike;

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
interface Subscribable {
    subscribe(listener: (...args: any[]) => unknown): unknown;
}
/** Configuration of {@link reactive} and {@link Reactive}. */
interface ReactiveConfig {
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
type ReactiveTarget = Element | RefLike | ArrayLike<Element>;
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
declare function reactive(config: ReactiveConfig, target: ReactiveTarget): () => void;
/** Props of {@link Reactive}: the {@link ReactiveConfig}, the wrapper's tag and any attribute for the wrapper. */
interface ReactiveProps extends Omit<ReactiveConfig, "signal"> {
    /** The wrapper element's tag. Default: `"div"`. */
    tag?: string;
    /** Set to the wrapper element. */
    ref?: RefLike;
    [attribute: string]: unknown;
}
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
declare function Reactive(props: ReactiveProps): VNode;
/** The `.reactive()` method {@link installReactive} adds to every defuss-query selection. */
interface ReactiveQueryMethod {
    /** Calls {@link reactive} with this selection as the target and returns the selection; end it with `config.signal`. */
    reactive(config: ReactiveConfig): this;
}
/**
 * Adds `.reactive(config)` to defuss-query's selections (`df$.fn`, the shared prototype), so markup already in the
 * page becomes reactive by selector: `df$("#cart").reactive({ store, render })`. Idempotent; returns `df$`. The CDN
 * bundle calls it itself when it loads after defuss-query; with defuss-morph loaded first, call
 * `df$.installReactive(df$)` once defuss-query has loaded.
 */
declare const installReactive: <Q>(df$: Q) => Q;

export { CAPTURE_ONLY_EVENTS, CLASS_ATTRIBUTE_NAME, COMMENT_TYPE, DANGEROUSLY_SET_INNER_HTML_ATTRIBUTE, DEFAULT_TRANSITION_CONFIG, FROM_DOM_MARKER, Fragment, JSX, REF_ATTRIBUTE_NAME, Reactive, XLINK_ATTRIBUTE_NAME, XMLNS_ATTRIBUTE_NAME, applyStyles, areDomNodesEqual, clearDelegatedEvents, clearDelegatedEventsDeep, createRef, domNodeToVNode, getMimeType, getRegisteredEventKeys, getRegisteredEventTypes, getRenderer, getTransitionStyles, h, handleLifecycleEventsForOnMount, htmlStringToVNodes, installReactive, isCommentVNode, isHTML, isMarkup, isRef, isSVG, jsx, jsxDEV, jsxs, morph, nsMap, observeUnmount, onClearDelegatedEvents, parseDOM, parseEventPropName, performTransition, queueCallback, reactive, registerDelegatedEvent, removeDelegatedEvent, removeDelegatedEventByKey, renderMarkup, replaceDomWithVdom, resolveGlobals, templateContent, updateDomWithVdom };
export type { CommentVNode, Component, DefussKey, DelegatedEventOptions, DelegatedPhase, DomAbstractionImpl, Globals, MorphMode, MorphOptions, MountHandler, ParsedEventProp, ReactiveConfig, ReactiveProps, ReactiveQueryMethod, ReactiveTarget, Ref, RefLike, RenderInput, Subscribable, TransitionConfig, TransitionStyles, TransitionType, TransitionsEasing, UnmountHandler, VNode, VNodeAttributes, VNodeChild, VNodeChildren, VNodeType, ValidChild };
