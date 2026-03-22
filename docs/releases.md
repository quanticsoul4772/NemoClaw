# Release Notes and Changelog Automation

NemoClaw uses automated release notes generation to ensure all changes are documented and agent contributions are properly tracked.

## Automated Systems

### 1. GitHub Actions Release Workflow

**Location**: `.github/workflows/release.yml`

**Triggers**:
- Push of version tags (`v*.*.*` pattern, e.g., `v0.2.0`, `v1.0.0`)
- Manual workflow dispatch

**What it does**:
1. **Generates categorized release notes** from git commits
2. **Creates GitHub Release** with auto-generated notes
3. **Updates CHANGELOG.md** with the new release
4. **Commits CHANGELOG.md** back to the repository

**Release Note Categories**:
- **Features**: Commits starting with `feat:` or `feature:`
- **Bug Fixes**: Commits starting with `fix:` or `bug:`
- **Documentation**: Commits starting with `docs:`
- **Security**: Commits starting with `security:`
- **Other Changes**: All other commits (limited to 20 most recent)
- **Contributors**: Automatic list of all contributors

**Example workflow run**:
```bash
# Create and push a version tag
git tag -a v0.2.0 -m "Release v0.2.0"
git push origin v0.2.0

# GitHub Actions automatically:
# 1. Generates release notes from v0.1.0..v0.2.0
# 2. Creates GitHub Release at https://github.com/NVIDIA/NemoClaw/releases/tag/v0.2.0
# 3. Updates CHANGELOG.md
# 4. Commits CHANGELOG back to main branch
```

### 2. Manual Changelog Generation

**Script**: `scripts/generate-changelog.js`

For local development or manual changelog updates:

**Basic usage** (generate from all tags):
```bash
npm run changelog
```

**Generate full history**:
```bash
npm run changelog:full
```

**Generate since specific tag**:
```bash
node scripts/generate-changelog.js --since v0.1.0
```

**Output**: Overwrites `CHANGELOG.md` with categorized changes

---

## CHANGELOG.md Format

The CHANGELOG follows [Keep a Changelog](https://keepachangelog.com/) format:

```markdown
# Changelog

## [Unreleased]

### Features
- feat: add new experimental feature (abc1234)

### Bug Fixes
- fix: resolve issue with inference routing (def5678)

### Documentation
- docs: update AGENTS.md with setup instructions (ghi9012)

## [0.2.0] - 2026-04-01

### Features
- feat: implement feature flag system (jkl3456)

### Contributors
- @alice
- @bob

[Unreleased]: https://github.com/NVIDIA/NemoClaw/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/NVIDIA/NemoClaw/releases/tag/v0.2.0
```

---

## Creating a Release

### Manual Release Process

**1. Update version**:
```bash
# Update version in package.json
npm version minor  # or major, patch
# This creates a git tag automatically
```

**2. Push tag to trigger automation**:
```bash
git push origin main --tags
```

**3. GitHub Actions runs automatically**:
- Generates release notes
- Creates GitHub Release
- Updates CHANGELOG.md

**4. Verify release**:
- Check GitHub Releases page
- Verify CHANGELOG.md was updated
- Review release notes for accuracy

### Automated Release (Future)

When release automation is fully configured (next signal), releases will happen automatically on merge to `main` via semantic versioning.

---

## Commit Message Conventions

To ensure good release notes, follow conventional commit format:

### Required Prefixes

- `feat:` or `feature:` → Listed under **Features**
- `fix:` or `bug:` → Listed under **Bug Fixes**
- `docs:` → Listed under **Documentation**
- `security:` → Listed under **Security**
- `test:` → Testing changes (not typically in release notes)
- `refactor:` → Code refactoring (listed in **Other Changes**)
- `chore:` → Build/tooling changes (listed in **Other Changes**)

### Examples

**Good commit messages**:
```
feat: add support for custom inference endpoints
fix: resolve memory leak in sandbox lifecycle
docs: update CONTRIBUTING.md with PR process
security: upgrade dependencies to patch CVE-2026-1234
```

**Bad commit messages** (won't be properly categorized):
```
Add feature
Fixed bug
Update docs
```

### For Autonomous Agents

When making commits, **always use conventional commit format**:
1. Start with a category prefix (`feat:`, `fix:`, `docs:`, etc.)
2. Write a clear, descriptive message (50 chars or less)
3. Add details in commit body if needed

This ensures your contributions are properly documented in release notes.

---

## Release Notes Review

Before publishing a release:

**1. Review generated notes**:
```bash
# View release notes locally
cat CHANGELOG.md
```

**2. Check for issues**:
- Missing important changes?
- Unclear descriptions?
- Sensitive information?

**3. Edit if needed**:
- Edit `CHANGELOG.md` directly before tagging
- Or edit GitHub Release after creation (releases are editable)

**4. Pre-release vs. full release**:
- Tags with `alpha`, `beta`, or `rc` are marked as pre-release automatically
- Examples: `v0.2.0-beta.1`, `v1.0.0-rc.1`

---

## CHANGELOG.md Maintenance

### Unreleased Section

The **Unreleased** section shows changes since the last tag:
- Automatically updated by release workflow
- Manually update with `npm run changelog` during development

### Historical Releases

Old releases are preserved in CHANGELOG.md with links to:
- Full GitHub comparison view
- Individual release pages
- Contributor lists

### Manual Edits

You can manually edit CHANGELOG.md:
- Add missing changes
- Improve descriptions
- Group related changes
- Highlight breaking changes

The automation will append new releases without overwriting your edits.

---

## For Developers

### Testing Release Workflow Locally

**1. Generate changelog without pushing**:
```bash
npm run changelog
git diff CHANGELOG.md  # Review changes
```

**2. Test release notes generation**:
```bash
# Simulate what GitHub Actions will do
git log --pretty=format:"- %s (%h)" --grep="^feat" -i v0.1.0..HEAD
```

**3. Verify commit categorization**:
```bash
# Check if your commits will be properly categorized
git log --oneline --grep="^feat:" HEAD~10..HEAD
git log --oneline --grep="^fix:" HEAD~10..HEAD
```

### Adding to CI/CD

The release workflow is already configured in `.github/workflows/release.yml`. To extend it:

**Add npm publishing**:
```yaml
- name: Publish to npm
  run: npm publish
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**Add Docker image publishing**:
```yaml
- name: Build and push Docker image
  uses: docker/build-push-action@v5
  with:
    tags: nvidia/nemoclaw:${{ steps.get_version.outputs.version }}
```

---

## Troubleshooting

### Changelog not updated after release

**Cause**: Git push to main might have failed
**Solution**: Manually run `npm run changelog` and commit

### Release notes missing changes

**Cause**: Commits don't follow conventional format
**Solution**: Ensure commits start with `feat:`, `fix:`, `docs:`, etc.

### Duplicate entries in CHANGELOG

**Cause**: Running `npm run changelog` after GitHub Actions
**Solution**: Pull latest changes before running locally

### Release workflow not triggering

**Cause**: Tag doesn't match `v*.*.*` pattern
**Solution**: Tag must start with `v` (e.g., `v0.2.0`, not `0.2.0`)

---

## References

- [Keep a Changelog](https://keepachangelog.com/) - Changelog format standard
- [Semantic Versioning](https://semver.org/) - Version numbering standard
- [Conventional Commits](https://www.conventionalcommits.org/) - Commit message format
- [GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github) - GitHub release documentation

---

**Last Updated**: 2026-03-22  
**For Questions**: See AGENTS.md or open a GitHub issue
