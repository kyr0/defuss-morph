# Episodes

<!-- Newest last. The gate appends FAIL|DONE|FINDING; past 100 entries it trims only its own oldest DONE|FAIL|learned
FINDING (git keeps them). Leads (LESSON, FINDING learn=none) stay until wrap settles them; doctor fails above 30.
Agents append `<UTC ISO> s=<session> LESSON <VAE-DIALECT>` only for a falsified HYPOTHESIS, a dead end, or a root cause.
Session start injects the 3 newest open entries: LESSON, FINDING learn=none, FAIL without a later DONE.
Wrap: EVERY lead becomes a test | .vae/VERIFY.py rule | one MEMORY line with BC, then delete; OR delete BC evidence. -->

2026-10-31T17:16:27Z s=7952b03c DONE fp=1c82ba717f12 cov=97.5% paths=.github/workflows/verify.yml,AGENTS.md,ARCH.md,Makefile(+51)
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
