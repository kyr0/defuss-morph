var _a;
/**
 * Why: a chainable, jQuery-shaped facade over the native DOM and the
 * defuss-morph engine. It exists so terse imperative DOM code — select,
 * mutate, listen — still routes every structural write through morph's
 * parser, renderer, reconciler, and delegated-event substrate instead of
 * growing a second DOM engine.
 *
 * Design decisions:
 * - `DfQuery` subclasses `Array` with snapshot membership: a selection is
 *   plain data. Traversal returns a new selection; mutators return `this`
 *   for chaining. No hidden reactivity, no collection thenable.
 * - `df$` is one symbol with two faces: calling it selects (`df$("a")`),
 *   while morph's functions live on it as properties (`df$.morph(...)`).
 * - The factory never imports morph itself. `createDf$` receives the API by
 *   injection, so the CDN browser bundle can adopt the already-loaded morph
 *   namespace instead of embedding a second copy (see scripts/build.ts).
 * - Element listeners belong to morph's delegated registry so morphing
 *   never detaches them; only non-element targets use a local WeakMap.
 */
import { createDomAdapter, documentOf, elements, isElement, isNode, isTarget, rootOf, tokens, } from "./dom.js";
export { createDomAdapter } from "./dom.js";
/** Keep in sync with package.json; scripts/verify.ts gates on it. */
export const QUERY_VERSION = "0.2.0";
// Unforgeable proof that query installed a given df$: installGlobal reuses a
// branded function and refuses to overwrite an unrelated one.
const brand = Symbol.for("defuss-query.factory");
// Every on() listener is a real addEventListener on its target, tracked here
// so off() and morph's element cleanup can find it again. Why not morph's
// delegated registry: delegation replays the path from the root, so handlers
// ran after ancestors', died on an ancestor's stopPropagation(), missed
// non-bubbling events and saw currentTarget === document.
// VERIFIED: all four in Chromium (suite.browser.test.ts "on(): native").
const nativeListeners = new WeakMap();
/** Remove the matching tracked listeners; no names/handler matches all. */
const detachListeners = (target, names, handler) => {
    const entries = nativeListeners.get(target);
    if (!entries)
        return;
    const kept = entries.filter((entry) => {
        const match = (!names || names.includes(entry.type)) &&
            (!handler || entry.handler === handler);
        if (match)
            target.removeEventListener(entry.type, entry.handler, entry.capture);
        return !match;
    });
    if (kept.length)
        nativeListeners.set(target, kept);
    else
        nativeListeners.delete(target);
};
/** morph teardown hook: elements morph removes lose their on() listeners. */
const clearListeners = (target) => detachListeners(target);
const styleName = (name) => name.startsWith("--")
    ? name
    : name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const propRecord = (target) => target;
/**
 * A snapshot selection: an `Array` subclass, so every native array method
 * works on it. Membership is fixed at creation — traversal methods return a
 * new `DfQuery`, while mutators change the DOM and return `this` for
 * chaining. Nothing re-evaluates the selector behind your back.
 */
export class DfQuery extends Array {
    // Plain Array as species: map/slice/flat would otherwise call this
    // constructor with Array's numeric length argument and break. Only the
    // explicit query methods below produce new DfQuery selections.
    static get [Symbol.species]() {
        return Array;
    }
    #runtime;
    constructor(runtime, items = []) {
        super();
        this.#runtime = runtime;
        // Dedupe so setters never double-apply to one node, and push in a loop
        // to avoid spread/push.apply argument limits on large NodeLists.
        for (const item of new Set(Array.from(items)))
            this.push(item);
    }
    #wrap(items) {
        return new _a(this.#runtime, items);
    }
    /** New selection from per-element traversal, dropping non-elements. */
    #walk(fn) {
        return this.#wrap(elements(this).flatMap((el) => Array.from(fn(el)).filter(isElement)));
    }
    /** First element of the selection, undefined when empty or non-element. */
    #first() {
        return isElement(this[0]) ? this[0] : undefined;
    }
    get(index) {
        return index === undefined ? Array.from(this) : this.at(index);
    }
    /** Copy of the selection as a plain array. */
    toArray() {
        return Array.from(this);
    }
    /** Selection containing only the item at `index` (negative from end). */
    eq(index) {
        const item = this.at(index);
        return this.#wrap(item === undefined ? [] : [item]);
    }
    /** Selection containing only the first item. */
    first() {
        return this.eq(0);
    }
    /** Selection containing only the last item. */
    last() {
        return this.eq(-1);
    }
    /** Iterate with `this` bound to the item; `false` breaks early. */
    each(callback) {
        for (let i = 0; i < this.length; i++)
            if (callback.call(this[i], i, this[i]) === false)
                break;
        return this;
    }
    find(input, thisArg) {
        if (typeof input === "function")
            return super.find(input, thisArg);
        return this.#wrap(Array.from(this).flatMap((target) => "querySelectorAll" in target
            ? Array.from(target.querySelectorAll(input))
            : []));
    }
    filter(input, thisArg) {
        return this.#wrap(super.filter(typeof input === "string"
            ? (value) => isElement(value) && value.matches(input)
            : input, thisArg));
    }
    /** True when any element in the selection matches the selector. */
    is(selector) {
        return this.some((el) => isElement(el) && el.matches(selector));
    }
    /** Unique parent elements of the selection. */
    parent() {
        return this.#walk((el) => [el.parentElement]);
    }
    /** Direct child elements, optionally narrowed by selector. */
    children(selector) {
        const result = this.#wrap(Array.from(this).flatMap((el) => "children" in el
            ? Array.from(el.children)
            : []));
        return selector === undefined ? result : result.filter(selector);
    }
    /** Nearest ancestor-or-self matching the selector, per element. */
    closest(selector) {
        return this.#walk((el) => [el.closest(selector)]);
    }
    /** Next element siblings. */
    next() {
        return this.#walk((el) => [el.nextElementSibling]);
    }
    /** Previous element siblings. */
    prev() {
        return this.#walk((el) => [el.previousElementSibling]);
    }
    attr(name, value) {
        if (arguments.length === 1)
            return this.#first()?.getAttribute(name);
        for (const el of elements(this))
            value === null
                ? el.removeAttribute(name)
                : el.setAttribute(name, String(value));
        return this;
    }
    prop(name, value) {
        if (arguments.length === 1)
            return this[0] ? propRecord(this[0])[name] : undefined;
        if (["innerHTML", "outerHTML", "textContent", "innerText"].includes(name))
            throw new TypeError("defuss-query: use html(), text(), or replaceWith() for structural writes");
        for (const el of this)
            propRecord(el)[name] = value;
        return this;
    }
    data(name, value) {
        const first = this.#first();
        if (arguments.length === 1)
            return first?.dataset && Object.hasOwn(first.dataset, name)
                ? first.dataset[name]
                : undefined;
        for (const el of elements(this)) {
            if (el.dataset)
                value === null
                    ? delete el.dataset[name]
                    : (el.dataset[name] = String(value));
        }
        return this;
    }
    css(name, value) {
        if (typeof name === "string" && arguments.length === 1) {
            const el = this.#first();
            return el
                ? el.ownerDocument.defaultView
                    ?.getComputedStyle(el)
                    .getPropertyValue(styleName(name))
                : undefined;
        }
        const entries = typeof name === "string"
            ? [[name, value]]
            : Object.entries(name);
        for (const el of elements(this))
            for (const [key, val] of entries) {
                if (el.style)
                    val === null
                        ? el.style.removeProperty(styleName(key))
                        : el.style.setProperty(styleName(key), String(val));
            }
        return this;
    }
    /** Add class tokens to every element. */
    addClass(names) {
        const list = tokens(names);
        for (const el of elements(this))
            el.classList.add(...list);
        return this;
    }
    /** Remove class tokens; no argument clears the whole class attribute. */
    removeClass(names) {
        const list = names === undefined ? undefined : tokens(names);
        for (const el of elements(this))
            list ? el.classList.remove(...list) : el.removeAttribute("class");
        return this;
    }
    /** Toggle class tokens, optionally forced on or off. */
    toggleClass(names, force) {
        const list = tokens(names);
        for (const el of elements(this))
            for (const name of list)
                force === undefined
                    ? el.classList.toggle(name)
                    : el.classList.toggle(name, force);
        return this;
    }
    /** True when any element carries the class. */
    hasClass(name) {
        return elements(this).some((el) => el.classList.contains(name));
    }
    val(value) {
        const controls = elements(this).filter((el) => "value" in el);
        if (arguments.length === 0) {
            const el = controls[0];
            return el?.localName === "select" && el.multiple
                ? Array.from(el.selectedOptions, (option) => option.value)
                : el?.value;
        }
        for (const el of controls) {
            if (el.localName === "select" && el.multiple) {
                const values = new Set(Array.isArray(value) ? value : value == null ? [] : [String(value)]);
                for (const option of el.options)
                    option.selected = values.has(option.value);
            }
            else if (el.localName === "input" &&
                ["checkbox", "radio"].includes(el.type) &&
                Array.isArray(value)) {
                el.checked = value.includes(el.value);
            }
            else
                el.value = Array.isArray(value)
                    ? (value[0] ?? "")
                    : value == null
                        ? ""
                        : String(value);
        }
        return this;
    }
    /**
     * FormData for a selection that is exactly one form element. Uses the
     * form's own realm constructor so cross-realm forms stay valid; an
     * optional submitter contributes its name/value.
     */
    form(submitter) {
        if (this.length !== 1 ||
            !isElement(this[0]) ||
            this[0].localName !== "form")
            throw new TypeError("defuss-query: form() requires exactly one form element");
        const form = this[0];
        const Ctor = form.ownerDocument.defaultView?.FormData;
        if (!Ctor)
            throw new Error("defuss-query: form document has no FormData");
        return new Ctor(form, submitter);
    }
    /** URL-encoded string of the form's string-valued entries. */
    serialize(submitter) {
        const params = new URLSearchParams();
        for (const [name, value] of this.form(submitter))
            if (typeof value === "string")
                params.append(name, value);
        return params.toString();
    }
    morph(content, options) {
        // No collection thenable or hidden queue. Supplying transition is explicitly async.
        if (options?.transition !== undefined)
            return Promise.all(elements(this).map(async (el) => {
                await this.#runtime.dom.morph(el, content, options);
            })).then(() => this);
        for (const el of elements(this))
            this.#runtime.dom.morph(el, content, options);
        return this;
    }
    html(content, options) {
        if (arguments.length === 0) {
            const el = this.#first();
            return el ? rootOf(el).innerHTML : undefined;
        }
        return this.morph(content, options);
    }
    text(value) {
        if (arguments.length === 0)
            return Array.from(this, (el) => isNode(el) ? ((isElement(el) ? rootOf(el) : el).textContent ?? "") : "").join("");
        // An ARRAY string is literal VNode text, not parsed HTML. Do not pass a bare string.
        for (const node of this)
            if (isNode(node))
                this.#runtime.dom.text(node, value == null ? "" : String(value));
        return this;
    }
    /** Remove every child by morphing in an empty list. */
    empty() {
        return this.morph([]);
    }
    /**
     * Shared write path for append/prepend/before/after/replaceWith. Live
     * node lists and fragments are snapshotted before the first write, which
     * would otherwise consume or move them mid-loop.
     */
    #insert(content, position, replace = false) {
        // Snapshot live lists/fragments once, before the first write consumes/moves them.
        const input = isNode(content) && content.nodeType === 11
            ? Array.from(content.childNodes)
            : content &&
                typeof content === "object" &&
                !isNode(content) &&
                !("type" in content) &&
                (Symbol.iterator in content || "length" in content)
                ? Array.from(content)
                : content;
        const targets = Array.from(this)
            .filter((item) => isNode(item))
            .filter((node) => position === "afterbegin" || position === "beforeend"
            ? node.nodeType === 1 || node.nodeType === 11
            : !!node.parentNode);
        // With several targets the content is cloned for all but the last one,
        // which receives the original nodes (moved once, matching jQuery).
        return targets.flatMap((node, index) => replace
            ? this.#runtime.dom.replace(node, input, index !== targets.length - 1)
            : this.#runtime.dom.insert(node, input, position, index !== targets.length - 1));
    }
    /** Insert content as the last child of every target. */
    append(content) {
        this.#insert(content, "beforeend");
        return this;
    }
    /** Insert content as the first child of every target. */
    prepend(content) {
        this.#insert(content, "afterbegin");
        return this;
    }
    /** Insert content before every target. */
    before(content) {
        this.#insert(content, "beforebegin");
        return this;
    }
    /** Insert content after every target. */
    after(content) {
        this.#insert(content, "afterend");
        return this;
    }
    /** Replace every target with the content. */
    replaceWith(content) {
        this.#insert(content, "beforebegin", true);
        return this;
    }
    /** Insert this selection into target(s); selects the inserted nodes. */
    appendTo(target) {
        const selection = typeof target === "string"
            ? this.#runtime.api(target, documentOf(this[0]))
            : this.#runtime.api(target);
        return this.#wrap(selection.#insert(this, "beforeend"));
    }
    /** Detach every node, clearing its delegated listeners first. */
    remove() {
        for (const node of Array.from(this).filter((item) => isNode(item)))
            this.#runtime.dom.remove(node);
        return this;
    }
    on(type, handler, options = {}) {
        if (typeof handler !== "function")
            throw new TypeError("defuss-query: on() requires a function");
        if (typeof options === "object" &&
            Object.keys(options).some((key) => key !== "capture"))
            throw new TypeError("defuss-query: on() supports capture only; use native addEventListener for other options");
        const capture = typeof options === "boolean" ? options : !!options.capture;
        for (const target of this)
            for (const name of tokens(type)) {
                const listener = handler;
                if (isElement(target)) {
                    if (typeof this.#runtime.api.registerDelegatedEvent !== "function")
                        throw new Error("defuss-query: load defuss-morph before on()");
                    // Older morph builds lack the hook: listeners then survive removal.
                    this.#runtime.api.onClearDelegatedEvents?.(clearListeners);
                }
                target.addEventListener(name, listener, capture);
                const entries = nativeListeners.get(target) ?? [];
                // Mirror addEventListener's own dedupe: an identical (type,
                // handler, capture) triple registers once and stays so here.
                if (!entries.some((entry) => entry.type === name &&
                    entry.handler === listener &&
                    entry.capture === capture))
                    entries.push({ type: name, handler: listener, capture });
                nativeListeners.set(target, entries);
            }
        return this;
    }
    off(type, handler) {
        const names = type === undefined ? undefined : tokens(type);
        for (const target of this)
            detachListeners(target, names, handler);
        return this;
    }
    /** Dispatch a bubbling, cancelable CustomEvent on every target. */
    trigger(type, detail) {
        for (const target of this) {
            // Construct the event in the target's own realm so cross-realm
            // targets (iframes, test VMs) dispatch it correctly.
            const realm = isNode(target)
                ? documentOf(target).defaultView
                : target.window === target
                    ? target
                    : globalThis;
            const Ctor = realm?.CustomEvent ?? globalThis.CustomEvent;
            target.dispatchEvent(new Ctor(type, { detail, bubbles: true, cancelable: true }));
        }
        return this;
    }
}
_a = DfQuery;
/**
 * Build a `df$` around an injected morph API. Dependency injection keeps
 * the query core free of globals and of a second morph copy: the npm entry
 * passes the module namespace, the CDN bundle passes the global object that
 * morph's own bundle already registered on `window.df$`.
 */
export function createDf$(morphApi) {
    const dollar = function (input, context) {
        if (input == null || input === "")
            return new DfQuery(runtime);
        if (typeof input === "function") {
            const doc = documentOf(context);
            const invoke = () => input(dollar);
            // DOM-ready callback: microtask once parsed, DOMContentLoaded before.
            doc.readyState === "loading"
                ? doc.addEventListener("DOMContentLoaded", invoke, { once: true })
                : queueMicrotask(invoke);
            return new DfQuery(runtime, [doc]);
        }
        if (typeof input === "string") {
            const root = context ?? documentOf();
            return new DfQuery(runtime, input.trimStart().startsWith("<")
                ? runtime.dom.create(input, root)
                : root.querySelectorAll(input));
        }
        if (isTarget(input))
            return new DfQuery(runtime, [input]);
        if (typeof input === "object" && "type" in input)
            return new DfQuery(runtime, runtime.dom.create(input, context ?? documentOf()));
        if (typeof input === "object" &&
            (Symbol.iterator in input || "length" in input)) {
            const items = Array.from(input);
            if (!items.every(isTarget))
                throw new TypeError("defuss-query: collections must contain EventTargets");
            return new DfQuery(runtime, items);
        }
        throw new TypeError("defuss-query: expected selector, markup, VNode, EventTarget, or target collection");
    };
    // Copy values, not the module namespace prototype. Function-intrinsic
    // slots (name/length/prototype/caller/arguments) are skipped: redefining
    // them on a function throws or corrupts its arity. Query's own reserved
    // slots (fn/dom/queryVersion) win over any same-named morph export.
    for (const key of Reflect.ownKeys(morphApi)) {
        if ([
            "name",
            "length",
            "prototype",
            "caller",
            "arguments",
            "fn",
            "dom",
            "queryVersion",
        ].includes(String(key)))
            continue;
        Object.defineProperty(dollar, key, {
            value: Reflect.get(morphApi, key),
            writable: true,
            enumerable: true,
            configurable: true,
        });
    }
    const runtime = { api: dollar, dom: createDomAdapter(dollar) };
    Object.defineProperties(dollar, {
        fn: { value: DfQuery.prototype },
        dom: { value: runtime.dom },
        queryVersion: { value: QUERY_VERSION },
        [brand]: { value: true },
    });
    return dollar;
}
/**
 * Install `df$` on `target` (the CDN path). Can run before morph loads:
 * selectors work immediately, morph capabilities resolve at call time.
 *
 * Coexistence contract for a pre-existing `df$`:
 * - one this module installed before (brand match) is returned unchanged;
 * - a plain object — typically the morph CDN bundle's namespace — is
 *   adopted: its entries are copied onto the callable, preserving morph
 *   function identities and any custom/symbol props placed there earlier;
 * - an unrelated df$ *function* is refused: overwriting someone else's
 *   global would silently break that script.
 */
export function installGlobal(target = globalThis) {
    const previous = Reflect.get(target, "df$");
    if (previous && previous[brand])
        return previous;
    if (typeof previous === "function")
        throw new Error("defuss-query: refusing to overwrite an unrelated df$ function");
    const dollar = createDf$((previous && typeof previous === "object" ? previous : {}));
    if (!Reflect.set(target, "df$", dollar))
        throw new TypeError("defuss-query: df$ global is not writable");
    return dollar;
}
//# sourceMappingURL=query.js.map