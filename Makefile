.PHONY: dev check lint format lint-ts format-ts complexity dead-code duplicates tech-debt docs docs-strict docs-live docs-clean

dev:
	npm install
	cd nemoclaw && npm install && npm run build
	pip install uv && uv sync --group docs 2>/dev/null || true
	@echo "Dev environment ready."

check:
	npx prek run --all-files
	@echo "All checks passed."

lint: check

# Targeted subproject checks (not part of `make check` — use for focused runs).
lint-ts:
	cd nemoclaw && npm run check

format: format-ts

format-ts:
	cd nemoclaw && npm run lint:fix && npm run format

complexity:
	@echo "Checking cyclomatic complexity..."
	cd nemoclaw && npx --yes ts-complex --threshold 15 src/**/*.ts 2>/dev/null || \
	  npx --yes complexity-report --format json src/**/*.ts 2>/dev/null || \
	  echo "Complexity check complete (install ts-complex for full output)"

dead-code:
	@echo "Scanning for dead code..."
	cd nemoclaw && npm run dead-code

duplicates:
	@echo "Scanning for duplicate code..."
	npm run duplicates

tech-debt:
	@echo "Scanning for technical debt markers..."
	npm run tech-debt

# --- Documentation ---

docs:
	uv run --group docs sphinx-build -b html docs docs/_build/html

docs-strict:
	uv run --group docs sphinx-build -W -b html docs docs/_build/html

docs-live:
	uv run --group docs sphinx-autobuild docs docs/_build/html --open-browser

docs-clean:
	rm -rf docs/_build
