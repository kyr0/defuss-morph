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
- VERIFIED[make e2e] needs network: `bun add` of happy-dom in the clean consumer and defuss-shadcn from jsDelivr for docs/ BC scripts/e2e/browser.mjs fails on failed requests
- VERIFIED[docs/assets/site.js@defuss-shadcn 0.9.11] tabs and toggle-group set aria-selected/aria-pressed in their own click handlers; a page handler that also set aria-pressed left no engine or scenario selected BC Chrome probe 2026-11-01
