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
 * Converts a DOM node to a VNode structure for use with updateDomWithVdom.
 * This allows us to leverage the sophisticated partial update system even for Node inputs.
 */
declare function domNodeToVNode(node: Node): VNode<VNodeAttributes> | string;
/**
 * Converts an HTML string to VNode structure for use with updateDomWithVdom.
 * This allows markup strings to benefit from the intelligent partial update system.
 */
declare function htmlStringToVNodes(html: string, Parser: typeof DOMParser): Array<VNode<VNodeAttributes> | string>;

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

export { CAPTURE_ONLY_EVENTS, CLASS_ATTRIBUTE_NAME, COMMENT_TYPE, DANGEROUSLY_SET_INNER_HTML_ATTRIBUTE, DEFAULT_TRANSITION_CONFIG, FROM_DOM_MARKER, REF_ATTRIBUTE_NAME, XLINK_ATTRIBUTE_NAME, XMLNS_ATTRIBUTE_NAME, applyStyles, areDomNodesEqual, clearDelegatedEvents, clearDelegatedEventsDeep, domNodeToVNode, getMimeType, getRegisteredEventKeys, getRegisteredEventTypes, getRenderer, getTransitionStyles, handleLifecycleEventsForOnMount, htmlStringToVNodes, isCommentVNode, isHTML, isMarkup, isSVG, morph, nsMap, observeUnmount, onClearDelegatedEvents, parseDOM, parseEventPropName, performTransition, queueCallback, registerDelegatedEvent, removeDelegatedEvent, removeDelegatedEventByKey, renderMarkup, replaceDomWithVdom, resolveGlobals, updateDomWithVdom };
export type { CommentVNode, DefussKey, DelegatedEventOptions, DelegatedPhase, DomAbstractionImpl, Globals, MorphMode, MorphOptions, MountHandler, ParsedEventProp, RefLike, RenderInput, TransitionConfig, TransitionStyles, TransitionType, TransitionsEasing, UnmountHandler, VNode, VNodeAttributes, VNodeChild, VNodeChildren, VNodeType, ValidChild };
