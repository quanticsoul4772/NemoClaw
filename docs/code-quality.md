# Code Quality and Complexity Management

NemoClaw enforces code quality standards to maintain readability and prevent overly complex code that would be difficult for both humans and autonomous AI agents to understand and modify.

## Complexity Analysis Tools

### TypeScript (nemoclaw/)

**ESLint Complexity Rules:**

The TypeScript plugin enforces several complexity thresholds via ESLint:

- **Cyclomatic Complexity**: Maximum 15 per function
  - Measures the number of linearly independent paths through code
  - High complexity indicates too many conditional branches
  - Rule: `complexity: ["error", { max: 15 }]`

- **Maximum Nesting Depth**: 4 levels
  - Prevents deeply nested if/for/while blocks
  - Rule: `max-depth: ["error", { max: 4 }]`

- **Maximum Lines per Function**: 150 lines (excluding blanks and comments)
  - Long functions should be broken into smaller pieces
  - Rule: `max-lines-per-function: ["error", { max: 150, skipBlankLines: true, skipComments: true }]`

- **Maximum Nested Callbacks**: 3 levels
  - Prevents callback hell
  - Rule: `max-nested-callbacks: ["error", { max: 3 }]`

- **Maximum Parameters**: 5 per function
  - Too many parameters indicate the function is doing too much
  - Rule: `max-params: ["error", { max: 5 }]`

**Running Complexity Analysis:**

```bash
# Check all TypeScript code
cd nemoclaw
npm run lint

# Or from repository root
make complexity
```

### Python (nemoclaw-blueprint/)

**Ruff McCabe Complexity (C90):**

The Python blueprint enforces cyclomatic complexity via Ruff's McCabe plugin:

- **Cyclomatic Complexity**: Maximum 15 per function
  - Same metric as TypeScript, for consistency
  - Rule: `C90` rule enabled with `max-complexity = 15`

**Running Complexity Analysis:**

```bash
# Check all Python code
cd nemoclaw-blueprint
ruff check . --select C90

# Or from repository root
make complexity
```

## Understanding Cyclomatic Complexity

**What is it?**
Cyclomatic complexity is a metric that measures the number of decision points in your code. Each `if`, `while`, `for`, `case`, `&&`, `||`, and `?:` adds to the complexity.

**Example:**

```typescript
// Complexity = 1 (no branches)
function add(a: number, b: number): number {
  return a + b;
}

// Complexity = 3 (two if statements, one else)
function classify(score: number): string {
  if (score >= 90) {
    return "A";
  } else if (score >= 80) {
    return "B";
  } else {
    return "C";
  }
}

// Complexity = 15 (many branches - at the limit!)
function complexFunction(data: Data): Result {
  if (data.type === "A") {
    if (data.value > 100) {
      if (data.flag) {
        // ... more nested conditions
      } else {
        // ...
      }
    } else if (data.value > 50) {
      // ...
    }
  } else if (data.type === "B") {
    // ... more branches
  }
  // This function needs refactoring!
}
```

**Why it matters:**
- High complexity = hard to understand
- Hard to test (need many test cases to cover all paths)
- More bug-prone
- Difficult for AI agents to reason about
- Expensive to maintain

## Dealing with Complexity Violations

### Strategy 1: Extract Methods

Break large functions into smaller, focused functions:

```typescript
// Before (complexity 25)
async function processData(data: Data[]): Promise<Result> {
  // 200 lines of complex logic
}

// After (complexity 5 + 4 + 3 + 2)
async function processData(data: Data[]): Promise<Result> {
  const validated = validateData(data);
  const transformed = transformData(validated);
  const enriched = enrichData(transformed);
  return finalizeData(enriched);
}
```

### Strategy 2: Use Lookup Tables

Replace complex conditionals with data structures:

```typescript
// Before (complexity 8)
function getColor(type: string): string {
  if (type === "error") return "red";
  else if (type === "warning") return "yellow";
  else if (type === "success") return "green";
  // ... more conditions
}

// After (complexity 1)
const COLOR_MAP: Record<string, string> = {
  error: "red",
  warning: "yellow",
  success: "green",
  // ...
};

function getColor(type: string): string {
  return COLOR_MAP[type] || "gray";
}
```

### Strategy 3: Early Returns

Reduce nesting with guard clauses:

```typescript
// Before (complexity 5, depth 3)
function process(input: Input): Result {
  if (input) {
    if (input.isValid) {
      if (input.data) {
        return transform(input.data);
      }
    }
  }
  return null;
}

// After (complexity 3, depth 1)
function process(input: Input): Result {
  if (!input) return null;
  if (!input.isValid) return null;
  if (!input.data) return null;
  return transform(input.data);
}
```

## Known Complex Functions

The following existing functions exceed complexity thresholds and are candidates for refactoring:

### TypeScript Plugin

- `src/commands/onboard.ts::cliOnboard` - Complexity 55, Lines 227
  - **Issue**: Onboarding wizard has many branches for different scenarios
  - **Plan**: Extract wizard steps into separate functions

- `src/commands/migration-state.ts::collectExternalRoots` - Complexity 31
  - **Issue**: Filesystem traversal with many conditionals
  - **Plan**: Extract directory filtering logic

- `src/commands/migration-state.ts::detectHostOpenClaw` - Complexity 23
  - **Issue**: Multiple detection strategies with fallbacks
  - **Plan**: Use strategy pattern for detection methods

- `src/commands/migrate.ts::cliMigrate` - Complexity 26
  - **Issue**: Migration orchestration with error handling
  - **Plan**: Extract migration phases into separate functions

### Python Blueprint

Currently, all Python code passes complexity thresholds (complexity ≤ 15).

## For Autonomous Agents

**When writing new code:**
1. Run `make complexity` to check your changes
2. If violations are reported, refactor before submitting PR
3. Use the strategies above to reduce complexity
4. Document why if complexity cannot be reduced (rare cases only)

**When modifying existing code:**
1. Try to reduce complexity if touching a complex function
2. If refactoring is too risky, add a TODO comment linking to a GitHub issue
3. Document the complexity in code comments for future work

**In pull requests:**
- The PR template asks about complexity violations
- Reviewers will check complexity metrics
- Prefer incremental improvements over perfect refactors

## Dead Code Detection

Dead code is code that exists in the repository but is never executed or referenced. It creates maintenance burden, confuses developers and AI agents, and obscures the actual functionality of the codebase.

### TypeScript (nemoclaw/)

**Knip - Dead Code Finder:**

Knip analyzes the TypeScript codebase to find:
- **Unused files**: Files that are never imported
- **Unused exports**: Functions, classes, types exported but never imported
- **Unused dependencies**: npm packages in package.json that aren't used
- **Unused types**: TypeScript types/interfaces that are never referenced
- **Unused enum members**: Enum values that are never accessed
- **Duplicate exports**: Same export defined multiple times

**Running Dead Code Detection:**

```bash
# Check for dead code in TypeScript
cd nemoclaw
npm run dead-code

# Or from repository root
make dead-code
```

**Configuration:**

Dead code detection is configured in `nemoclaw/knip.json`:
- **Entry points**: `src/index.ts` (plugin entry), `src/cli.ts` (CLI entry)
- **Project files**: All `src/**/*.ts` files
- **Rules**: Warn on unused exports/types, error on unlisted dependencies

**Interpreting Results:**

```
Unused dependencies (1)
yaml  package.json:29:6
```
→ The `yaml` package is installed but never imported. Consider removing it.

```
Unused exports (1)
clearOnboardConfig  function  src/onboard/config.ts:49:17
```
→ This function is exported but never imported elsewhere. Either use it or remove the export.

**Fixing Dead Code:**

1. **Remove truly dead code**: If the code isn't needed, delete it
2. **Remove unused exports**: If the function is only used internally, don't export it
3. **Add to entry points**: If the code is used by external consumers, add it to knip entry points
4. **Document intentional exports**: If exporting for future use or external packages, document why

### Python (nemoclaw-blueprint/)

**Vulture - Dead Code Finder:**

Vulture finds unused code in Python:
- **Unused functions**: Functions that are never called
- **Unused classes**: Classes that are never instantiated
- **Unused methods**: Class methods that are never invoked
- **Unused variables**: Variables that are assigned but never read
- **Unused properties**: Class properties that are never accessed
- **Unused imports**: Imported modules/functions that are never used

**Running Dead Code Detection:**

```bash
# Check for dead code in Python
cd nemoclaw-blueprint
make dead-code

# Or from repository root
make dead-code
```

**Configuration:**

Dead code detection is configured with a minimum confidence threshold of 80% (`.vulture` file):
- **Confidence 80-100%**: High likelihood it's truly dead code
- **Confidence 60-79%**: Medium likelihood (more false positives)
- **Confidence 0-59%**: Low confidence (many false positives)

Higher confidence means fewer false positives but might miss some dead code.

**Whitelisting False Positives:**

If vulture reports code that is actually used (e.g., methods called via `getattr()`, CLI commands loaded dynamically), add them to `.vulture`:

```python
# In .vulture file
# Whitelisted names
run_command  # CLI dynamically loads this
ClassName.dynamic_method  # Called via getattr
```

**Common False Positives:**

- Functions passed as callbacks
- Methods called dynamically (getattr, __getattribute__)
- Code used by external packages
- CLI commands loaded via entry points
- Test fixtures

### Integration with CI

Dead code detection is **informational** - it doesn't fail builds:

```bash
# Runs both TypeScript and Python dead code detection
make dead-code
```

**Why not fail builds on dead code?**
- False positives can occur (especially in Python)
- Code might be exported for future use or external consumers
- Some "dead" code is intentionally kept for documentation/examples

**For pull requests:**
- Run `make dead-code` before submitting
- If dead code is detected, consider cleaning it up
- If it's intentional, document why in PR description

## For Autonomous Agents

**When adding new code:**
1. Run `make dead-code` after your changes
2. If new code is flagged as unused, ensure it's properly wired up
3. Don't export functions/classes that are only used internally

**When removing features:**
1. Delete the feature code
2. Run `make dead-code` to find orphaned utilities/helpers
3. Clean up unused dependencies and imports

**Best practices:**
- Export only what's needed by external consumers
- Remove unused imports immediately
- Clean up old code rather than commenting it out (use git history instead)
- Document why if keeping "dead" code intentionally

## Duplicate Code Detection (DRY Principle)

Duplicate code violates the DRY (Don't Repeat Yourself) principle and creates maintenance problems: bugs fixed in one place remain unfixed in duplicates, changes must be synchronized across copies, and the codebase grows unnecessarily large.

### Cross-Language Detection with jscpd

**jscpd (Copy/Paste Detector)** analyzes the entire codebase for duplicate code across multiple languages:
- **TypeScript** - Plugin source code
- **JavaScript** - CLI scripts and tests
- **Python** - Blueprint and migration tools

**Running Duplicate Code Detection:**

```bash
# Check entire codebase for duplicates
npm run duplicates

# Or from repository root
make duplicates
```

**Configuration:**

Duplicate detection is configured in `.jscpd.json`:
- **Threshold**: 3% - Fails if >3% of code is duplicated
- **Minimum clone size**: 5 lines OR 50 tokens
- **Maximum clone size**: 500 lines (huge duplicates likely indicate different issue)
- **Skip comments**: Comments don't count toward duplication
- **Output**: Console table + HTML report in `.jscpd/html/`

**Current Duplication Status:**

Based on latest scan:
- **JavaScript**: 0.19% duplication (6 lines in 3,160 total)
- **Python**: 0.72% duplication (26 lines in 3,606 total)
- **TypeScript**: 0% duplication (0 lines - excellent!)
- **Total**: 0.35% duplication (32 lines in 9,110 total)

**Interpreting Results:**

```
Clone found (javascript):
 - bin/nemoclaw.js [250:4 - 256:2] (6 lines, 86 tokens)
   bin/nemoclaw.js [228:23 - 235:6]
```
→ 6 lines of code are duplicated within the same file. Consider extracting to a function.

**Duplication Percentage Guidelines:**
- **0-3%**: Excellent - typical for well-maintained codebases
- **3-5%**: Acceptable - some refactoring opportunities
- **5-10%**: Concerning - should prioritize DRY refactoring
- **>10%**: Poor - significant technical debt from copy-paste

**Fixing Duplicate Code:**

1. **Extract to function/method**: Most common solution
   ```typescript
   // Before (duplicated)
   const result1 = data.filter(x => x.active).map(x => x.value);
   const result2 = data.filter(x => x.active).map(x => x.value);
   
   // After (DRY)
   const getActiveValues = (data) => data.filter(x => x.active).map(x => x.value);
   const result1 = getActiveValues(data);
   const result2 = getActiveValues(data);
   ```

2. **Extract to shared utility module**: For cross-file duplicates
3. **Use inheritance/composition**: For class-level duplicates
4. **Configuration over code**: Replace similar code with data-driven patterns
5. **Template/mixin patterns**: For similar structures

**Legitimate Duplicates:**

Sometimes duplication is acceptable:
- **Boilerplate**: Test setup, configuration files
- **Error messages**: Similar error handling with different contexts
- **Platform-specific code**: Windows vs Linux implementations
- **Independent modules**: Intentionally decoupled code

For legitimate duplicates, consider:
- Adding comments explaining why duplication is intentional
- Documenting in code review if challenged
- Accepting the duplication rather than creating tight coupling

**HTML Reports:**

jscpd generates detailed HTML reports in `.jscpd/html/`:
- Visual highlighting of duplicate blocks
- Side-by-side comparison
- File-by-file and format-by-format breakdowns
- Sortable by duplication percentage

Open `.jscpd/html/index.html` in a browser to explore duplicates visually.

**For Autonomous Agents:**

**When writing new code:**
1. Run `make duplicates` before submitting PR
2. If duplication >3%, refactor before submitting
3. Extract repeated logic to utilities/helpers
4. Use existing helper functions rather than reimplementing

**When fixing bugs:**
1. Search for similar code that might have the same bug
2. If duplicates found, fix all instances or refactor to DRY
3. Add tests to prevent regression in all copies

**Best practices:**
- Extract after second duplication (Rule of Three)
- Prefer small, focused utilities over large shared modules
- Don't over-DRY: some duplication is better than tight coupling
- Document why if accepting duplication

## Technical Debt Tracking

Technical debt refers to the implied cost of future rework caused by choosing a quick, short-term solution instead of a better approach that would take longer. In code, technical debt is often marked with TODO, FIXME, HACK, or XXX comments indicating areas that need improvement.

### Why Track Technical Debt?

- **Visibility**: Know what needs fixing and where
- **Prioritization**: Decide which debt to address first
- **Prevention**: Avoid accumulating too much debt
- **Maintenance**: Ensure temporary solutions don't become permanent
- **Agent guidance**: AI agents need to know about known issues and planned improvements

### Tracking with leasot

**leasot** scans the codebase for technical debt markers:
- **TODO**: Tasks that need to be done
- **FIXME**: Known bugs or issues that need fixing
- **HACK**: Temporary workarounds that should be refactored
- **XXX**: Warnings about problematic code
- **NOTE**: Important information for developers
- **OPTIMIZE**: Performance improvement opportunities

**Running Technical Debt Scan:**

```bash
# Scan project files for tech debt markers
npm run tech-debt

# Or from repository root
make tech-debt
```

**Configuration:**

Technical debt scanning is configured in `package.json`:
- **Scanned files**: TypeScript plugin, CLI scripts, Python blueprint, tests
- **Excluded**: node_modules, dist, build outputs, generated files
- **Output**: Markdown table with filename, line number, and comment

**Interpreting Results:**

```markdown
### TODOs
| Filename | line # | TODO |
|:------|:------:|:------|
| bin/nemoclaw.js | 42 | Refactor this to use async/await |
| nemoclaw/src/commands/migrate.ts | 89 | Add validation for config schema |
```

→ Two technical debt items found that should be addressed

**Current Technical Debt Status:**

Based on latest scan: **No technical debt markers found** in project code! 🎉

This indicates the codebase is well-maintained without known TODOs, FIXMEs, or HACKs. Maintain this standard by addressing debt immediately or documenting it properly.

**Best Practices for Technical Debt Comments:**

1. **Be specific**: Explain what needs to be done and why
   ```typescript
   // TODO: Add retry logic with exponential backoff for API calls (NVBUG-1234)
   // Current implementation fails on transient network errors
   ```

2. **Link to tracking**: Reference GitHub issue or ticket number
   ```python
   # FIXME(#123): Memory leak when processing large files
   # See https://github.com/NVIDIA/NemoClaw/issues/123
   ```

3. **Add context**: Explain why it's temporary
   ```javascript
   // HACK: Workaround for upstream bug in dependency@1.2.3
   // Remove this when dependency@1.3.0 is released (fixes issue #456)
   ```

4. **Set deadlines**: When should this be addressed?
   ```typescript
   // TODO(2026-06-01): Remove deprecated API once all users migrate
   ```

5. **Assign ownership**: Who should fix this?
   ```python
   # FIXME(@alice): Incorrect timezone handling in date parser
   ```

**When to Use Each Marker:**

- **TODO**: Future enhancements, missing features, planned refactoring
- **FIXME**: Known bugs, incorrect behavior that needs fixing
- **HACK**: Temporary workaround, code that violates best practices
- **XXX**: Dangerous code, potential security issues, critical warnings
- **NOTE**: Important explanations, non-obvious behavior, dependencies
- **OPTIMIZE**: Performance bottlenecks, inefficient algorithms

**For Autonomous Agents:**

**When adding TODO comments:**
1. Be specific about what needs to be done
2. Link to GitHub issue if one exists
3. Explain why it's not done now
4. Consider creating a GitHub issue instead of just a comment

**When encountering TODO/FIXME:**
1. Assess if it can be fixed immediately (if yes, fix it!)
2. If not, ensure it's tracked in GitHub issues
3. Update the comment to link to the issue
4. Consider priority vs. current task

**When fixing technical debt:**
1. Remove the TODO/FIXME comment after fixing
2. Add tests to prevent regression
3. Update documentation if behavior changed
4. Run `make tech-debt` to confirm comment removed

**Avoiding technical debt:**
- Don't leave commented-out code (use git history instead)
- Fix issues immediately when possible
- If temporary solution needed, document why and when to revisit
- Prefer GitHub issues over TODO comments for significant work
- Review and address debt during refactoring

## References

- [Cyclomatic Complexity - Wikipedia](https://en.wikipedia.org/wiki/Cyclomatic_complexity)
- [ESLint Complexity Rules](https://eslint.org/docs/latest/rules/complexity)
- [Ruff McCabe (C90) Rules](https://docs.astral.sh/ruff/rules/#mccabe-c90)
- [Refactoring Techniques - Martin Fowler](https://refactoring.com/)
- [Knip Documentation](https://knip.dev/)
- [Vulture Documentation](https://github.com/jendrikseipp/vulture)

---

**Last Updated**: 2026-03-22
**For Questions**: See AGENTS.md or ask in GitHub Discussions
