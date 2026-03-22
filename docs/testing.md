# Testing Guide

NemoClaw uses the Node.js built-in test runner for unit tests with parallel execution for speed and isolation.

## Test Isolation

Tests are configured for **isolated parallel execution** to ensure:
- Each test file runs independently
- Tests don't share state between files
- Faster execution on multi-core systems
- Reliable, reproducible test results

### Parallel Execution

**Default behavior** (`npm test`):
- Tests run with `--test-concurrency=4`
- Up to 4 test files execute simultaneously
- Provides ~4x speedup on multi-core systems
- Each test file runs in its own process for isolation

**Serial execution** (`npm run test:serial`):
- Tests run with `--test-concurrency=1`
- One test file at a time
- Useful for debugging intermittent failures
- Useful when tests have external dependencies (filesystem, network)

### Running Tests

```bash
# Run all tests in parallel (default, fast)
npm test

# Run tests serially (debugging)
npm run test:serial

# Run specific test file
node --test test/cli.test.js

# Run with coverage (if configured)
node --test --experimental-test-coverage test/*.test.js
```

### Test File Organization

```
test/
├── cli.test.js          # CLI command tests
├── preflight.test.js    # Preflight check tests
├── policy.test.js       # Policy management tests
├── nim.test.js          # NIM integration tests
└── registry.test.js     # Registry tests
```

Each test file is independent and can run in isolation.

### Writing Isolated Tests

**✅ Good - Tests are isolated:**

```javascript
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

describe('Feature X', () => {
  let tempDir;

  before(async () => {
    // Create unique temp directory for this test file
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-'));
  });

  after(async () => {
    // Clean up after tests
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('test case 1', async () => {
    const testFile = path.join(tempDir, 'test1.txt');
    await fs.writeFile(testFile, 'data');
    // Test using isolated temp file
  });

  it('test case 2', async () => {
    const testFile = path.join(tempDir, 'test2.txt');
    await fs.writeFile(testFile, 'data');
    // Each test gets its own file
  });
});
```

**❌ Bad - Tests share global state:**

```javascript
// Don't do this - shared state between test files
let globalCounter = 0;

it('test 1', () => {
  globalCounter++;
  assert.strictEqual(globalCounter, 1); // Fails in parallel!
});

it('test 2', () => {
  globalCounter++;
  assert.strictEqual(globalCounter, 2); // Race condition!
});
```

### Test Isolation Patterns

#### 1. Unique Temporary Directories

Each test file should use its own temporary directory:

```javascript
import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const tempDir = await mkdtemp(join(tmpdir(), 'nemoclaw-test-'));
// Use tempDir for all file operations
// Clean up in after() hook
```

#### 2. Avoid Shared Resources

Don't rely on:
- Global variables across test files
- Shared filesystem locations (use temp directories)
- Hardcoded ports (let OS assign random ports)
- External state (databases, APIs - mock instead)

#### 3. Clean Up After Tests

Always clean up resources:

```javascript
import { describe, after } from 'node:test';

describe('My tests', () => {
  let cleanup = [];

  after(async () => {
    // Clean up all resources
    await Promise.all(cleanup.map(fn => fn()));
  });

  // Register cleanup functions
  cleanup.push(async () => {
    await fs.rm(tempFile, { force: true });
  });
});
```

#### 4. Mock External Dependencies

Use mocks for external services:

```javascript
import { mock } from 'node:test';

// Mock external API
const mockFetch = mock.fn(() => Promise.resolve({
  ok: true,
  json: () => Promise.resolve({ data: 'test' })
}));

globalThis.fetch = mockFetch;
```

### Debugging Parallel Test Failures

If tests pass serially but fail in parallel:

1. **Identify the issue:**
   ```bash
   # Tests fail
   npm test

   # Tests pass
   npm run test:serial
   ```

2. **Common causes:**
   - Shared filesystem locations
   - Shared global variables
   - Port conflicts
   - External service rate limiting

3. **Fix the root cause:**
   - Use unique temp directories
   - Avoid global state
   - Use random ports or mocks
   - Isolate external dependencies

4. **Verify the fix:**
   ```bash
   # Run multiple times to catch race conditions
   npm test && npm test && npm test
   ```

### Performance Considerations

**Parallel execution speedup:**
- 1 test file: No benefit
- 2-4 test files: ~2-4x faster
- 8+ test files: ~4x faster (limited by concurrency=4)

**When to use serial execution:**
- Debugging intermittent failures
- Tests have external rate limits
- Investigating test interactions

**Optimizing test speed:**
- Keep test files focused (one feature per file)
- Minimize slow operations (network, disk I/O)
- Use mocks for external services
- Parallelize within test files using Promise.all()

### Test Isolation Verification

To verify tests are properly isolated:

```bash
# Run tests multiple times - should always pass
for i in {1..10}; do npm test; done

# Run tests in random order (Node.js does this by default)
npm test

# Run tests with different concurrency levels
node --test --test-concurrency=1 test/*.test.js
node --test --test-concurrency=2 test/*.test.js
node --test --test-concurrency=8 test/*.test.js
```

If tests pass consistently regardless of:
- Execution order
- Concurrency level
- Number of runs

Then they are properly isolated! ✅

### For Autonomous Agents

**When writing new tests:**
1. Use unique temp directories for file operations
2. Avoid global state or shared resources
3. Clean up in `after()` hooks
4. Run `npm test` to verify parallel execution works
5. If failures occur, use `npm run test:serial` to debug

**When modifying existing tests:**
1. Ensure changes don't introduce shared state
2. Run tests multiple times to catch race conditions
3. Verify both `npm test` and `npm run test:serial` pass

**Best practices:**
- Each test file should be completely independent
- Use mocks for external dependencies
- Prefer functional/pure test helpers over stateful ones
- Document any unavoidable shared resources

## Test Performance Tracking

Test performance is automatically tracked and measured to ensure tests stay fast and identify performance regressions.

### Why Track Test Performance?

- **Prevent slowdowns**: Catch performance regressions before they accumulate
- **Identify bottlenecks**: Find slow tests that need optimization
- **Monitor trends**: Track whether test suite is getting slower over time
- **CI efficiency**: Faster tests = faster feedback loops
- **Developer experience**: Fast tests encourage running them frequently

### Viewing Test Timing

**Default output** (`npm test`):
```bash
npm test
# Shows pass/fail with total duration at end
# ✓ tests 52
# ✓ suites 17
# ✓ pass 51
# ✓ duration_ms 2105.7423
```

**Detailed timing** (`npm run test:timing`):
```bash
npm run test:timing
# Shows duration for each test and suite:
# ✓ validates config schema (12.4ms)
# ✓ handles missing fields gracefully (3.2ms)
# ✓ policy management (45.8ms)
```

**Per-test duration in default TAP output:**
Each test includes `duration_ms` in YAML metadata:
```
ok 1 - test name
  ---
  duration_ms: 12.4567
  ...
```

### Performance Metrics

**Current baseline** (as of 2026-03-22):
- **Total duration**: ~2.1 seconds
- **Number of tests**: 52 tests across 17 suites
- **Average per test**: ~40ms
- **Slowest suite**: ~500ms
- **Concurrency**: 4 parallel test files

### Identifying Slow Tests

**1. Run with spec reporter for detailed timing:**
```bash
npm run test:timing | grep "duration"
```

**2. Look for tests >100ms:**
```bash
npm run test:timing 2>&1 | grep -E "\([0-9]{3,}ms\)"
```

**3. Run specific test file to isolate:**
```bash
node --test --test-reporter=spec test/slow-file.test.js
```

### Performance Thresholds

**Recommended limits:**
- **Individual test**: < 100ms (fast unit tests)
- **Test file**: < 1000ms (1 second max per file)
- **Full suite**: < 5 seconds (for quick feedback)
- **Per-test average**: < 50ms

**Current status:** ✅ All thresholds met!
- Individual tests: Mostly < 50ms
- Test files: All < 1000ms
- Full suite: ~2.1 seconds
- Average: ~40ms per test

### Monitoring Test Performance Over Time

**1. Track in CI:**

The Node.js test runner outputs duration in TAP format, which CI systems can parse:

```yaml
# GitHub Actions example (.github/workflows/test.yml)
- name: Run tests
  run: npm test > test-results.tap

- name: Upload test results
  uses: actions/upload-artifact@v3
  with:
    name: test-results
    path: test-results.tap
```

**2. Compare against baseline:**

```bash
# Save current timing as baseline
npm run test:timing > baseline-timing.txt

# Later, compare
npm run test:timing > current-timing.txt
diff baseline-timing.txt current-timing.txt
```

**3. Fail on performance regression:**

```bash
# Extract total duration
DURATION=$(npm test 2>&1 | grep "duration_ms" | tail -1 | grep -oE '[0-9]+\.[0-9]+')

# Fail if > 5000ms (5 seconds)
if (( $(echo "$DURATION > 5000" | bc -l) )); then
  echo "Tests too slow: ${DURATION}ms > 5000ms"
  exit 1
fi
```

### Optimizing Slow Tests

**Common causes of slow tests:**
1. **Synchronous operations**: Use async/await properly
2. **Unnecessary delays**: Remove `setTimeout` or reduce duration
3. **External services**: Mock API calls, don't hit real endpoints
4. **Large data sets**: Use minimal test data
5. **Complex setup**: Move shared setup to `before()` hooks
6. **Inefficient assertions**: Simplify complex assertions

**Example optimization:**

```javascript
// ❌ Slow - sleeps for 100ms per test
it('waits unnecessarily', async () => {
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.ok(true);
});

// ✅ Fast - no unnecessary delays
it('tests immediately', () => {
  assert.ok(true);
});

// ❌ Slow - hits real API
it('calls real API', async () => {
  const data = await fetch('https://api.example.com/data');
  assert.ok(data);
});

// ✅ Fast - mocks the API
import { mock } from 'node:test';
it('calls mocked API', async () => {
  const mockFetch = mock.fn(() => Promise.resolve({ ok: true }));
  globalThis.fetch = mockFetch;
  const data = await fetch('https://api.example.com/data');
  assert.ok(data);
});
```

### CI Integration for Performance Tracking

**GitHub Actions example:**

```yaml
name: Test Performance
on: [push, pull_request]

jobs:
  test-performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Install dependencies
        run: npm install

      - name: Run tests with timing
        run: |
          npm run test:timing > test-output.txt 2>&1 || true

      - name: Extract and display timing
        run: |
          echo "=== Test Performance Metrics ==="
          grep "duration_ms" test-output.txt | tail -1
          echo ""
          echo "=== Slowest Tests ==="
          grep -oP '\(.*\d{2,}ms\)' test-output.txt | sort -rn | head -10

      - name: Check performance threshold
        run: |
          DURATION=$(grep "duration_ms" test-output.txt | tail -1 | grep -oE '[0-9]+\.[0-9]+')
          echo "Total duration: ${DURATION}ms"
          if (( $(echo "$DURATION > 5000" | bc -l) )); then
            echo "❌ Tests exceeded 5000ms threshold!"
            exit 1
          fi
          echo "✅ Tests within performance budget"
```

### For Autonomous Agents

**When writing new tests:**
1. Run `npm run test:timing` to see individual test durations
2. Keep individual tests < 100ms
3. Mock external dependencies (APIs, filesystem when possible)
4. Use minimal test data

**When optimizing tests:**
1. Identify slow tests with `npm run test:timing`
2. Profile the test to find bottlenecks
3. Remove unnecessary delays or I/O
4. Add mocks for external dependencies
5. Verify improvement with before/after timing

**Performance regression workflow:**
1. Before changes: `npm run test:timing > before.txt`
2. Make changes
3. After changes: `npm run test:timing > after.txt`
4. Compare: `diff before.txt after.txt`
5. Ensure no significant slowdown

**CI best practices:**
- Always run `npm test` (includes timing metadata)
- Parse duration_ms from output
- Fail builds if duration exceeds threshold
- Track trends over time (store timing artifacts)
- Alert on performance regressions

## Test Coverage Thresholds

Test coverage thresholds are **enforced** to ensure adequate testing and prevent coverage regressions.

### Why Enforce Coverage Thresholds?

- **Quality gate**: Minimum coverage standards prevent untested code
- **Prevent regressions**: New code must maintain or improve coverage
- **Visibility**: Know which code lacks tests
- **CI integration**: Fail builds if coverage drops below threshold
- **Team accountability**: Everyone maintains test coverage

### Current Thresholds

**Configuration**: `.c8rc.json`

```json
{
  "check-coverage": true,
  "lines": 30,           // 30% of lines must be covered
  "functions": 40,       // 40% of functions must be tested
  "branches": 65,        // 65% of branches must be covered
  "statements": 30       // 30% of statements must be covered
}
```

**Current Coverage** (as of 2026-03-22):
- **Lines**: 32.25% ✅ (above 30% threshold)
- **Functions**: 43.39% ✅ (above 40% threshold)
- **Branches**: 74.31% ✅ (above 65% threshold)
- **Statements**: 32.25% ✅ (above 30% threshold)

### Running Coverage

**Generate coverage report:**

```bash
npm run test:coverage
```

**Output:**
```
-----------------|---------|----------|---------|---------|-----------------------
File             | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s  
-----------------|---------|----------|---------|---------|-----------------------
All files        |   32.25 |    74.31 |   43.39 |   32.25 |  
 bin/nemoclaw.js |   36.06 |    47.61 |   13.33 |   36.06 | 152-155,157-162,...
 bin/lib/*.js    |   31.14 |    80.68 |   55.26 |   31.14 |
-----------------|---------|----------|---------|---------|-----------------------
```

**Coverage reports generated:**
- **Text**: Console output (shown above)
- **HTML**: `coverage/index.html` (open in browser for detailed view)
- **LCOV**: `coverage/lcov.info` (for CI tools, code quality platforms)

### Viewing HTML Coverage Report

```bash
# Generate coverage
npm run test:coverage

# Open HTML report (macOS/Linux)
open coverage/index.html

# Open HTML report (Windows)
start coverage/index.html
```

The HTML report shows:
- Per-file coverage with color coding
- Uncovered lines highlighted in red
- Branch coverage visualization
- Click-through to see exactly which lines lack tests

### Threshold Enforcement

**Automatic enforcement**: `npm run test:coverage` **fails** if coverage is below thresholds.

**Example failure:**
```
ERROR: Coverage for lines (28.5%) does not meet global threshold (30%)
ERROR: Coverage for functions (38%) does not meet global threshold (40%)
```

→ Exit code 1, fails CI builds

**Example success:**
```
All files        |   32.25 |    74.31 |   43.39 |   32.25 |
```

→ Exit code 0 (or test exit code), passes threshold check

### Increasing Thresholds Over Time

**Gradual improvement strategy:**

1. **Current baseline**: 30% lines, 40% functions
2. **Add tests for high-value code**: Focus on critical paths first
3. **Increase thresholds by 5%**: Update `.c8rc.json` when coverage improves
4. **Prevent regressions**: Threshold acts as floor, coverage can only improve
5. **Long-term goal**: 70-80% coverage for production code

**When to increase thresholds:**
```bash
# Check current coverage
npm run test:coverage

# If coverage is 40%, increase threshold to 35% in .c8rc.json
# This locks in the improvement and prevents future regressions
```

### CI Integration

**GitHub Actions example:**

```yaml
- name: Run tests with coverage
  run: npm run test:coverage

- name: Upload coverage report
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/lcov.info

- name: Check coverage thresholds
  run: |
    # c8 already fails if below threshold
    # This step only runs if coverage passes
    echo "Coverage thresholds met!"
```

**Coverage fails → CI fails → PR cannot merge**

### Coverage Configuration

**`.c8rc.json` options:**

```json
{
  "all": true,                    // Include all source files, even untested
  "src": ["bin", "test"],        // Directories to track coverage for
  "exclude": [                    // Files to exclude from coverage
    "**/*.test.js",              // Exclude test files themselves
    "node_modules/**",           // Exclude dependencies
    "nemoclaw/dist/**"           // Exclude build artifacts
  ],
  "reporter": ["text", "lcov", "html"],  // Output formats
  "reports-dir": "coverage",     // Where to save reports
  "check-coverage": true,        // Enforce thresholds
  "lines": 30,                   // Line coverage threshold
  "functions": 40,               // Function coverage threshold
  "branches": 65,                // Branch coverage threshold
  "statements": 30,              // Statement coverage threshold
  "per-file": false              // Global thresholds, not per-file
}
```

**Per-file thresholds** (optional):

Set `"per-file": true` to enforce thresholds on **each file** instead of globally. Stricter but more work to maintain.

### Improving Coverage

**1. Identify untested code:**

```bash
# Run coverage and open HTML report
npm run test:coverage
open coverage/index.html

# Look for files with low coverage (red highlighting)
# Focus on critical/complex code first
```

**2. Add tests for uncovered code:**

```javascript
// bin/lib/credentials.js has 21.8% coverage
// Add tests in test/credentials.test.js

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { saveCredentials, loadCredentials } from '../bin/lib/credentials.js';

describe('credentials', () => {
  it('saves and loads credentials', () => {
    // Write tests for previously untested functions
  });
});
```

**3. Verify coverage improved:**

```bash
npm run test:coverage
# Check that percentage increased
```

**4. Increase threshold:**

```json
// .c8rc.json - lock in the improvement
{
  "lines": 35,  // was 30
  "functions": 45  // was 40
}
```

### For Autonomous Agents

**Before submitting PR:**
1. Run `npm run test:coverage` to check current coverage
2. If adding new code, add tests to maintain coverage above threshold
3. If coverage drops below threshold, add tests until it passes
4. Never lower thresholds to make tests pass - add tests instead

**When coverage fails:**
1. Check HTML report: `open coverage/index.html`
2. Find red (uncovered) lines in your new code
3. Add tests for those lines
4. Re-run `npm run test:coverage` until it passes

**Best practices:**
- Write tests alongside new code (not as an afterthought)
- Test edge cases and error paths (improves branch coverage)
- Test public APIs thoroughly (improves function coverage)
- Avoid testing trivial getters/setters (focus on logic)

**When thresholds block you:**
- **Don't** lower thresholds in `.c8rc.json`
- **Do** add meaningful tests for your code
- **Do** ask if certain code should be excluded (e.g., generated files)
- **Do** explain in PR if threshold seems unreasonable for your changes

## Integration Tests

Integration tests verify that multiple components work together correctly. Unlike unit tests that test individual functions in isolation, integration tests exercise real workflows and interactions.

### What Integration Tests Cover

**Location**: `test/integration/`

**Test Suites**:

1. **CLI Workflow Integration** (`cli-workflow.test.js`):
   - Multi-command workflows (help → list → help sequences)
   - Registry module API and structure
   - CLI command stability and consistency
   - Environment variable configuration handling

2. **Policy Workflow Integration** (`policy-workflow.test.js`):
   - Policy preset discovery and loading
   - Endpoint extraction from policy YAML
   - Policy module API completeness
   - Preset validation and structure checking

3. **Runner and Blueprint Integration** (`runner-blueprint.test.js`):
   - Blueprint YAML validation
   - Inference profile configuration (default, vllm, nim-local)
   - Blueprint runner and orchestrator integration
   - Policy preset file structure
   - Migration snapshot system
   - E2E test script validation

### Running Integration Tests

**Run only integration tests:**

```bash
npm run test:integration
```

**Run all tests (unit + integration):**

```bash
npm run test:all
```

**Run specific integration test file:**

```bash
node --test test/integration/cli-workflow.test.js
node --test test/integration/policy-workflow.test.js
node --test test/integration/runner-blueprint.test.js
```

### Integration Test Results

**Current Status** (as of 2026-03-22):
- **Total integration tests**: 21
- **Passing**: 21 ✅
- **Duration**: ~0.5 seconds

**Test Breakdown**:
- CLI Workflow: 5 tests
- Policy Workflow: 7 tests
- Runner & Blueprint: 9 tests

### Writing Integration Tests

Integration tests follow the same patterns as unit tests but focus on multi-component interactions:

```javascript
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

describe("Component Integration", () => {
  it("components A and B work together", () => {
    const moduleA = require("../../bin/lib/moduleA");
    const moduleB = require("../../bin/lib/moduleB");

    // Test that A's output works as B's input
    const aResult = moduleA.process("input");
    const bResult = moduleB.consume(aResult);

    assert.ok(bResult, "B should successfully consume A's output");
  });
});
```

**Key principles**:
1. **Test real interactions**: Don't mock dependencies
2. **Test workflows**: Multi-step processes, not single function calls
3. **Test contracts**: Verify modules interact correctly via their APIs
4. **Clean up state**: Use try/finally to clean up any test state
5. **Avoid brittle assertions**: Test behavior, not exact output strings

### Integration vs Unit Tests

| Aspect | Unit Tests | Integration Tests |
|--------|-----------|-------------------|
| **Location** | `test/*.test.js` | `test/integration/*.test.js` |
| **Scope** | Single function/module | Multiple components |
| **Dependencies** | Mocked or isolated | Real dependencies |
| **Speed** | Very fast (~40ms avg) | Slower (~25ms avg) |
| **Purpose** | Verify logic correctness | Verify component interaction |
| **Run frequency** | Every commit | Every PR |

**When to write unit tests**:
- Testing a single function's logic
- Testing edge cases and error handling
- Fast feedback during development

**When to write integration tests**:
- Testing CLI command workflows
- Testing module interactions (e.g., runner + policies)
- Testing configuration loading and validation
- Testing end-to-end user scenarios

### For Autonomous Agents

**Before submitting PR with new features:**

1. **Add unit tests** for individual functions/logic
2. **Add integration tests** if feature involves multiple modules
3. **Run all tests**: `npm run test:all`
4. **Verify coverage**: `npm run test:coverage`

**Integration test checklist**:
- ✅ Tests realistic user workflows
- ✅ Tests module interactions, not just individual functions
- ✅ Cleans up any state (files, registry entries, etc.)
- ✅ Doesn't rely on specific environment setup
- ✅ Has clear assertions with meaningful error messages

**Example scenarios requiring integration tests**:
- Adding a new CLI command that uses multiple modules
- Adding a new policy preset that integrates with runner
- Changing how modules communicate (API changes)
- Adding new workflow features (onboarding, migration, etc.)

## References

- [Node.js Test Runner Documentation](https://nodejs.org/api/test.html)
- [Node.js Test Concurrency](https://nodejs.org/api/test.html#test-runner-execution-model)
- [Node.js Test Reporters](https://nodejs.org/api/test.html#test-reporters)
- [Writing Isolated Tests](https://nodejs.org/api/test.html#test-contexts)
- [c8 Coverage Tool](https://github.com/bcoe/c8)
- [Istanbul Coverage Metrics](https://istanbul.js.org/)

---

**Last Updated**: 2026-03-22
**For Questions**: See AGENTS.md or ask in GitHub Discussions
