---
name: check-code-quality
description: Run code quality analysis including complexity checks, dead code detection, duplicate code detection, and technical debt tracking. Use when refactoring, reviewing code health, or before releases. Trigger keywords - code quality, complexity, dead code, duplicates, tech debt, maintainability.
---

# Check Code Quality

Run comprehensive code quality analysis to identify complexity issues, dead code, duplicate code, and technical debt.

## Prerequisites

- You must be in the NemoClaw repository root
- Node.js 20+ and Python 3.11+ must be installed
- Dependencies must be installed (`npm install`)

## When to Use

- **Before refactoring** - Identify problem areas to improve
- **Code reviews** - Assess code maintainability
- **Before releases** - Ensure code quality standards are met
- **Periodic health checks** - Monitor codebase health over time
- **After large changes** - Verify quality hasn't degraded

## Quick Commands

### All Quality Checks

```bash
# Run all quality checks
make complexity && make dead-code && make duplicates && make tech-debt
```

### Individual Checks

```bash
# Cyclomatic complexity analysis
make complexity

# Dead code detection
make dead-code

# Duplicate code detection
make duplicates

# Technical debt tracking (TODO/FIXME comments)
make tech-debt
```

## Quality Checks Explained

### 1. Cyclomatic Complexity

**What it measures**: Code complexity based on number of independent paths through code.

**Configured in**:
- TypeScript: `nemoclaw/eslint.config.mjs` (max: 15)
- Python: `nemoclaw-blueprint/pyproject.toml` (max: 15)

**Run it**:

```bash
make complexity
# or
cd nemoclaw && npm run lint
cd nemoclaw-blueprint && make check
```

**Interpreting Results**:

```
✖ Function 'processInference' has complexity 18 (max: 15)
  nemoclaw/src/commands/connect.ts:42
```

**Complexity 1-5**: Simple, easy to understand ✅  
**Complexity 6-10**: Moderate, acceptable ⚠️  
**Complexity 11-15**: Complex, consider refactoring 🔶  
**Complexity 16+**: Too complex, must refactor ❌

**How to fix**: Break large functions into smaller ones:

```typescript
// ❌ BAD: Complexity 18
function process(data: Data) {
  if (cond1) { /* logic */ }
  else if (cond2) { /* logic */ }
  else if (cond3) { /* logic */ }
  // ... many more conditions
}

// ✅ GOOD: Complexity 3
function process(data: Data) {
  const handlers = {
    type1: handleType1,
    type2: handleType2,
    type3: handleType3,
  };
  return handlers[data.type]?.(data);
}
```

### 2. Dead Code Detection

**What it detects**: Unused variables, functions, imports, and exports.

**Tools**:
- TypeScript: **knip** (configured in `nemoclaw/knip.json`)
- Python: **vulture** (configured in `nemoclaw-blueprint/.vulture`)

**Run it**:

```bash
make dead-code
# or
cd nemoclaw && npm run dead-code
cd nemoclaw-blueprint && vulture .
```

**Interpreting Results**:

```
Unused exports (1)
  createLogger  nemoclaw/src/logger.ts:42

Unused files (1)
  nemoclaw/src/utils/old-helper.ts
```

**How to fix**:
1. **Remove truly unused code** - Delete it entirely
2. **Mark as intentionally unused** - Add `/* Used externally */` comment
3. **Export if needed** - If code is used but not exported, export it
4. **Ignore in config** - Add to knip.json or .vulture ignore list

### 3. Duplicate Code Detection

**What it detects**: Copy-pasted code blocks that violate DRY principle.

**Tool**: **jscpd** (configured in `.jscpd.json`)

**Run it**:

```bash
make duplicates
# or
npm run duplicates
```

**Interpreting Results**:

```
Found 3 clones with 42 duplicated lines in 2 files (12.4%)

Clone #1:
  nemoclaw/src/commands/launch.ts:42-67
  nemoclaw/src/commands/connect.ts:89-114
  Lines: 26
```

**Thresholds**:
- **<5% duplication**: Excellent ✅
- **5-10% duplication**: Acceptable ⚠️  
- **>10% duplication**: Needs refactoring ❌

**How to fix**:

```typescript
// ❌ BAD: Duplicated code in launch.ts and connect.ts
async function launch() {
  const config = loadConfig();
  validateConfig(config);
  await initializeService(config);
  // ... same logic in connect.ts
}

// ✅ GOOD: Extract common logic
async function prepareService() {
  const config = loadConfig();
  validateConfig(config);
  await initializeService(config);
  return config;
}

async function launch() {
  const config = await prepareService();
  // launch-specific logic
}

async function connect() {
  const config = await prepareService();
  // connect-specific logic
}
```

### 4. Technical Debt Tracking

**What it detects**: TODO, FIXME, HACK, XXX comments that represent technical debt.

**Tool**: **leasot** (scans TypeScript, JavaScript, and Python files)

**Run it**:

```bash
make tech-debt
# or
npm run tech-debt
```

**Interpreting Results**:

```markdown
## bin/lib/metrics.js
- [ ] `TODO`: Implement metrics aggregation (line 42)
- [ ] `FIXME`: Handle edge case for empty data (line 89)

## nemoclaw-blueprint/orchestrator/runner.py
- [ ] `TODO`: Add retry logic for failed steps (line 156)
```

**How to manage**:

1. **Link TODOs to issues**: `TODO(#123): Fix this` links to issue #123
2. **Prioritize**: FIXME > TODO > NOTE
3. **Set deadlines**: `TODO(v0.2.0): Implement feature X`
4. **Clean up regularly**: Remove completed TODOs
5. **Track in issues**: Create GitHub issues for important TODOs

**Best practice**:

```typescript
// ❌ BAD: Vague TODO
// TODO: fix this

// ✅ GOOD: Specific TODO with context
// TODO(#456): Add timeout to prevent infinite loops (target: v0.2.0)
```

## Quality Metrics Dashboard

After running all checks, you can create a quality dashboard:

```bash
# Generate all metrics
make complexity > metrics/complexity.txt
make dead-code > metrics/dead-code.txt
make duplicates > metrics/duplicates.txt
make tech-debt > metrics/tech-debt.md
```

Track over time:
- **Complexity**: Should trend downward
- **Dead code**: Should be near zero
- **Duplication**: Should stay below 5%
- **Tech debt**: Should decrease before releases

## Integration with CI

Quality checks can be enforced in CI:

```yaml
# Example GitHub Actions job
- name: Check code quality
  run: |
    make complexity
    make dead-code
    make duplicates
```

Set up quality gates:
- Fail PR if complexity >15 is introduced
- Warn if duplication >10%
- Require TODO cleanup before releases

## Common Issues and Fixes

### High Complexity in CLI Commands

CLI commands often have high complexity due to argument parsing and validation.

**Fix**: Extract validation and processing logic:

```typescript
// ❌ BAD: High complexity in command handler
async function onboardCommand(args) {
  if (!args.profile) { /* handle */ }
  if (args.gpu && !hasGpu()) { /* handle */ }
  if (args.model && !validModel(args.model)) { /* handle */ }
  // ... many more conditions
}

// ✅ GOOD: Extract validation
async function onboardCommand(args) {
  const config = validateOnboardArgs(args);
  await executeOnboard(config);
}

function validateOnboardArgs(args) {
  // validation logic extracted
}
```

### False Positive Dead Code

Some exports are used externally (by OpenClaw plugin system):

**Fix**: Add knip configuration:

```json
// nemoclaw/knip.json
{
  "entry": ["src/index.ts"],
  "project": ["src/**/*.ts"],
  "ignore": ["src/exports.ts"]  // Intentionally exported
}
```

### Acceptable Duplication

Some duplication is acceptable (test setup, type definitions):

**Fix**: Configure jscpd to ignore:

```json
// .jscpd.json
{
  "ignore": [
    "**/test/**",
    "**/*.d.ts"
  ]
}
```

## Best Practices

1. **Run quality checks regularly** - Weekly or before each release
2. **Set quality gates** - Enforce maximum complexity and duplication
3. **Prioritize tech debt** - Address FIXMEs before TODOs
4. **Refactor incrementally** - Improve quality with each change
5. **Track trends** - Monitor quality metrics over time

## Example Workflow

```bash
# 1. Run full quality analysis
make complexity
make dead-code
make duplicates
make tech-debt

# 2. Review results and prioritize fixes
# - High complexity functions? → Refactor
# - Unused code? → Delete
# - Duplication? → Extract common logic
# - Old TODOs? → Complete or create issues

# 3. Make improvements
# ... refactor code ...

# 4. Verify improvements
make complexity  # Should show lower scores
make dead-code   # Should show fewer unused items

# 5. Commit improvements
git add -A
git commit -m "refactor: reduce complexity and remove dead code"
```

## Success Criteria

✅ All functions have complexity ≤15  
✅ No unused exports or files (or justified)  
✅ Code duplication <5%  
✅ TODOs are tracked with issue numbers  
✅ Tech debt decreases over time

When all criteria are met, your codebase is maintainable and healthy! 🎉

## Related Commands

- `make check` - Run linting and formatting checks
- `npm test` - Run test suite
- `make lint` - Run linters only
