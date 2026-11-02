# Episodes

<!-- Newest last. The gate appends FAIL|DONE|FINDING; past 100 entries it trims only its own oldest DONE|FAIL|learned
FINDING (git keeps them). Leads (LESSON, FINDING learn=none) stay until wrap settles them; doctor fails above 30.
Agents append `<UTC ISO> s=<session> LESSON <VAE-DIALECT>` only for a falsified HYPOTHESIS, a dead end, or a root cause.
Session start injects the 3 newest open entries: LESSON, FINDING learn=none, FAIL without a later DONE.
Wrap: EVERY lead becomes a test | .vae/VERIFY.py rule | one MEMORY line with BC, then delete; OR delete BC evidence. -->

2026-10-31T17:16:27Z s=7952b03c FINDING src/renderer.ts:handleLifecycleEventsForOnMount learn=test: renderer.test.ts 'fires onUnmount once, with the latest handler, after in-place morphs' + re-arm test
2026-10-31T17:16:27Z s=7952b03c FINDING src/renderer.ts:setAttribute(ref) learn=test: renderer.test.ts 'fires onUnmount declared before ref'
2026-10-31T17:16:27Z s=7952b03c FINDING src/html.ts:htmlStringToVNodes learn=test: html.test.ts context-dependent tags + morph-diff.test.ts table rows (both environments)
2026-10-31T17:16:27Z s=7952b03c FINDING src/renderer.ts:createElementOrElements learn=test: renderer.test.ts + morph-edge.test.ts 'renders text input as a text node'
2026-10-31T17:16:27Z s=7952b03c FINDING src/morph.ts:replaceDomWithVdom learn=test: morph-edge.test.ts 'clears delegated handlers and runs clear hooks for removed elements'
2026-10-31T17:16:27Z s=7952b03c FINDING src/transitions.ts:performCrossfade learn=test: transitions.browser.test.ts 'places the snapshot over the element on a scrolled page'
2026-10-31T17:16:27Z s=7952b03c FINDING src/index.ts:morph learn=test: transitions.test.ts detached root returns a Promise
2026-10-31T17:16:27Z s=7952b03c FINDING src/renderer.ts:createElement catch learn=verifier: .vae/VERIFY.py rule src.no-console
2026-10-31T17:16:27Z s=7952b03c FINDING src/*.test.ts vi.fn/vi.spyOn learn=verifier: existing tests.no-mocks rule now passes
2026-10-31T17:16:27Z s=7952b03c FINDING Makefile:e2e learn=verifier: gate tests.e2e.evidence + scripts/e2e/*
2026-10-31T17:16:27Z s=7952b03c FINDING tsconfig.json learn=none: one-time extraction defect; typecheck in make lint catches recurrence
2026-10-31T17:16:27Z s=7952b03c FINDING README.md learn=verifier: scripts/check-dist.ts keeps README and docs size figures fresh
2026-10-31T17:16:27Z s=7952b03c FINDING morph()@Chromium script execution learn=memory: .vae/MEMORY.md line; decision left to the maintainer
2026-11-01T01:55:34Z s=7952b03c DONE fp=010d6e4d8166 cov=97.5% paths=.github/workflows/verify.yml,AGENTS.md,ARCH.md,Makefile(+53)
2026-11-01T01:55:34Z s=7952b03c FINDING scripts/serve.mjs:createStaticServer learn=test: scripts/serve.test.ts 'keeps serving after a file fails to read' times out on the old code and passes now
2026-11-01T02:00:59Z s=7952b03c DONE fp=4e1dc64a430a cov=97.5% paths=.github/workflows/verify.yml,AGENTS.md,ARCH.md,Makefile(+55)
2026-11-01T02:14:56Z s=7952b03c FAIL env.example
2026-11-01T02:17:35Z s=7952b03c DONE fp=fca0a6dbe014 cov=97.5% paths=.github/workflows/verify.yml,AGENTS.md,ARCH.md,Makefile(+57)
2026-11-01T02:17:35Z s=7952b03c FINDING docs/assets/site.js:engines|scenarios learn=test: scripts/e2e/browser.mjs checks the selected tab and pressed engine after clicks, after a second click and after arrow keys; MEMORY line records the ownership ru
2026-11-01T02:17:35Z s=7952b03c FINDING docs/index.html:#next-html|#call learn=test: e2e: the editor colors typed text; every code element on the page carries tokens with >= 4.5:1 contrast in both schemes
2026-11-01T02:17:35Z s=7952b03c FINDING docs/assets/site.css:.tab-list learn=test: e2e: no tab label is cut and no horizontal scroll at 375 px
2026-11-01T02:29:24Z s=7952b03c DONE fp=58ae762c8ff9 cov=97.5% paths=.github/workflows/verify.yml,AGENTS.md,ARCH.md,Makefile(+57)
2026-11-01T02:33:53Z s=7952b03c DONE fp=bebfa4d7ecaa cov=97.4% paths=ARCH.md,README.md,docs/assets/defuss-morph.min.js,docs/assets/defuss-morph.mjs(+4)
2026-11-01T02:33:53Z s=7952b03c FINDING src/morph.ts:moveNode|morphDomDirect learn=test: src/morph.browser.test.ts: focused input with a backward selection moved to the front keeps focus, value and selection, with and without moveBefore (both failed
2026-11-01T02:39:39Z s=7952b03c DONE fp=f46379fafc9a cov=97.4% paths=ARCH.md,README.md,docs/assets/defuss-morph.min.js,docs/assets/defuss-morph.mjs(+5)
2026-11-01T02:39:39Z s=7952b03c FINDING docs/assets/site.js:apply|reset|example learn=test: scripts/e2e/browser.mjs: editor starts with the stage markup; Apply runs exactly an edited rename and keeps the text; a second Apply creates and removes nothing
2026-11-01T14:44:39Z s=97c0601e DONE fp=3fffd0b83efe cov=97.6% paths=.claude-plugin/marketplace.json,.claude-plugin/plugin.json,.codex-plugin/plugin.json,AGENTS.md(+59)
2026-11-01T14:44:39Z s=97c0601e FINDING src/html.ts:domNodeToVNode; src/renderer.ts:createElement; src/morph.ts:morphDomDirect learn=test: src/morph-edge.test.ts '<template> content' (parse, create, patch, identity) and the i18n case in src/reactive.test.ts, in happy-dom and Chromium
2026-11-01T14:44:39Z s=97c0601e FINDING src/renderer.ts:handleLifecycleEventsForOnMount learn=test: src/reactive.test.ts 'leaving the document ... onUnmount' asserts onUnmount.calls equals [[aside]]
2026-11-01T14:44:39Z s=97c0601e FINDING src/reactive.ts:toChildren learn=test: src/reactive.test.ts deletes globalThis.DOMParser and checks plain text renders, markup throws; scripts/e2e/consumer.mjs covers it from the tarball
2026-11-01T14:44:39Z s=97c0601e FINDING src/jsx.ts:jsx learn=test: src/jsx.test.ts 'keys a copy' calls one shared-VNode component with keys a and b and checks the shared object stays unkeyed
2026-11-01T14:44:39Z s=97c0601e FINDING package.json:exports (jsx-runtime) learn=test: scripts/e2e/consumer.mjs/.cjs assert the subpaths resolve to the same jsx; consumer.tsx type-checks JSX against the packed declarations; check-dist lists the ar
2026-11-01T14:44:39Z s=97c0601e FINDING scripts/check-dist.ts:SSR-safety check learn=verifier: check-dist runs in every make build
2026-11-01T14:44:39Z s=97c0601e FINDING scripts/e2e/browser.mjs:examples learn=test: 'examples: every page has a scenario' fails for a page without one
2026-11-01T14:44:39Z s=97c0601e FINDING scripts/e2e/browser.mjs:sameNode/sameNodeIn learn=none: one-off duplication removed; the docs checks call sameNodeIn/stillSameIn
2026-11-01T14:44:39Z s=97c0601e FINDING README.md:Agent skill; docs/index.html:#skill (B06) learn=none: editorial; vae prose static check has no rule for unmeasured outcome promises
2026-11-01T14:44:39Z s=97c0601e FINDING docs/index.html:#patterns-title; skills/defuss-morph/references/patterns.md:3 (B05) learn=none: editorial
2026-11-01T14:44:39Z s=97c0601e FINDING docs/index.html:#integrations desc (L01); #in-router lead (P08) learn=none: editorial
2026-11-01T14:44:39Z s=97c0601e FINDING ARCH.md:website paragraph (P06); skills/defuss-morph/references/integrations.md:3 (T04); README.md + SKILL.md reactive timing (P07) learn=none: editorial
2026-11-01T14:44:39Z s=97c0601e FINDING README.md / SKILL.md: 'TypeScript, Bun, esbuild and Vite read these options' learn=test: the TSX consumer in make e2e covers TypeScript; the bundler probes were one-off
2026-11-01T14:44:39Z s=97c0601e FINDING ARCH.md: mermaid flowchart (T07) learn=none: render check done once for this change
2026-11-01T14:44:39Z s=97c0601e FINDING bunfig.toml: install.peer=false learn=none: tests import defuss-query/core and defuss-i18n/core with explicit injection, so no test resolves the bare name
2026-11-01T14:44:39Z s=97c0601e FINDING src/global.ts, src/jsx.ts, src/ref.ts, src/reactive.ts, scripts/check-dist.ts, scripts/e2e/consumer.tsx, docs/demos/index.ts (comments) learn=none: comment-only change
2026-11-01T16:08:34Z s=97c0601e FAIL prose
2026-11-01T16:14:17Z s=97c0601e DONE fp=1f43eee8c349 cov=97.6% paths=.claude-plugin/marketplace.json,.claude-plugin/plugin.json,.codex-plugin/plugin.json,AGENTS.md(+66)
2026-11-01T16:14:17Z s=97c0601e FINDING docs/demos/router.ts:project view learn=test: scripts/e2e/browser.mjs 'a route param from the URL renders as text, never as markup' navigates to #/projects/%3Cb%3Ex%3C%2Fb%3E and asserts no <b> in the headi
2026-11-01T16:14:17Z s=97c0601e FINDING docs/demos/router.ts:renderBar learn=test: e2e checks the address text on start and after navigation; onError makes any router failure a console error, which fails the e2e; MEMORY line records the silent
2026-11-01T16:14:17Z s=97c0601e FINDING docs/router.html:theme script learn=none: Does not reproduce headless: Playwright's colorScheme emulation reaches the frame with the old script too (probe 2026-11-01), so a test could not fail on the ol
2026-11-01T16:14:17Z s=97c0601e FINDING docs/demos/router.ts:link learn=test: e2e asserts header nav a[aria-current=page] is exactly Project 7
2026-11-01T16:14:17Z s=97c0601e FINDING docs/index.html:header nav learn=none: visual layout at one width range; no rule kind expresses it and a pixel test would pin one viewport
2026-11-01T16:14:17Z s=97c0601e FINDING docs/demos/bench-ui.ts:ms + bench.ts:run learn=test: e2e asserts every cell matches ^\d+(\.\d)?$ or n/a
2026-11-01T16:14:17Z s=97c0601e FINDING ARCH.md:Complexity learn=verifier: the prose gate rejects HYPOTHESIS claims in ARCH.md
2026-11-01T16:14:17Z s=97c0601e FINDING docs/assets/frame-theme.js, docs/demos/bench*.ts, scripts/bench.mjs (comments) learn=none: comment-only change; the docs gate already enforces it
2026-11-01T18:57:53Z s=97c0601e DONE fp=ca1fe0fd0946 cov=97.7% paths=.claude-plugin/marketplace.json,.claude-plugin/plugin.json,.codex-plugin/plugin.json,AGENTS.md(+70)
2026-11-01T18:57:53Z s=97c0601e FINDING src/morph.ts:morphDomDirect consumeKeyedNode learn=test: morph-edge.test.ts 'removes a node whose id another, matched node also carries' failed before the fix; morph-reorder.test.ts model checks 900+ chains
2026-11-01T18:57:53Z s=97c0601e FINDING src/morph.ts:morphDomDirect placement learn=test: morph-reorder.test.ts move counts vs an independent quadratic count (ops + 160 random chains, both placements paths); reorder-matrix.mjs checks the same in the 
2026-11-01T18:57:53Z s=97c0601e FINDING src/morph.ts:morphDomDirect placement (interim order) learn=none: not a defect: final DOM, reused nodes, hook order and state are pinned by tests; the interim order has no contract
2026-11-01T18:57:53Z s=97c0601e FINDING scripts/e2e/reorder-matrix.mjs:runOp learn=none: the e2e run itself fails on it
2026-11-01T18:57:53Z s=97c0601e FINDING src/morph.ts:764 + src/morph-reorder.test.ts:187 learn=verifier: make lint enforces both
2026-11-01T18:57:53Z s=97c0601e FINDING src/morph-reorder.test.ts:header; ARCH.md:13 learn=none: editorial
2026-11-01T18:57:53Z s=97c0601e FINDING docs/router.html (user report: empty card) learn=memory: MEMORY line: file:// blocks modules; the server log shows whether a browser fetched the current build
2026-11-01T18:57:53Z s=97c0601e FINDING src/lis.ts learn=test: lis.test.ts
2026-11-01T19:23:01Z s=97c0601e DONE fp=a7626b4c273d cov=97.7% paths=.claude-plugin/marketplace.json,.claude-plugin/plugin.json,.codex-plugin/plugin.json,AGENTS.md(+71)
2026-11-01T19:23:01Z s=97c0601e FINDING src/html.ts:domNodeToVNode type learn=test: morph.test.ts 'creates camelCase SVG elements ...' failed in happy-dom and Chromium before the fix; browser.mjs checks the built bundle yields SVGLinearGradient
2026-11-01T19:23:01Z s=97c0601e FINDING src/html.ts:htmlStringToVNodes learn=none: behaviour pinned by the existing HTML-string tests (all pass); a timing test would pin a machine
2026-11-01T19:23:01Z s=97c0601e FINDING src/html.ts:domNodeToVNode children/attributes learn=none: covered by html.test.ts and every HTML-string morph test
2026-11-01T19:23:01Z s=97c0601e FINDING src/morph.ts:patchByPosition learn=test: morph-reorder.test.ts sameShapeEdits: 250 seeds x 2 inputs + parsed-first + onMount order against the model; it passed before the fast path existed
2026-11-01T19:23:01Z s=97c0601e FINDING src/renderer.ts:setAttribute regex; skip same-value attribute writes learn=none: rejected by measurement
2026-11-01T19:23:01Z s=97c0601e FINDING src/html.ts:129 attributes type learn=verifier: make lint runs tsc
2026-11-01T19:44:44Z s=97c0601e DONE fp=04593f0c9c28 cov=97.7% paths=.claude-plugin/marketplace.json,.claude-plugin/plugin.json,.codex-plugin/plugin.json,AGENTS.md(+72)
2026-11-01T19:44:44Z s=97c0601e FINDING comments (user question: does morph eat comments?) learn=test: morph-comments.test.ts: 14 positions + 7 updates + the full-document rule
2026-11-01T19:44:44Z s=97c0601e FINDING docs/demos/bench.ts:Op.steps + rerender op learn=test: browser.mjs: the table has bench.ops.length (10) rows, every cell a time or n/a, VNode run returns ops*4 ok results
2026-11-01T19:44:44Z s=97c0601e FINDING scripts/e2e/browser.mjs:benchmark counts learn=none: the check itself fails on a mismatch
2026-11-01T19:53:43Z s=97c0601e DONE fp=a1025dd117fc cov=97.7% paths=.claude-plugin/marketplace.json,.claude-plugin/plugin.json,.codex-plugin/plugin.json,AGENTS.md(+72)
2026-11-01T19:53:43Z s=97c0601e FINDING src/morph.ts:patchByPosition (keyed variant) learn=none: a single benchmark run is not evidence for a gap; ARCH.md already records up to 28% run-to-run variance
2026-11-01T20:00:02Z s=97c0601e DONE fp=7efb5786a17a cov=97.7% paths=.claude-plugin/marketplace.json,.claude-plugin/plugin.json,.codex-plugin/plugin.json,AGENTS.md(+73)
2026-11-01T20:00:02Z s=97c0601e FINDING docs/index.html:hero badge + footer note learn=test: scripts/lib/version.test.ts failed (0.2.0 vs 0.3.0) before the fix; AGENTS.md names it with the release steps
2026-11-01T20:09:13Z s=97c0601e FAIL tests.e2e.1
2026-11-01T20:15:09Z s=97c0601e DONE fp=0c7488fe312b cov=97.7% paths=.claude-plugin/marketplace.json,.claude-plugin/plugin.json,.codex-plugin/plugin.json,AGENTS.md(+78)
2026-11-01T20:15:09Z s=97c0601e FINDING scripts/lib/bench-page.ts:formatMs/cell learn=test: bench-page.test.ts 'keeps one decimal in a fine-timer table even for whole medians, and none in WebKit's'
2026-11-01T20:15:09Z s=97c0601e FINDING scripts/lib/bench-page.ts:coverageBlock learn=test: bench-page.test.ts expects 97 for 97.74
2026-11-01T20:15:09Z s=97c0601e FINDING scripts/e2e/browser.mjs (gate run during make bench) learn=none: the check itself guards an empty or partial block
2026-11-01T20:15:09Z s=97c0601e FINDING scripts/coverage-page.ts + Makefile coverage learn=none: observed: 'unchanged docs/index.html' on the repeat run
2026-11-01T20:15:09Z s=97c0601e FINDING scripts/bench.mjs learn=test: bench-page.test.ts: benchBlock throws on a wrong result; make bench ran with both browsers (exit 0)
2026-11-01T20:15:09Z s=97c0601e FINDING docs/index.html eyebrows learn=test: browser.mjs checks every section header starts with a badge with an icon and every <use href> resolves
2026-11-01T20:15:09Z s=97c0601e FINDING CHANGELOG.md learn=test: version.test.ts: top entry equals package.json version, files contains CHANGELOG.md
2026-11-01T20:31:54Z s=97c0601e FAIL tests.e2e.1
2026-11-01T20:38:20Z s=97c0601e DONE fp=690ac8983e74 cov=97.7% paths=.claude-plugin/marketplace.json,.claude-plugin/plugin.json,.codex-plugin/plugin.json,AGENTS.md(+78)
2026-11-01T20:38:20Z s=97c0601e FINDING vitest.config.ts browser instances + package.json coverage learn=verifier: make verify runs both; a coverage run including Firefox fails at startup
2026-11-01T20:38:20Z s=97c0601e FINDING scripts/e2e/browser.mjs library block learn=test: output/e2e-browser.json
2026-11-01T20:38:20Z s=97c0601e FINDING make bench run overlapped by the Stop hook's make verify learn=memory: .vae/MEMORY.md line: run make bench in the foreground
2026-11-01T20:38:20Z s=97c0601e FINDING scripts/lib/bench-page.ts note learn=test: bench-page.test.ts expects 'Firefox and WebKit count whole milliseconds.'
2026-11-01T21:06:53Z s=97c0601e DONE fp=f6ecdfd38875 cov=97.7% paths=.claude-plugin/marketplace.json,.claude-plugin/plugin.json,.codex-plugin/plugin.json,AGENTS.md(+78)
2026-11-01T21:06:53Z s=97c0601e FINDING docs/assets/site.css:.dm-eyebrow learn=test: browser.mjs 'each section badge lines up with its title'
2026-11-01T23:03:55Z s=97c0601e DONE fp=430815389323 cov=97.7% paths=.claude-plugin/marketplace.json,.claude-plugin/plugin.json,.codex-plugin/plugin.json,AGENTS.md(+78)
2026-11-01T23:03:55Z s=97c0601e FINDING docs/index.html header + sheet: npm link learn=test: version.test.ts pins both badges and labels to package.json; browser.mjs checks both links and their version
2026-11-01T23:03:55Z s=97c0601e FINDING docs/assets/site.css header breakpoint learn=test: browser.mjs 'the header fits from 375 to 1,440 px' checks the widths around each breakpoint
2026-11-02T01:08:03Z s=97c0601e FAIL prose
2026-11-02T01:10:50Z s=97c0601e DONE fp=458f3e9b68a5 cov=97.7% paths=.claude-plugin/marketplace.json,.claude-plugin/plugin.json,.codex-plugin/plugin.json,AGENTS.md(+78)
2026-11-02T01:10:50Z s=97c0601e FINDING docs/index.html:1007 T02 learn=verifier: the prose gate rule T02 already catches it
