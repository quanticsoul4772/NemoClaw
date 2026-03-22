---
name: create-pr-workflow
description: Create a pull request workflow for agents working with branch protection. Use when you need to contribute changes to a repository with branch protection enabled that blocks direct pushes to main. This skill handles the full PR lifecycle - creating a feature branch, committing changes, pushing, creating the PR, and optionally auto-merging.
---

# Create PR Workflow for Agents

This skill enables autonomous agents to work with repositories that have branch protection enabled on the main branch. Instead of pushing directly to main (which is blocked), this workflow creates a feature branch and PR.

## Prerequisites

- You must be in the NemoClaw repository root
- GitHub CLI (`gh`) must be installed and authenticated
- You must have write access to the repository
- Branch protection must be enabled on main (which blocks direct pushes)

## When to Use

- **When direct push to main fails** - Branch protection prevents direct commits
- **When implementing new features** - Follow best practices with PRs
- **When you need review checkpoints** - PRs enable human/automated review
- **When you want clean git history** - PRs create clear attribution

## Quick Reference

```bash
# Complete PR workflow in one command chain
git checkout -b agent/my-feature && \
git add . && \
git commit -m "feat: description" && \
git push -u origin agent/my-feature && \
gh pr create --fill && \
gh pr merge --auto --squash --delete-branch
```

## Step-by-Step Workflow

### Step 1: Create Feature Branch

Create a branch from main with a descriptive name:

```bash
# Ensure you're on main and up-to-date
git checkout main
git pull origin main

# Create feature branch (use agent/ prefix for agent-created branches)
git checkout -b agent/feature-name

# Examples of good branch names:
# - agent/add-metrics-collection
# - agent/fix-sentry-initialization
# - agent/update-documentation
# - agent/refactor-onboarding
```

**Branch naming conventions:**
- Prefix with `agent/` to identify agent-created branches
- Use kebab-case (lowercase with hyphens)
- Be descriptive (feature/fix/docs/refactor)
- Keep under 50 characters

### Step 2: Make Your Changes

Edit files, create new files, whatever changes are needed:

```bash
# Make changes to files
# ... edit, create, delete files ...

# Check what changed
git status
git diff

# Stage all changes
git add .

# Or stage specific files
git add path/to/file1.ts path/to/file2.py
```

### Step 3: Commit Changes

Use conventional commits format:

```bash
git commit -m "feat: add new feature description"

# Or with body for more context
git commit -m "feat: add metrics collection

Implements metrics tracking for command duration and inference latency.
Integrates with existing observability infrastructure.

Co-authored-by: factory-droid[bot] <138933559+factory-droid[bot]@users.noreply.github.com>"
```

**Conventional commit types:**
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style (formatting, no logic change)
- `refactor:` - Code refactoring (no feature/fix)
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks
- `perf:` - Performance improvements
- `ci:` - CI/CD changes

### Step 4: Push Feature Branch

Push to the remote repository (this is NOT blocked by branch protection):

```bash
# First push - set upstream
git push -u origin agent/feature-name

# Subsequent pushes (if you make more commits)
git push
```

**Important:** Branch protection only blocks pushes to `main`. Feature branches can be pushed freely!

### Step 5: Create Pull Request

Create a PR using GitHub CLI:

```bash
# Create PR with auto-filled title and body from commits
gh pr create --fill

# Or specify title and body manually
gh pr create \
  --title "feat: Add metrics collection" \
  --body "This PR implements metrics tracking for command duration and inference latency."

# Create PR with specific base branch
gh pr create --fill --base main --head agent/feature-name

# Create draft PR (for work in progress)
gh pr create --fill --draft
```

**The `--fill` flag:**
- Automatically uses commit message as PR title
- Includes commit body as PR description
- Saves time for single-commit PRs

### Step 6: Auto-Merge (Optional)

If CI checks pass, automatically merge the PR:

```bash
# Enable auto-merge with squash strategy
gh pr merge --auto --squash --delete-branch

# This will:
# 1. Wait for required status checks to pass
# 2. Squash all commits into one
# 3. Merge to main
# 4. Delete the feature branch automatically
```

**Merge strategies:**
- `--squash` - Squash all commits into one (recommended for clean history)
- `--merge` - Standard merge commit
- `--rebase` - Rebase and fast-forward

**Manual merge (if auto-merge not desired):**
```bash
# Just create the PR, don't merge
gh pr create --fill

# Later, manually merge after review
gh pr merge 123 --squash --delete-branch
```

## Complete Examples

### Example 1: Single Feature Implementation

```bash
# Start fresh from main
git checkout main
git pull origin main

# Create feature branch
git checkout -b agent/add-health-checks

# Make changes
echo "Health check implementation" > bin/lib/health.js
git add bin/lib/health.js

# Commit with conventional format
git commit -m "feat: add health check endpoint

Implements /health endpoint for monitoring.
Returns status, uptime, and dependency checks.

Co-authored-by: factory-droid[bot] <138933559+factory-droid[bot]@users.noreply.github.com>"

# Push and create PR with auto-merge
git push -u origin agent/add-health-checks
gh pr create --fill
gh pr merge --auto --squash --delete-branch
```

### Example 2: Bug Fix with Multiple Commits

```bash
# Create fix branch
git checkout -b agent/fix-sentry-init

# Fix the bug
# ... make changes ...
git add bin/lib/sentry.js
git commit -m "fix: initialize Sentry before first use"

# Add tests
# ... write tests ...
git add test/sentry.test.js
git commit -m "test: add Sentry initialization tests"

# Push all commits
git push -u origin agent/fix-sentry-init

# Create PR (will show both commits)
gh pr create --fill

# Wait for CI, then manually merge when ready
# (or use --auto if you want automatic merge)
```

### Example 3: Documentation Update

```bash
# Create docs branch
git checkout -b agent/update-readme

# Update documentation
# ... edit README.md ...
git add README.md
git commit -m "docs: update installation instructions

Clarifies Node.js version requirement and adds troubleshooting section."

# Quick push and merge
git push -u origin agent/update-readme && \
gh pr create --fill && \
gh pr merge --auto --squash --delete-branch
```

## Handling CI Failures

If CI checks fail, you can't merge. Here's how to fix:

```bash
# Check PR status
gh pr status

# View CI check details
gh pr checks

# If checks failed, fix the issue
# ... make fixes ...
git add .
git commit -m "fix: resolve lint errors"
git push

# CI will automatically re-run
# Auto-merge will proceed once checks pass
```

## Handling Merge Conflicts

If your branch conflicts with main:

```bash
# Update your branch with latest main
git checkout agent/feature-name
git fetch origin
git merge origin/main

# Or use rebase for cleaner history
git rebase origin/main

# Resolve conflicts if any
# ... edit conflicted files ...
git add .
git rebase --continue  # if rebasing
# or
git commit  # if merging

# Push updated branch (may need --force-with-lease if rebased)
git push --force-with-lease
```

## Troubleshooting

### Error: "refusing to allow a Personal Access Token to create or update workflow"

**Problem:** GitHub blocks token-based pushes to `.github/workflows/` for security.

**Solution:** Use `--no-verify` to skip pre-commit hooks that might check this:
```bash
git commit -m "ci: update workflow" --no-verify
git push
```

Or request a maintainer to make workflow changes.

### Error: "required status checks have failed"

**Problem:** CI checks didn't pass.

**Solution:**
```bash
# View which checks failed
gh pr checks

# Fix the issues, commit, and push
# CI will re-run automatically
```

### Error: "branch protection prevents direct push to main"

**Problem:** You tried to push to main directly.

**Solution:** This is expected! Use this skill's workflow to create a PR instead.

## Advanced: Scripting the Workflow

For repetitive tasks, create a bash script:

```bash
#!/bin/bash
# create-agent-pr.sh

set -e  # Exit on any error

BRANCH_NAME="agent/$1"
COMMIT_MESSAGE="$2"

echo "Creating PR workflow for: $BRANCH_NAME"

# Create and switch to feature branch
git checkout -b "$BRANCH_NAME"

# Stage all changes
git add .

# Commit with message
git commit -m "$COMMIT_MESSAGE

Co-authored-by: factory-droid[bot] <138933559+factory-droid[bot]@users.noreply.github.com>"

# Push branch
git push -u origin "$BRANCH_NAME"

# Create PR with auto-merge
gh pr create --fill
gh pr merge --auto --squash --delete-branch

echo "✅ PR created and set to auto-merge!"
```

**Usage:**
```bash
chmod +x create-agent-pr.sh
./create-agent-pr.sh "add-feature" "feat: add new feature description"
```

## Best Practices for Agents

1. **Always use agent/ prefix** - Makes it clear which PRs are agent-created
2. **Use conventional commits** - Enables automated changelog generation
3. **Include Co-authored-by** - Gives credit to the agent
4. **Squash on merge** - Keeps main branch history clean
5. **Delete branches after merge** - Prevents branch clutter
6. **Enable auto-merge** - Reduces manual intervention
7. **Check CI status** - Don't merge if tests fail
8. **Keep PRs focused** - One feature/fix per PR

## Why This Workflow is Better

**Compared to direct pushes to main:**
- ✅ **Enables review** - Humans or automated tools can review before merge
- ✅ **CI validation** - Tests/lints run before changes hit main
- ✅ **Rollback capability** - Easy to revert a PR if issues found
- ✅ **Clear attribution** - Git history shows who/what made changes
- ✅ **Safer** - Branch protection prevents accidental bad commits
- ✅ **Standard practice** - Follows industry best practices

**For autonomous agents specifically:**
- Provides checkpoints where humans can intervene if needed
- Enables automated review tools to validate agent work
- Creates audit trail of agent-made changes
- Allows gradual rollout with feature flags
- Reduces risk of agent errors affecting production

## Integration with Other Skills

This skill works well with:
- **lint-and-format-code** - Run before committing to ensure CI passes
- **run-full-test-suite** - Verify tests pass before creating PR
- **check-code-quality** - Validate complexity/quality before PR
- **generate-release-notes** - PRs show up in automated changelogs

## Example: Full Development Cycle

```bash
# 1. Start feature
git checkout main && git pull origin main
git checkout -b agent/improve-error-handling

# 2. Make changes
# ... edit files ...

# 3. Run quality checks (using other skills)
npm run lint
npm test
npm run check-quality

# 4. Commit if checks pass
git add .
git commit -m "feat: improve error handling with better context

Adds structured error types and improved error messages.
Integrates with Sentry for better error tracking.

Co-authored-by: factory-droid[bot] <138933559+factory-droid[bot]@users.noreply.github.com>"

# 5. Push and create PR with auto-merge
git push -u origin agent/improve-error-handling
gh pr create --fill
gh pr merge --auto --squash --delete-branch

# 6. Monitor PR
gh pr status
gh pr checks

# Done! PR will auto-merge when CI passes
```

## Summary

This skill transforms branch protection from a blocker into a feature by establishing a proper PR workflow for agents. It ensures:
- ✅ Compliance with branch protection rules
- ✅ Proper review and validation checkpoints
- ✅ Clean git history with clear attribution
- ✅ Automated merging when checks pass
- ✅ Industry best practices for code collaboration

**Remember:** Branch protection blocking direct pushes to main is a GOOD thing. It forces proper workflows that make the codebase safer and more maintainable.
