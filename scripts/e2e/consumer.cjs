// e2e consumer (CommonJS): require() resolves the package's `require` condition, dist/index.cjs.
// VERIFIED: it passes against the packed tarball installed with `bun add` (make e2e).
const assert = require("node:assert/strict");
const morphPkg = require("defuss-morph");

const log = (level, message) => console.log(`${new Date().toISOString()} ${level} e2e.consumer.cjs ${message}`);

(async () => {
  assert.equal(typeof morphPkg.morph, "function");
  const { Window } = await import("happy-dom");
  const window = new Window();
  const app = window.document.createElement("div");
  morphPkg.morph(app, `<p key="x">one</p>`);
  const p = app.firstChild;
  morphPkg.morph(app, `<p key="x">two</p>`);
  assert.equal(app.firstChild, p, "the keyed node is patched, not replaced");
  assert.equal(app.textContent, "two");
  log("INFO", "pass require('defuss-morph') morphs with dist/index.cjs");
})().catch((error) => {
  log("ERROR", `FAIL ${error.message}`);
  process.exit(1);
});
