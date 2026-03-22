---
name: build-project
description: Build the TypeScript plugin and verify compilation succeeds. Use when making code changes, before testing, or preparing for release. Trigger keywords - build, compile, tsc, typescript, dist.
---

# Build Project

Compile the TypeScript plugin and verify the build succeeds without errors.

## Prerequisites

- You must be in the NemoClaw repository root
- Node.js 20+ must be installed
- Dependencies must be installed (`npm install`)

## When to Use

- **After code changes** - Verify TypeScript compiles
- **Before running tests** - Tests need compiled code
- **Before publishing** - Ensure distributable builds correctly
- **Troubleshooting import errors** - Rebuild to fix module resolution
- **After pulling changes** - Ensure new code compiles

## Quick Commands

### Build Everything

```bash
# Build TypeScript plugin
make dev
```

This runs:
1. `npm install` in nemoclaw/ (install dependencies)
2. `npm run build` in nemoclaw/ (compile TypeScript)

### Build TypeScript Plugin Only

```bash
cd nemoclaw

# One-time build
npm run build

# Watch mode (auto-rebuild on changes)
npm run dev
```

### Clean and Rebuild

```bash
cd nemoclaw

# Remove old build artifacts
npm run clean

# Rebuild from scratch
npm run build
```

## Build Process Explained

### TypeScript Compilation

The TypeScript plugin (`nemoclaw/`) compiles to JavaScript in `nemoclaw/dist/`:

```
nemoclaw/src/*.ts  →  nemoclaw/dist/*.js
```

**Compiler**: TypeScript 5.4+ with strict mode  
**Configuration**: `nemoclaw/tsconfig.json`  
**Output**: JavaScript (ES2022), type definitions (.d.ts), source maps

**Build artifacts**:
- `nemoclaw/dist/*.js` - Compiled JavaScript
- `nemoclaw/dist/*.d.ts` - Type definition files
- `nemoclaw/dist/*.js.map` - Source maps for debugging

### Watch Mode

For active development, use watch mode to auto-rebuild on file changes:

```bash
cd nemoclaw
npm run dev
```

**Benefits**:
- Instant feedback on TypeScript errors
- No need to manually rebuild after each change
- Faster iteration during development

**When to use**:
- Developing new features
- Refactoring TypeScript code
- Debugging compilation errors

## Interpreting Build Output

### Success

```
> nemoclaw@0.1.0 build
> tsc

✨  Done in 2.34s
```

Build succeeded! ✅ Compiled files in `nemoclaw/dist/`

### Type Errors

```
> nemoclaw@0.1.0 build
> tsc

src/commands/launch.ts:42:7 - error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.

42   await launchSandbox("invalid");
   ~~~~~~~

Found 1 error in src/commands/launch.ts:42
```

**Fix**: Correct the type error in the indicated file and line.

### Import Errors

```
src/index.ts:3:23 - error TS2307: Cannot find module './commands/new-command' or its corresponding type declarations.

3 import { execute } from "./commands/new-command";
                        ~~~~~~~~~~~~~~~~~~~~~~~
```

**Common causes**:
1. File doesn't exist - Create the missing file
2. Typo in import path - Fix the path
3. Missing .ts extension - Add it to the file

### Strict Mode Errors

TypeScript strict mode is enabled, which catches common issues:

```
src/utils/helper.ts:12:5 - error TS2322: Type 'string | undefined' is not assignable to type 'string'.

12   const name: string = data.name;
    ~~~~~~
```

**Fix**: Handle undefined cases:

```typescript
// ❌ BAD: Doesn't handle undefined
const name: string = data.name;

// ✅ GOOD: Handle undefined with default or guard
const name: string = data.name ?? "default";
// or
if (!data.name) throw new Error("Name required");
const name: string = data.name;
```

## Common Build Issues

### Build Fails After Git Pull

**Problem**: New dependencies or TypeScript version changes

**Fix**:

```bash
cd nemoclaw
npm install  # Update dependencies
npm run build
```

### Module Not Found Errors

**Problem**: Import paths don't match file structure

**Fix**:

```bash
# Check file exists
ls nemoclaw/src/commands/my-command.ts

# Fix import path
import { execute } from "./commands/my-command";  # correct
```

### Build Artifacts Out of Sync

**Problem**: Old compiled files cached

**Fix**:

```bash
cd nemoclaw
npm run clean   # Remove dist/
npm run build   # Rebuild
```

### TypeScript Version Mismatch

**Problem**: Different TypeScript version than configured

**Fix**:

```bash
cd nemoclaw
npm install typescript@^5.4.0 --save-dev
npm run build
```

## Integration with Development Workflow

### Standard Development Flow

```bash
# 1. Start watch mode
cd nemoclaw
npm run dev

# 2. Make changes to TypeScript files
# (watch mode auto-rebuilds)

# 3. Test changes
cd ..
npm test

# 4. Stop watch mode (Ctrl+C)
```

### Pre-commit Checks

Pre-commit hooks verify TypeScript compiles:

```yaml
# .pre-commit-config.yaml
- id: tsc-check
  name: tsc --noEmit (TypeScript type check)
  entry: bash -c 'cd nemoclaw && npm run check'
```

This runs:
- Type checking (no emit)
- Linting
- Formatting checks

### CI Build

GitHub Actions builds on every push:

```yaml
# .github/workflows/ci.yml
- name: Build TypeScript plugin
  run: |
    cd nemoclaw
    npm install
    npm run build
```

## Build Output Structure

After successful build:

```
nemoclaw/
├── src/                    # Source TypeScript
│   ├── index.ts
│   ├── cli.ts
│   └── commands/*.ts
├── dist/                   # Compiled output
│   ├── index.js           # Compiled JavaScript
│   ├── index.d.ts         # Type definitions
│   ├── index.js.map       # Source map
│   ├── cli.js
│   ├── cli.d.ts
│   ├── cli.js.map
│   └── commands/*.js
├── tsconfig.json          # TypeScript config
└── package.json           # Build scripts
```

**Published files** (in npm package):
- `dist/*.js` - Executed by Node.js
- `dist/*.d.ts` - Used by TypeScript consumers
- Source maps - For debugging in production

## Verification

After building, verify the build:

```bash
# Check build artifacts exist
ls nemoclaw/dist/index.js

# Verify type definitions
ls nemoclaw/dist/index.d.ts

# Check package can be imported
node -e "require('./nemoclaw/dist/index.js')"
```

## Build Performance

**Typical build times**:
- **Clean build**: 2-5 seconds
- **Incremental build**: <1 second
- **Watch mode rebuild**: <500ms

**Optimization tips**:
1. Use watch mode during development (faster)
2. Use `tsc --noEmit` for type checking only (no files written)
3. Keep `tsconfig.json` optimized (incremental mode)

## Best Practices

1. **Build before committing** - Ensure code compiles
2. **Use watch mode** - Faster feedback during development
3. **Clean periodically** - Prevent stale artifacts
4. **Check type errors** - Don't ignore TypeScript warnings
5. **Keep dependencies updated** - Prevent version conflicts

## Example Workflows

### Quick Fix Workflow

```bash
# 1. Make small change to TypeScript
vim nemoclaw/src/commands/launch.ts

# 2. Build
cd nemoclaw && npm run build && cd ..

# 3. Test
npm test

# 4. Commit
git add -A && git commit -m "fix: handle edge case in launch"
```

### Feature Development Workflow

```bash
# 1. Start watch mode
cd nemoclaw && npm run dev &

# 2. Develop feature (watch auto-rebuilds)
vim nemoclaw/src/commands/new-feature.ts

# 3. Test incrementally
npm test test/new-feature.test.js

# 4. Stop watch mode
killall node

# 5. Final verification
make check && npm run test:all

# 6. Commit
git add -A && git commit -m "feat: add new feature"
```

## Success Criteria

✅ TypeScript compiles without errors  
✅ All type definitions generated  
✅ Source maps created  
✅ Build completes in <5 seconds  
✅ CLI still works after build

When all criteria are met, your build is ready! 🎉

## Related Commands

- `make check` - Run type checking + linting + formatting
- `npm run lint` - Check ESLint errors only
- `npm test` - Run tests (requires build)
- `npm run clean` - Remove build artifacts
