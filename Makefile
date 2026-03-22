.PHONY: check lint format lint-ts lint-py format-ts format-py complexity docs docs-live docs-clean dev setup test

# --- Quick Start for Development ---

dev: setup
	@echo "=== Development Environment Ready ==="
	@echo ""
	@echo "Next steps:"
	@echo "  - Run tests:     make test"
	@echo "  - Build plugin:  cd nemoclaw && npm run build"
	@echo "  - Lint code:     make lint"
	@echo "  - Format code:   make format"
	@echo "  - Build docs:    make docs"
	@echo ""

setup:
	@echo "=== Setting up NemoClaw development environment ==="
	@echo ""
	@echo "[1/4] Installing TypeScript dependencies..."
	cd nemoclaw && npm install
	@echo ""
	@echo "[2/4] Installing Python documentation dependencies..."
	pip install uv || echo "uv not installed, skipping Python deps (optional for docs)"
	uv sync --group docs 2>/dev/null || echo "Skipping docs dependencies (optional)"
	@echo ""
	@echo "[3/4] Installing pre-commit hooks..."
	pip install pre-commit || echo "pre-commit not installed, install manually"
	pre-commit install || echo "Run 'pre-commit install' manually after installing pre-commit"
	@echo ""
	@echo "[4/4] Building TypeScript plugin..."
	cd nemoclaw && npm run build
	@echo ""
	@echo "✓ Setup complete!"

test:
	npm test

# --- Code Quality ---

check: lint-ts lint-py
	@echo "All checks passed."

lint: lint-ts lint-py

complexity:
	@echo "=== TypeScript Complexity Analysis ==="
	cd nemoclaw && npx eslint src/**/*.ts --format unix || true
	@echo ""
	@echo "=== Python Complexity Analysis ==="
	cd nemoclaw-blueprint && ruff check . --select C90 || true

dead-code:
	@echo "=== TypeScript Dead Code Detection ==="
	cd nemoclaw && npm run dead-code || true
	@echo ""
	@echo "=== Python Dead Code Detection ==="
	cd nemoclaw-blueprint && $(MAKE) dead-code || true

duplicates:
	@echo "=== Duplicate Code Detection (All Languages) ==="
	npm run duplicates || true

tech-debt:
	@echo "=== Technical Debt Tracking (TODO/FIXME/HACK markers) ==="
	npm run tech-debt || echo "No technical debt markers found"

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

docs-live:
	uv run --group docs sphinx-autobuild docs docs/_build/html --open-browser

docs-clean:
	rm -rf docs/_build
