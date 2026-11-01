/** Duck-typed Node check; `instanceof Node` fails across realms. */
export const isNode = (value) => !!value &&
    typeof value === "object" &&
    typeof value.nodeType === "number";
/** Element check (nodeType 1) — the target kind most chain methods need. */
export const isElement = (value) => isNode(value) && value.nodeType === 1;
/** Anything with addEventListener — the widest input `df$()` accepts. */
export const isTarget = (value) => !!value && typeof value.addEventListener === "function";
/**
 * The document owning any context value (window, node, or the ambient
 * document). Throws when none is reachable, e.g. SSR without a context.
 */
export const documentOf = (value) => {
    const doc = value?.document ??
        (isNode(value)
            ? value.nodeType === 9
                ? value
                : value.ownerDocument
            : undefined) ??
        globalThis.document;
    if (!doc)
        throw new Error("defuss-query: a DOM document or explicit context is required");
    return doc;
};
/** The Element subset of a selection; most mutators ignore non-elements. */
export const elements = (items) => Array.from(items).filter(isElement);
/** Whitespace-split class/event token lists from string or array input. */
export const tokens = (input) => (typeof input === "string" ? input : input.join(" "))
    .split(/\s+/)
    .filter(Boolean);
/**
 * Write root for content: an element's shadow root, except custom elements
 * (hyphenated tags), whose slotted light DOM is morph's update surface.
 */
export const rootOf = (el) => !el.localName.includes("-") && el.shadowRoot ? el.shadowRoot : el;
/**
 * Create the structural adapter over an injected morph API. Capability
 * checks run at call time (`requireMorph`), so `df$` selection and ready
 * callbacks work before the morph engine has loaded.
 */
export function createDomAdapter(api) {
    const requireMorph = () => {
        if (typeof api.morph !== "function" ||
            typeof api.getRenderer !== "function")
            throw new Error("defuss-query: load defuss-morph before creating or mutating DOM");
    };
    function parse(html, context) {
        requireMorph();
        const doc = documentOf(context);
        const Parser = doc.defaultView
            ?.DOMParser;
        if (!Parser)
            throw new Error("defuss-query: context document has no DOMParser");
        // DOMParser's document mode otherwise drops standalone tr/td/tbody/col.
        // Leading comments are skipped so they cannot hide the context tag.
        // VERIFIED: otherwise `<!--c--><tr>` loses its row (suite.browser.test.ts).
        const tag = /^\s*(?:<!--[\s\S]*?-->\s*)*<([a-z][\w:-]*)/i
            .exec(html)?.[1]
            .toLowerCase();
        const wrappers = {
            tr: ["table", "tbody"],
            td: ["table", "tbody", "tr"],
            th: ["table", "tbody", "tr"],
            tbody: ["table"],
            thead: ["table"],
            tfoot: ["table"],
            caption: ["table"],
            colgroup: ["table"],
            col: ["table", "colgroup"],
            option: ["select"],
            optgroup: ["select"],
        };
        const tags = wrappers[tag ?? ""] ?? [];
        let input = html;
        for (let i = tags.length - 1; i >= 0; i--)
            input = `<${tags[i]}>${input}</${tags[i]}>`;
        let result = api.htmlStringToVNodes(`<body>${input}</body>`, Parser);
        for (const wrapper of tags) {
            const node = result.find((item) => !!item &&
                typeof item === "object" &&
                item.type === wrapper);
            result = node?.children ?? [];
        }
        return result;
    }
    function render(content, context, clone = false) {
        requireMorph();
        if (isNode(content)) {
            if (content.nodeType === 11)
                return Array.from(content.childNodes).flatMap((node) => render(node, context, clone));
            return [clone ? content.cloneNode(true) : content];
        }
        if (typeof content === "string")
            return parse(content, context).flatMap((item) => renderValue(item, context));
        if (content &&
            typeof content === "object" &&
            !("type" in content) &&
            (Symbol.iterator in content || "length" in content)) {
            return Array.from(content).flatMap((item) => render(item, context, clone));
        }
        return renderValue(content, context);
    }
    function renderValue(content, context) {
        if (content == null || typeof content === "boolean")
            return [];
        if (Array.isArray(content))
            return content.flatMap((item) => renderValue(item, context));
        const renderer = api.getRenderer(documentOf(context));
        if (typeof content === "string" || typeof content === "number")
            return [renderer.createTextNode(String(content))];
        const vnode = content;
        if (vnode.type === "fragment" || vnode.type === "Fragment")
            return renderValue(vnode.children ?? [], context);
        if (typeof vnode.type !== "string")
            throw new TypeError("defuss-query: expected an intrinsic VNode with a string type");
        // A detached SVG parent supplies the inherited namespace without changing the target.
        if (isElement(context) &&
            context.namespaceURI === "http://www.w3.org/2000/svg" &&
            vnode.type !== "svg") {
            const holder = renderer.createElement({ type: "svg" });
            return [renderer.createElement(vnode, holder)];
        }
        return [renderer.createElement(vnode)];
    }
    function remove(node) {
        requireMorph();
        if (isElement(node))
            api.clearDelegatedEventsDeep(node);
        node.parentNode?.removeChild(node);
    }
    function insert(target, content, position = "beforeend", clone = false) {
        requireMorph();
        const inside = position === "afterbegin" || position === "beforeend";
        const parent = inside
            ? isElement(target)
                ? rootOf(target)
                : target
            : target.parentNode;
        if (!parent)
            return [];
        const anchor = position === "afterbegin"
            ? parent.firstChild
            : position === "beforebegin"
                ? target
                : position === "afterend"
                    ? target.nextSibling
                    : null;
        const created = render(content, (isElement(parent) || parent.nodeType === 11
            ? parent
            : documentOf(parent)), clone);
        // Validate all sources before moving any: a failure must not partially insert the batch.
        for (const node of created)
            if (node === parent || node.contains(parent))
                throw new DOMException("Cannot insert an ancestor into its descendant", "HierarchyRequestError");
        for (const node of created) {
            parent.insertBefore(node, anchor);
            // morph's handlers listen on the element itself, so moving a node into
            // another Document/ShadowRoot needs no re-arming
            if (isElement(node))
                api.handleLifecycleEventsForOnMount(node);
        }
        return created;
    }
    function replace(target, content, clone = false) {
        if (!target.parentNode)
            return [];
        const nodes = render(content, target.parentNode, clone);
        if (nodes.includes(target)) {
            if (nodes.length === 1)
                return nodes;
            throw new TypeError("defuss-query: replacement containing its target must contain only that target");
        }
        const inserted = insert(target, nodes, "beforebegin");
        remove(target);
        return inserted;
    }
    function morph(target, content, options) {
        requireMorph();
        const snapshot = (item) => isNode(item)
            ? item.nodeType === 11
                ? Array.from(item.childNodes, (child) => api.domNodeToVNode(child))
                : api.domNodeToVNode(item)
            : Array.isArray(item)
                ? item.map(snapshot)
                : item;
        return api.morph(target, typeof content === "string" ? parse(content, target) : snapshot(content), options);
    }
    function text(target, value) {
        requireMorph();
        if (isElement(target))
            morph(target, [value]);
        else if (target.nodeType === 3 || target.nodeType === 4)
            target.nodeValue = value;
    }
    return { create: render, insert, replace, remove, morph, text };
}
//# sourceMappingURL=dom.js.map