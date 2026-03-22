.PHONY: lint format check dead-code

lint:
	ruff check .

format:
	ruff format .
	ruff check --fix .

check:
	ruff check .
	ruff format --check .

dead-code:
	vulture . --min-confidence 80
