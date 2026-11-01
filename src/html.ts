import type { VNode, VNodeAttributes } from "./types.js";

/**
 * Marks VNodes derived from existing DOM (HTML strings / DOM nodes).
 * Such VNodes cannot declare event handlers, so the morph engine must
 * preserve delegated handlers already attached to surviving elements
 * (same rationale as uncontrolled form-state preservation).
 */
export const FROM_DOM_MARKER: unique symbol = Symbol("defuss-morph.from-dom");

/**
 * VNode type of an HTML comment: `{ type: "#comment", value }`.
 * Why "#comment": it is the DOM's own nodeName for comments and can never
 * collide with a tag name ("#" is invalid there). The data lives in `value`,
 * not `children`, so generic tree walkers never mistake it for content.
 */
export const COMMENT_TYPE = "#comment";

export type CommentVNode = VNode & { type: typeof COMMENT_TYPE };

/** True for a comment VNode (`{ type: "#comment", value }`). */
export const isCommentVNode = (value: unknown): value is CommentVNode =>
  !!value &&
  typeof value === "object" &&
  (value as VNode).type === COMMENT_TYPE;

const HTML_BOOLEAN_ATTRIBUTES = new Set([
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
  "selected",
]);

const domAttributeToVNodeValue = (attr: Attr): string | boolean =>
  HTML_BOOLEAN_ATTRIBUTES.has(attr.name.toLowerCase()) ? true : attr.value;

/** Parses `input` into a detached document with the given parser. */
export function parseDOM(
  input: string,
  type: DOMParserSupportedType,
  Parser: typeof DOMParser,
): Document {
  return new Parser().parseFromString(input, type);
}

/** True when `input` parses as an SVG document (root element `<svg>`). */
export function isSVG(input: string, Parser: typeof DOMParser) {
  const doc = parseDOM(input, "image/svg+xml", Parser);
  if (!doc.documentElement) return false;
  return doc.documentElement.nodeName.toLowerCase() === "svg";
}

/** True when `input` parses into at least one element besides the implied `<head>` and `<body>`. */
export function isHTML(input: string, Parser: typeof DOMParser): boolean {
  const doc = parseDOM(input, "text/html", Parser);
  return doc.documentElement.querySelectorAll("*").length > 2; // 2 = <html> and <body>
}

/** True when `input` contains a tag and parses as HTML or SVG. */
export const isMarkup = (input: string, Parser: typeof DOMParser): boolean =>
  input.indexOf("<") > -1 &&
  input.indexOf(">") > -1 &&
  (isHTML(input, Parser) || isSVG(input, Parser));

/** Parses `markup` (HTML or SVG) and returns its top-level nodes, detached from any live document. */
export function renderMarkup(
  markup: string,
  Parser: typeof DOMParser,
  doc?: Document,
) {
  const parsed = doc ? doc : parseDOM(markup, getMimeType(markup, Parser), Parser);
  // HTML documents expose body; XML documents (e.g. image/svg+xml) don't —
  // there the documentElement is the root node to render
  if (parsed.body) return Array.from(parsed.body.childNodes);
  return parsed.documentElement ? [parsed.documentElement] : [];
}

/** The `DOMParser` MIME type for `input`: `image/svg+xml` for SVG documents, else `text/html`. */
export function getMimeType(
  input: string,
  Parser: typeof DOMParser,
): DOMParserSupportedType {
  if (isSVG(input, Parser)) {
    return "image/svg+xml";
  }
  return "text/html";
}

/**
 * The content fragment of a `<template>` element, where the parser puts its markup; `undefined` for other elements.
 * morph reads, creates and patches a template's children there, so markup such as defuss-i18n's translation
 * templates survives a morph.
 */
export const templateContent = (element: Element): DocumentFragment | undefined =>
  element.localName === "template" ? (element as HTMLTemplateElement).content : undefined;

/**
 * Converts a DOM node to a VNode structure for use with updateDomWithVdom.
 * This allows us to leverage the sophisticated partial update system even for Node inputs.
 */
export function domNodeToVNode(node: Node): VNode<VNodeAttributes> | string {
  if (node.nodeType === 3 /* Node.TEXT_NODE */) {
    return node.nodeValue || "";
  }

  if (node.nodeType === 1 /* Node.ELEMENT_NODE */) {
    const element = node as Element;
    const attributes: VNodeAttributes & { [FROM_DOM_MARKER]?: true } = {};

    // Convert DOM attributes to VNode attributes
    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i];
      attributes[attr.name] = domAttributeToVNodeValue(attr);
    }

    // Convert child nodes recursively; a <template> keeps its markup in .content, not in childNodes
    // (VERIFIED: reading childNodes turned `<template><b>x</b></template>` into an empty template)
    const children: Array<VNode<VNodeAttributes> | string> = [];
    for (let child = (templateContent(element) ?? element).firstChild; child; child = child.nextSibling) {
      children.push(domNodeToVNode(child));
    }
    attributes[FROM_DOM_MARKER] = true;

    // localName is the name the parser gave the element: lowercase for HTML, camelCase where SVG has it
    // (VERIFIED: tagName.toLowerCase() turned linearGradient into an unknown "lineargradient", morph.test.ts)
    return { type: element.localName, attributes, children };
  }

  if (node.nodeType === 8 /* Node.COMMENT_NODE */) {
    return { type: COMMENT_TYPE, value: node.nodeValue ?? "" };
  }

  // For other node types (processing instructions, etc.), convert to empty string
  return "";
}

/**
 * One inert document per DOMParser, which creates the <template> each fragment parses into. VERIFIED (A/B in
 * Chromium, 2026-11-01): creating a document per call made 500 small re-renders take half again as long; the
 * document only ever creates detached templates, so reusing it changes no result.
 */
const inertDocuments = new WeakMap<typeof DOMParser, Document>();

/** Input starting (after optional comments) with doctype/html/head/body. */
const DOCUMENT_START = /^\s*(?:<!--[\s\S]*?-->\s*)*<(?:!doctype|html|head|body)[\s>/]/i;

/**
 * Converts an HTML string to VNode structure for use with updateDomWithVdom.
 * This allows markup strings to benefit from the intelligent partial update system.
 */
export function htmlStringToVNodes(
  html: string,
  Parser: typeof DOMParser,
): Array<VNode<VNodeAttributes> | string> {
  // A full document parses as one, so its <head> content (e.g. <title>) never
  // leaks into the result.
  if (DOCUMENT_START.test(html)) {
    return toVNodes(new Parser().parseFromString(html, "text/html").body.childNodes);
  }

  // A fragment parses as <template> content, the parser's context-free mode.
  // VERIFIED: in Chromium and happy-dom (html.test.ts), inside <body> the
  // parser drops table tags, so `<tr><td>x</td></tr>` became the text "x", and a
  // leading comment without a <body> landed outside it and was lost. Template
  // content keeps both, and stays inert (no scripts run, nothing loads).
  let inert = inertDocuments.get(Parser);
  if (!inert) {
    inert = new Parser().parseFromString("", "text/html");
    inertDocuments.set(Parser, inert);
  }
  const template = inert.createElement("template");
  template.innerHTML = html;
  return toVNodes(template.content.childNodes);
}

function toVNodes(nodes: NodeListOf<ChildNode>): Array<VNode<VNodeAttributes> | string> {
  const vNodes: Array<VNode<VNodeAttributes> | string> = [];
  for (let i = 0; i < nodes.length; i++) {
    const vnode = domNodeToVNode(nodes[i]);
    if (vnode !== "") vNodes.push(vnode);
  }
  return vNodes;
}
