.PHONY: check lint format lint-ts lint-py format-ts format-py test test-js test-py dead-code docs docs-strict docs-live docs-clean

check: lint-ts lint-py
	@echo "All checks passed."

lint: lint-ts lint-py

# --- Testing ---

test: test-js test-py

test-js:
	npm test

test-py:
	cd nemoclaw-blueprint && python -m pytest tests/ -v

# --- Dead code detection ---

dead-code:
	@echo "Checking TypeScript for unused exports..."
	cd nemoclaw && npx tsc --noEmit --noUnusedLocals --noUnusedParameters 2>&1 || true
	@echo ""
	@echo "Checking Python for unused imports..."
	cd nemoclaw-blueprint && ruff check --select F401,F841 .

lint-ts:
	cd nemoclaw && npm run check

lint-py:
	cd nemoclaw-blueprint && $(MAKE) check

format: format-ts format-py

format-ts:
	cd nemoclaw && npm run lint:fix && npm run format

format-py:
	cd nemoclaw-blueprint && $(MAKE) format

# --- Documentation ---

docs:
	uv run --group docs sphinx-build -b html docs docs/_build/html

docs-strict:
	uv run --group docs sphinx-build -W -b html docs docs/_build/html

docs-live:
	uv run --group docs sphinx-autobuild docs docs/_build/html --open-browser

docs-clean:
	rm -rf docs/_build
