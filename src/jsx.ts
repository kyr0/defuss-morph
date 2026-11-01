import type { DefussKey, RenderInput, VNode, VNodeChild } from "./types.js";

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
export type Component<P = any> = (props: P) => RenderInput;

type Props = { [name: string]: unknown; children?: unknown; key?: DefussKey };

/** Children as a flat list: nested arrays (fragments, `.map()` results) are spliced in place. */
const toChildren = (children: unknown): VNodeChild[] =>
  children === undefined ? [] : Array.isArray(children) ? (children.flat(Infinity) as VNodeChild[]) : [children as VNodeChild];

const isVNode = (value: unknown): value is VNode =>
  typeof value === "object" && value !== null && !Array.isArray(value) && "type" in value;

/** `<>…</>`: its children, rendered in place of the fragment. */
export const Fragment = (props: { children?: unknown }): RenderInput => toChildren(props?.children);

/**
 * The automatic-runtime factory: `jsx(type, props, key)`. A tag name gives a VNode; a function component is called
 * with `props` (children included). A `key` given to a component lands on the element it returns, unless that
 * element has one, so `items.map((item) => <Row key={item.id} item={item} />)` is keyed for morph.
 */
export function jsx(type: string | Component, props?: Props | null, key?: DefussKey): RenderInput {
  const { children, ...attributes } = props ?? {};
  const resolvedKey = key ?? attributes.key;
  if (resolvedKey !== undefined) attributes.key = resolvedKey;

  if (typeof type === "function") {
    const result = type(children === undefined ? attributes : { ...attributes, children });
    // a copy: a component may return the same VNode object for every call
    return resolvedKey !== undefined && isVNode(result) && result.attributes?.key === undefined
      ? { ...result, attributes: { ...result.attributes, key: resolvedKey } }
      : result;
  }
  return { type, attributes, children: toChildren(children) };
}

/** Same as {@link jsx}; compilers call it for elements with several static children. */
export const jsxs = jsx;

/** Same as {@link jsx}; compilers call it in development mode. The extra source arguments are ignored. */
export const jsxDEV = (type: string | Component, props?: Props | null, key?: DefussKey): RenderInput => jsx(type, props, key);

/**
 * The classic factory, for `jsxFactory: "h"` and for pages without a build step:
 * `h("button", { onClick: save }, "Save")` is `<button onClick={save}>Save</button>`.
 */
export function h(type: string | Component, props?: Props | null, ...children: unknown[]): RenderInput {
  return jsx(type, children.length === 0 ? props : { ...props, children: children.length === 1 ? children[0] : children });
}

/**
 * JSX types for `jsxImportSource: "defuss-morph"`. Loose on purpose: any tag, any attribute. A JSX expression is a
 * `RenderInput` (a fragment is an array), and a component may return anything morph renders.
 */
export declare namespace JSX {
  type Element = RenderInput;
  type ElementType = string | Component;
  interface ElementChildrenAttribute {
    children: {};
  }
  interface IntrinsicAttributes {
    key?: DefussKey;
  }
  interface IntrinsicElements {
    [tagName: string]: { [attribute: string]: any };
  }
}
