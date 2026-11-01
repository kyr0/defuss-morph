import { describe, expect, it } from "vitest";
import {
  areDomNodesEqual,
  COMMENT_TYPE,
  getRenderer,
  morph,
  replaceDomWithVdom,
} from "./index.js";

const container = (html = ""): HTMLElement => {
  const el = document.createElement("div");
  el.innerHTML = html;
  document.body.appendChild(el);
  return el;
};

describe("morph: HTML comments", () => {
  it("round-trips: morph(x) then innerHTML returns x, comments around keyed elements included", () => {
    const html =
      `<!-- lead --><ul><!-- list --><li id="a">A</li><!-- between --><li id="b">B</li></ul>` +
      `<svg viewBox="0 0 1 1"><!-- licence --><circle r="1"></circle></svg><!-- tail -->`;
    const el = container();

    morph(el, html);
    expect(el.innerHTML).toBe(html);

    // writing the read value back must not change a single node
    const before = Array.from(el.querySelectorAll("*"));
    const comments = Array.from(el.childNodes);
    morph(el, el.innerHTML);
    expect(el.innerHTML).toBe(html);
    expect(Array.from(el.querySelectorAll("*"))).toEqual(before);
    expect(Array.from(el.childNodes)).toEqual(comments);
  });

  it("updates comment data in place (node identity kept)", () => {
    const el = container("<p>x</p><!-- old -->");
    const comment = el.childNodes[1];

    morph(el, "<p>x</p><!-- new -->");

    expect(el.childNodes[1]).toBe(comment);
    expect(comment.nodeValue).toBe(" new ");
  });

  it("inserts and removes comments without disturbing keyed siblings", () => {
    const el = container(`<li key="a">A</li><li key="b">B</li>`);
    const [a, b] = Array.from(el.children);

    morph(el, `<!--1--><li key="a">A</li><!--2--><li key="b">B</li><!--3-->`);
    expect(el.innerHTML).toBe(`<!--1--><li key="a">A</li><!--2--><li key="b">B</li><!--3-->`);
    expect(el.children[0]).toBe(a);
    expect(el.children[1]).toBe(b);

    morph(el, `<li key="b">B</li><li key="a">A</li>`);
    expect(el.innerHTML).toBe(`<li key="b">B</li><li key="a">A</li>`);
    expect(el.children[0]).toBe(b);
    expect(el.children[1]).toBe(a);
  });

  it("never reuses a text node for a comment (or vice versa)", () => {
    const el = container("text<!--c-->");
    const text = el.childNodes[0];
    const comment = el.childNodes[1];

    morph(el, "<!--c-->text");

    expect(el.innerHTML).toBe("<!--c-->text");
    expect(el.childNodes[0]).toBe(comment);
    expect(el.childNodes[1]).toBe(text);
  });

  it("morphs comments nested inside elements", () => {
    const el = container("<div>a<!--x-->b</div>");
    const div = el.firstChild;

    morph(el, "<div>a<!--y-->b<!--z--></div>");

    expect(el.firstChild).toBe(div);
    expect(el.innerHTML).toBe("<div>a<!--y-->b<!--z--></div>");
  });

  it("accepts comment VNodes directly", () => {
    const el = container("<p>x</p>");

    morph(el, [
      { type: COMMENT_TYPE, value: "vnode" },
      { type: "p", attributes: {}, children: ["x"] },
    ]);

    expect(el.innerHTML).toBe("<!--vnode--><p>x</p>");
  });

  it("renderer and replaceDomWithVdom create comment nodes", () => {
    const comment = getRenderer(document).createElement({
      type: COMMENT_TYPE,
      value: "r",
    }) as unknown as Comment;
    expect(comment.nodeType).toBe(8);
    expect(comment.nodeValue).toBe("r");

    const el = container("<p>old</p>");
    replaceDomWithVdom(el, [{ type: COMMENT_TYPE, value: "c" }, "t"]);
    expect(el.innerHTML).toBe("<!--c-->t");
  });

  it("diff mode skips top-level comments but morphs comments inside items", () => {
    const el = container(`<li key="a">A</li><li key="b">B</li>`);

    morph(el, `<!-- patch --><li key="b">B<!--n--></li>`, { diff: true });
    morph(el, `<!-- patch --><li key="b">B<!--n--></li>`, { diff: true });

    expect(el.innerHTML).toBe(`<li key="a">A</li><li key="b">B<!--n--></li>`);
  });

  it("areDomNodesEqual compares comment data", () => {
    expect(areDomNodesEqual(document.createComment("a"), document.createComment("a"))).toBe(true);
    expect(areDomNodesEqual(document.createComment("a"), document.createComment("b"))).toBe(false);
  });
});

// VERIFIED (Chromium and happy-dom, 2026-11-01): morph leaves every comment where innerHTML puts it, in every position
// below, and a second morph of the same markup changes nothing
describe("morph: comments in every position, as innerHTML parses them", () => {
  const POSITIONS: Record<string, string> = {
    "top level": "<!--a--><p>x</p><!--b-->",
    "only a comment": "<!--only-->",
    "nested": "<div><!--a--><p>x</p><!--b--></div>",
    "inside <svg>": '<svg viewBox="0 0 1 1"><!--a--><rect width="1" height="1"></rect><!--b--></svg>',
    "inside an SVG <g>": '<svg><g><!--a--><circle r="1"></circle></g></svg>',
    "CDATA in an SVG <style>": '<svg><style><![CDATA[ .a { fill: red } ]]></style><rect class="a"></rect></svg>',
    "CDATA in an SVG <text>": "<svg><text><![CDATA[a < b]]></text></svg>",
    "CDATA in HTML (a bogus comment)": "<p><![CDATA[x]]></p>",
    "table rows and cells": "<table><tbody><!--a--><tr><!--b--><td>x</td></tr></tbody></table>",
    "<template> content": "<template><!--a--><b>x</b></template>",
    "<select>": "<select><!--a--><option>x</option></select>",
    "list items": "<ul><!--a--><li>x</li><!--b--><li>y</li></ul>",
    "empty and with dashes": "<p><!----><!-- a -- b --></p>",
    "an SVG processing instruction (a bogus comment)": '<svg><?xml-stylesheet href="a.css"?><rect></rect></svg>',
  };
  for (const [name, html] of Object.entries(POSITIONS)) {
    it(name, () => {
      const el = container();
      morph(el, html);
      expect(el.innerHTML).toBe(container(html).innerHTML);
      const nodes = [...el.querySelectorAll("*")];
      morph(el, html);
      expect([...el.querySelectorAll("*")]).toEqual(nodes);
    });
  }

  // innerHTML serializes no key; the shape outside the keys must match what the parser makes of the next markup
  const UPDATES: Record<string, [string, string]> = {
    "a comment added before an element": ["<p>x</p>", "<!--a--><p>x</p>"],
    "a comment added between keyed rows": ['<p key="1">1</p><p key="2">2</p>', '<p key="1">1</p><!--mid--><p key="2">2</p>'],
    "keyed rows reordered around comments": ['<!--s--><p key="1">1</p><!--m--><p key="2">2</p><!--e-->', '<!--s--><p key="2">2</p><!--m--><p key="1">1</p><!--e-->'],
    "table rows reordered around a comment": [
      '<table><tbody><tr key="a"><td>a</td></tr><!--x--><tr key="b"><td>b</td></tr></tbody></table>',
      '<table><tbody><tr key="b"><td>b</td></tr><!--x--><tr key="a"><td>a</td></tr></tbody></table>',
    ],
    "a comment turned into text and back": ["<p><!--c--></p>", "<p>t</p>"],
    "SVG comments moved and added": ["<svg><!--a--><rect></rect></svg>", "<svg><rect></rect><!--b--><circle></circle></svg>"],
    "several comments shrunk to one": ["<!--1--><!--2--><!--3--><p>x</p>", "<!--2--><p>x</p>"],
  };
  const withoutKeys = (html: string) => html.replace(/ key="[^"]*"/g, "");
  for (const [name, [from, to]] of Object.entries(UPDATES)) {
    it(name, () => {
      const el = container();
      morph(el, from);
      morph(el, to);
      expect(el.innerHTML).toBe(withoutKeys(container(to).innerHTML));
    });
  }

  it("a full document contributes its <body> only, so comments before it and in <head> are dropped, like <title>", () => {
    const el = container();
    morph(el, "<!--pre--><!doctype html><html><head><!--h--><title>t</title></head><body><!--a--><p>x</p></body></html>");
    expect(el.innerHTML).toBe("<!--a--><p>x</p>");
  });
});
