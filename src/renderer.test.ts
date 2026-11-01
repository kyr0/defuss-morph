import { describe, expect, it } from "vitest";
import { recorder } from "./test-recorder.js";
import {
  type VNode,
  getRenderer,
  handleLifecycleEventsForOnMount,
  observeUnmount,
  queueCallback,
  updateDomWithVdom,
} from "./index.js";

const flushMicrotasks = () => new Promise<void>((r) => setTimeout(r, 0));

describe("getRenderer", () => {
  const renderer = () => getRenderer(document);

  it("creates an element with children and appends to the parent", () => {
    const parent = document.createElement("div");
    const el = renderer().createElement(
      {
        type: "section",
        attributes: { class: "box" },
        children: ["hello"],
      },
      parent,
    ) as HTMLElement;

    expect(el.tagName).toBe("SECTION");
    expect(el.getAttribute("class")).toBe("box");
    expect(el.textContent).toBe("hello");
    expect(parent.children[0]).toBe(el);
  });

  it("createElementOrElements handles arrays, undefined and single vnodes", () => {
    const parent = document.createElement("div");
    const r = renderer();

    const many = r.createElementOrElements(
      [
        { type: "i", attributes: {}, children: ["a"] },
        { type: "b", attributes: {}, children: ["b"] },
      ],
      parent,
    ) as Array<Element | Text | undefined>;
    expect(many.length).toBe(2);
    expect(parent.querySelector("i")!.textContent).toBe("a");
    expect(parent.querySelector("b")!.textContent).toBe("b");

    // undefined renders as an empty text node
    const parent2 = document.createElement("div");
    const undef = r.createElementOrElements(undefined, parent2) as Text;
    expect(undef.nodeType).toBe(3);
    expect(parent2.childNodes.length).toBe(1);
  });

  it("createTextNode appends only when a parent is given", () => {
    const free = renderer().createTextNode("free");
    expect(free.textContent).toBe("free");
    expect(free.parentNode).toBeNull();

    const parent = document.createElement("div");
    renderer().createTextNode("in", parent);
    expect(parent.textContent).toBe("in");
  });

  it("createChildElements skips booleans and stringifies null/undefined", () => {
    const parent = document.createElement("div");
    renderer().createChildElements(
      [true, false, null, undefined, 0, "x"] as any,
      parent,
    );
    // booleans skipped; null/undefined -> empty text; 0 -> "0"; "x" -> "x"
    expect(parent.textContent).toBe("0x");
  });

  it("creates an empty div for unresolved AsyncFunction vnodes", () => {
    const el = renderer().createElement((async () => {}) as any) as HTMLElement;
    expect(el.tagName).toBe("DIV");
  });

  it("renders a FATAL ERROR div for function-typed vnodes", () => {
    const el = renderer().createElement({
      type: function Broken() {},
      attributes: {},
      children: [],
    }) as unknown as HTMLElement;
    expect(el.tagName).toBe("DIV");
    expect(el.innerText).toContain("FATAL ERROR");
  });

  it("creates SVG elements in the SVG namespace, including nested children", () => {
    const el = renderer().createElement({
      type: "svg",
      attributes: { viewBox: "0 0 1 1" },
      children: [{ type: "circle", attributes: { cx: 1 } }],
    }) as Element;
    expect(el.namespaceURI).toBe("http://www.w3.org/2000/svg");
    expect(el.children[0].namespaceURI).toBe("http://www.w3.org/2000/svg");
  });

  it("does not treat STYLE/SCRIPT inside SVG as SVG-namespaced", () => {
    const r = renderer();
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    expect(r.hasSvgNamespace(svg, "STYLE")).toBe(false);
    expect(r.hasSvgNamespace(svg, "SCRIPT")).toBe(false);
    expect(r.hasSvgNamespace(svg, "CIRCLE")).toBe(true);
  });

  it("applies dangerouslySetInnerHTML and skips children", () => {
    const el = renderer().createElement({
      type: "div",
      attributes: { dangerouslySetInnerHTML: { __html: "<b>raw</b>" } },
      children: [{ type: "i", attributes: {}, children: ["ignored"] }],
    }) as HTMLElement;
    expect(el.innerHTML).toBe("<b>raw</b>");
    expect(el.querySelector("i")).toBeNull();
  });

  describe("setAttribute", () => {
    const setup = () => {
      const el = document.createElement("div");
      return { el, r: renderer() };
    };

    it("ignores undefined values", () => {
      const { el, r } = setup();
      r.setAttribute("title", undefined, el);
      expect(el.hasAttribute("title")).toBe(false);
    });

    it("ignores the dangerouslySetInnerHTML pseudo-attribute", () => {
      const { el, r } = setup();
      r.setAttribute("dangerouslySetInnerHTML", { __html: "x" }, el);
      expect(el.hasAttribute("dangerouslySetInnerHTML")).toBe(false);
    });

    it("stores key internally without serializing it", () => {
      const { el, r } = setup();
      r.setAttribute("key", "k1", el);
      expect(el.hasAttribute("key")).toBe(false);
      expect((el as any)._defussKey).toBe("k1");
    });

    it("maps className to class and joins class arrays", () => {
      const { el, r } = setup();
      r.setAttribute("className", "a", el);
      expect(el.getAttribute("class")).toBe("a");
      r.setAttribute("class", ["x", false, "y"], el);
      expect(el.getAttribute("class")).toBe("x y");
    });

    it("applies style objects as individual style properties", () => {
      const { el, r } = setup();
      r.setAttribute("style", { color: "red", paddingLeft: "3px" }, el);
      expect(el.style.color).toBe("red");
      expect(el.style.paddingLeft).toBe("3px");
    });

    it("sets boolean attributes as property + attribute, removes on false", () => {
      const { el, r } = setup();
      r.setAttribute("hidden", true, el);
      expect((el as any).hidden).toBe(true);
      expect(el.hasAttribute("hidden")).toBe(true);
      r.setAttribute("hidden", false, el);
      expect((el as any).hidden).toBe(false);
      expect(el.hasAttribute("hidden")).toBe(false);
    });

    it("syncs value/checked as live properties on form elements", () => {
      const r = renderer();
      const input = document.createElement("input");
      r.setAttribute("value", "v1", input);
      expect(input.value).toBe("v1");
      expect(input.getAttribute("value")).toBe("v1");

      r.setAttribute("checked", true, input);
      expect(input.checked).toBe(true);
      expect(input.hasAttribute("checked")).toBe(true);
      r.setAttribute("checked", false, input);
      expect(input.checked).toBe(false);
      expect(input.hasAttribute("checked")).toBe(false);

      const select = document.createElement("select");
      const optA = document.createElement("option");
      const optB = document.createElement("option");
      select.append(optA, optB);
      r.setAttribute("selectedIndex", 1, select);
      expect(select.selectedIndex).toBe(1);
      expect(select.hasAttribute("selectedIndex")).toBe(false);
    });

    it("sets plain string values as attributes on non-form elements", () => {
      const { el, r } = setup();
      r.setAttribute("value", "plain", el);
      expect(el.getAttribute("value")).toBe("plain");
    });

    it("assigns refs: current and _defussRef", () => {
      const el = document.createElement("div");
      const ref = { current: null as unknown };
      renderer().setAttribute("ref", ref, el);

      expect(ref.current).toBe(el);
      expect((el as any)._defussRef).toBe(ref);
    });

    it("wires onMount via $onMount (microtask-deferred) and onUnmount", async () => {
      const parent = document.createElement("div");
      document.body.appendChild(parent);
      const el = document.createElement("div");
      parent.appendChild(el);

      const onMount = recorder();
      const onUnmount = recorder();
      const r = renderer();
      r.setAttribute("onMount", onMount, el);
      r.setAttribute("onUnmount", onUnmount, el);

      expect(typeof (el as any).$onMount).toBe("function");
      expect(onMount.calls).toHaveLength(0); // deferred

      handleLifecycleEventsForOnMount(el);
      expect((el as any).$onMount).toBeNull(); // consumed
      await flushMicrotasks();
      expect(onMount.calls).toHaveLength(1);
      expect(onMount.calls[0][0]).toBe(el);
    });

    it("keeps only the latest onUnmount registration (re-render semantics)", async () => {
      const el = document.createElement("div");
      const a = recorder();
      const b = recorder();
      const r = renderer();
      r.setAttribute("onUnmount", a, el);
      r.setAttribute("onUnmount", b, el);

      (el as any).$onUnmount();
      await flushMicrotasks(); // registrations are microtask-wrapped
      expect(a.calls).toHaveLength(0);
      expect(b.calls).toHaveLength(1);
    });

    it("sets namespaced attributes (xlink) on SVG elements", () => {
      const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
      renderer().setAttribute("xlinkHref", "#icon", use);
      expect(
        use.getAttributeNS("http://www.w3.org/1999/xlink", "href"),
      ).toBe("#icon");
    });
  });

  it("setAttributes applies every attribute of a vnode", () => {
    const el = document.createElement("div");
    renderer().setAttributes(
      { type: "div", attributes: { class: "c", title: "t" } } as VNode,
      el,
    );
    expect(el.getAttribute("class")).toBe("c");
    expect(el.getAttribute("title")).toBe("t");
  });

  it("propagates render errors to the caller", () => {
    expect(() =>
      renderer().createElement({
        type: "div",
        attributes: {
          // an attribute getter that throws while setAttributes reads it
          get bad() {
            throw new Error("attr boom");
          },
        },
        children: [],
      }),
    ).toThrow("attr boom");
  });

  // regression: text used to reach createElement as a tag name ("hi" -> <hi>)
  it("createElementOrElements renders text and numbers as text nodes", () => {
    const parent = document.createElement("div");
    const text = renderer().createElementOrElements("hello world", parent) as Text;
    const num = renderer().createElementOrElements(42) as Text;

    expect(text.nodeType).toBe(3);
    expect(parent.textContent).toBe("hello world");
    expect(num.nodeValue).toBe("42");
  });
});

describe("observeUnmount", () => {
  it("throws on invalid arguments", () => {
    expect(() => observeUnmount(null as any, () => {})).toThrow();
    expect(() => observeUnmount(document.createElement("div"), null as any)).toThrow();
  });

  it("throws when the node has no parentNode", () => {
    expect(() => observeUnmount(document.createElement("div"), () => {})).toThrow(
      "parentNode",
    );
  });

  it("fires when the node is removed from the DOM", async () => {
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    const child = document.createElement("span");
    parent.appendChild(child);

    const onUnmount = recorder();
    observeUnmount(child, onUnmount);

    parent.removeChild(child);
    await flushMicrotasks();
    expect(onUnmount.calls).toHaveLength(1);
  });

  it("does not fire when the node is moved (re-arms on the new parent)", async () => {
    const parentA = document.createElement("div");
    const parentB = document.createElement("div");
    document.body.append(parentA, parentB);
    const child = document.createElement("span");
    parentA.appendChild(child);

    const onUnmount = recorder();
    observeUnmount(child, onUnmount);

    parentB.appendChild(child); // move, not unmount
    await flushMicrotasks();
    expect(onUnmount.calls).toHaveLength(0);

    // re-armed on parentB: real removal still fires
    parentB.removeChild(child);
    await flushMicrotasks();
    expect(onUnmount.calls).toHaveLength(1);
  });
});

describe("queueCallback", () => {
  it("defers the callback to a microtask and forwards args", async () => {
    const cb = recorder();
    const queued = queueCallback(cb);

    queued("a", 1);
    expect(cb.calls).toHaveLength(0);

    await flushMicrotasks();
    expect(cb.calls).toEqual([["a", 1]]);
  });
});

describe("lifecycle hooks under repeated morphs", () => {
  const host = () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    return el;
  };

  // regression: every in-place patch armed another observer and chained the
  // handler, so 1 render + 3 morphs fired onUnmount 10 times on removal
  it("fires onUnmount once, with the latest handler, after in-place morphs", async () => {
    const el = host();
    const handlers = [recorder(), recorder(), recorder(), recorder()];
    for (const onUnmount of handlers)
      updateDomWithVdom(el, [{ type: "section", attributes: { id: "s", onUnmount }, children: [] }]);

    updateDomWithVdom(el, []);
    await flushMicrotasks();
    expect(handlers.map((h) => h.calls.length)).toEqual([0, 0, 0, 1]);
  });

  // regression: a ref declared after onUnmount replaced it with a no-op
  it("fires onUnmount declared before ref", async () => {
    const el = host();
    const onUnmount = recorder();
    const ref = { current: null as unknown };
    updateDomWithVdom(el, [{ type: "p", attributes: { onUnmount, ref }, children: [] }]);
    expect(ref.current).toBe(el.firstChild);

    updateDomWithVdom(el, []);
    await flushMicrotasks();
    expect(onUnmount.calls).toHaveLength(1);
  });

  it("re-arms onUnmount when a removed node is inserted again", async () => {
    const parent = host();
    const onUnmount = recorder();
    updateDomWithVdom(parent, [{ type: "i", attributes: { onUnmount }, children: [] }]);
    const node = parent.firstChild as HTMLElement;

    parent.removeChild(node);
    await flushMicrotasks();
    parent.appendChild(node);
    handleLifecycleEventsForOnMount(node);
    parent.removeChild(node);
    await flushMicrotasks();
    expect(onUnmount.calls).toHaveLength(2);
  });
});

describe("controlled props with non-boolean values", () => {
  const r = () => getRenderer(document);

  it("sets the checked attribute for truthy non-boolean values", () => {
    const input = document.createElement("input");
    r().setAttribute("checked", 1, input);
    // property is assigned raw; the attribute reflects truthiness
    expect((input as HTMLInputElement).checked).toBeTruthy();
    expect(input.getAttribute("checked")).toBe("");
  });

  it("removes the checked attribute for falsy non-boolean values", () => {
    const input = document.createElement("input");
    input.setAttribute("checked", "");
    r().setAttribute("checked", 0, input);
    expect((input as HTMLInputElement).checked).toBeFalsy();
    expect(input.hasAttribute("checked")).toBe(false);
  });
});
