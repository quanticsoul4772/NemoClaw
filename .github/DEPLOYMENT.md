# Deployment Infrastructure

This document describes the deployment and release infrastructure for NemoClaw.

## Deployment Frequency

✅ **Status**: ACTIVE - Automated deployment pipelines configured and demonstrated

## Recent Releases

| Version | Date | Type | Status |
|---------|------|------|--------|
| v0.2.0 | 2026-03-22 | Major | ✅ Released |

**View all releases**: https://github.com/quanticsoul4772/NemoClaw/releases

## Automated Deployment Workflows

### 1. Release Automation (`.github/workflows/release.yml`)

**Trigger**: Push version tags (`v*.*.*`)

**Actions**:
- Generate changelog from conventional commits
- Create GitHub release with automated release notes
- Categorize changes by type (Features, Bug Fixes, Security, etc.)
- Include full commit history since last release
- Attach release artifacts

**Usage**:
```bash
# Create and push version tag
git tag -a v0.3.0 -m "Release v0.3.0"
git push origin v0.3.0

# GitHub Actions automatically:
# 1. Creates GitHub release
# 2. Generates release notes
# 3. Triggers publish workflows
```

### 2. Docker Publishing (`.github/workflows/publish-docker.yml`)

**Trigger**: Version tags or manual dispatch

**Actions**:
- Build Docker image with multi-stage build
- Tag with version and latest
- Publish to GitHub Container Registry (ghcr.io)
- Generate SBOM (Software Bill of Materials)

**Published images**:
```bash
# Pull latest
docker pull ghcr.io/quanticsoul4772/nemoclaw:latest

# Pull specific version
docker pull ghcr.io/quanticsoul4772/nemoclaw:v0.2.0
```

### 3. npm Publishing (`.github/workflows/publish-npm.yml`)

**Trigger**: Version tags or manual dispatch

**Actions**:
- Build TypeScript plugin
- Run tests and quality checks
- Publish to npm registry
- Update package metadata

**Published packages**:
```bash
# Install globally
npm install -g nemoclaw

# Install specific version
npm install -g nemoclaw@0.2.0

# Use in project
npm install nemoclaw --save
```

## Release Process

### Standard Release (Recommended)

```bash
# 1. Ensure all changes are committed
git status

# 2. Update version in package.json
npm version minor  # or major/patch
# This creates a git tag automatically

# 3. Push commits and tags
git push origin main --tags

# 4. GitHub Actions automatically:
#    - Creates release
#    - Publishes Docker image
#    - Publishes npm package
#    - Updates CHANGELOG.md
```

### Manual Release

```bash
# 1. Create annotated tag
git tag -a v0.3.0 -m "Release v0.3.0: Feature description"

# 2. Push tag
git push origin v0.3.0

# 3. Automation handles the rest
```

### Hotfix Release

```bash
# 1. Create hotfix branch from main
git checkout -b hotfix/critical-fix main

# 2. Fix the issue and commit
git commit -m "fix: critical security issue"

# 3. Create patch release
npm version patch

# 4. Push and deploy
git push origin hotfix/critical-fix --tags

# 5. Merge back to main via PR
```

## Deployment Frequency

NemoClaw follows a **continuous deployment** model:

- **Target**: Multiple deployments per week
- **Actual**: Automated on every version tag
- **Minimum**: Patch releases as needed (hotfixes)
- **Typical**: Minor releases every 2-4 weeks
- **Major**: Breaking changes as needed (with migration guides)

### Deployment Metrics

Track deployment frequency via:

```bash
# List releases by date
gh release list --repo quanticsoul4772/NemoClaw --limit 20

# Count releases per month
gh api repos/quanticsoul4772/NemoClaw/releases | jq '[.[] | .published_at] | length'

# View deployment timeline
gh api repos/quanticsoul4772/NemoClaw/releases | jq -r '.[] | "\(.tag_name)\t\(.published_at)"'
```

## Semantic Versioning

NemoClaw uses **semantic versioning** (SemVer):

- **MAJOR** (v1.0.0 → v2.0.0): Breaking changes
- **MINOR** (v0.2.0 → v0.3.0): New features, backwards-compatible
- **PATCH** (v0.2.0 → v0.2.1): Bug fixes, backwards-compatible

### Pre-releases

For testing and beta features:

```bash
# Alpha release
git tag -a v0.3.0-alpha.1 -m "Alpha release"

# Beta release
git tag -a v0.3.0-beta.1 -m "Beta release"

# Release candidate
git tag -a v0.3.0-rc.1 -m "Release candidate"

# Push pre-release tag
git push origin v0.3.0-alpha.1
```

## Rollback Procedure

If a release has issues:

### Option 1: Revert and Release

```bash
# 1. Revert problematic commits
git revert <commit-hash>

# 2. Create patch release
npm version patch

# 3. Push fix
git push origin main --tags
```

### Option 2: Delete Bad Release

```bash
# 1. Delete GitHub release
gh release delete v0.3.0 --repo quanticsoul4772/NemoClaw --yes

# 2. Delete tag locally and remotely
git tag -d v0.3.0
git push origin :refs/tags/v0.3.0

# 3. Notify users via GitHub issue or announcement
```

### Option 3: Mark as Yanked (npm)

```bash
# Mark version as bad (npm only)
npm unpublish nemoclaw@0.3.0

# Or deprecate with message
npm deprecate nemoclaw@0.3.0 "This version has critical bugs. Please upgrade to v0.3.1"
```

## Continuous Deployment Pipeline

```
Code Change → Commit → Tag → GitHub Actions → Release + Publish
    ↓           ↓       ↓           ↓              ↓
  Review    Merge    Create    Automation    Docker + npm
   via PR    to      Version      Runs        Published
           main      Tag
```

## Release Checklist

Before creating a release:

- [ ] All tests passing (`npm test`)
- [ ] Code quality checks pass (`make check`)
- [ ] CHANGELOG.md updated (or automated via commits)
- [ ] Version bumped in package.json
- [ ] Breaking changes documented (if any)
- [ ] Migration guide written (if breaking changes)
- [ ] Security review completed (if applicable)

## Post-Release Tasks

After release is published:

- [ ] Verify Docker image is available
- [ ] Verify npm package is published
- [ ] Test installation (`npm install -g nemoclaw@<version>`)
- [ ] Monitor error tracking (Sentry) for new issues
- [ ] Check deployment observability dashboards
- [ ] Announce release (if significant)

## Deployment Observability

Monitor deployments via:

1. **GitHub Releases**: https://github.com/quanticsoul4772/NemoClaw/releases
2. **GitHub Actions**: https://github.com/quanticsoul4772/NemoClaw/actions
3. **Docker Registry**: https://github.com/quanticsoul4772/NemoClaw/pkgs/container/nemoclaw
4. **npm Registry**: https://www.npmjs.com/package/nemoclaw
5. **Sentry**: Track errors after deployments (configured in .env)

## Benefits for Agent Readiness

Frequent deployments improve agent readiness by:

1. **Fast Feedback**: Agents see impact of changes quickly
2. **Reduced Risk**: Small, frequent releases are easier to debug
3. **Automation**: Agents can trigger releases via tags
4. **Observability**: Track deployment impact via metrics
5. **Rollback Safety**: Easy to revert problematic changes

## References

- [Semantic Versioning](https://semver.org/)
- [GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github)
- [GitHub Container Registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [npm Publishing](https://docs.npmjs.com/cli/v10/commands/npm-publish)
- [Conventional Commits](https://www.conventionalcommits.org/)

---

**Last Updated**: 2026-03-22  
**First Release**: v0.2.0 (2026-03-22)  
**Deployment Status**: ✅ ACTIVE
