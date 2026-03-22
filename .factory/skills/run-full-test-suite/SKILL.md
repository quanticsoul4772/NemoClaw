---
name: run-full-test-suite
description: Execute the complete test suite including unit tests, integration tests, and generate coverage reports. Use when validating changes, before commits, or verifying test health. Trigger keywords - run tests, test suite, coverage, verify tests, test all.
---

# Run Full Test Suite

Execute all tests (unit and integration) with coverage reporting to verify code changes and ensure quality.

## Prerequisites

- You must be in the NemoClaw repository root
- Node.js 20+ must be installed
- Dependencies must be installed (`npm install`)

## When to Use

- **Before committing** - Verify your changes don't break existing functionality
- **After pulling changes** - Ensure the codebase still works after merging
- **Before creating a PR** - Validate all tests pass
- **When debugging test failures** - Run full suite to identify scope of issues
- **To check coverage** - Ensure new code is adequately tested

## Test Suite Structure

NemoClaw has two types of tests:

1. **Unit Tests** - Fast, isolated tests in `test/*.test.js`
   - CLI command tests
   - Preflight check tests
   - Policy management tests
   - Metrics and logging tests
   - Sentry integration tests

2. **Integration Tests** - Slower, end-to-end tests in `test/integration/*.test.js`
   - CLI workflow tests (full command execution)
   - Blueprint runner tests
   - Policy workflow tests

## Quick Commands

### Run All Tests (Recommended)

```bash
# Run both unit and integration tests in parallel
npm run test:all
```

This executes:
- All unit tests in `test/*.test.js`
- All integration tests in `test/integration/*.test.js`
- Parallel execution with concurrency=4 for speed

### Run Only Unit Tests

```bash
# Fast unit tests only (default)
npm test
```

### Run Only Integration Tests

```bash
# Slower integration tests only
npm run test:integration
```

### Run Tests Serially (Debugging)

```bash
# One test at a time for debugging
npm run test:serial
```

Use this when:
- Tests are failing intermittently
- You need detailed output for a specific test
- Debugging test isolation issues

### Generate Coverage Report

```bash
# Run tests with coverage analysis
npm run test:coverage
```

This generates:
- **Coverage summary** in terminal (lines, functions, branches, statements)
- **HTML report** in `coverage/lcov-report/index.html`
- **lcov.info** file for CI integration

### Check Test Timing

```bash
# Show test duration for each file
npm run test:timing
```

Use this to identify slow tests that need optimization.

## Interpreting Results

### Success

```
✔ test/cli.test.js (5 tests) 234ms
✔ test/preflight.test.js (3 tests) 156ms
✔ test/metrics.test.js (11 tests) 289ms
...
tests 42
suites 11
pass 42
```

All tests passed! ✅

### Failure

```
✖ test/cli.test.js (5 tests | 1 failed) 234ms
  ✔ should register commands
  ✖ should execute onboard command
    AssertionError: Expected status 0, got 1
```

A test failed - investigate the specific test and fix the issue.

### Coverage Thresholds

The repository requires minimum coverage (configured in `.c8rc.json`):
- **Statements**: 80%
- **Branches**: 80%
- **Functions**: 80%
- **Lines**: 80%

If coverage falls below these thresholds, add tests for uncovered code.

## Troubleshooting

### Tests Hanging

If tests hang or take too long:

```bash
# Check for tests waiting on timeouts or promises
npm run test:serial
```

Look for:
- Unresolved promises
- Missing `await` keywords
- Long timeouts in tests

### Import/Module Errors

```bash
# Rebuild TypeScript plugin first
cd nemoclaw && npm run build && cd ..
npm test
```

### Flaky Tests

If tests pass/fail inconsistently:

```bash
# Run multiple times to identify flakiness
for i in {1..5}; do npm test; done
```

Then:
1. Check for shared state between tests
2. Verify test isolation
3. Look for race conditions
4. Check external dependencies (filesystem, network)

## Integration with CI

These test commands are used in CI pipelines:

```yaml
# GitHub Actions example
- name: Run tests
  run: npm run test:all

- name: Check coverage
  run: npm run test:coverage
```

## Best Practices

1. **Run tests before committing** - Catch issues early
2. **Keep tests fast** - Unit tests should complete in seconds
3. **Maintain isolation** - Tests shouldn't depend on execution order
4. **Write descriptive test names** - Make failures easy to understand
5. **Keep coverage high** - Aim for >90% coverage on critical code

## Related Commands

- `make check` - Run linting + formatting + type checking (no tests)
- `make lint` - Run linters only
- `pre-commit run --all-files` - Run pre-commit hooks including tests

## Example Workflow

```bash
# 1. Make code changes
vim bin/lib/metrics.js

# 2. Run relevant unit tests quickly
npm test test/metrics.test.js

# 3. Fix issues, run full suite
npm run test:all

# 4. Check coverage
npm run test:coverage
open coverage/lcov-report/index.html

# 5. Verify timing
npm run test:timing

# 6. All good? Commit!
git add -A
git commit -m "feat: improve metrics collection"
```

## Success Criteria

✅ All tests pass (exit code 0)  
✅ Coverage meets thresholds (≥80%)  
✅ No flaky or hanging tests  
✅ Test duration is reasonable (<30s for unit, <2min for integration)

When all criteria are met, your changes are ready for commit/PR! 🎉
