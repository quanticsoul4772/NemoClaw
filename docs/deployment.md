# Deployment and Release Automation

NemoClaw has fully automated release pipelines that handle Docker image publishing and npm package distribution.

## Automated Release Pipeline

When you create a GitHub Release, the following automation runs automatically:

```text
graph LR
    A[Push Tag v*.*.* ] --> B[Generate Release Notes]
    B --> C[Create GitHub Release]
    C --> D[Build & Publish Docker Image]
    C --> E[Publish to npm Registry]
    B --> F[Update CHANGELOG.md]
    D --> G[Generate SBOM]
```

### 1. Release Notes Generation

**Workflow**: `.github/workflows/release.yml`

**Triggered by**: Pushing a version tag (`v0.2.0`, `v1.0.0`, etc.)

**Actions**:
- Generates categorized release notes from git commits
- Creates GitHub Release with auto-generated notes
- Updates `CHANGELOG.md` with the new release
- Commits CHANGELOG back to main branch
- Triggers Docker and npm publishing workflows

**See**: [docs/releases.md](./releases.md) for release notes documentation

### 2. Docker Image Publishing

**Workflow**: `.github/workflows/publish-docker.yml`

**Triggered by**: GitHub Release publication or manual dispatch

**Actions**:
- Builds NemoClaw sandbox Docker image
- Pushes to GitHub Container Registry (`ghcr.io/nvidia/nemoclaw`)
- Creates multi-architecture images (linux/amd64, linux/arm64)
- Generates Software Bill of Materials (SBOM)
- Tags images with semantic versions and `latest`

**Published images**:
```bash
# Latest stable release
ghcr.io/nvidia/nemoclaw:latest

# Specific version
ghcr.io/nvidia/nemoclaw:0.2.0
ghcr.io/nvidia/nemoclaw:0.2
ghcr.io/nvidia/nemoclaw:0

# Pre-releases (alpha, beta, rc) don't get 'latest' tag
ghcr.io/nvidia/nemoclaw:0.2.0-beta.1
```

**Using published images**:
```bash
# Pull latest stable image
docker pull ghcr.io/nvidia/nemoclaw:latest

# Pull specific version
docker pull ghcr.io/nvidia/nemoclaw:0.2.0

# Run the sandbox
docker run -it ghcr.io/nvidia/nemoclaw:latest
```

### 3. npm Package Publishing

**Workflow**: `.github/workflows/publish-npm.yml`

**Triggered by**: GitHub Release publication or manual dispatch

**Actions**:
- Builds TypeScript plugin
- Runs test suite
- Publishes to npm registry
- Generates provenance attestation
- Tags pre-releases with `next` tag

**Published packages**:
```bash
# Stable releases
npm install nemoclaw@latest

# Pre-releases
npm install nemoclaw@next

# Specific version
npm install nemoclaw@0.2.0
```

---

## Creating a Release

### Automatic Release (Recommended)

**1. Prepare release**:
```bash
# Update version in package.json
npm version minor  # or major, patch
# This creates a git tag automatically (e.g., v0.2.0)

# Review changes
git log v0.1.0..HEAD --oneline

# Verify tests pass
npm test
```

**2. Push tag to trigger automation**:
```bash
git push origin main --tags
```

**3. Automation runs automatically**:
- ✅ Release notes generated and GitHub Release created
- ✅ Docker image built and pushed to ghcr.io
- ✅ npm package published to registry
- ✅ CHANGELOG.md updated and committed

**4. Verify deployment**:
```bash
# Check Docker image
docker pull ghcr.io/nvidia/nemoclaw:latest

# Check npm package
npm view nemoclaw

# Verify GitHub Release
# Visit: https://github.com/NVIDIA/NemoClaw/releases
```

### Manual Release (Advanced)

If automation fails or you need manual control:

**Docker image**:
```bash
# Trigger manually from GitHub Actions UI
# Go to: Actions → Publish Docker Image → Run workflow
# Enter tag (e.g., "0.2.0")
```

**npm package**:
```bash
# Build and publish locally
cd nemoclaw && npm run build
npm publish --access public
```

---

## Pre-Release Versions

For alpha, beta, or release candidate versions:

**1. Create pre-release tag**:
```bash
npm version prerelease --preid=beta
# Creates tag like v0.2.0-beta.1

git push origin main --tags
```

**2. Automation handles pre-releases differently**:
- ✅ Docker image published but **NOT** tagged as `latest`
- ✅ npm package published with `next` tag (not `latest`)
- ✅ GitHub Release marked as "Pre-release"

**Installing pre-releases**:
```bash
# Docker
docker pull ghcr.io/nvidia/nemoclaw:0.2.0-beta.1

# npm
npm install nemoclaw@next
```

---

## Release Channels

### Stable Channel

- **Docker tag**: `latest`
- **npm tag**: `latest` (default)
- **Trigger**: GitHub Release without pre-release flag
- **Use case**: Production deployments

### Pre-release Channel

- **Docker tags**: Version-specific (e.g., `0.2.0-beta.1`)
- **npm tag**: `next`
- **Trigger**: GitHub Release marked as pre-release
- **Use case**: Testing, early adopters, CI

---

## Deployment Verification

### Verify Docker Image

```bash
# Check image exists and metadata
docker manifest inspect ghcr.io/nvidia/nemoclaw:latest

# Run smoke test
docker run --rm ghcr.io/nvidia/nemoclaw:latest \
  openclaw --version

# Check SBOM (Software Bill of Materials)
# Available as release asset on GitHub Releases page
```

### Verify npm Package

```bash
# Check package metadata
npm view nemoclaw

# Check published files
npm pack nemoclaw --dry-run

# Install and test
npm install -g nemoclaw
nemoclaw help
```

### Verify GitHub Release

**Checklist**:
- [ ] Release notes are complete and accurate
- [ ] CHANGELOG.md was updated
- [ ] Docker image appears in Packages tab
- [ ] npm package appears on npmjs.com
- [ ] SBOM is attached to release
- [ ] Pre-release flag is correct (if applicable)

---

## Rollback Procedures

### Rollback Docker Image

Docker images are immutable, so "rollback" means pointing users to previous version:

```bash
# Users can pin to previous version
docker pull ghcr.io/nvidia/nemoclaw:0.1.0

# Or re-tag previous version as latest (requires admin)
docker pull ghcr.io/nvidia/nemoclaw:0.1.0
docker tag ghcr.io/nvidia/nemoclaw:0.1.0 ghcr.io/nvidia/nemoclaw:latest
docker push ghcr.io/nvidia/nemoclaw:latest
```

### Rollback npm Package

**Deprecate bad version**:
```bash
npm deprecate nemoclaw@0.2.0 "Version 0.2.0 has issues, please use 0.1.0"
```

**Publish patch version**:
```bash
# Fix issues
npm version patch  # e.g., 0.2.1
git push origin main --tags
# Automation publishes fixed version
```

### Delete GitHub Release

If release was created in error:

1. Go to GitHub Releases page
2. Click "Delete" on the release
3. Delete the git tag: `git push --delete origin v0.2.0`
4. Clean up published artifacts manually

---

## Continuous Deployment (CD) Status

### Current State

✅ **Fully automated**:
- Release notes generation (on tag push)
- Docker image publishing (GitHub Container Registry)
- npm package publishing (npm registry)
- CHANGELOG.md updates
- SBOM generation

❌ **Not automated** (manual for now):
- Production deployment (requires manual infrastructure setup)
- Brev instance deployment (manual via `nemoclaw deploy`)

### Future Enhancements

**Planned**:
- [ ] Automated deployment to staging environment
- [ ] Smoke tests on published images
- [ ] Automatic rollback on deployment failures
- [ ] GitOps deployment via ArgoCD/Flux
- [ ] Canary deployments for gradual rollout

---

## For Autonomous Agents

When contributing code that requires a release:

**1. Ensure tests pass**:
```bash
npm test
npm run test:all  # Unit + integration
```

**2. Follow semantic versioning**:
- **Major** (v1.0.0): Breaking changes
- **Minor** (v0.2.0): New features, backwards-compatible
- **Patch** (v0.1.1): Bug fixes, no new features

**3. Use conventional commits**:
```
feat: add new feature → Minor version bump
fix: resolve bug → Patch version bump
BREAKING CHANGE: ... → Major version bump
```

**4. Let maintainers handle releases**:
- Don't create tags or releases yourself
- PRs are merged to main
- Maintainers create releases when appropriate

**5. Release will auto-publish**:
- Your changes are documented in release notes
- Docker image includes your code
- npm package updated automatically

---

## Security Considerations

### Secrets Required

GitHub repository secrets that must be configured:

| Secret | Purpose | Where to Get |
|--------|---------|--------------|
| `GITHUB_TOKEN` | Create releases, push images to ghcr.io | Auto-provided by GitHub |
| `NPM_TOKEN` | Publish to npm registry | https://www.npmjs.com/settings/tokens |

**Setting up NPM_TOKEN**:
1. Go to https://www.npmjs.com/settings/YOUR_USERNAME/tokens
2. Create "Automation" token
3. Add as repository secret in GitHub Settings → Secrets → NPM_TOKEN

### Image Signing (Future)

When implemented, Docker images will be signed with cosign:
```bash
# Verify signed image
cosign verify ghcr.io/nvidia/nemoclaw:latest
```

---

## Monitoring Deployments

### GitHub Actions

Monitor deployment status:
- **Actions tab**: https://github.com/NVIDIA/NemoClaw/actions
- **Packages tab**: https://github.com/orgs/NVIDIA/packages?repo_name=NemoClaw
- **Releases tab**: https://github.com/NVIDIA/NemoClaw/releases

### npm Registry

Monitor package health:
- **Package page**: https://www.npmjs.com/package/nemoclaw
- **Download stats**: https://npm-stat.com/charts.html?package=nemoclaw

### Alerts

Currently manual monitoring. Future automation:
- Deploy failure notifications → Slack
- Download metrics → Datadog
- Security vulnerabilities → PagerDuty

---

## Troubleshooting

### Docker build fails

**Error**: "failed to solve: process ... did not complete successfully"

**Solution**: Check build logs in GitHub Actions, ensure all dependencies are available

### npm publish fails

**Error**: "403 Forbidden" or "401 Unauthorized"

**Solution**: Verify NPM_TOKEN secret is set correctly and has publish permissions

### Release workflow doesn't trigger

**Error**: Tag pushed but no workflow run appears

**Solution**: Ensure tag matches `v*.*.*` pattern (must start with 'v')

### CHANGELOG not updated

**Error**: Release created but CHANGELOG.md unchanged

**Solution**: Check workflow logs for git push errors, verify bot has write permissions

---

## References

- [GitHub Actions - Publishing Docker images](https://docs.github.com/en/actions/publishing-packages/publishing-docker-images)
- [GitHub Actions - Publishing Node packages](https://docs.github.com/en/actions/publishing-packages/publishing-nodejs-packages)
- [Semantic Versioning](https://semver.org/)
- [GitHub Container Registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)

---

**Last Updated**: 2026-03-22  
**For Questions**: See AGENTS.md or open a GitHub issue
