# CLI gist

<!-- Commands future agents need that the Makefile verbs do not cover (setup, env, data, deploy):
- VERIFIED[purpose] `cmd`: only after an observed success
- UNKNOWN[purpose] BC gap
Budget 2 KiB (`vae.py doctor --repo .`); entries are injected at session start. -->
- VERIFIED[preview website] `make start` → http://127.0.0.1:4173/docs/ and /examples/<name>.html; `make build` + reload for src changes; `make stop`
- VERIFIED[one Vitest file] `bunx vitest run --project browser src/<name>.test.ts` (or `--project node`)
