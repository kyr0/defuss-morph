import type {
  DomAbstractionImpl,
  RenderInput,
  VNode,
  VNodeAttributes,
  VNodeChildren,
} from "./types.js";
import { queueCallback } from "./queue.js";
import {
  parseEventPropName,
  registerDelegatedEvent,
} from "./delegated-events.js";
import { isCommentVNode, templateContent } from "./html.js";

export const CLASS_ATTRIBUTE_NAME = "class";
export const XLINK_ATTRIBUTE_NAME = "xlink";
export const XMLNS_ATTRIBUTE_NAME = "xmlns";
export const REF_ATTRIBUTE_NAME = "ref";
export const DANGEROUSLY_SET_INNER_HTML_ATTRIBUTE = "dangerouslySetInnerHTML";

export const nsMap = {
  [XMLNS_ATTRIBUTE_NAME]: "http://www.w3.org/2000/xmlns/",
  [XLINK_ATTRIBUTE_NAME]: "http://www.w3.org/1999/xlink",
  svg: "http://www.w3.org/2000/svg",
};

/**
 * Calls `onUnmount` once `domNode` leaves the document. A move (removal and re-insertion in the
 * same task) is not an unmount: the observer follows the node to its new parent. Throws when the
 * node has no parent; a no-op where `MutationObserver` does not exist (SSR).
 */
export const observeUnmount = (domNode: Node, onUnmount: () => void): void => {
  if (!domNode || typeof onUnmount !== "function") {
    throw new Error(
      "Invalid arguments. Ensure domNode and onUnmount are valid.",
    );
  }

  // Skip MutationObserver in SSR environments where it doesn't exist
  if (typeof MutationObserver === "undefined") {
    return;
  }

  let parentNode: Node | null = domNode.parentNode;
  if (!parentNode) {
    throw new Error("The provided domNode does not have a parentNode.");
  }

  const observer = new MutationObserver((mutationsList) => {
    for (const mutation of mutationsList) {
      if (mutation.removedNodes.length > 0) {
        for (const removedNode of mutation.removedNodes) {
          if (removedNode === domNode) {
            // Defer check: if node is re-inserted (move), it will be connected
            queueMicrotask(() => {
              if (!domNode.isConnected) {
                // Node was actually unmounted
                onUnmount();
                observer.disconnect();
                return;
              }

              // Node was moved, not unmounted: re-arm observer on new parent
              const newParent = domNode.parentNode;
              if (newParent && newParent !== parentNode) {
                parentNode = newParent;
                observer.disconnect();
                observer.observe(parentNode, { childList: true });
              }
            });
            return;
          }
        }
      }
    }
  });

  // Observe the parentNode for child removals
  observer.observe(parentNode, { childList: true });
};

/** Elements with an armed unmount observer (at most one per element). */
const unmountObserved = new WeakSet<Node>();

/**
 * Runs the pending `onMount` hook and arms the `onUnmount` observer of an
 * element that was just inserted or patched in place.
 *
 * Why one observer that reads `$onUnmount` when it fires: morph calls this on
 * every in-place patch, and each re-render sets a fresh `onUnmount` closure.
 * Arming one observer per call made a single removal run every handler ever
 * registered (VERIFIED: 1 render + 3 morphs fired onUnmount 10 times).
 */
export const handleLifecycleEventsForOnMount = (newEl: HTMLElement) => {
  // check for a lifecycle "onMount" hook and call it
  if (typeof (newEl as any)?.$onMount === "function") {
    (newEl as any).$onMount!(newEl); // remove the hook after it's been called
    (newEl as any).$onMount = null;
  }

  if (typeof (newEl as any)?.$onUnmount === "function" && !unmountObserved.has(newEl)) {
    unmountObserved.add(newEl);
    observeUnmount(newEl, () => {
      // re-arm on a later re-insertion of the same node
      unmountObserved.delete(newEl);
      // the element, as UnmountHandler declares (it was called without one until 0.3.0)
      (newEl as any).$onUnmount?.(newEl);
    });
  }
};

/**
 * Returns the VNode-to-DOM renderer for `document`: element and SVG creation, text and comment
 * nodes, attributes (class arrays, style objects, controlled form props, namespaced SVG
 * attributes), refs, JSX event props and the `onMount`/`onUnmount` hooks.
 */
export const getRenderer = (document: Document): DomAbstractionImpl => {
  // DOM abstraction layer for manipulation
  const renderer = {
    hasElNamespace: (domElement: Element | Document): boolean =>
      (domElement as Element).namespaceURI === nsMap.svg,

    hasSvgNamespace: (
      parentElement: Element | Document,
      type: string,
    ): boolean =>
      renderer.hasElNamespace(parentElement) &&
      type !== "STYLE" &&
      type !== "SCRIPT",

    createElementOrElements: (
      virtualNode: RenderInput,
      parentDomElement?: Element | Document,
    ): Array<Element | Text | undefined> | Element | Text | undefined => {
      if (Array.isArray(virtualNode)) {
        return renderer.createChildElements(virtualNode, parentDomElement);
      }
      // text input is a text node, as in createChildElements (createElement
      // used to take it as a tag name: "hello" became <hello>)
      if (typeof virtualNode === "string" || typeof virtualNode === "number") {
        return renderer.createTextNode(String(virtualNode), parentDomElement);
      }
      if (typeof virtualNode !== "undefined") {
        return renderer.createElement(virtualNode, parentDomElement);
      }
      // undefined virtualNode -> e.g. when a tsx variable is used in markup which is undefined
      return renderer.createTextNode("", parentDomElement);
    },

    createElement: (
      virtualNode: RenderInput,
      parentDomElement?: Element | Document,
    ): Element | undefined => {
      let newEl: Element | undefined;

      // VERIFIED: comment nodes are leaves in the DOM (no attributes or
      // children), so none of the element setup below applies
      if (isCommentVNode(virtualNode)) {
        const comment = document.createComment(virtualNode.value ?? "");
        parentDomElement?.appendChild(comment);
        return comment as unknown as Element;
      }

      // An async function component that is still a function never resolved:
      // the JSX runtime failed while producing it, so render an empty box.
      if (
        typeof virtualNode === "function" &&
        virtualNode.constructor.name === "AsyncFunction"
      ) {
        newEl = document.createElement("div");
      } else if (
        typeof virtualNode === "object" &&
        virtualNode !== null &&
        "type" in virtualNode
      ) {
        const vNode = virtualNode as VNode;

        if (typeof vNode.type === "function") {
          newEl = document.createElement("div");
          (newEl as HTMLElement).innerText =
            `FATAL ERROR: ${(vNode.type as { _error?: string })._error}`;
        } else if (
          // SVG support
          (typeof vNode.type === "string" &&
            vNode.type.toUpperCase() === "SVG") ||
          (parentDomElement &&
            renderer.hasSvgNamespace(
              parentDomElement,
              typeof vNode.type === "string" ? vNode.type.toUpperCase() : "",
            ))
        ) {
          newEl = document.createElementNS(nsMap.svg, vNode.type as string);
        } else {
          newEl = document.createElement(vNode.type as string);
        }

        if (vNode.attributes) {
          renderer.setAttributes(vNode, newEl as Element);

          // apply dangerouslySetInnerHTML if provided
          if (vNode.attributes.dangerouslySetInnerHTML) {
            (newEl as HTMLElement).innerHTML =
              vNode.attributes.dangerouslySetInnerHTML.__html;
          }
        }

        // Skip child creation when dangerouslySetInnerHTML is used (matches React semantics)
        if (vNode.children && !vNode.attributes?.dangerouslySetInnerHTML) {
          // a <template>'s children belong in its content fragment, as the HTML parser puts them
          renderer.createChildElements(
            vNode.children,
            (templateContent(newEl) as unknown as Element | undefined) ?? newEl,
          );
        }
      }
      // anything else (text, null, a plain object) is not an element: undefined

      // Errors propagate to the caller unchanged: a library that logs and
      // rethrows reports every failure twice and cannot be silenced.
      if (newEl && parentDomElement) {
        parentDomElement.appendChild(newEl);
        handleLifecycleEventsForOnMount(newEl as HTMLElement);
      }
      return newEl as Element;
    },

    createTextNode: (text: string, domElement?: Element | Document): Text => {
      const node = document.createTextNode(text.toString());

      if (domElement) {
        domElement.appendChild(node);
      }
      return node;
    },

    createChildElements: (
      virtualChildren: VNodeChildren,
      domElement?: Element | Document,
    ): Array<Element | Text | undefined> => {
      const children: Array<Element | Text | undefined> = [];

      for (let i = 0; i < virtualChildren.length; i++) {
        const virtualChild = virtualChildren[i];

        // Skip booleans entirely - {true} and {false} render nothing (React/JSX semantics)
        if (typeof virtualChild === "boolean") {
          continue;
        }

        if (
          virtualChild === null ||
          (typeof virtualChild !== "object" &&
            typeof virtualChild !== "function")
        ) {
          children.push(
            renderer.createTextNode(
              (typeof virtualChild === "undefined" || virtualChild === null
                ? ""
                : virtualChild!
              ).toString(),
              domElement,
            ),
          );
        } else {
          children.push(
            renderer.createElement(virtualChild as VNode, domElement),
          );
        }
      }
      return children;
    },

    setAttribute: (name: string, value: any, domElement: Element) => {
      // attributes not set (undefined) are ignored; use null value to reset an attributes state
      if (typeof value === "undefined") return;

      if (name === DANGEROUSLY_SET_INNER_HTML_ATTRIBUTE) return;

      // internal list key: store on element, do not serialize into DOM
      if (name === "key") {
        (domElement as HTMLElement & { _defussKey?: string })._defussKey =
          String(value);
        return;
      }

      // save ref as { current: DOMElement } in ref object. A ref needs no
      // unmount observer: an earlier no-op one replaced an onUnmount declared
      // before `ref` (VERIFIED: it never fired) and added observers per morph.
      if (name === REF_ATTRIBUTE_NAME && typeof value !== "function") {
        (value as { current?: unknown }).current = domElement;
        (domElement as any)._defussRef = value;
        return;
      }

      // event props: delegate globally; still keep defuss lifecycle hooks
      const parsed = parseEventPropName(name);
      if (parsed && typeof value === "function") {
        const { eventType, capture } = parsed;

        if (eventType === "mount") {
          (domElement as any).$onMount = queueCallback(value as () => void);
          return;
        }

        // latest wins, like event props: a re-render replaces the handler
        // instead of chaining it to every earlier render's closure
        if (eventType === "unmount") {
          (domElement as any).$onUnmount = queueCallback(value as () => void);
          return;
        }

        registerDelegatedEvent(
          domElement as HTMLElement,
          eventType,
          value as EventListener,
          { capture },
        );
        return;
      }

      // transforms className="..." -> class="..."
      if (name === "className") {
        name = CLASS_ATTRIBUTE_NAME;
      }

      // transforms class={['a', 'b']} into class="a b"
      if (name === CLASS_ATTRIBUTE_NAME && Array.isArray(value)) {
        value = value.filter((val) => !!val).join(" ");
      }

      // SVG support
      const nsEndIndex = name.match(/[A-Z]/)?.index;
      if (renderer.hasElNamespace(domElement) && nsEndIndex) {
        const ns = name.substring(0, nsEndIndex).toLowerCase();
        const attrName = name.substring(nsEndIndex, name.length).toLowerCase();
        const namespace = nsMap[ns as keyof typeof nsMap] || null;
        domElement.setAttributeNS(
          namespace,
          ns === XLINK_ATTRIBUTE_NAME || ns === XMLNS_ATTRIBUTE_NAME
            ? `${ns}:${attrName}`
            : name,
          String(value),
        );
      } else if (name === "style" && typeof value !== "string") {
        const styleObj = value as Record<string, string | number>;
        for (const prop of Object.keys(styleObj)) {
          (domElement as HTMLElement).style[prop as any] = String(
            styleObj[prop],
          );
        }
      } else if (typeof value === "boolean") {
        (domElement as any)[name] = value;
        // Also set/remove the attribute so SSG serialization includes it
        if (value) {
          domElement.setAttribute(name, "");
        } else {
          domElement.removeAttribute(name);
        }
      } else if (
        // Controlled input props: use property assignment for live value,
        // AND setAttribute so SSG serialization (w3c-xmlserializer) includes it
        (name === "value" || name === "checked" || name === "selectedIndex") &&
        (domElement.nodeName === "INPUT" ||
          domElement.nodeName === "TEXTAREA" ||
          domElement.nodeName === "SELECT")
      ) {
        (domElement as any)[name] = value;
        if (name === "checked") {
          if (value) {
            domElement.setAttribute("checked", "");
          } else {
            domElement.removeAttribute("checked");
          }
        } else if (name === "value") {
          domElement.setAttribute("value", String(value));
        }
        // selectedIndex has no HTML attribute equivalent - skip setAttribute
      } else {
        domElement.setAttribute(name, String(value));
      }
    },

    setAttributes: (
      virtualNode: VNode<VNodeAttributes>,
      domElement: Element,
    ) => {
      // attributes are optional on hand-written VNodes — guard instead of the
      // `!` assertion, which crashed patching an element with an
      // attributes-less vnode (Object.keys(undefined) throws)
      const attrNames = Object.keys(virtualNode.attributes ?? {});
      for (let i = 0; i < attrNames.length; i++) {
        renderer.setAttribute(
          attrNames[i],
          virtualNode.attributes![attrNames[i]],
          domElement,
        );
      }
    },
  };
  return renderer;
};
