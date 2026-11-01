# defuss-morph: the defuss-vae verbs for humans, agents and CI (`make` lists them).
# Recipes delegate to package.json scripts or scripts/, so there is one source of truth per step.

.DEFAULT_GOAL := help
.PHONY: help setup build docs lint typecheck test test-watch coverage e2e verify \
	start stop restart status log metrics bench purge-cdn clean

E2E := tmp/e2e
# the consumer's server-side DOM: the same happy-dom version the unit tests run on
HAPPY_DOM = $(shell node -p "require('./node_modules/happy-dom/package.json').version")
# the store the consumer drives reactive() with: the version bun.lock pins for the tests
STORE = $(shell node -p "require('./node_modules/defuss-store/package.json').version")

help: ## Show available targets
	@grep -E '^[a-zA-Z0-9_ -]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "  \033[36m%-24s\033[0m %s\n", $$1, $$2}'

setup: ## Install bun dependencies (frozen lockfile) and the Playwright Chromium browser
	bun install --frozen-lockfile
	bunx playwright install $(if $(CI),--with-deps) chromium

# dist/ is committed (GitHub ZIP download, jsDelivr /gh/), so every build rewrites it from src/.
build: ## Compile (pkgroll) → CDN bundle → minify → sizes → website copies → dist consistency check
	bun run build
	bun run bundle
	bun run minify
	bun run stats
	bun run docs
	bun run check:dist

docs: build ## Refresh docs/ (static website) from a fresh build

lint: ## oxlint (warnings fail) + strict tsc type-check
	bun run lint
	bun run typecheck

typecheck: ## Strict tsc type-check (no emit)
	bun run typecheck

test: ## Unit + browser tests: happy-dom and real Chromium (Vitest projects)
	bun run test

test-watch: ## Tests in watch mode
	bun run test:watch

coverage: ## Tests with merged v8 coverage (prints the `All files` table)
	bun run coverage

# e2e consumes the publishable artifact like a user: the packed tarball in a clean
# project (Node ESM + CJS, server-side DOM), then the website and every example page
# in Chromium. Evidence lands in output/.
e2e: build ## Pack → install the tarball in a clean consumer → Node + Chromium checks → output/
	rm -rf $(E2E) && mkdir -p $(E2E)/consumer output
	bun pm pack --destination $(E2E) --quiet
	cp scripts/e2e/consumer.mjs scripts/e2e/consumer.cjs scripts/e2e/consumer.tsx scripts/e2e/reorder-matrix.mjs $(E2E)/consumer/
	cp scripts/e2e/tsconfig.consumer.json $(E2E)/consumer/tsconfig.json
	cd $(E2E)/consumer && printf '{ "name": "consumer", "private": true, "type": "module" }\n' > package.json \
		&& bun add --silent ../defuss-morph-*.tgz happy-dom@$(HAPPY_DOM) defuss-store@$(STORE)
	cd $(E2E)/consumer && node consumer.mjs ../../../output/e2e-consumer.json && node consumer.cjs
	cd $(E2E)/consumer && $(CURDIR)/node_modules/.bin/tsc -p tsconfig.json && echo "$$(date -u +%FT%TZ) INFO e2e.consumer.tsx pass JSX type-checks against the packed declarations"
	node scripts/e2e/browser.mjs

verify: lint test coverage e2e ## What CI runs: every gate verb, cheapest first

# The one service: scripts/serve.mjs serves the repo root (website at /docs/, examples at /examples/) with the
# committed build; run `make build` and reload to see source changes. Detached, so a closed shell cannot kill it.
PORT ?= 4173
SVC := docs
PID := tmp/$(SVC).pid
RUNNING = [ -f $(PID) ] && kill -0 $$(cat $(PID)) 2>/dev/null

start: ## Dev server for the website + examples: http://127.0.0.1:$(PORT)/docs/ (PORT=… to change)
	@mkdir -p var/log tmp
	@if $(RUNNING); then echo "running pid=$$(cat $(PID)) (make status)"; exit 0; fi; \
	nohup node scripts/serve.mjs $(PORT) >> var/log/$(SVC).stdout 2>> var/log/$(SVC).stderr & echo $$! > $(PID); \
	for i in $$(seq 50); do curl -sf -o /dev/null http://127.0.0.1:$(PORT)/docs/ && break; \
		kill -0 $$(cat $(PID)) 2>/dev/null || break; sleep 0.1; done; \
	if $(RUNNING); then echo "started pid=$$(cat $(PID)) url=http://127.0.0.1:$(PORT)/docs/"; \
	else rm -f $(PID); tail -n 3 var/log/$(SVC).stderr; exit 1; fi

stop: ## Stop the dev server (SIGTERM, waits for exit)
	@if $(RUNNING); then pid=$$(cat $(PID)); kill $$pid; \
		for i in $$(seq 50); do kill -0 $$pid 2>/dev/null || break; sleep 0.1; done; echo "stopped pid=$$pid"; \
	else echo "not running"; fi; rm -f $(PID)

restart: stop start ## Restart the dev server

status: ## Dev server state and URL
	@if $(RUNNING); then echo "running pid=$$(cat $(PID)) $$(grep ' listening ' var/log/$(SVC).stdout | tail -n 1 | grep -o 'url=[^ ]*')"; \
	else echo "stopped"; fi

log: ## Last 40 lines of the dev server log (stdout, stderr)
	@tail -n 40 var/log/$(SVC).stdout var/log/$(SVC).stderr 2>/dev/null || echo "no log yet (make start)"

metrics: ## Print the measured artifact sizes (dist/stats.json)
	@cat dist/stats.json

bench: build ## The website's benchmark in headless Chromium → table + output/bench.json
	node scripts/bench.mjs

purge-cdn: ## Purge the jsDelivr @latest cache for the CDN assets (after npm publish)
	bun run purge-cdn

clean: ## Remove dist/, coverage/, vite caches and e2e scratch
	bun run clean
	rm -rf $(E2E)
