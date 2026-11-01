import { describe, expect, it } from "vitest";
import { type Component, Fragment, h, jsx, jsxDEV, jsxs, morph } from "./index.js";

const container = () => {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
};

describe("jsx runtime", () => {
  it("builds the VNode a compiler's jsx() call describes", () => {
    // what `<p class="x" key="a">hi</p>` compiles to with jsxImportSource: "defuss-morph"
    expect(jsx("p", { class: "x", children: "hi" }, "a")).toEqual({
      type: "p",
      attributes: { class: "x", key: "a" },
      children: ["hi"],
    });
    expect(jsxs).toBe(jsx);
    expect(jsxDEV("br", null)).toEqual({ type: "br", attributes: {}, children: [] });
  });

  it("flattens fragments and .map() results into the children list", () => {
    const items = ["a", "b"];
    const vnode = jsx("ul", {
      children: [jsx(Fragment, { children: [jsx("li", { children: "first" })] }), items.map((item) => jsx("li", { children: item }, item))],
    });
    expect((vnode as { children: unknown[] }).children).toHaveLength(3);

    const el = container();
    morph(el, vnode);
    expect(el.innerHTML).toBe("<ul><li>first</li><li>a</li><li>b</li></ul>");
  });

  it("calls a function component with its props and children", () => {
    const Card: Component<{ title: string; children?: unknown }> = ({ title, children }) =>
      jsx("section", { children: [jsx("h2", { children: title }), children] });
    const el = container();
    morph(el, jsx(Card, { title: "T", children: jsx("p", { children: "body" }) }));
    expect(el.innerHTML).toBe("<section><h2>T</h2><p>body</p></section>");
  });

  it("puts a component's key on the element it returns, so keyed rows move instead of being rebuilt", () => {
    const Row: Component<{ name: string }> = ({ name }) => jsx("li", { children: name });
    const list = (names: string[]) => jsx("ul", { children: names.map((name) => jsx(Row, { name }, name)) });

    const el = container();
    morph(el, list(["a", "b"]));
    const [a, b] = el.querySelectorAll("li");
    morph(el, list(["b", "a"]));
    const after = el.querySelectorAll("li");
    expect(after[0]).toBe(b);
    expect(after[1]).toBe(a);
  });

  it("keys a copy: a component that returns one shared VNode keeps it unkeyed", () => {
    const shared = { type: "hr", attributes: {}, children: [] };
    const Rule: Component = () => shared;
    expect(jsx(Rule, {}, "a")).toEqual({ type: "hr", attributes: { key: "a" }, children: [] });
    expect(jsx(Rule, {}, "b")).toEqual({ type: "hr", attributes: { key: "b" }, children: [] });
    expect(shared.attributes).toEqual({});
  });

  it("h() is the classic factory: rest arguments are the children", () => {
    const onClick = () => {};
    expect(h("button", { onClick }, "Save")).toEqual({ type: "button", attributes: { onClick }, children: ["Save"] });
    expect(h("p", null, "a", h("b", null, "c"))).toEqual({
      type: "p",
      attributes: {},
      children: ["a", { type: "b", attributes: {}, children: ["c"] }],
    });
    const el = container();
    morph(el, h(Fragment, null, h("i", null, "1"), h("i", null, "2")));
    expect(el.innerHTML).toBe("<i>1</i><i>2</i>");
  });
});
