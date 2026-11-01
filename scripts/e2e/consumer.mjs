// e2e consumer (ESM). `make e2e` copies this file into a clean project where the packed
// defuss-morph tarball is installed, so it imports what npm users get, not src/.
// Server-side DOM: happy-dom; morph derives its globals from the element's own document.
// VERIFIED: its table-row diff check found the dropped-<tr> fragment parsing defect (2026-10-31),
// which the source-tree unit suite had missed.
import { readFileSync, writeFileSync } from "node:fs";
import { Window } from "happy-dom";
import { createStore } from "defuss-store";
import { Reactive, createRef, h, jsx, morph, reactive, updateDomWithVdom } from "defuss-morph";
import * as jsxRuntime from "defuss-morph/jsx-runtime";
import { reorderMatrix } from "./reorder-matrix.mjs";

const log = (level, message) => console.log(`${new Date().toISOString()} ${level} e2e.consumer ${message}`);
const results = [];
const check = (name, ok) => {
  results.push({ name, ok: Boolean(ok) });
  log(ok ? "INFO" : "ERROR", `${ok ? "pass" : "FAIL"} ${name}`);
};

const window = new Window();
const app = window.document.createElement("div");
window.document.body.appendChild(app);

morph(app, `<ul><li key="a">Alpha</li><li key="b">Beta</li></ul>`);
const [alpha, beta] = app.querySelectorAll("li");
morph(app, `<ul><li key="b">Beta</li><li key="a">Alpha 2</li></ul>`);
const reordered = app.querySelectorAll("li");
check("keyed reorder moves the existing nodes", reordered[0] === beta && reordered[1] === alpha && alpha.textContent === "Alpha 2");

// the everyday list operations (scripts/e2e/reorder-matrix.mjs); happy-dom has no moveBefore, so insertBefore moves
for (const r of reorderMatrix({ document: window.document, morph, moveBefore: false })) check(r.detail ? `${r.name} (${r.detail})` : r.name, r.ok);

morph(app, `<input id="name">`);
const input = app.querySelector("#name");
input.value = "typed by a user";
morph(app, `<input id="name" class="touched">`);
check("uncontrolled input value survives a morph", app.querySelector("#name") === input && input.value === "typed by a user" && input.className === "touched");

morph(app, `<table><tbody id="rows"><tr key="1"><td>one</td></tr><tr key="2"><td>two</td></tr></tbody></table>`);
const rows = app.querySelector("#rows");
const first = rows.firstElementChild;
morph(rows, `<tr key="2"><td>two (patched)</td></tr><tr key="3"><td>three</td></tr>`, { diff: true });
check("diff mode patches by key, appends new, keeps the rest", rows.firstElementChild === first && rows.textContent === "onetwo (patched)three");

updateDomWithVdom(app, [{ type: "input", attributes: { type: "checkbox", id: "c", checked: false }, children: [] }]);
check("VNodes express explicit state (checked: false)", app.querySelector("#c").checked === false);

// reactive(): a defuss-store store drives an HTML string; the paragraph is patched, not replaced
const cart = createStore({ count: 1 });
const region = window.document.createElement("section");
window.document.body.appendChild(region);
const dispose = reactive({ store: cart, render: () => `<p>${cart.value.count} items</p>` }, region);
const paragraph = region.querySelector("p");
cart.set("count", 2);
check("reactive() re-renders on a defuss-store change into the same node", region.querySelector("p") === paragraph && paragraph.textContent === "2 items");
dispose();
cart.set("count", 3);
check("its dispose function unsubscribes", paragraph.textContent === "2 items");

// <Reactive> written with h(), a ref on its wrapper; subscribed once mounted (onMount runs in a microtask)
const counter = createStore({ n: 0 });
const wrapper = createRef();
morph(app, h(Reactive, { ref: wrapper, tag: "output", store: counter, render: () => String(counter.value.n) }));
await new Promise((resolve) => setTimeout(resolve, 0));
counter.set("n", 5);
check("<Reactive> renders its wrapper, sets the ref and follows the store", wrapper.current === app.querySelector("output") && wrapper.current.textContent === "5");

check("defuss-morph/jsx-runtime is the package entry, not a second copy", jsxRuntime.jsx === jsx && typeof jsxRuntime.Fragment === "function");

check("the library entry registers no df$ global", !("df$" in globalThis));

// the exports map hides package.json from resolution, so read it from the install
const pkg = JSON.parse(readFileSync(new URL("./node_modules/defuss-morph/package.json", import.meta.url), "utf8"));
const failed = results.filter((r) => !r.ok).length;
writeFileSync(process.argv[2], `${JSON.stringify({ timestamp: new Date().toISOString(), package: `${pkg.name}@${pkg.version}`, format: "esm", results }, null, 2)}\n`);
log(failed ? "ERROR" : "INFO", `${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
