var __defProp = Object.defineProperty;
var __returnValue = (v) => v;
function __exportSetter(name, newValue) {
  this[name] = __returnValue.bind(null, newValue);
}
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: __exportSetter.bind(all, name)
    });
};

// src/index.ts
var exports_src = {};
__export(exports_src, {
  CAPTURE_ONLY_EVENTS: () => CAPTURE_ONLY_EVENTS,
  CLASS_ATTRIBUTE_NAME: () => CLASS_ATTRIBUTE_NAME,
  COMMENT_TYPE: () => COMMENT_TYPE,
  DANGEROUSLY_SET_INNER_HTML_ATTRIBUTE: () => DANGEROUSLY_SET_INNER_HTML_ATTRIBUTE,
  DEFAULT_TRANSITION_CONFIG: () => DEFAULT_TRANSITION_CONFIG,
  FROM_DOM_MARKER: () => FROM_DOM_MARKER,
  Fragment: () => Fragment,
  REF_ATTRIBUTE_NAME: () => REF_ATTRIBUTE_NAME,
  Reactive: () => Reactive,
  XLINK_ATTRIBUTE_NAME: () => XLINK_ATTRIBUTE_NAME,
  XMLNS_ATTRIBUTE_NAME: () => XMLNS_ATTRIBUTE_NAME,
  applyStyles: () => applyStyles,
  areDomNodesEqual: () => areDomNodesEqual,
  clearDelegatedEvents: () => clearDelegatedEvents,
  clearDelegatedEventsDeep: () => clearDelegatedEventsDeep,
  createRef: () => createRef,
  domNodeToVNode: () => domNodeToVNode,
  getMimeType: () => getMimeType,
  getRegisteredEventKeys: () => getRegisteredEventKeys,
  getRegisteredEventTypes: () => getRegisteredEventTypes,
  getRenderer: () => getRenderer,
  getTransitionStyles: () => getTransitionStyles,
  h: () => h,
  handleLifecycleEventsForOnMount: () => handleLifecycleEventsForOnMount,
  htmlStringToVNodes: () => htmlStringToVNodes,
  installReactive: () => installReactive,
  isCommentVNode: () => isCommentVNode,
  isHTML: () => isHTML,
  isMarkup: () => isMarkup,
  isRef: () => isRef,
  isSVG: () => isSVG,
  jsx: () => jsx,
  jsxDEV: () => jsxDEV,
  jsxs: () => jsxs,
  morph: () => morph,
  nsMap: () => nsMap,
  observeUnmount: () => observeUnmount,
  onClearDelegatedEvents: () => onClearDelegatedEvents,
  parseDOM: () => parseDOM,
  parseEventPropName: () => parseEventPropName,
  performTransition: () => performTransition,
  queueCallback: () => queueCallback,
  reactive: () => reactive,
  registerDelegatedEvent: () => registerDelegatedEvent,
  removeDelegatedEvent: () => removeDelegatedEvent,
  removeDelegatedEventByKey: () => removeDelegatedEventByKey,
  renderMarkup: () => renderMarkup,
  replaceDomWithVdom: () => replaceDomWithVdom,
  resolveGlobals: () => resolveGlobals,
  templateContent: () => templateContent,
  updateDomWithVdom: () => updateDomWithVdom
});
// src/queue.ts
var queueCallback = (cb) => (...args) => queueMicrotask(() => cb(...args));
// src/delegated-events.ts
var CAPTURE_ONLY_EVENTS = new Set([
  "focus",
  "blur",
  "scroll",
  "mouseenter",
  "mouseleave"
]);
var elementHandlerMap = new WeakMap;
var slotListeners = new WeakMap;
var activeDispatches = new WeakMap;
var parseEventPropName = (propName) => {
  if (!propName.startsWith("on"))
    return null;
  const raw = propName.slice(2);
  if (!raw)
    return null;
  const lower = raw.toLowerCase();
  const isCapture = lower.endsWith("capture");
  const eventType = isCapture ? lower.slice(0, -"capture".length) : lower;
  if (!eventType)
    return null;
  return { eventType, capture: isCapture };
};
var getOrCreateElementHandlers = (el) => {
  const existing = elementHandlerMap.get(el);
  if (existing)
    return existing;
  const created = new Map;
  elementHandlerMap.set(el, created);
  return created;
};
var runSlot = (target, eventType, phase, event) => {
  const handler = elementHandlerMap.get(target)?.get(eventType)?.[phase];
  if (!handler)
    return;
  const dispatchKey = `${eventType}:${phase}`;
  let active = activeDispatches.get(target);
  if (active?.has(dispatchKey))
    return;
  if (!active) {
    active = new Set;
    activeDispatches.set(target, active);
  }
  active.add(dispatchKey);
  try {
    handler.call(target, event);
  } finally {
    active.delete(dispatchKey);
  }
};
var setSlot = (target, eventType, phase, entry, handler) => {
  entry[phase] = handler;
  const key = `${eventType}:${phase}`;
  const capture = phase === "capture";
  let byKey = slotListeners.get(target);
  const installed = byKey?.get(key);
  if (handler && !installed) {
    if (!byKey) {
      byKey = new Map;
      slotListeners.set(target, byKey);
    }
    const trampoline = (event) => runSlot(target, eventType, phase, event);
    byKey.set(key, trampoline);
    target.addEventListener(eventType, trampoline, capture);
  } else if (!handler && installed) {
    byKey.delete(key);
    target.removeEventListener(eventType, installed, capture);
  }
};
var clearPhase = (target, eventType, entry, phase) => {
  setSlot(target, eventType, phase, entry, undefined);
  const setKey = phase === "capture" ? "captureSet" : "bubbleSet";
  for (const handler of entry[setKey] ?? [])
    target.removeEventListener(eventType, handler, phase === "capture");
  entry[setKey] = undefined;
};
var registerDelegatedEvent = (element, eventType, handler, options = {}) => {
  const capture = options.capture || CAPTURE_ONLY_EVENTS.has(eventType);
  const phase = capture ? "capture" : "bubble";
  const byEvent = getOrCreateElementHandlers(element);
  const entry = byEvent.get(eventType) ?? {};
  byEvent.set(eventType, entry);
  if (options.multi) {
    const setKey = capture ? "captureSet" : "bubbleSet";
    const set = entry[setKey] ??= new Set;
    if (!set.has(handler)) {
      set.add(handler);
      element.addEventListener(eventType, handler, capture);
    }
  } else {
    setSlot(element, eventType, phase, entry, handler);
  }
};
var isEntryEmpty = (entry) => !entry.capture && !entry.bubble && (!entry.captureSet || entry.captureSet.size === 0) && (!entry.bubbleSet || entry.bubbleSet.size === 0);
var removeDelegatedEvent = (target, eventType, handler, _options = {}) => {
  const byEvent = elementHandlerMap.get(target);
  if (!byEvent)
    return;
  const entry = byEvent.get(eventType);
  if (!entry)
    return;
  if (handler) {
    for (const phase of ["capture", "bubble"]) {
      const set = phase === "capture" ? entry.captureSet : entry.bubbleSet;
      if (set?.delete(handler))
        target.removeEventListener(eventType, handler, phase === "capture");
      if (entry[phase] === handler)
        setSlot(target, eventType, phase, entry, undefined);
    }
  } else {
    clearPhase(target, eventType, entry, "capture");
    clearPhase(target, eventType, entry, "bubble");
  }
  if (isEntryEmpty(entry)) {
    byEvent.delete(eventType);
  }
};
var clearHooks = new Set;
var onClearDelegatedEvents = (hook) => {
  clearHooks.add(hook);
  return () => {
    clearHooks.delete(hook);
  };
};
var clearDelegatedEvents = (target) => {
  const byEvent = elementHandlerMap.get(target);
  if (byEvent) {
    for (const [eventType, entry] of byEvent) {
      clearPhase(target, eventType, entry, "capture");
      clearPhase(target, eventType, entry, "bubble");
    }
    byEvent.clear();
  }
  for (const hook of clearHooks)
    hook(target);
};
var clearDelegatedEventsDeep = (root) => {
  clearDelegatedEvents(root);
  const doc = root.ownerDocument;
  if (!doc)
    return;
  const walker = doc.createTreeWalker(root, 1);
  let node = walker.nextNode();
  while (node) {
    clearDelegatedEvents(node);
    node = walker.nextNode();
  }
};
var getRegisteredEventTypes = (element) => {
  const byEvent = elementHandlerMap.get(element);
  if (!byEvent)
    return new Set;
  return new Set(byEvent.keys());
};
var getRegisteredEventKeys = (element) => {
  const byEvent = elementHandlerMap.get(element);
  if (!byEvent)
    return new Set;
  const keys = new Set;
  for (const [eventType, entry] of byEvent) {
    if (entry.bubble || entry.bubbleSet?.size)
      keys.add(`${eventType}:bubble`);
    if (entry.capture || entry.captureSet?.size)
      keys.add(`${eventType}:capture`);
  }
  return keys;
};
var removeDelegatedEventByKey = (element, eventType, phase) => {
  const byEvent = elementHandlerMap.get(element);
  if (!byEvent)
    return;
  const entry = byEvent.get(eventType);
  if (!entry)
    return;
  clearPhase(element, eventType, entry, phase);
  if (isEntryEmpty(entry))
    byEvent.delete(eventType);
};
// src/html.ts
var FROM_DOM_MARKER = Symbol("defuss-morph.from-dom");
var COMMENT_TYPE = "#comment";
var isCommentVNode = (value) => !!value && typeof value === "object" && value.type === COMMENT_TYPE;
var HTML_BOOLEAN_ATTRIBUTES = new Set([
  "allowfullscreen",
  "async",
  "autofocus",
  "autoplay",
  "checked",
  "controls",
  "default",
  "defer",
  "disabled",
  "formnovalidate",
  "hidden",
  "inert",
  "ismap",
  "itemscope",
  "loop",
  "multiple",
  "muted",
  "nomodule",
  "novalidate",
  "open",
  "playsinline",
  "readonly",
  "required",
  "reversed",
  "selected"
]);
var domAttributeToVNodeValue = (attr) => HTML_BOOLEAN_ATTRIBUTES.has(attr.name.toLowerCase()) ? true : attr.value;
function parseDOM(input, type, Parser) {
  return new Parser().parseFromString(input, type);
}
function isSVG(input, Parser) {
  const doc = parseDOM(input, "image/svg+xml", Parser);
  if (!doc.documentElement)
    return false;
  return doc.documentElement.nodeName.toLowerCase() === "svg";
}
function isHTML(input, Parser) {
  const doc = parseDOM(input, "text/html", Parser);
  return doc.documentElement.querySelectorAll("*").length > 2;
}
var isMarkup = (input, Parser) => input.indexOf("<") > -1 && input.indexOf(">") > -1 && (isHTML(input, Parser) || isSVG(input, Parser));
function renderMarkup(markup, Parser, doc) {
  const parsed = doc ? doc : parseDOM(markup, getMimeType(markup, Parser), Parser);
  if (parsed.body)
    return Array.from(parsed.body.childNodes);
  return parsed.documentElement ? [parsed.documentElement] : [];
}
function getMimeType(input, Parser) {
  if (isSVG(input, Parser)) {
    return "image/svg+xml";
  }
  return "text/html";
}
var templateContent = (element) => element.localName === "template" ? element.content : undefined;
function domNodeToVNode(node) {
  if (node.nodeType === 3) {
    return node.nodeValue || "";
  }
  if (node.nodeType === 1) {
    const element = node;
    const attributes = {};
    for (let i = 0;i < element.attributes.length; i++) {
      const attr = element.attributes[i];
      attributes[attr.name] = domAttributeToVNodeValue(attr);
    }
    const children = [];
    for (let child = (templateContent(element) ?? element).firstChild;child; child = child.nextSibling) {
      children.push(domNodeToVNode(child));
    }
    attributes[FROM_DOM_MARKER] = true;
    return { type: element.localName, attributes, children };
  }
  if (node.nodeType === 8) {
    return { type: COMMENT_TYPE, value: node.nodeValue ?? "" };
  }
  return "";
}
var inertDocuments = new WeakMap;
var DOCUMENT_START = /^\s*(?:<!--[\s\S]*?-->\s*)*<(?:!doctype|html|head|body)[\s>/]/i;
function htmlStringToVNodes(html, Parser) {
  if (DOCUMENT_START.test(html)) {
    return toVNodes(new Parser().parseFromString(html, "text/html").body.childNodes);
  }
  let inert = inertDocuments.get(Parser);
  if (!inert) {
    inert = new Parser().parseFromString("", "text/html");
    inertDocuments.set(Parser, inert);
  }
  const template = inert.createElement("template");
  template.innerHTML = html;
  return toVNodes(template.content.childNodes);
}
function toVNodes(nodes) {
  const vNodes = [];
  for (let i = 0;i < nodes.length; i++) {
    const vnode = domNodeToVNode(nodes[i]);
    if (vnode !== "")
      vNodes.push(vnode);
  }
  return vNodes;
}

// src/renderer.ts
var CLASS_ATTRIBUTE_NAME = "class";
var XLINK_ATTRIBUTE_NAME = "xlink";
var XMLNS_ATTRIBUTE_NAME = "xmlns";
var REF_ATTRIBUTE_NAME = "ref";
var DANGEROUSLY_SET_INNER_HTML_ATTRIBUTE = "dangerouslySetInnerHTML";
var nsMap = {
  [XMLNS_ATTRIBUTE_NAME]: "http://www.w3.org/2000/xmlns/",
  [XLINK_ATTRIBUTE_NAME]: "http://www.w3.org/1999/xlink",
  svg: "http://www.w3.org/2000/svg"
};
var observeUnmount = (domNode, onUnmount) => {
  if (!domNode || typeof onUnmount !== "function") {
    throw new Error("Invalid arguments. Ensure domNode and onUnmount are valid.");
  }
  if (typeof MutationObserver === "undefined") {
    return;
  }
  let parentNode = domNode.parentNode;
  if (!parentNode) {
    throw new Error("The provided domNode does not have a parentNode.");
  }
  const observer = new MutationObserver((mutationsList) => {
    for (const mutation of mutationsList) {
      if (mutation.removedNodes.length > 0) {
        for (const removedNode of mutation.removedNodes) {
          if (removedNode === domNode) {
            queueMicrotask(() => {
              if (!domNode.isConnected) {
                onUnmount();
                observer.disconnect();
                return;
              }
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
  observer.observe(parentNode, { childList: true });
};
var unmountObserved = new WeakSet;
var handleLifecycleEventsForOnMount = (newEl) => {
  if (typeof newEl?.$onMount === "function") {
    newEl.$onMount(newEl);
    newEl.$onMount = null;
  }
  if (typeof newEl?.$onUnmount === "function" && !unmountObserved.has(newEl)) {
    unmountObserved.add(newEl);
    observeUnmount(newEl, () => {
      unmountObserved.delete(newEl);
      newEl.$onUnmount?.(newEl);
    });
  }
};
var getRenderer = (document2) => {
  const renderer = {
    hasElNamespace: (domElement) => domElement.namespaceURI === nsMap.svg,
    hasSvgNamespace: (parentElement, type) => renderer.hasElNamespace(parentElement) && type !== "STYLE" && type !== "SCRIPT",
    createElementOrElements: (virtualNode, parentDomElement) => {
      if (Array.isArray(virtualNode)) {
        return renderer.createChildElements(virtualNode, parentDomElement);
      }
      if (typeof virtualNode === "string" || typeof virtualNode === "number") {
        return renderer.createTextNode(String(virtualNode), parentDomElement);
      }
      if (typeof virtualNode !== "undefined") {
        return renderer.createElement(virtualNode, parentDomElement);
      }
      return renderer.createTextNode("", parentDomElement);
    },
    createElement: (virtualNode, parentDomElement) => {
      let newEl;
      if (isCommentVNode(virtualNode)) {
        const comment = document2.createComment(virtualNode.value ?? "");
        parentDomElement?.appendChild(comment);
        return comment;
      }
      if (typeof virtualNode === "function" && virtualNode.constructor.name === "AsyncFunction") {
        newEl = document2.createElement("div");
      } else if (typeof virtualNode === "object" && virtualNode !== null && "type" in virtualNode) {
        const vNode = virtualNode;
        if (typeof vNode.type === "function") {
          newEl = document2.createElement("div");
          newEl.innerText = `FATAL ERROR: ${vNode.type._error}`;
        } else if (typeof vNode.type === "string" && vNode.type.toUpperCase() === "SVG" || parentDomElement && renderer.hasSvgNamespace(parentDomElement, typeof vNode.type === "string" ? vNode.type.toUpperCase() : "")) {
          newEl = document2.createElementNS(nsMap.svg, vNode.type);
        } else {
          newEl = document2.createElement(vNode.type);
        }
        if (vNode.attributes) {
          renderer.setAttributes(vNode, newEl);
          if (vNode.attributes.dangerouslySetInnerHTML) {
            newEl.innerHTML = vNode.attributes.dangerouslySetInnerHTML.__html;
          }
        }
        if (vNode.children && !vNode.attributes?.dangerouslySetInnerHTML) {
          renderer.createChildElements(vNode.children, templateContent(newEl) ?? newEl);
        }
      }
      if (newEl && parentDomElement) {
        parentDomElement.appendChild(newEl);
        handleLifecycleEventsForOnMount(newEl);
      }
      return newEl;
    },
    createTextNode: (text, domElement) => {
      const node = document2.createTextNode(text.toString());
      if (domElement) {
        domElement.appendChild(node);
      }
      return node;
    },
    createChildElements: (virtualChildren, domElement) => {
      const children = [];
      for (let i = 0;i < virtualChildren.length; i++) {
        const virtualChild = virtualChildren[i];
        if (typeof virtualChild === "boolean") {
          continue;
        }
        if (virtualChild === null || typeof virtualChild !== "object" && typeof virtualChild !== "function") {
          children.push(renderer.createTextNode((typeof virtualChild === "undefined" || virtualChild === null ? "" : virtualChild).toString(), domElement));
        } else {
          children.push(renderer.createElement(virtualChild, domElement));
        }
      }
      return children;
    },
    setAttribute: (name, value, domElement) => {
      if (typeof value === "undefined")
        return;
      if (name === DANGEROUSLY_SET_INNER_HTML_ATTRIBUTE)
        return;
      if (name === "key") {
        domElement._defussKey = String(value);
        return;
      }
      if (name === REF_ATTRIBUTE_NAME && typeof value !== "function") {
        value.current = domElement;
        domElement._defussRef = value;
        return;
      }
      const parsed = parseEventPropName(name);
      if (parsed && typeof value === "function") {
        const { eventType, capture } = parsed;
        if (eventType === "mount") {
          domElement.$onMount = queueCallback(value);
          return;
        }
        if (eventType === "unmount") {
          domElement.$onUnmount = queueCallback(value);
          return;
        }
        registerDelegatedEvent(domElement, eventType, value, { capture });
        return;
      }
      if (name === "className") {
        name = CLASS_ATTRIBUTE_NAME;
      }
      if (name === CLASS_ATTRIBUTE_NAME && Array.isArray(value)) {
        value = value.filter((val) => !!val).join(" ");
      }
      const nsEndIndex = name.match(/[A-Z]/)?.index;
      if (renderer.hasElNamespace(domElement) && nsEndIndex) {
        const ns = name.substring(0, nsEndIndex).toLowerCase();
        const attrName = name.substring(nsEndIndex, name.length).toLowerCase();
        const namespace = nsMap[ns] || null;
        domElement.setAttributeNS(namespace, ns === XLINK_ATTRIBUTE_NAME || ns === XMLNS_ATTRIBUTE_NAME ? `${ns}:${attrName}` : name, String(value));
      } else if (name === "style" && typeof value !== "string") {
        const styleObj = value;
        for (const prop of Object.keys(styleObj)) {
          domElement.style[prop] = String(styleObj[prop]);
        }
      } else if (typeof value === "boolean") {
        domElement[name] = value;
        if (value) {
          domElement.setAttribute(name, "");
        } else {
          domElement.removeAttribute(name);
        }
      } else if ((name === "value" || name === "checked" || name === "selectedIndex") && (domElement.nodeName === "INPUT" || domElement.nodeName === "TEXTAREA" || domElement.nodeName === "SELECT")) {
        domElement[name] = value;
        if (name === "checked") {
          if (value) {
            domElement.setAttribute("checked", "");
          } else {
            domElement.removeAttribute("checked");
          }
        } else if (name === "value") {
          domElement.setAttribute("value", String(value));
        }
      } else {
        domElement.setAttribute(name, String(value));
      }
    },
    setAttributes: (virtualNode, domElement) => {
      const attrNames = Object.keys(virtualNode.attributes ?? {});
      for (let i = 0;i < attrNames.length; i++) {
        renderer.setAttribute(attrNames[i], virtualNode.attributes[attrNames[i]], domElement);
      }
    }
  };
  return renderer;
};
// src/lis.ts
var longestIncreasingRun = (values) => {
  const n = values.length;
  const marked = new Uint8Array(n);
  const tails = new Int32Array(n);
  const previous = new Int32Array(n);
  let length = 0;
  for (let i = 0;i < n; i++) {
    const value = values[i];
    if (value < 0)
      continue;
    let low = 0;
    let high = length;
    while (low < high) {
      const mid = low + high >> 1;
      if (values[tails[mid]] < value)
        low = mid + 1;
      else
        high = mid;
    }
    previous[i] = low > 0 ? tails[low - 1] : -1;
    tails[low] = i;
    if (low === length)
      length++;
  }
  for (let i = length > 0 ? tails[length - 1] : -1;i >= 0; i = previous[i])
    marked[i] = 1;
  return marked;
};

// src/morph.ts
var areDomNodesEqual = (oldNode, newNode) => {
  if (oldNode === newNode)
    return true;
  if (oldNode.nodeType !== newNode.nodeType)
    return false;
  if (oldNode.nodeType === 1) {
    const oldElement = oldNode;
    const newElement = newNode;
    if (oldElement.tagName !== newElement.tagName)
      return false;
    const oldAttrs = oldElement.attributes;
    const newAttrs = newElement.attributes;
    if (oldAttrs.length !== newAttrs.length)
      return false;
    for (let i = 0;i < oldAttrs.length; i++) {
      const oldAttr = oldAttrs[i];
      const newAttrValue = newElement.getAttribute(oldAttr.name);
      if (oldAttr.value !== newAttrValue)
        return false;
    }
  }
  if (oldNode.nodeType === 3 || oldNode.nodeType === 8) {
    if (oldNode.nodeValue !== newNode.nodeValue)
      return false;
  }
  return true;
};
function isTextLike(value) {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}
function isVNode(value) {
  return Boolean(value && typeof value === "object" && "type" in value);
}
function toValidChild(child, lenient = false) {
  if (child == null)
    return child;
  if (isTextLike(child))
    return child;
  if (isVNode(child))
    return child;
  if (lenient && child && typeof child === "object" && "attributes" in child)
    return child;
  return;
}
function normalizeChildren(input, lenient = false) {
  const raw = [];
  const pushChild = (child) => {
    if (Array.isArray(child)) {
      child.forEach(pushChild);
      return;
    }
    const valid = toValidChild(child, lenient);
    if (typeof valid === "undefined")
      return;
    if (isVNode(valid) && (valid.type === "fragment" || valid.type === "Fragment")) {
      const nested = Array.isArray(valid.children) ? valid.children : [];
      nested.forEach(pushChild);
      return;
    }
    if (valid === null || typeof valid === "undefined" || typeof valid === "boolean")
      return;
    raw.push(valid);
  };
  pushChild(input);
  const fused = [];
  let buffer = null;
  const flush = () => {
    if (buffer !== null && buffer.length > 0)
      fused.push(buffer);
    buffer = null;
  };
  for (const child of raw) {
    if (typeof child === "string" || typeof child === "number" || typeof child === "boolean") {
      buffer = (buffer ?? "") + String(child);
      continue;
    }
    flush();
    fused.push(child);
  }
  flush();
  return fused;
}
function getVNodeMatchKey(child) {
  if (!child || typeof child !== "object")
    return null;
  const key = child.attributes?.key;
  if (typeof key === "string" || typeof key === "number")
    return `k:${String(key)}`;
  const id = child.attributes?.id;
  if (typeof id === "string" && id.length > 0)
    return `id:${id}`;
  return null;
}
function describePatchItem(child) {
  if (child && typeof child === "object") {
    return `<${typeof child.type === "string" ? child.type : "component"}>`;
  }
  return "plain text";
}
function getDomMatchKeys(node) {
  if (node.nodeType !== 1)
    return [];
  const el = node;
  const keys = [];
  const internalKey = el._defussKey;
  if (internalKey)
    keys.push(`k:${internalKey}`);
  const attrKey = el.getAttribute("key");
  if (attrKey)
    keys.push(`k:${attrKey}`);
  const id = el.id;
  if (id)
    keys.push(`id:${id}`);
  return keys;
}
function areNodeAndChildMatching(domNode, child) {
  if (typeof child === "string" || typeof child === "number" || typeof child === "boolean") {
    return domNode.nodeType === 3;
  }
  if (isCommentVNode(child))
    return domNode.nodeType === 8;
  if (child && typeof child === "object") {
    if (domNode.nodeType !== 1)
      return false;
    const el = domNode;
    const oldTag = el.tagName.toLowerCase();
    const newTag = typeof child.type === "string" ? child.type.toLowerCase() : "";
    if (!newTag || oldTag !== newTag)
      return false;
    return true;
  }
  return false;
}
function createDomFromChild(child, globals) {
  const renderer = getRenderer(globals.window.document);
  if (child == null)
    return;
  if (typeof child === "string" || typeof child === "number" || typeof child === "boolean") {
    return [globals.window.document.createTextNode(String(child))];
  }
  const created = renderer.createElementOrElements(child);
  if (!created)
    return;
  const nodes = Array.isArray(created) ? created : [created];
  return nodes.filter(Boolean);
}
function shouldPreserveFormStateAttribute(el, attrName, vnode) {
  const tag = el.tagName.toLowerCase();
  const hasExplicit = Object.hasOwn(vnode.attributes ?? {}, attrName);
  if (hasExplicit)
    return false;
  if (tag === "input")
    return attrName === "value" || attrName === "checked";
  if (tag === "textarea")
    return attrName === "value";
  if (tag === "select")
    return attrName === "value";
  return false;
}
function patchElementInPlace(el, vnode, globals, mergeAttributes = false) {
  const renderer = getRenderer(globals.window.document);
  const existingAttrs = mergeAttributes ? [] : Array.from(el.attributes);
  const nextAttrs = vnode.attributes ?? {};
  for (const attr of existingAttrs) {
    const { name } = attr;
    if (name === "key")
      continue;
    if (name.startsWith("on"))
      continue;
    if (name === "class" && (Object.hasOwn(nextAttrs, "class") || Object.hasOwn(nextAttrs, "className"))) {
      continue;
    }
    if (!Object.hasOwn(nextAttrs, name)) {
      if (shouldPreserveFormStateAttribute(el, name, vnode))
        continue;
      el.removeAttribute(name);
    }
  }
  const preserveDelegatedHandlers = mergeAttributes || Boolean(nextAttrs[FROM_DOM_MARKER]);
  if (!preserveDelegatedHandlers) {
    const registeredKeys = getRegisteredEventKeys(el);
    const nextEventKeys = new Set;
    for (const propName of Object.keys(nextAttrs)) {
      const parsed = parseEventPropName(propName);
      if (parsed) {
        const phase = parsed.capture ? "capture" : "bubble";
        nextEventKeys.add(`${parsed.eventType}:${phase}`);
      }
    }
    for (const key of registeredKeys) {
      if (!nextEventKeys.has(key)) {
        const [eventType, phase] = key.split(":");
        removeDelegatedEventByKey(el, eventType, phase);
      }
    }
  }
  renderer.setAttributes(vnode, el);
  handleLifecycleEventsForOnMount(el);
  const d = vnode.attributes?.dangerouslySetInnerHTML;
  if (d && typeof d === "object" && typeof d.__html === "string") {
    el.innerHTML = d.__html;
    return;
  }
  const tag = el.tagName.toLowerCase();
  if (tag === "textarea") {
    const isControlled = Object.hasOwn(nextAttrs, "value");
    const isActive = el.ownerDocument?.activeElement === el;
    if (isActive && !isControlled)
      return;
  }
  if (mergeAttributes && (vnode.children === undefined || vnode.children.length === 0 && nextAttrs[FROM_DOM_MARKER]))
    return;
  morphDomDirect(el, vnode.children ?? [], globals);
}
function replaceNode(old, next) {
  if (old.nodeType === 1)
    clearDelegatedEventsDeep(old);
  old.parentNode?.replaceChild(next, old);
}
function morphNode(domNode, child, globals, mergeAttributes = false) {
  if (typeof child === "string" || typeof child === "number" || typeof child === "boolean") {
    const text = String(child);
    if (domNode.nodeType === 3) {
      if (domNode.nodeValue !== text)
        domNode.nodeValue = text;
      return domNode;
    }
    const next = globals.window.document.createTextNode(text);
    replaceNode(domNode, next);
    return next;
  }
  if (isCommentVNode(child)) {
    const data = child.value ?? "";
    if (domNode.nodeType === 8) {
      if (domNode.nodeValue !== data)
        domNode.nodeValue = data;
      return domNode;
    }
    const next = globals.window.document.createComment(data);
    replaceNode(domNode, next);
    return next;
  }
  if (child && typeof child === "object") {
    const newType = typeof child.type === "string" ? child.type : null;
    if (!newType)
      return domNode;
    if (domNode.nodeType !== 1) {
      const created = createDomFromChild(child, globals);
      const first = Array.isArray(created) ? created[0] : created;
      if (!first)
        return null;
      domNode.parentNode?.replaceChild(first, domNode);
      handleLifecycleEventsForOnMount(first);
      return first;
    }
    const el = domNode;
    const oldTag = el.tagName.toLowerCase();
    const newTag = newType.toLowerCase();
    if (oldTag !== newTag) {
      const created = createDomFromChild(child, globals);
      const first = Array.isArray(created) ? created[0] : created;
      if (!first)
        return null;
      replaceNode(el, first);
      handleLifecycleEventsForOnMount(first);
      return first;
    }
    patchElementInPlace(el, child, globals, mergeAttributes);
    return el;
  }
  if (domNode.nodeType === 1)
    clearDelegatedEventsDeep(domNode);
  domNode.parentNode?.removeChild(domNode);
  return null;
}
var renderingNodes = new WeakSet;
var pendingMorphs = new Map;
var resolveGlobals = (el, globals) => {
  if (globals)
    return globals;
  const win = el?.ownerDocument?.defaultView ?? globalThis;
  return { window: win };
};
function isAncestorRendering(el) {
  let current = el.parentElement;
  while (current) {
    if (renderingNodes.has(current))
      return true;
    current = current.parentElement;
  }
  return false;
}
function flushPendingMorphs() {
  if (pendingMorphs.size === 0)
    return;
  const snapshot = [...pendingMorphs.entries()];
  pendingMorphs.clear();
  for (const [el, { vdom, globals, mode }] of snapshot) {
    if (!el.isConnected)
      continue;
    updateDomWithVdom(el, vdom, globals, mode);
  }
}
function updateDomWithVdom(parentElement, newVDOM, globals, mode = "replace") {
  const resolvedGlobals = resolveGlobals(parentElement, globals);
  if (renderingNodes.has(parentElement) || isAncestorRendering(parentElement)) {
    pendingMorphs.set(parentElement, {
      vdom: newVDOM,
      globals: resolvedGlobals,
      mode
    });
    return;
  }
  renderingNodes.add(parentElement);
  try {
    morphDomDirect(parentElement, newVDOM, resolvedGlobals, mode);
  } finally {
    renderingNodes.delete(parentElement);
  }
  flushPendingMorphs();
}
function morphDiff(targetRoot, patchItems, globals) {
  const keyedPool = new Map;
  for (const node of Array.from(targetRoot.childNodes)) {
    for (const k of getDomMatchKeys(node)) {
      if (!keyedPool.has(k))
        keyedPool.set(k, node);
    }
  }
  for (const item of patchItems) {
    if (typeof item === "string" && item.trim() === "")
      continue;
    if (isCommentVNode(item))
      continue;
    const key = getVNodeMatchKey(item);
    if (!key) {
      throw new Error(`morph diff: patch items must be elements with a key or id attribute (got ${describePatchItem(item)})`);
    }
    const match = keyedPool.get(key);
    if (match) {
      const patchItem = item && typeof item === "object" && !item.type ? { ...item, type: match.tagName.toLowerCase() } : item;
      morphNode(match, patchItem, globals, true);
      continue;
    }
    if (!item?.type) {
      throw new Error(`morph diff: new (unmatched) patch items must declare a tag (type), got key/id "${key}"`);
    }
    const created = createDomFromChild(item, globals) ?? [];
    for (const node of created) {
      targetRoot.appendChild(node);
      handleLifecycleEventsForOnMount(node);
    }
  }
}
function moveNode(parent, node, anchor) {
  if (typeof parent.moveBefore === "function") {
    try {
      parent.moveBefore(node, anchor);
      return;
    } catch {}
  }
  const doc = node.ownerDocument;
  const active = doc?.activeElement;
  const holdsFocus = !!active && active !== doc.body && node.contains(active);
  let selection;
  if (holdsFocus) {
    try {
      if (active.selectionStart !== null && active.selectionStart !== undefined) {
        selection = [active.selectionStart, active.selectionEnd ?? active.selectionStart, active.selectionDirection ?? "none"];
      }
    } catch {
      selection = undefined;
    }
  }
  parent.insertBefore(node, anchor);
  if (holdsFocus && active.isConnected && doc.activeElement !== active) {
    active.focus({ preventScroll: true });
    if (selection)
      active.setSelectionRange(...selection);
  }
}
function patchByPosition(targetRoot, nextChildren, globals) {
  const live = targetRoot.childNodes;
  if (live.length !== nextChildren.length)
    return false;
  for (let c = 0;c < nextChildren.length; c++) {
    const node = live[c];
    const child = nextChildren[c];
    if (getVNodeMatchKey(child) !== null || !areNodeAndChildMatching(node, child))
      return false;
    if (node.nodeType === 1 && getDomMatchKeys(node).length > 0)
      return false;
  }
  for (let c = 0;c < nextChildren.length; c++)
    morphNode(live[c], nextChildren[c], globals);
  return true;
}
function morphDomDirect(parentElement, newVDOM, globals, mode = "replace") {
  const el = parentElement;
  const isCustomElement = el.tagName.includes("-");
  const targetRoot = templateContent(parentElement) ?? (el.shadowRoot && !isCustomElement ? el.shadowRoot : parentElement);
  const nextChildren = normalizeChildren(newVDOM, mode === "diff");
  if (mode === "diff") {
    morphDiff(targetRoot, nextChildren, globals);
    return;
  }
  if (patchByPosition(targetRoot, nextChildren, globals))
    return;
  const existing = Array.from(targetRoot.childNodes);
  const keyedPool = new Map;
  const nodeKeys = [];
  const unkeyedPool = [];
  for (let i = 0;i < existing.length; i++) {
    const keys = getDomMatchKeys(existing[i]);
    if (keys.length > 0) {
      nodeKeys[i] = keys;
      let addedToKeyedPool = false;
      for (const k of keys) {
        if (!keyedPool.has(k)) {
          keyedPool.set(k, i);
          addedToKeyedPool = true;
        }
      }
      if (!addedToKeyedPool) {
        unkeyedPool.push(i);
      }
    } else {
      unkeyedPool.push(i);
    }
  }
  const consumeKeyedNode = (i) => {
    for (const k of nodeKeys[i] ?? []) {
      if (keyedPool.get(k) === i)
        keyedPool.delete(k);
    }
  };
  const takeUnkeyedMatch = (child) => {
    for (let j = 0;j < unkeyedPool.length; j++) {
      const i = unkeyedPool[j];
      if (areNodeAndChildMatching(existing[i], child)) {
        unkeyedPool.splice(j, 1);
        return i;
      }
    }
    return -1;
  };
  const count = nextChildren.length;
  const matched = new Int32Array(count);
  let inOrder = true;
  let previous = -1;
  for (let c = 0;c < count; c++) {
    const child = nextChildren[c];
    const key = getVNodeMatchKey(child);
    let i = -1;
    if (key) {
      const hit = keyedPool.get(key);
      if (hit !== undefined) {
        i = hit;
        consumeKeyedNode(hit);
      }
    } else {
      i = takeUnkeyedMatch(child);
    }
    matched[c] = i;
    if (i >= 0) {
      if (i < previous)
        inOrder = false;
      previous = i;
    }
  }
  const stays = inOrder ? null : longestIncreasingRun(matched);
  const staying = (c) => matched[c] >= 0 && (stays === null || stays[c] === 1);
  let anchorAt = 0;
  while (anchorAt < count && !staying(anchorAt))
    anchorAt++;
  for (let c = 0;c < count; c++) {
    if (anchorAt <= c) {
      anchorAt = c + 1;
      while (anchorAt < count && !staying(anchorAt))
        anchorAt++;
    }
    const anchor = anchorAt < count ? existing[matched[anchorAt]] : null;
    const child = nextChildren[c];
    if (matched[c] >= 0) {
      const match = existing[matched[c]];
      if (!staying(c))
        moveNode(targetRoot, match, anchor);
      morphNode(match, child, globals);
      continue;
    }
    const created = createDomFromChild(child, globals);
    if (!created || Array.isArray(created) && created.length === 0)
      continue;
    const nodes = Array.isArray(created) ? created : [created];
    for (const node of nodes) {
      targetRoot.insertBefore(node, anchor);
      handleLifecycleEventsForOnMount(node);
    }
  }
  const remaining = new Set;
  for (const i of unkeyedPool)
    remaining.add(existing[i]);
  for (const i of keyedPool.values())
    remaining.add(existing[i]);
  for (const node of remaining) {
    if (node.parentNode === targetRoot) {
      if (node.nodeType === 1) {
        clearDelegatedEventsDeep(node);
      }
      targetRoot.removeChild(node);
    }
  }
}
function replaceDomWithVdom(parentElement, newVDOM, globals) {
  const resolvedGlobals = resolveGlobals(parentElement, globals);
  while (parentElement.firstChild) {
    const child = parentElement.firstChild;
    if (child.nodeType === 1)
      clearDelegatedEventsDeep(child);
    parentElement.removeChild(child);
  }
  const renderer = getRenderer(resolvedGlobals.window.document);
  const newDom = renderer.createElementOrElements(newVDOM);
  if (Array.isArray(newDom)) {
    for (const node of newDom) {
      if (node) {
        parentElement.appendChild(node);
        handleLifecycleEventsForOnMount(node);
      }
    }
  } else if (newDom) {
    parentElement.appendChild(newDom);
    handleLifecycleEventsForOnMount(newDom);
  }
}
// src/transitions.ts
var injectShakeKeyframes = (doc) => {
  if (!doc)
    return;
  if (!doc.getElementById("defuss-shake")) {
    const style = doc.createElement("style");
    style.id = "defuss-shake";
    style.textContent = "@keyframes shake{0%,100%{transform:translate3d(0,0,0)}10%,30%,50%,70%,90%{transform:translate3d(-10px,0,0)}20%,40%,60%,80%{transform:translate3d(10px,0,0)}}";
    doc.head.appendChild(style);
  }
};
var getTransitionStyles = (type, duration, easing = "ease-in-out") => {
  const t = `transform ${duration}ms ${easing}, opacity ${duration}ms ${easing}`;
  const styles = {
    fade: {
      enter: { opacity: "0", transition: t, transform: "translate3d(0,0,0)" },
      enterActive: { opacity: "1" },
      exit: { opacity: "1", transition: t, transform: "translate3d(0,0,0)" },
      exitActive: { opacity: "0" }
    },
    "slide-left": {
      enter: {
        transform: "translate3d(100%,0,0)",
        opacity: "0.5",
        transition: t
      },
      enterActive: { transform: "translate3d(0,0,0)", opacity: "1" },
      exit: { transform: "translate3d(0,0,0)", opacity: "1", transition: t },
      exitActive: { transform: "translate3d(-100%,0,0)", opacity: "0.5" }
    },
    "slide-right": {
      enter: {
        transform: "translate3d(-100%,0,0)",
        opacity: "0.5",
        transition: t
      },
      enterActive: { transform: "translate3d(0,0,0)", opacity: "1" },
      exit: { transform: "translate3d(0,0,0)", opacity: "1", transition: t },
      exitActive: { transform: "translate3d(100%,0,0)", opacity: "0.5" }
    },
    shake: (() => {
      injectShakeKeyframes(typeof document !== "undefined" ? document : undefined);
      return {
        enter: {
          transform: "translate3d(0,0,0)",
          opacity: "1",
          transition: "none"
        },
        enterActive: {
          transform: "translate3d(0,0,0)",
          opacity: "1",
          animation: `shake ${duration}ms cubic-bezier(0.36,0.07,0.19,0.97)`
        },
        exit: {
          transform: "translate3d(0,0,0)",
          opacity: "1",
          transition: "none"
        },
        exitActive: {
          transform: "translate3d(0,0,0)",
          opacity: "1",
          animation: `shake ${duration}ms cubic-bezier(0.36,0.07,0.19,0.97)`
        }
      };
    })()
  };
  return styles[type] || { enter: {}, enterActive: {}, exit: {}, exitActive: {} };
};
var applyStyles = (el, styles) => Object.entries(styles).forEach(([k, v]) => el.style.setProperty(k, String(v)));
var DEFAULT_TRANSITION_CONFIG = {
  type: "fade",
  duration: 300,
  easing: "ease-in-out",
  delay: 0,
  target: "parent"
};
var wait = (ms) => new Promise((r) => setTimeout(r, ms));
var performCrossfade = async (element, updateCallback, duration, easing) => {
  const originalStyle = element.style.cssText;
  const snapshot = element.cloneNode(true);
  const doc = element.ownerDocument;
  try {
    const rect = element.getBoundingClientRect();
    const top = rect.top + (doc.defaultView?.scrollY ?? 0);
    const left = rect.left + (doc.defaultView?.scrollX ?? 0);
    snapshot.style.cssText = `position:absolute;top:${top}px;left:${left}px;width:${rect.width}px;height:${rect.height}px;opacity:1;transition:opacity ${duration}ms ${easing};z-index:1000;`;
    element.style.opacity = "0";
    element.style.transition = `opacity ${duration}ms ${easing}`;
    doc.body.appendChild(snapshot);
    await updateCallback();
    element.offsetHeight;
    snapshot.style.opacity = "0";
    element.style.opacity = "1";
    await wait(duration);
    doc.body.removeChild(snapshot);
  } catch (error) {
    if (snapshot.parentElement)
      doc.body.removeChild(snapshot);
    throw error;
  } finally {
    element.style.cssText = originalStyle;
  }
};
var performTransition = async (element, updateCallback, config = {}) => {
  const {
    type = "fade",
    duration = 300,
    easing = "ease-in-out",
    delay = 0
  } = { ...DEFAULT_TRANSITION_CONFIG, ...config };
  if (type === "none") {
    await updateCallback();
    return;
  }
  if (delay > 0)
    await wait(delay);
  if (type === "fade") {
    await performCrossfade(element, updateCallback, duration, easing);
    return;
  }
  const styles = config.styles || getTransitionStyles(type, duration, easing);
  const originalTransition = element.style.transition;
  const originalAnimation = element.style.animation;
  try {
    if (type === "shake") {
      element.style.animation = "none";
      element.offsetHeight;
    }
    applyStyles(element, styles.exit);
    element.offsetHeight;
    applyStyles(element, styles.exitActive);
    await wait(duration);
    await updateCallback();
    applyStyles(element, styles.enter);
    element.offsetHeight;
    applyStyles(element, styles.enterActive);
    await wait(duration);
    element.style.transition = originalTransition;
    element.style.animation = originalAnimation;
  } catch (error) {
    element.style.transition = originalTransition;
    element.style.animation = originalAnimation;
    throw error;
  }
};
// src/api.ts
var inflightTransitions = new WeakMap;
var morph = (el, newContent, options = {}) => {
  const globals = resolveGlobals(el);
  const win = globals.window;
  const mode = options.diff ? "diff" : "replace";
  const apply = (content) => updateDomWithVdom(el, typeof content === "string" ? htmlStringToVNodes(content, win.DOMParser) : content, globals, mode);
  const transition = options.transition;
  if (transition && transition.type !== "none") {
    const config = { ...DEFAULT_TRANSITION_CONFIG, ...transition };
    const transitionTarget = config.target === "self" ? el : el.parentElement;
    if (!transitionTarget) {
      apply(newContent);
      return Promise.resolve();
    }
    const slot = { content: newContent };
    inflightTransitions.set(el, slot);
    return performTransition(transitionTarget, async () => {
      if (inflightTransitions.get(el) === slot)
        apply(slot.content);
    }, config).finally(() => {
      if (inflightTransitions.get(el) === slot)
        inflightTransitions.delete(el);
    });
  }
  const slot = inflightTransitions.get(el);
  if (slot)
    slot.content = newContent;
  apply(newContent);
};
// src/jsx.ts
var toChildren = (children) => children === undefined ? [] : Array.isArray(children) ? children.flat(Infinity) : [children];
var isVNode2 = (value) => typeof value === "object" && value !== null && !Array.isArray(value) && ("type" in value);
var Fragment = (props) => toChildren(props?.children);
function jsx(type, props, key) {
  const { children, ...attributes } = props ?? {};
  const resolvedKey = key ?? attributes.key;
  if (resolvedKey !== undefined)
    attributes.key = resolvedKey;
  if (typeof type === "function") {
    const result = type(children === undefined ? attributes : { ...attributes, children });
    return resolvedKey !== undefined && isVNode2(result) && result.attributes?.key === undefined ? { ...result, attributes: { ...result.attributes, key: resolvedKey } } : result;
  }
  return { type, attributes, children: toChildren(children) };
}
var jsxs = jsx;
var jsxDEV = (type, props, key) => jsx(type, props, key);
function h(type, props, ...children) {
  return jsx(type, children.length === 0 ? props : { ...props, children: children.length === 1 ? children[0] : children });
}
// src/ref.ts
var createRef = (state) => ({
  current: null,
  state
});
var isRef = (value) => typeof value === "object" && value !== null && ("current" in value);
// src/reactive.ts
var isElement = (value) => typeof value === "object" && value !== null && value.nodeType === 1;
var toStores = (store, caller) => {
  const stores = Array.isArray(store) ? store : [store];
  stores.forEach((candidate, index) => {
    if (typeof candidate?.subscribe !== "function") {
      throw new TypeError(`${caller}: store${Array.isArray(store) ? ` ${index}` : ""} has no subscribe() method`);
    }
  });
  return stores;
};
var listen = (stores, update) => {
  const unsubscribes = stores.map((store) => {
    const result = store.subscribe(() => update());
    if (typeof result === "function")
      return result;
    return () => result?.unsubscribe?.();
  });
  return () => {
    for (const unsubscribe of unsubscribes)
      unsubscribe();
  };
};
var resolveTarget = (target) => {
  if (isElement(target))
    return () => [target];
  if (isRef(target)) {
    if (!isElement(target.current)) {
      throw new TypeError("reactive: the ref has no element yet; call reactive() after the element is rendered (in onMount or later)");
    }
    return () => isElement(target.current) ? [target.current] : [];
  }
  if (target && typeof target.length === "number") {
    const elements = Array.from(target).filter(isElement);
    return () => elements;
  }
  throw new TypeError("reactive: the target must be an element, a ref or a list of elements");
};
function reactive(config, target) {
  const stores = toStores(config?.store, "reactive");
  if (typeof config.render !== "function")
    throw new TypeError("reactive: config.render must be a function");
  const elements = resolveTarget(target);
  if (config.signal?.aborted || elements().length === 0)
    return () => {};
  const update = () => {
    for (const el of elements())
      morph(el, config.render());
  };
  update();
  const unsubscribe = listen(stores, update);
  let disposed = false;
  const dispose = () => {
    if (disposed)
      return;
    disposed = true;
    unsubscribe();
    config.signal?.removeEventListener("abort", dispose);
    config.cleanup?.();
  };
  config.signal?.addEventListener("abort", dispose, { once: true });
  return dispose;
}
var mounted = new WeakMap;
var toChildren2 = (content) => {
  if (typeof content === "string") {
    if (!/[<&]/.test(content))
      return content === "" ? [] : [content];
    const Parser = globalThis.DOMParser;
    if (!Parser) {
      throw new TypeError("Reactive: rendering an HTML string needs a global DOMParser; return JSX/VNodes, or call reactive()");
    }
    return htmlStringToVNodes(content, Parser);
  }
  return Array.isArray(content) ? content.flat(Infinity) : [content];
};
function Reactive(props) {
  const { store, render, cleanup, tag = "div", onMount, onUnmount, children: _children, ...attributes } = props;
  const stores = toStores(store, "Reactive");
  if (typeof render !== "function")
    throw new TypeError("Reactive: the render prop must be a function");
  return {
    type: tag,
    attributes: {
      ...attributes,
      onMount: (el) => {
        mounted.get(el)?.unsubscribe();
        mounted.set(el, { unsubscribe: listen(stores, () => morph(el, render())), cleanup });
        morph(el, render());
        if (typeof onMount === "function")
          onMount(el);
      },
      onUnmount: (el) => {
        const entry = mounted.get(el);
        mounted.delete(el);
        entry?.unsubscribe();
        entry?.cleanup?.();
        if (typeof onUnmount === "function")
          onUnmount(el);
      }
    },
    children: toChildren2(render())
  };
}
var installReactive = (df$) => {
  const fn = df$?.fn;
  if (typeof fn !== "object" || fn === null) {
    throw new TypeError("installReactive: expected defuss-query's df$ (a df$ with a df$.fn prototype)");
  }
  Object.defineProperty(fn, "reactive", {
    configurable: true,
    writable: true,
    value: function(config) {
      reactive(config, this);
      return this;
    }
  });
  return df$;
};
// src/global.ts
if (typeof globalThis !== "undefined") {
  const g = globalThis;
  const current = g.df$;
  if (current === null || typeof current !== "object" && typeof current !== "function") {
    g.df$ = {};
  }
  Object.assign(g.df$, exports_src);
  const fn = g.df$.fn;
  if (typeof fn === "object" && fn !== null)
    installReactive(g.df$);
}
export {
  CAPTURE_ONLY_EVENTS,
  CLASS_ATTRIBUTE_NAME,
  COMMENT_TYPE,
  DANGEROUSLY_SET_INNER_HTML_ATTRIBUTE,
  DEFAULT_TRANSITION_CONFIG,
  FROM_DOM_MARKER,
  Fragment,
  REF_ATTRIBUTE_NAME,
  Reactive,
  XLINK_ATTRIBUTE_NAME,
  XMLNS_ATTRIBUTE_NAME,
  applyStyles,
  areDomNodesEqual,
  clearDelegatedEvents,
  clearDelegatedEventsDeep,
  createRef,
  domNodeToVNode,
  getMimeType,
  getRegisteredEventKeys,
  getRegisteredEventTypes,
  getRenderer,
  getTransitionStyles,
  h,
  handleLifecycleEventsForOnMount,
  htmlStringToVNodes,
  installReactive,
  isCommentVNode,
  isHTML,
  isMarkup,
  isRef,
  isSVG,
  jsx,
  jsxDEV,
  jsxs,
  morph,
  nsMap,
  observeUnmount,
  onClearDelegatedEvents,
  parseDOM,
  parseEventPropName,
  performTransition,
  queueCallback,
  reactive,
  registerDelegatedEvent,
  removeDelegatedEvent,
  removeDelegatedEventByKey,
  renderMarkup,
  replaceDomWithVdom,
  resolveGlobals,
  templateContent,
  updateDomWithVdom
};

//# debugId=18D1BB0152DB217664756E2164756E21
//# sourceMappingURL=all.js.map
