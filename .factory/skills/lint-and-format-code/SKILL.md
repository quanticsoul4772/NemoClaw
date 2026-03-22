---
name: lint-and-format-code
description: Run linting and code formatting for both TypeScript and Python code. Auto-fixes issues when possible. Use before committing, after refactoring, or when enforcing code style. Trigger keywords - lint, format, style check, eslint, prettier, ruff, code quality.
---

# Lint and Format Code

Run linting and automatic code formatting for TypeScript and Python to ensure consistent code style and catch common issues.

## Prerequisites

- You must be in the NemoClaw repository root
- Node.js 20+ and Python 3.11+ must be installed
- Dependencies must be installed (`npm install` and `uv sync`)

## When to Use

- **Before committing** - Ensure code meets style guidelines
- **After refactoring** - Apply consistent formatting to changed code
- **Fixing linting errors** - Auto-fix issues reported by linters
- **Onboarding new code** - Apply project standards to new files
- **Before creating a PR** - Ensure CI linting checks will pass

## Quick Commands

### Lint and Format Everything

```bash
# Check and auto-fix both TypeScript and Python
make format
```

This runs:
- ESLint with auto-fix for TypeScript
- Prettier formatting for TypeScript
- Ruff linter with auto-fix for Python
- Ruff formatter for Python

### Check Only (No Auto-Fix)

```bash
# Check linting and formatting without modifying files
make check
```

Use this to:
- See what would change without applying it
- Verify CI checks will pass
- Review issues before fixing

### TypeScript Only

```bash
cd nemoclaw

# Run ESLint (auto-fix)
npm run lint:fix

# Run Prettier (auto-format)
npm run format

# Run both ESLint + Prettier + type check
npm run check
```

### Python Only

```bash
cd nemoclaw-blueprint

# Run Ruff linter (auto-fix)
make format

# Check only (no fixes)
make check
```

## Linting Rules

### TypeScript (ESLint)

**Configured in**: `nemoclaw/eslint.config.mjs`

**Key Rules**:
- **Strict type checking** - No `any` types, explicit types required
- **No unused variables** - All variables must be used (prefix with `_` if intentionally unused)
- **No floating promises** - All promises must be awaited or handled
- **Complexity limits** - Functions ≤15 cyclomatic complexity, ≤4 depth, ≤150 lines
- **Naming conventions** - camelCase for variables/functions, PascalCase for classes/types

**Example Violations**:

```typescript
// ❌ BAD: No any types
function process(data: any) { ... }

// ✅ GOOD: Explicit types
function process(data: ProcessData) { ... }

// ❌ BAD: Unused variable
const result = calculate();

// ✅ GOOD: Use or prefix with underscore
const _result = calculate(); // intentionally unused
```

### Python (Ruff)

**Configured in**: `nemoclaw-blueprint/pyproject.toml`

**Key Rules**:
- **PEP 8 naming** - snake_case for functions, PascalCase for classes
- **Import order** - Enforced via isort
- **Cyclomatic complexity** - Functions ≤15 complexity (McCabe C90)
- **Security** - flake8-bandit rules enabled
- **No print statements** - Use proper logging (allowed for CLI output)

**Example Violations**:

```python
# ❌ BAD: PascalCase function name
def RunOrchestrator():
    pass

# ✅ GOOD: snake_case function name
def run_orchestrator():
    pass

# ❌ BAD: High complexity
def complex_function():  # >15 branches
    if ... elif ... elif ... # many conditions

# ✅ GOOD: Break into smaller functions
def complex_function():
    check_conditions()
    process_data()
```

## Formatting Rules

### TypeScript (Prettier)

**Configured in**: `nemoclaw/.prettierrc`

**Automatic Formatting**:
- **Line length**: 100 characters
- **Indent**: 2 spaces
- **Semicolons**: Required
- **Quotes**: Double quotes
- **Trailing commas**: ES5 style

### Python (Ruff Format)

**Configured in**: `nemoclaw-blueprint/pyproject.toml`

**Automatic Formatting**:
- **Line length**: 100 characters
- **Indent**: 4 spaces
- **Quotes**: Double quotes
- **Import order**: Standard library → third-party → local

## Pre-commit Hooks

The repository uses pre-commit hooks to automatically lint and format code on commit:

```bash
# Manually run all pre-commit hooks
pre-commit run --all-files
```

**Hooks include**:
- Trailing whitespace removal
- YAML/JSON validation
- ESLint (TypeScript)
- Prettier (TypeScript)
- Ruff lint + format (Python)
- Type checking (TypeScript)
- Secret detection

If a hook fails:

```bash
# Fix issues automatically
pre-commit run --all-files

# Review changes
git diff

# Stage fixes and retry commit
git add -A
git commit
```

## Common Issues and Fixes

### ESLint: Complexity Too High

**Error**: `Function has a complexity of 18. Maximum allowed is 15.`

**Fix**: Break the function into smaller functions:

```typescript
// ❌ BAD: Complex function
function process(data: Data) {
  if (data.type === 'A') {
    // 20 lines of logic
  } else if (data.type === 'B') {
    // 20 lines of logic
  } else if (data.type === 'C') {
    // 20 lines of logic
  }
}

// ✅ GOOD: Split into smaller functions
function process(data: Data) {
  switch (data.type) {
    case 'A': return processTypeA(data);
    case 'B': return processTypeB(data);
    case 'C': return processTypeC(data);
  }
}

function processTypeA(data: Data) { ... }
function processTypeB(data: Data) { ... }
function processTypeC(data: Data) { ... }
```

### Prettier vs ESLint Conflicts

Prettier is already integrated with ESLint via `eslint-config-prettier`. If conflicts occur:

```bash
# Format with Prettier first
npm run format

# Then fix ESLint issues
npm run lint:fix
```

### Python Import Order

**Error**: `I001 Import block is un-sorted or un-formatted`

**Fix**: Ruff will auto-fix import order:

```bash
cd nemoclaw-blueprint
make format
```

### TypeScript Type Errors

Linting won't fix type errors - you need to add proper types:

```bash
# Check type errors
cd nemoclaw
npx tsc --noEmit

# Fix by adding types to code
```

## Integration with CI

Linting and formatting are checked in CI:

```yaml
# .pre-commit-config.yaml hooks run automatically
- pre-commit hook: ESLint
- pre-commit hook: Prettier  
- pre-commit hook: Ruff lint
- pre-commit hook: Ruff format
- pre-commit hook: Type check
```

To verify CI will pass:

```bash
# Run all pre-commit checks locally
pre-commit run --all-files

# Exit code 0 = CI will pass
echo $?
```

## Best Practices

1. **Format before committing** - Let tools handle style for you
2. **Trust the formatters** - Don't fight Prettier/Ruff formatting
3. **Fix complexity issues** - Break large functions into smaller ones
4. **Use meaningful names** - Follow naming conventions
5. **Run checks frequently** - Catch issues early

## Example Workflow

```bash
# 1. Make code changes
vim bin/lib/metrics.js
vim nemoclaw-blueprint/orchestrator/runner.py

# 2. Format all code
make format

# 3. Review changes
git diff

# 4. Verify checks pass
make check

# 5. Commit (pre-commit hooks run automatically)
git add -A
git commit -m "refactor: improve error handling"
```

## Success Criteria

✅ No ESLint errors or warnings  
✅ Code is formatted according to Prettier/Ruff  
✅ All pre-commit hooks pass  
✅ TypeScript type checking passes  
✅ Python code follows PEP 8

When all criteria are met, your code is ready to commit! 🎉

## Related Commands

- `make complexity` - Check cyclomatic complexity
- `make dead-code` - Detect unused code
- `make duplicates` - Find duplicate code
- `npm test` - Run test suite after formatting
