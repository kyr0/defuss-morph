# Agent memory

<!-- One tagged line per durable fact NOT derivable from code, git or docs:
- VERIFIED[scope] fact BC evidence
- HYPOTHESIS[scope] claim BC observation; falsifier=`cmd`
- UNKNOWN[scope] gap BC missing evidence
[scope] = the narrowest path|module|command|condition the evidence covers, not a topic: the entry decides nothing
outside it, and recurrence inside one subsystem never widens it.
Every line carries its BC and stays within 240 chars. Replace stale lines instead of appending.
Mechanizable lessons belong in tests or .vae/VERIFY.py.
Budget 4 KiB (`vae.py doctor --repo .`); entries are injected at session start. -->
- VERIFIED[src/*.test.ts@happy-dom 20.14.6] `tbody.rows` and `row.cells` are undefined in happy-dom; tests use querySelectorAll BC morph-diff.test.ts failed with TypeError in the node project only
- VERIFIED[morph()@Chromium] a `<script>` in an HTML string executes when morphed in (renderer uses createElement); innerHTML does not run it BC browser probe 2026-10-31
- VERIFIED[make e2e] needs network: `bun add` of happy-dom + defuss-store in the clean consumer, defuss-shadcn from jsDelivr for docs/, defuss-query + defuss-store from jsDelivr for examples/reactive-*.html BC scripts/e2e/browser.mjs fails on failed requests
- VERIFIED[docs/assets/site.js@defuss-shadcn 0.9.11] tabs and toggle-group set aria-selected/aria-pressed in their own click handlers; a page handler that also set aria-pressed left no engine or scenario selected BC Chrome probe 2026-11-01
- VERIFIED[bun install] bun auto-installs peer deps: defuss-query/defuss-i18n pulled npm defuss-morph into node_modules; bunfig.toml `peer = false` keeps it out BC 2026-11-01
- VERIFIED[defuss-dom-router 0.1.1] an error thrown in prepare() or commit() is swallowed silently unless the router has `onError`; docs/demos/router.ts logs it so the e2e (fails on console errors) sees it BC an empty address bar 2026-11-01
- VERIFIED[morph()] a `key` is stored internally, not as a DOM attribute; e2e selectors use `data-*` attributes BC browser.mjs read key=null 2026-11-01
- VERIFIED[docs/ opened as file://] Chromium blocks every module script (CORS, origin null): demos, both frames and site.js stay empty; serve it with `make start`. var/log/docs.stdout shows whether a browser fetched the current build BC probe 2026-11-01
