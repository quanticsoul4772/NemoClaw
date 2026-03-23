---
name: generate-release-notes
description: Generate changelog and release notes from git commits. Use when preparing releases, updating CHANGELOG.md, or documenting changes. Trigger keywords - changelog, release notes, release, version, what changed.
---

# Generate Release Notes

Generate release notes and changelog from git commit history using conventional commit conventions.

## Prerequisites

- You must be in the NemoClaw repository root
- Git repository must have commit history
- Node.js 20+ must be installed
- Dependencies must be installed (`npm install`)

## When to Use

- **Before creating a release** - Document what's changed
- **Updating CHANGELOG.md** - Keep changelog current
- **Release announcements** - Generate user-facing release notes
- **Version planning** - See what features are ready to ship
- **Contributor attribution** - Acknowledge all contributors

## Quick Commands

### Generate Full Changelog

```bash
# Generate complete changelog from all commits
npm run changelog:full
```

Creates/updates `CHANGELOG.md` with all releases.

### Generate Latest Release Notes

```bash
# Generate notes for latest changes
npm run changelog
```

Generates notes from last tag to HEAD (or all commits if no tags).

### Manual Generation with Script

```bash
# Generate release notes for specific version
node scripts/generate-changelog.js --version v0.2.0

# Generate from specific tag range
node scripts/generate-changelog.js --from v0.1.0 --to HEAD
```

## Commit Message Conventions

NemoClaw uses **Conventional Commits** for automated changelog generation:

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types (determines changelog section)

- **feat**: New feature → **Features** section
- **fix**: Bug fix → **Bug Fixes** section
- **docs**: Documentation → **Documentation** section
- **style**: Code style (formatting, no logic change) → **Style** section
- **refactor**: Code refactoring → **Refactoring** section
- **perf**: Performance improvement → **Performance** section
- **test**: Adding tests → **Tests** section
- **build**: Build system changes → **Build System** section
- **ci**: CI configuration → **CI** section
- **chore**: Other changes (no user impact) → Not included in changelog
- **security**: Security fixes → **Security** section

### Examples

**Feature:**
```
feat(inference): add support for Nemotron-4 340B model

Implements support for the new Nemotron-4 340B instruction model
with optimized prompt templates for better quality.

Closes #123
```

**Bug Fix:**
```
fix(sandbox): prevent memory leak in long-running sandboxes

Properly clean up event listeners and timers when sandbox is stopped.
Reduces memory usage by ~50MB per sandbox.

Fixes #456
```

**Breaking Change:**
```
feat(cli)!: change onboard command to require --profile flag

BREAKING CHANGE: The onboard command now requires an explicit
--profile flag. Users must specify the inference profile.

Migration: `nemoclaw onboard --profile vllm`
```

**Security Fix:**
```
security: validate sandbox names to prevent path traversal

Adds input validation to prevent malicious sandbox names from
accessing files outside allowed directories.

CVE-2024-12345
```

### Breaking Changes

Mark breaking changes with `!` after type:

```
feat(api)!: change authentication method
```

Or use `BREAKING CHANGE:` in footer:

```
refactor(config): restructure configuration format

BREAKING CHANGE: Configuration file format has changed.
See migration guide in docs/migration-v0.2.md
```

## Changelog Structure

Generated `CHANGELOG.md` follows Keep a Changelog format:

```markdown
# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Features
- Add support for Nemotron-4 340B model (#123)
- Implement automatic sandbox cleanup (#145)

### Bug Fixes
- Fix memory leak in long-running sandboxes (#456)
- Prevent race condition in parallel inference (#478)

### Documentation  
- Update quickstart guide with new examples (#234)
- Add troubleshooting section to README (#267)

## [0.1.0] - 2026-03-15

### Features
- Initial release of NemoClaw
- OpenClaw plugin for NVIDIA inference
- Blueprint-based sandbox orchestration

### Security
- Add secret scanning to prevent credential leaks (#89)
```

## Release Process

### 1. Review Recent Commits

```bash
# Check commits since last release
git log v0.1.0..HEAD --oneline
```

Verify:
- All commits follow conventional commit format
- Breaking changes are marked with `!` or `BREAKING CHANGE:`
- Important changes have descriptive messages

### 2. Generate Release Notes

```bash
# Generate changelog
npm run changelog

# Review the generated CHANGELOG.md
cat CHANGELOG.md
```

### 3. Create Release Tag

```bash
# Update version in package.json
npm version minor  # or major/patch

# This creates a git tag (e.g., v0.2.0)
# Automatically updates package.json and package-lock.json
```

### 4. Push Release

```bash
# Push commits and tags
git push origin main --tags
```

GitHub Actions will automatically:
- Generate release notes from commits
- Create GitHub release
- Publish Docker image
- Publish npm package
- Update CHANGELOG.md

## Advanced Usage

### Custom Date Range

```bash
# Generate notes for specific range
git log --since="2026-01-01" --until="2026-02-01" --oneline

# Then generate changelog
node scripts/generate-changelog.js --since 2026-01-01
```

### Filter by Type

```bash
# Show only features
git log --oneline --grep="^feat"

# Show only bug fixes
git log --oneline --grep="^fix"

# Show breaking changes
git log --oneline --grep="BREAKING CHANGE"
```

### Contributor Attribution

```bash
# List contributors for release
git log v0.1.0..HEAD --format="%an <%ae>" | sort -u

# Thank contributors in release notes
git shortlog v0.1.0..HEAD --summary --numbered
```

## GitHub Release Integration

Releases are automated via `.github/workflows/release.yml`:

**Trigger**: Push version tag (`v*.*.*`)

**Workflow**:
1. Generate release notes from commits
2. Create GitHub release
3. Upload CHANGELOG.md as release asset
4. Publish Docker image to ghcr.io
5. Publish npm package to registry

**Example release notes** (auto-generated):

```markdown
## What's Changed

### Features ✨
- Add Nemotron-4 340B support by @username in #123
- Implement automatic cleanup by @username in #145

### Bug Fixes 🐛
- Fix memory leak in sandboxes by @username in #456
- Prevent race condition in inference by @username in #478

### Documentation 📚
- Update quickstart guide by @username in #234

### Security 🔒
- Validate sandbox names by @username in #567

**Full Changelog**: v0.1.0...v0.2.0
```

## Best Practices

### Writing Good Commit Messages

**Do**:
```
feat(inference): add support for custom model parameters

Allows users to pass custom parameters to inference calls,
including temperature, top_p, and max_tokens.

Closes #123
```

**Don't**:
```
Update files  # Too vague
Fixed bug     # No context
wip           # Not descriptive
```

### Organizing Releases

1. **Semantic Versioning**:
   - **MAJOR** (1.0.0): Breaking changes
   - **MINOR** (0.2.0): New features, backwards-compatible
   - **PATCH** (0.1.1): Bug fixes, backwards-compatible

2. **Release Frequency**:
   - Patch releases: As needed for bug fixes
   - Minor releases: Every 2-4 weeks for features
   - Major releases: When breaking changes accumulate

3. **Pre-releases**:
   - Alpha: `v0.2.0-alpha.1` (internal testing)
   - Beta: `v0.2.0-beta.1` (external testing)
   - RC: `v0.2.0-rc.1` (release candidate)

### Maintaining CHANGELOG.md

1. **Keep Unreleased section** - Accumulate changes between releases
2. **Move to version section** - When creating release
3. **Add release date** - `## [0.2.0] - 2026-03-22`
4. **Link to diffs** - `[0.2.0]: https://github.com/.../compare/v0.1.0...v0.2.0`

## Common Issues

### Commits Not Following Convention

**Problem**: Commit doesn't match `type(scope): message` format

**Fix**: Amend the commit message:

```bash
# Amend last commit
git commit --amend -m "feat(cli): add new command"

# Reword older commit (interactive rebase)
git rebase -i HEAD~5
# Change 'pick' to 'reword' for commits to fix
```

### Missing Scope

Scope is optional but recommended:

```
feat: add support for custom parameters        # OK
feat(inference): add support for custom params  # Better
```

### Breaking Changes Not Marked

**Problem**: Breaking change not marked with `!` or `BREAKING CHANGE:`

**Fix**: Add to commit message:

```
feat(config)!: change configuration format

BREAKING CHANGE: Config file structure has changed.
See migration guide in docs/migration.md
```

## Example Release Workflow

```bash
# 1. Check what's changed since last release
git log v0.1.0..HEAD --oneline

# 2. Ensure all commits follow conventions
# Fix any non-conforming commits with rebase

# 3. Generate changelog
npm run changelog:full

# 4. Review CHANGELOG.md
cat CHANGELOG.md

# 5. Update version
npm version minor  # Creates v0.2.0 tag

# 6. Push to trigger release automation
git push origin main --tags

# GitHub Actions automatically:
# - Creates GitHub release
# - Generates release notes
# - Publishes Docker image
# - Publishes npm package
```

## Success Criteria

✅ All commits follow conventional commit format  
✅ Breaking changes are clearly marked  
✅ CHANGELOG.md is up-to-date  
✅ Version follows semantic versioning  
✅ Release notes are comprehensive and clear  
✅ Contributors are properly attributed

When all criteria are met, your release is ready to publish! 🎉

## Related Commands

- `git tag` - Create version tags
- `npm version` - Bump version and create tag
- `git log --oneline` - View commit history
- `git push --tags` - Push tags to remote

## Resources

- [Conventional Commits](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)
- [Keep a Changelog](https://keepachangelog.com/)
- [GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github)
