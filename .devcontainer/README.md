# NemoClaw Dev Container

This directory contains the VS Code Dev Container configuration for NemoClaw development.

## What is a Dev Container?

A development container (devcontainer) is a fully configured development environment running in a Docker container. It provides a consistent, reproducible environment for all contributors, whether human developers or autonomous AI agents.

## Features

This devcontainer includes:

### Base Environment
- **Node.js 22** (Debian Bookworm base image)
- **Python 3.11** with pip, uv, and development tools
- **Docker-in-Docker** for testing containerized workflows
- **Git** with LFS support

### VS Code Extensions

**TypeScript/JavaScript:**
- ESLint - Linting and code quality
- Prettier - Code formatting
- TypeScript Next - Latest TypeScript language features

**Python:**
- Python extension - IntelliSense, debugging, testing
- Pylance - Fast type checking
- Ruff - Fast Python linter and formatter

**Git:**
- GitLens - Git supercharged (blame, history, etc.)
- GitHub Pull Requests - Review and manage PRs from VS Code

**Documentation:**
- Markdown All in One - Markdown authoring
- markdownlint - Markdown linting

**General:**
- EditorConfig - Consistent coding styles
- Code Spell Checker - Catch typos

### Pre-Configured Settings

- **TypeScript**: Auto-format on save with Prettier, ESLint auto-fix
- **Python**: Auto-format on save with Ruff, import organization
- **Editor**: 100-character ruler, 2-space tabs, trim whitespace
- **Git**: Auto-fetch enabled, safe directory configured

### Automatic Setup

The `postCreate.sh` script runs after container creation:
1. Installs Python dependencies (uv sync)
2. Installs TypeScript dependencies (npm install)
3. Installs root dependencies (test runner, code quality tools)
4. Installs pre-commit hooks
5. Builds TypeScript plugin
6. Displays quick start guide

## Using the Dev Container

### First Time Setup

1. **Install Prerequisites:**
   - [Visual Studio Code](https://code.visualstudio.com/)
   - [Docker Desktop](https://www.docker.com/products/docker-desktop)
   - [Remote - Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)

2. **Open in Container:**
   - Clone the repository
   - Open the folder in VS Code
   - Click "Reopen in Container" when prompted
   - Or use Command Palette (F1): `Dev Containers: Reopen in Container`

3. **Wait for Initialization:**
   - First build takes ~2-3 minutes
   - Subsequent starts are much faster (~30 seconds)
   - Watch the progress in the terminal

4. **Start Developing:**
   - All dependencies are installed
   - Pre-commit hooks are configured
   - TypeScript is built and ready
   - You can immediately run `npm test`, `make check`, etc.

### Rebuilding the Container

If you modify `.devcontainer/devcontainer.json` or `postCreate.sh`:

1. Command Palette (F1): `Dev Containers: Rebuild Container`
2. Or: `Dev Containers: Rebuild Without Cache` for a clean rebuild

### SSH Keys and Git

The devcontainer mounts your local `~/.ssh` directory (read-only) so you can use your SSH keys for Git operations without copying them into the container.

## For Autonomous Agents

The devcontainer provides a fully configured environment for autonomous AI agents:

**Benefits:**
- Consistent environment across all agents
- No "works on my machine" issues
- All tools pre-installed and configured
- Editor settings enforce code quality
- Pre-commit hooks automatically configured

**Agent Workflow:**
1. Open repository in devcontainer
2. Environment is ready - no setup needed
3. Make changes with all tools available
4. Pre-commit hooks run automatically on commit
5. All linters, formatters, type checkers work out of the box

**Testing Agent Changes:**
```bash
# All these commands work immediately in the devcontainer:
npm test                    # Run unit tests
cd nemoclaw && npm run check  # TypeScript checks
cd nemoclaw-blueprint && make check  # Python checks
make complexity             # Complexity analysis
make dead-code              # Dead code detection
make duplicates             # Duplicate code detection
make tech-debt              # Technical debt tracking
```

## Troubleshooting

### Container Won't Build
- Check Docker is running: `docker ps`
- Check disk space: `docker system df`
- Try rebuild without cache

### Slow Performance
- Allocate more resources to Docker (Settings → Resources)
- Use Docker volumes for node_modules (already configured)

### Extensions Not Working
- Reload window: `Developer: Reload Window`
- Reinstall extension inside container

### Post-Create Script Failed
- Check terminal output for specific error
- Run manually: `.devcontainer/postCreate.sh`
- Report issue with error message

## Configuration Files

- **devcontainer.json**: Main configuration (image, features, extensions, settings)
- **postCreate.sh**: Initialization script (dependencies, hooks, build)
- **README.md**: This file (documentation)

## Customization

To customize for your workflow:

1. **Add Extensions:** Edit `customizations.vscode.extensions` in devcontainer.json
2. **Change Settings:** Edit `customizations.vscode.settings` in devcontainer.json
3. **Add Tools:** Edit `postCreate.sh` to install additional tools
4. **Change Base Image:** Edit `image` in devcontainer.json (requires rebuild)

## References

- [VS Code Dev Containers](https://code.visualstudio.com/docs/devcontainers/containers)
- [devcontainer.json reference](https://containers.dev/implementors/json_reference/)
- [Dev Container Features](https://containers.dev/features)
- [NemoClaw AGENTS.md](../AGENTS.md) - Full development guide

---

**Questions?** See [CONTRIBUTING.md](../CONTRIBUTING.md) or ask in GitHub Discussions.
