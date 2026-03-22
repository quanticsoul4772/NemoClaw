.PHONY: lint format check test

lint:
	ruff check .

format:
	ruff format .
	ruff check --fix .

check:
	ruff check .
	ruff format --check .
	uv run --with pyright pyright .

test:
	python -m pytest tests/ -v
