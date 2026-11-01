// Reordering children: which existing node each child of the next markup reuses, the DOM a morph leaves, and the
// state that travels with a reused node (typed values, focus, selection, listeners, onMount and onUnmount). These pin
// what morphDomDirect produces, independent of how it moves nodes into place.
// VERIFIED (2026-11-01): every test above "how many nodes a morph moves" passed against both the placement that moved
// each match not at the next position and the one that keeps the longest in-order run in place; the move counts below
// failed against the former (it moved every row after one out of place).
import { describe, expect, it } from "vitest";
import { type VNode, morph } from "./index.js";
import { recorder } from "./test-recorder.js";

const container = (html = ""): HTMLElement => {
  const el = document.createElement("div");
  el.innerHTML = html;
  document.body.appendChild(el);
  return el;
};

/** Takes moveBefore() away from `el`, so morph moves its children with insertBefore() (older browsers, happy-dom). */
const withoutMoveBefore = (el: Element) => Object.defineProperty(el, "moveBefore", { value: undefined, configurable: true });

const ticks = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

// ---- a model of the matching rules ----------------------------------------------------------------------------------

type Item =
  | { kind: "el"; tag: string; key?: string; id?: string; label: string }
  | { kind: "text"; text: string }
  | { kind: "comment"; text: string };

type Input = "html" | "vnode";

const renderHtml = (items: Item[]) =>
  items
    .map((it) => {
      if (it.kind === "text") return it.text;
      if (it.kind === "comment") return `<!--${it.text}-->`;
      const key = it.key === undefined ? "" : ` key="${it.key}"`;
      const id = it.id ? ` id="${it.id}"` : "";
      return `<${it.tag}${key}${id} data-v="${it.label}"><span>${it.label}</span></${it.tag}>`;
    })
    .join("");

const renderVNodes = (items: Item[], onMount?: (label: string) => void): Array<VNode | string> =>
  items.map((it, i) => {
    if (it.kind === "text") return it.text;
    if (it.kind === "comment") return { type: "#comment", value: it.text, attributes: {}, children: [] } as unknown as VNode;
    return {
      type: it.tag,
      attributes: {
        ...(it.key === undefined ? {} : { key: it.key }),
        ...(it.id ? { id: it.id } : {}),
        "data-v": it.label,
        ...(onMount ? { onMount: () => onMount(`${i}:${it.label}`) } : {}),
      },
      children: [{ type: "span", attributes: {}, children: [it.label] }],
    } as VNode;
  });

const render = (items: Item[], input: Input) => (input === "html" ? renderHtml(items) : renderVNodes(items));

/** The children of `parent` as text: tags, attributes sorted (no `key`: parsed markup keeps it as an attribute), text, comments. */
const shape = (parent: Node): string =>
  [...parent.childNodes]
    .map((node) => {
      if (node.nodeType === 3) return `"${node.nodeValue}"`;
      if (node.nodeType === 8) return `<!--${node.nodeValue}-->`;
      const el = node as Element;
      const attrs = [...el.attributes].filter((a) => a.name !== "key").map((a) => ` ${a.name}="${a.value}"`).sort().join("");
      return `<${el.tagName.toLowerCase()}${attrs}>${shape(el)}</>`;
    })
    .join("");

/** A child of the morphed element as the matching sees it: its keys (internal, from a parsed key attribute, id). */
interface Slot {
  token: number;
  kind: Item["kind"];
  tag?: string;
  key?: string;
  attrKey?: string;
  id?: string;
}

const domKeys = (s: Slot) =>
  s.kind === "el" ? [s.key ? `k:${s.key}` : "", s.attrKey ? `k:${s.attrKey}` : "", s.id ? `id:${s.id}` : ""].filter(Boolean) : [];
const itemKey = (it: Item) => (it.kind !== "el" ? null : it.key !== undefined ? `k:${it.key}` : it.id ? `id:${it.id}` : null);

/**
 * The documented matching of a full morph: a keyed item takes the node holding its key (`key`, else `id`; the first node
 * wins a duplicate key, and taking a node frees the keys that address it); an item without a key takes the first compatible node
 * without a key (same node type, same tag) in document order; a matched element with another tag is replaced; the rest
 * is created. Returns the children after the morph.
 */
const simulate = (dom: Slot[], next: Item[], fresh: () => number): Slot[] => {
  const pool = new Map<string, Slot>();
  const unkeyed: Slot[] = [];
  for (const slot of dom) {
    let pooled = false;
    for (const k of domKeys(slot)) {
      if (!pool.has(k)) {
        pool.set(k, slot);
        pooled = true;
      }
    }
    if (!pooled) unkeyed.push(slot);
  }
  return next.map((it) => {
    const key = itemKey(it);
    let match: Slot | undefined;
    if (key) {
      match = pool.get(key);
      // only the keys that address this node: a duplicate key or id stays with the node that holds it
      if (match) for (const k of domKeys(match)) if (pool.get(k) === match) pool.delete(k);
    } else {
      const at = unkeyed.findIndex((s) => s.kind === it.kind && (it.kind !== "el" || s.tag === it.tag));
      if (at >= 0) match = unkeyed.splice(at, 1)[0];
    }
    if (it.kind !== "el") return match ?? { token: fresh(), kind: it.kind };
    if (!match || match.tag !== it.tag) return { token: fresh(), kind: "el", tag: it.tag, key: it.key, id: it.id };
    // patched in place: a key overwrites the internal one, the id follows the markup, a parsed key attribute stays
    return { ...match, key: it.key ?? match.key, id: it.id };
  });
};

/** Morphs `el` through `states` and checks every step against the model, the fresh render and the removed nodes. */
const checkChain = (states: Item[][], input: Input, parsedFirst: boolean, label: string) => {
  const el = container();
  const tokens = new Map<Node, number>();
  let counter = 0;
  const fresh = () => ++counter;
  let model: Slot[];
  if (parsedFirst) {
    // server-rendered markup: keys arrive as attributes
    el.innerHTML = renderHtml(states[0]);
    model = states[0].map((it) =>
      it.kind === "el" ? { token: fresh(), kind: "el", tag: it.tag, attrKey: it.key, id: it.id } : { token: fresh(), kind: it.kind },
    );
  } else {
    model = simulate([], states[0], fresh);
    morph(el, render(states[0], input));
  }
  [...el.childNodes].forEach((node, i) => tokens.set(node, model[i].token));

  for (const [step, state] of states.slice(1).entries()) {
    const at = `${label} step ${step + 1}: ${renderHtml(states[step])} -> ${renderHtml(state)}`;
    const before = [...el.childNodes];
    const known = new Set(model.map((s) => s.token));
    const expected = simulate(model, state, fresh);
    morph(el, render(state, input));
    const after = [...el.childNodes];

    expect(after.map((node) => tokens.get(node) ?? "new"), at).toEqual(expected.map((s) => (known.has(s.token) ? s.token : "new")));
    after.forEach((node, i) => tokens.set(node, expected[i].token));

    const reference = container();
    morph(reference, render(state, input));
    expect(shape(el), at).toBe(shape(reference));
    reference.remove();

    const gone = before.filter((node) => !after.includes(node));
    expect(gone.filter((node) => node.parentNode !== null).length, `${at}: removed nodes are detached`).toBe(0);
    model = expected;
  }
  el.remove();
};

const random = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const TAGS = ["p", "section", "article"];
const LETTERS = "abcdefghij".split("");

/** Lists that mix keyed, id-addressed and plain elements, text and comments, with duplicate keys and tag changes. */
const mixedList = (rand: () => number): Item[] => {
  const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  const items: Item[] = [];
  const length = Math.floor(rand() * 13);
  for (let i = 0; i < length; i++) {
    const r = rand();
    const label = `v${Math.floor(rand() * 4)}`;
    if (r < 0.45) items.push({ kind: "el", tag: pick(TAGS), key: pick(LETTERS), label });
    else if (r < 0.55) items.push({ kind: "el", tag: pick(TAGS), id: `i${pick(LETTERS)}`, label });
    else if (r < 0.6) items.push({ kind: "el", tag: pick(TAGS), key: pick(LETTERS), id: `i${pick(LETTERS)}`, label });
    else if (r < 0.82) items.push({ kind: "el", tag: pick(TAGS), label });
    // adjacent text would merge into one node when parsed
    else if (r < 0.94) {
      if (items.at(-1)?.kind !== "text") items.push({ kind: "text", text: `t${Math.floor(rand() * 4)}` });
    }
    else items.push({ kind: "comment", text: `c${Math.floor(rand() * 3)}` });
  }
  return items;
};

/** A keyed list with unique keys, then edits of it: swaps, moves, inserts, removals, reversal, rotation, shuffles. */
const keyedEdits = (rand: () => number, steps: number): Item[][] => {
  let next = 0;
  const row = (): Item => ({ kind: "el", tag: "p", key: `r${next++}`, label: "v0" });
  let list = Array.from({ length: Math.floor(rand() * 30) }, row);
  const states = [list];
  const index = (length: number) => Math.floor(rand() * length);
  for (let s = 0; s < steps; s++) {
    list = list.slice();
    for (let edits = 1 + index(3); edits > 0; edits--) {
      const op = index(8);
      if (op === 0 && list.length > 1) {
        const [a, b] = [index(list.length), index(list.length)];
        [list[a], list[b]] = [list[b], list[a]];
      } else if (op === 1 && list.length > 0) list.splice(index(list.length + 1), 0, list.splice(index(list.length), 1)[0]);
      else if (op === 2) list.splice(index(list.length + 1), 0, row());
      else if (op === 3 && list.length > 0) list.splice(index(list.length), 1);
      else if (op === 4) list.reverse();
      else if (op === 5 && list.length > 0) list.push(list.shift()!);
      else if (op === 6) list.sort(() => rand() - 0.5);
      else if (list.length > 0) {
        const at = index(list.length);
        list[at] = { ...(list[at] as Item & { kind: "el" }), label: `v${index(4)}` };
      }
    }
    states.push(list);
  }
  return states;
};

/**
 * Lists that keep their length and mostly their kinds and tags: labels change, and now and then a tag, a key or an id
 * comes or goes, or a text turns into a comment and back. Positional patching applies to most steps and narrowly
 * misses the rest.
 */
const sameShapeEdits = (rand: () => number, steps: number): Item[][] => {
  const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  // a text at every third position, so two texts never meet
  let list: Item[] = Array.from({ length: 1 + Math.floor(rand() * 9) }, (_, i) =>
    i % 3 === 2 ? { kind: "text", text: "t0" } : { kind: "el", tag: pick(TAGS), label: "v0" },
  );
  const states = [list];
  for (let s = 0; s < steps; s++) {
    list = list.map((it): Item => {
      const r = rand();
      if (it.kind !== "el") {
        if (r < 0.1) return it.kind === "text" ? { kind: "comment", text: "c0" } : { kind: "text", text: "t1" };
        return r < 0.6 && it.kind === "text" ? { kind: "text", text: `t${Math.floor(rand() * 4)}` } : it;
      }
      if (r < 0.55) return { ...it, label: `v${Math.floor(rand() * 4)}` };
      if (r < 0.65) return { ...it, tag: pick(TAGS) };
      if (r < 0.72) return { ...it, key: pick(LETTERS) };
      if (r < 0.77) return { ...it, id: `i${pick(LETTERS)}` };
      if (r < 0.85) return { kind: "el", tag: it.tag, label: it.label };
      return it;
    });
    states.push(list);
  }
  return states;
};

/**
 * Keyed lists that mostly keep their order, the usual reactive() list: labels change, and now and then a key is
 * duplicated, two keys trade places, a key gives way to an id or to nothing, or a keyed element changes its tag. Text
 * sits between some rows. Patching by position applies to most steps and narrowly misses the rest.
 */
const keyedSameOrder = (rand: () => number, steps: number): Item[][] => {
  const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  let list: Item[] = Array.from({ length: 1 + Math.floor(rand() * 10) }, (_, i): Item =>
    i % 4 === 3 ? { kind: "text", text: "t0" } : { kind: "el", tag: "p", key: `k${i}`, label: "v0" },
  );
  const states = [list];
  for (let s = 0; s < steps; s++) {
    list = list.slice();
    const rows = list.flatMap((it, i) => (it.kind === "el" ? [i] : []));
    for (const i of rows) {
      const it = list[i] as Item & { kind: "el" };
      const r = rand();
      if (r < 0.5) list[i] = { ...it, label: `v${Math.floor(rand() * 4)}` };
      else if (r < 0.55 && rows.length > 1) list[i] = { ...it, key: (list[pick(rows)] as Item & { kind: "el" }).key };
      else if (r < 0.6) list[i] = { kind: "el", tag: it.tag, id: `i${it.key ?? i}`, label: it.label };
      else if (r < 0.63) list[i] = { kind: "el", tag: it.tag, label: it.label };
      else if (r < 0.67) list[i] = { ...it, tag: pick(TAGS) };
      else if (r < 0.7) list[i] = { ...it, key: `k${Math.floor(rand() * 20)}` };
    }
    if (rand() < 0.1 && rows.length > 1) {
      const [a, b] = [pick(rows), pick(rows)];
      [list[a], list[b]] = [list[b], list[a]];
    }
    states.push(list);
  }
  return states;
};

describe("reordering — the node every child reuses (model-checked)", () => {
  for (const input of ["html", "vnode"] as const) {
    it(`mixed lists with duplicate keys, ids, text, comments and tag changes (${input})`, () => {
      for (let seed = 1; seed <= 250; seed++) {
        const rand = random(seed);
        checkChain([mixedList(rand), mixedList(rand), mixedList(rand), mixedList(rand)], input, false, `seed ${seed}`);
      }
    });

    it(`keyed lists through swaps, moves, inserts, removals and shuffles (${input})`, () => {
      for (let seed = 1; seed <= 250; seed++) checkChain(keyedEdits(random(seed), 4), input, false, `seed ${seed}`);
    });

    it(`same-length lists patched by position, with tags, keys and ids that come and go (${input})`, () => {
      for (let seed = 1; seed <= 250; seed++) checkChain(sameShapeEdits(random(seed), 5), input, false, `seed ${seed}`);
    });

    it(`keyed lists that mostly keep their order, with duplicate, moved and dropped keys (${input})`, () => {
      for (let seed = 1; seed <= 250; seed++) checkChain(keyedSameOrder(random(seed), 5), input, false, `seed ${seed}`);
    });
  }

  it("server-rendered markup with key attributes, then morphs", () => {
    for (let seed = 1; seed <= 150; seed++) {
      const rand = random(seed);
      checkChain([mixedList(rand), mixedList(rand), mixedList(rand)], "html", true, `mixed seed ${seed}`);
      checkChain(keyedEdits(random(seed), 3), "html", true, `keyed seed ${seed}`);
      checkChain(sameShapeEdits(random(seed), 3), "html", true, `same-shape seed ${seed}`);
      checkChain(keyedSameOrder(random(seed), 3), "html", true, `keyed same-order seed ${seed}`);
    }
  });

  it("runs onMount for every element of the next markup, in its order", async () => {
    for (let seed = 1; seed <= 60; seed++) {
      const states = [keyedEdits(random(seed), 3), [mixedList(random(seed)), mixedList(random(seed + 1000))], sameShapeEdits(random(seed), 3), keyedSameOrder(random(seed), 3)][seed % 4];
      const el = container();
      for (const state of states) {
        const mounted: string[] = [];
        morph(el, renderVNodes(state, (label) => mounted.push(label)));
        await ticks();
        const expected = state.flatMap((it, i) => (it.kind === "el" ? [`${i}:${it.label}`] : []));
        expect(mounted, `seed ${seed}`).toEqual(expected);
      }
      el.remove();
    }
  });
});

// ---- the typical operations on a keyed list -------------------------------------------------------------------------

const ROWS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** The operations of js-framework-benchmark and the other everyday edits: the row ids before and after. */
const OPS: Array<[string, number[]]> = [
  ["unchanged", ROWS],
  ["swap rows 2 and 9", [1, 9, 3, 4, 5, 6, 7, 8, 2, 10]],
  ["swap neighbours", [2, 1, 3, 4, 5, 6, 7, 8, 9, 10]],
  ["reverse", [...ROWS].reverse()],
  ["first to last", [2, 3, 4, 5, 6, 7, 8, 9, 10, 1]],
  ["last to first", [10, 1, 2, 3, 4, 5, 6, 7, 8, 9]],
  ["move 3 behind 8", [1, 2, 4, 5, 6, 7, 8, 3, 9, 10]],
  ["insert at the front", [11, ...ROWS]],
  ["insert in the middle", [1, 2, 3, 4, 5, 11, 6, 7, 8, 9, 10]],
  ["append one", [...ROWS, 11]],
  ["remove the first", ROWS.slice(1)],
  ["remove the middle", [1, 2, 3, 4, 6, 7, 8, 9, 10]],
  ["remove the last", ROWS.slice(0, -1)],
  ["remove two, insert one elsewhere", [1, 3, 4, 11, 5, 6, 7, 9, 10]],
  ["remove every other", [1, 3, 5, 7, 9]],
  ["interleave new rows", [1, 11, 2, 12, 3, 13, 4, 5, 6, 7, 8, 9, 10]],
  ["shuffle", [7, 3, 10, 1, 9, 2, 5, 8, 4, 6]],
  ["shuffle, remove and insert", [12, 7, 3, 11, 1, 9, 5, 8, 4]],
  ["replace all", [11, 12, 13, 14, 15, 16, 17, 18, 19, 20]],
  ["prepend five", [11, 12, 13, 14, 15, ...ROWS]],
  ["append five", [...ROWS, 11, 12, 13, 14, 15]],
  ["clear", []],
];

const rowHtml = (id: number, text = `row ${id}`) => `<li key="r${id}" data-id="${id}"><input aria-label="note ${id}"><button type="button">${text}</button></li>`;
const rowVNode = (id: number, text = `row ${id}`, props: Record<string, unknown> = {}): VNode =>
  ({
    type: "li",
    attributes: { key: `r${id}`, "data-id": String(id), ...props },
    children: [
      { type: "input", attributes: { "aria-label": `note ${id}` }, children: [] },
      { type: "button", attributes: { type: "button" }, children: [text] },
    ],
  }) as VNode;

const listOf = (ids: number[], input: Input, text?: (id: number) => string) =>
  input === "html" ? `<ul>${ids.map((id) => rowHtml(id, text?.(id))).join("")}</ul>` : [{ type: "ul", attributes: {}, children: ids.map((id) => rowVNode(id, text?.(id))) } as VNode];

const rowsOf = (el: HTMLElement) => [...el.querySelectorAll<HTMLLIElement>("ul > li")];
const idsOf = (el: HTMLElement) => rowsOf(el).map((li) => Number(li.dataset.id));

describe("reordering — the typical operations on a keyed list", () => {
  for (const input of ["html", "vnode"] as const) {
    for (const placement of ["moveBefore", "insertBefore"] as const) {
      for (const [name, after] of OPS) {
        it(`${name} (${input}, ${placement}): same rows, same nodes, typed values and listeners kept`, () => {
          const el = container();
          morph(el, listOf(ROWS, input));
          if (placement === "insertBefore") withoutMoveBefore(el.querySelector("ul")!);
          const nodes = new Map(rowsOf(el).map((li) => [Number(li.dataset.id), li]));
          const clicks = new Map<number, number>();
          for (const [id, li] of nodes) {
            li.querySelector("input")!.value = `typed ${id}`;
            li.querySelector("button")!.addEventListener("click", () => clicks.set(id, (clicks.get(id) ?? 0) + 1));
          }

          morph(el, listOf(after, input, (id) => `row ${id}!`));

          expect(idsOf(el)).toEqual(after);
          for (const li of rowsOf(el)) {
            const id = Number(li.dataset.id);
            expect(li.querySelector("button")!.textContent).toBe(`row ${id}!`);
            if (!nodes.has(id)) {
              expect(li.querySelector("input")!.value).toBe("");
              continue;
            }
            expect(li).toBe(nodes.get(id));
            expect(li.querySelector("input")!.value).toBe(`typed ${id}`);
            li.querySelector("button")!.click();
            expect(clicks.get(id)).toBe(1);
          }
          for (const [id, li] of nodes) if (!after.includes(id)) expect(li.isConnected).toBe(false);
          el.remove();
        });
      }
    }
  }

  // attributes are written again on every morph (attribute records), so this counts inserted, moved and removed nodes
  it("leaves an unchanged keyed list without inserting, moving or removing a node", async () => {
    for (const input of ["html", "vnode"] as const) {
      const el = container();
      morph(el, listOf(ROWS, input));
      const records: MutationRecord[] = [];
      const observer = new MutationObserver((list) => records.push(...list));
      observer.observe(el, { subtree: true, childList: true });
      morph(el, listOf(ROWS, input));
      await ticks();
      records.push(...observer.takeRecords());
      observer.disconnect();
      expect(records.length, input).toBe(0);
      el.remove();
    }
  });
});

describe("reordering — focus and selection travel with the row", () => {
  // rows at the edges, in the middle and the ones the operations take out of place
  const FOCUSED = [1, 2, 5, 9, 10];
  for (const placement of ["moveBefore", "insertBefore"] as const) {
    for (const [name, after] of OPS) {
      for (const id of FOCUSED.filter((id) => after.includes(id))) {
        it(`${name}, row ${id} focused (${placement})`, () => {
          const el = container();
          morph(el, listOf(ROWS, "html"));
          if (placement === "insertBefore") withoutMoveBefore(el.querySelector("ul")!);
          const input = el.querySelector<HTMLInputElement>(`[aria-label="note ${id}"]`)!;
          input.value = "hello world";
          input.focus();
          input.setSelectionRange(2, 7, "backward");

          morph(el, listOf(after, "html"));

          expect(idsOf(el)).toEqual(after);
          expect(el.querySelector(`[aria-label="note ${id}"]`)).toBe(input);
          expect(document.activeElement).toBe(input);
          expect([input.value, input.selectionStart, input.selectionEnd, input.selectionDirection]).toEqual(["hello world", 2, 7, "backward"]);
          el.remove();
        });
      }
    }
  }
});

describe("reordering — lifecycle and delegated handlers", () => {
  for (const placement of ["moveBefore", "insertBefore"] as const) {
    it(`onUnmount runs for the removed rows only, never for a moved one (${placement})`, async () => {
      const el = container();
      const unmounted = recorder<[string]>();
      const list = (ids: number[]) => [
        { type: "ul", attributes: {}, children: ids.map((id) => rowVNode(id, `row ${id}`, { onUnmount: () => unmounted(String(id)) })) } as VNode,
      ];
      morph(el, list(ROWS));
      if (placement === "insertBefore") withoutMoveBefore(el.querySelector("ul")!);
      await ticks();

      morph(el, list([10, 8, 7, 6, 5, 4, 3, 1, 9]));
      await ticks();
      await ticks();

      expect(unmounted.calls.map(([id]) => id).sort()).toEqual(["2"]);
      el.remove();
    });

    it(`delegated click handlers fire once on moved and kept rows, with their latest closure (${placement})`, () => {
      const el = container();
      const clicked = recorder<[number, number]>();
      const list = (ids: number[], round: number) => [
        { type: "ul", attributes: {}, children: ids.map((id) => rowVNode(id, `row ${id}`, { onClick: () => clicked(id, round) })) } as VNode,
      ];
      morph(el, list(ROWS, 1));
      if (placement === "insertBefore") withoutMoveBefore(el.querySelector("ul")!);
      const order = [7, 3, 10, 1, 9, 2, 5, 8, 4, 6];
      morph(el, list(order, 2));

      for (const li of rowsOf(el)) li.click();
      expect(clicked.calls).toEqual(order.map((id) => [id, 2]));
      el.remove();
    });
  }
});

describe("reordering — nested lists and other targets", () => {
  const nested = (outer: number[], inner: (id: number) => number[]) =>
    outer.map((o) => `<section key="s${o}" data-id="${o}"><ol>${inner(o).map((i) => `<li key="s${o}-${i}" data-id="${i}">${o}.${i}</li>`).join("")}</ol></section>`).join("");

  it("reorders the outer and the inner keyed lists at once, keeping every node", () => {
    const el = container();
    morph(el, nested([1, 2, 3, 4], () => [1, 2, 3, 4, 5]));
    const nodes = new Map([...el.querySelectorAll<HTMLElement>("[data-id]")].map((n) => [n.getAttribute("key") ?? n.textContent, n]));
    const sections = new Map([...el.querySelectorAll<HTMLElement>("section")].map((s) => [s.dataset.id, s]));
    const items = new Map([...el.querySelectorAll<HTMLElement>("li")].map((li) => [li.textContent, li]));
    expect(nodes.size).toBeGreaterThan(0);

    morph(el, nested([3, 1, 4, 2], (o) => (o % 2 ? [5, 4, 3, 2, 1] : [2, 1, 3, 6])));

    expect([...el.querySelectorAll<HTMLElement>("section")].map((s) => s.dataset.id)).toEqual(["3", "1", "4", "2"]);
    for (const section of el.querySelectorAll<HTMLElement>("section")) {
      expect(section).toBe(sections.get(section.dataset.id));
      const o = Number(section.dataset.id);
      const expected = o % 2 ? [5, 4, 3, 2, 1] : [2, 1, 3, 6];
      expect([...section.querySelectorAll("li")].map((li) => li.textContent)).toEqual(expected.map((i) => `${o}.${i}`));
      for (const li of section.querySelectorAll("li")) {
        if (items.has(li.textContent)) expect(li).toBe(items.get(li.textContent));
      }
    }
    expect(items.get("2.4")!.isConnected).toBe(false);
    el.remove();
  });

  it("reorders keyed children inside a <template>'s content", () => {
    const el = container();
    morph(el, `<template>${ROWS.map((id) => rowHtml(id)).join("")}</template>`);
    const content = el.querySelector("template")!.content;
    const nodes = new Map([...content.children].map((li) => [(li as HTMLElement).dataset.id, li]));
    const order = [5, 1, 9, 2, 8, 3, 7, 4, 6];
    morph(el, `<template>${order.map((id) => rowHtml(id)).join("")}</template>`);
    const after = [...el.querySelector("template")!.content.children] as HTMLElement[];
    expect(after.map((li) => Number(li.dataset.id))).toEqual(order);
    for (const li of after) expect(li).toBe(nodes.get(li.dataset.id));
    el.remove();
  });

  it("reorders keyed children of a shadow root", () => {
    const host = container();
    const root = host.attachShadow({ mode: "open" });
    morph(host, ROWS.map((id) => rowHtml(id)).join(""));
    const nodes = new Map([...root.children].map((li) => [(li as HTMLElement).dataset.id, li]));
    const order = [...ROWS].reverse();
    morph(host, order.map((id) => rowHtml(id)).join(""));
    const after = [...root.children] as HTMLElement[];
    expect(after.map((li) => Number(li.dataset.id))).toEqual(order);
    for (const li of after) expect(li).toBe(nodes.get(li.dataset.id));
    expect(host.childNodes.length).toBe(0);
    host.remove();
  });

  it("keyed rows among unkeyed text and comments keep both their identities and the text between them", () => {
    const el = container();
    const markup = (ids: number[]) => `head<!--start-->${ids.map((id) => `<b key="b${id}">${id}</b>`).join("|")}<!--end-->tail`;
    morph(el, markup([1, 2, 3, 4, 5]));
    const bold = new Map([...el.querySelectorAll("b")].map((b) => [b.textContent, b]));
    const [head, start] = [el.childNodes[0], el.childNodes[1]];

    morph(el, markup([4, 2, 5, 1]));

    expect(el.innerHTML).toBe(`head<!--start--><b>4</b>|<b>2</b>|<b>5</b>|<b>1</b><!--end-->tail`);
    for (const b of el.querySelectorAll("b")) expect(b).toBe(bold.get(b.textContent));
    expect([el.childNodes[0], el.childNodes[1]]).toEqual([head, start]);
    expect(bold.get("3")!.isConnected).toBe(false);
    el.remove();
  });
});

// ---- how many nodes a morph moves ------------------------------------------------------------------------------------

/** The rows that must move: all kept rows but a longest run that is already in order (O(n²), independent of morph). */
const minimalMoves = (before: number[], after: number[]) => {
  const old = after.filter((id) => before.includes(id)).map((id) => before.indexOf(id));
  const best = old.map(() => 1);
  for (let i = 0; i < old.length; i++) for (let j = 0; j < i; j++) if (old[j] < old[i]) best[i] = Math.max(best[i], best[j] + 1);
  return old.length - Math.max(0, ...best);
};

/** Morphs `ul` and counts the nodes that were children before and were inserted again: moves (moveBefore reports them too). */
const countMoves = async (ul: HTMLElement, morphIt: () => void) => {
  const before = new Set<Node>(ul.childNodes);
  const records: MutationRecord[] = [];
  const observer = new MutationObserver((list) => records.push(...list));
  observer.observe(ul, { childList: true });
  morphIt();
  await ticks();
  records.push(...observer.takeRecords());
  observer.disconnect();
  return records.flatMap((r) => [...r.addedNodes]).filter((node) => before.has(node)).length;
};

describe("reordering — moves only the rows that are out of order", () => {
  for (const placement of ["moveBefore", "insertBefore"] as const) {
    for (const [name, after] of OPS) {
      const moves = minimalMoves(ROWS, after);
      it(`${name} moves ${moves} row${moves === 1 ? "" : "s"} (${placement})`, async () => {
        const el = container();
        morph(el, listOf(ROWS, "html"));
        const ul = el.querySelector("ul")!;
        if (placement === "insertBefore") withoutMoveBefore(ul);
        expect(await countMoves(ul, () => morph(el, listOf(after, "html")))).toBe(minimalMoves(ROWS, after));
        expect(idsOf(el)).toEqual(after);
        el.remove();
      });
    }

    it(`random keyed edits move the minimum (${placement})`, async () => {
      for (let seed = 1; seed <= 80; seed++) {
        const states = keyedEdits(random(seed), 3).map((items) => items.map((it) => Number((it as { key: string }).key.slice(1))));
        const el = container();
        morph(el, listOf(states[0], "vnode"));
        const ul = el.querySelector("ul")!;
        if (placement === "insertBefore") withoutMoveBefore(ul);
        for (let s = 1; s < states.length; s++) {
          const moves = await countMoves(ul, () => morph(el, listOf(states[s], "vnode")));
          expect(moves, `seed ${seed} step ${s}`).toBe(minimalMoves(states[s - 1], states[s]));
        }
        el.remove();
      }
    });
  }

  it("swapping rows 2 and 999 of 1,000 moves 2 rows; removing one moves none", async () => {
    const thousand = Array.from({ length: 1000 }, (_, i) => i + 1);
    const swapped = thousand.slice();
    [swapped[1], swapped[998]] = [swapped[998], swapped[1]];
    const el = container();
    morph(el, listOf(thousand, "html"));
    const ul = el.querySelector("ul")!;
    expect(await countMoves(ul, () => morph(el, listOf(swapped, "html")))).toBe(2);
    expect(await countMoves(ul, () => morph(el, listOf(swapped.filter((id) => id !== 500), "html")))).toBe(0);
    expect(idsOf(el)).toEqual(swapped.filter((id) => id !== 500));
    el.remove();
  });
});
