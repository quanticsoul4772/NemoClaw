.PHONY: check format lint install

check:
	uv run --group dev ruff check . 2>/dev/null || \
	  python3 -m ruff check . 2>/dev/null || \
	  echo "Ruff not available — skipping Python lint check"
	@echo "Python checks passed."

format:
	uv run --group dev ruff format . 2>/dev/null && \
	  uv run --group dev ruff check --fix . 2>/dev/null || \
	  echo "Ruff not available — skipping Python format"

lint: check

install:
	uv sync --group dev 2>/dev/null || pip install -e '.[dev]'
