# AGENTS.md - NemoClaw Development Guide for Autonomous Agents

This document provides essential information for autonomous AI agents working on the NemoClaw codebase. It covers setup, commands, conventions, and project-specific knowledge.

---

## Project Overview

**NemoClaw** is a TypeScript/Python hybrid project that provides an OpenClaw plugin for OpenShell with NVIDIA inference routing. The project consists of:

- **TypeScript Plugin** (`nemoclaw/`): CLI commands and OpenClaw plugin integration
- **Python Blueprint** (`nemoclaw-blueprint/`): Sandbox orchestration and policy management
- **CLI Scripts** (`bin/`): Node.js entry points and helper scripts
- **Tests** (`test/`): Node.js test runner unit tests
- **Documentation** (`docs/`): Sphinx-based documentation

**Key Technologies:**
- TypeScript 5.4+ with strict mode
- Python 3.11+ with Ruff linter/formatter
- Node.js 20+ test runner
- Sphinx for documentation

---

## Repository Structure

```
NemoClaw/
├── .pre-commit-config.yaml    # Pre-commit hooks configuration
├── .env.example                # Environment variable template
├── .gitignore                  # Comprehensive gitignore with security protections
├── Makefile                    # Top-level build/lint/docs commands
├── package.json                # Root npm package (test runner)
├── pyproject.toml              # Root Python config (docs dependencies)
│
├── bin/                        # Node.js CLI entry points
│   ├── nemoclaw.js             # Main CLI dispatcher
│   └── lib/                    # CLI helper modules
│       ├── onboard.js          # Onboarding wizard
│       ├── policies.js         # Policy management
│       ├── nim.js              # NIM inference helpers
│       └── credentials.js      # Credential storage
│
├── nemoclaw/                   # TypeScript plugin
│   ├── package.json            # Plugin dependencies & scripts
│   ├── tsconfig.json           # TypeScript config (strict mode)
│   ├── eslint.config.mjs       # ESLint config with naming conventions
│   ├── .prettierrc             # Prettier config
│   ├── src/                    # TypeScript source
│   │   ├── index.ts            # Plugin entry point
│   │   ├── cli.ts              # Command registration
│   │   ├── commands/           # CLI command implementations
│   │   ├── blueprint/          # Blueprint execution
│   │   └── onboard/            # Onboarding logic
│   └── dist/                   # Compiled JavaScript output
│
├── nemoclaw-blueprint/         # Python blueprint
│   ├── pyproject.toml          # Python dependencies & Ruff config
│   ├── Makefile                # Python-specific build commands
│   ├── blueprint.yaml          # Blueprint manifest
│   ├── orchestrator/           # Blueprint runner
│   │   └── runner.py           # Main orchestration logic
│   ├── migrations/             # State migration tools
│   │   └── snapshot.py         # Snapshot/restore logic
│   └── policies/               # Policy templates
│       └── openclaw-sandbox.yaml
│
├── test/                       # Unit tests (Node.js test runner)
│   ├── cli.test.js
│   ├── preflight.test.js
│   └── *.test.js
│
├── docs/                       # Sphinx documentation
│   ├── conf.py                 # Sphinx configuration
│   ├── index.md                # Documentation home
│   └── */                      # Documentation sections
│
└── scripts/                    # Installation/setup scripts
    ├── telegram-bridge.js      # Telegram integration
    └── write-auth-profile.py   # Auth profile writer
```

---

## Development Setup

### Option 1: Dev Container (Recommended for Agents)

The fastest way to get started is using VS Code Dev Containers with all dependencies pre-configured:

**Prerequisites:**
- **Visual Studio Code** with Remote - Containers extension
- **Docker** installed and running

**Setup:**
1. Open the repository in VS Code
2. Click "Reopen in Container" when prompted (or use Command Palette: "Dev Containers: Reopen in Container")
3. Wait for container to build and initialize (~2-3 minutes first time)
4. Development environment is ready with all dependencies installed!

The devcontainer includes:
- Node.js 22 (TypeScript development)
- Python 3.11 (Blueprint development)
- Docker-in-Docker (for testing containerized workflows)
- All VS Code extensions (ESLint, Prettier, Ruff, GitLens, etc.)
- Pre-configured editor settings (formatters, linters, rulers)
- Automatic dependency installation
- Pre-commit hooks configured

**Configuration:** `.devcontainer/devcontainer.json`

### Option 2: Local Setup

If you prefer local development without containers:

**Prerequisites:**
- **Node.js 20+** and npm 10+ (for TypeScript plugin and tests)
- **Python 3.11+** (for blueprint and documentation)
- **uv** (Python package manager, recommended) or pip
- **Git** with pre-commit hooks support
- **Docker** (optional, for full integration)

**Quick Start (One Command):**

```bash
# Clone and set up development environment
git clone https://github.com/NVIDIA/NemoClaw.git
cd NemoClaw
make dev  # Installs all dependencies, builds plugin, sets up pre-commit hooks
```

This single command:
- Installs TypeScript dependencies (`npm install`)
- Installs Python documentation dependencies (`uv sync`)
- Sets up pre-commit hooks (`pre-commit install`)
- Builds the TypeScript plugin (`npm run build`)

**Manual Setup (Step-by-Step):**

```bash
# 1. Clone the repository
git clone https://github.com/NVIDIA/NemoClaw.git
cd NemoClaw

# 2. Install pre-commit hooks (enforces code quality)
pip install pre-commit
pre-commit install

# 3. Install TypeScript dependencies
cd nemoclaw
npm install
cd ..

# 4. Install Python documentation dependencies (optional)
pip install uv
uv sync --group docs

# 5. Build TypeScript plugin
cd nemoclaw
npm run build
cd ..

# 6. Set up environment variables (for running locally)
cp .env.example .env
# Edit .env with your NVIDIA_API_KEY (get from build.nvidia.com)
```

### Environment Variables

Required variables (see `.env.example` for full list):

- `NVIDIA_API_KEY`: **Required** for NVIDIA cloud inference
- `TELEGRAM_BOT_TOKEN`: Optional, for Telegram bridge
- `GITHUB_TOKEN`: Optional, for private repository operations

**Feature Flags** (all optional, default to disabled):
- `NEMOCLAW_EXPERIMENTAL=1`: Enable all experimental features
- `NEMOCLAW_LOCAL_INFERENCE=1`: Enable local inference endpoints (NIM, vLLM, Ollama)
- `NEMOCLAW_AUTO_SELECT=1`: Auto-select detected providers during onboarding
- `NEMOCLAW_VERBOSE=1`: Enable verbose debug logging

See [docs/feature-flags.md](docs/feature-flags.md) for complete feature flag documentation.

**CRITICAL**: Never commit `.env` files. The `.gitignore` is configured to block them.

---

## Build Commands

### TypeScript Plugin

```bash
# Build the TypeScript plugin
cd nemoclaw
npm run build                 # Compile TypeScript to JavaScript (outputs to dist/)

# Development mode (watch for changes)
npm run dev                   # Run TypeScript compiler in watch mode

# Clean build artifacts
npm run clean                 # Remove dist/ directory
```

### Top-Level Commands

```bash
# Check both TypeScript and Python (runs linters + type checks)
make check

# Lint both TypeScript and Python
make lint

# Format all code (auto-fix)
make format
```

---

## Test Commands

### Unit Tests

```bash
# Run all tests (Node.js test runner with parallel execution)
npm test                      # Runs with concurrency=4 for speed

# Run tests serially (for debugging)
npm run test:serial           # Runs one test at a time

# Run specific test file
node --test test/cli.test.js  # Run specific test file
```

**Test Files Location**: `test/*.test.js`

**Test Framework**: Node.js built-in test runner (node:test)

**Test Isolation**: Tests run in parallel with concurrency=4 by default, ensuring:
- Each test file runs independently
- Tests don't share state between files
- Faster execution (4x speedup on multi-core systems)
- Use `npm run test:serial` if debugging intermittent failures

**Important**: Tests verify CLI behavior, preflight checks, policy management, and NIM integration.

---

## Linting and Formatting

### TypeScript (nemoclaw/)

```bash
cd nemoclaw

# Run ESLint
npm run lint                  # Check for linting errors
npm run lint:fix              # Auto-fix linting errors

# Run Prettier
npm run format:check          # Check code formatting
npm run format                # Auto-format code

# Run all checks (lint + format + type check)
npm run check                 # Run full validation suite
```

**Enforced Conventions**:
- **Naming**: camelCase for variables/functions, PascalCase for types/classes (via `@typescript-eslint/naming-convention`)
- **Strict TypeScript**: Full strict mode enabled
- **No unused vars**: Enforced (prefix with `_` for intentionally unused)
- **Complexity Limits**: Functions must have cyclomatic complexity ≤ 15, max depth ≤ 4, max lines ≤ 150

### Python (nemoclaw-blueprint/)

```bash
cd nemoclaw-blueprint

# Run Ruff linter
make check                    # Check for linting errors
ruff check .                  # Alternative: direct ruff command

# Run Ruff formatter
make format                   # Auto-format and fix
ruff format .                 # Alternative: format only
```

**Enforced Conventions**:
- **Naming**: snake_case for functions/variables, PascalCase for classes (PEP 8 via `pep8-naming`)
- **Line length**: 100 characters
- **Import order**: Enforced via isort
- **Security**: flake8-bandit rules enabled
- **Complexity Limit**: Functions must have cyclomatic complexity ≤ 15 (McCabe via Ruff C90)

### Pre-commit Hooks

Automatically run on every commit:

```bash
# Run all pre-commit hooks manually
pre-commit run --all-files

# Update hooks to latest versions
pre-commit autoupdate
```

**Hooks include**:
- Trailing whitespace removal
- YAML/JSON validation
- ESLint (TypeScript)
- Prettier (TypeScript)
- Ruff (Python linter + formatter)
- TypeScript type checking
- Secret detection (detect-secrets)
- Large file detection (>1MB)

---

## Documentation

### Build Documentation

```bash
# Build HTML documentation (Sphinx)
make docs                     # Build to docs/_build/html

# Build and serve with live reload
make docs-live                # Auto-rebuilds on changes, opens browser

# Clean documentation build
make docs-clean               # Remove docs/_build

# Generate TypeScript API documentation
cd nemoclaw
npm run docs                  # Generate to nemoclaw/docs/api using TypeDoc
```

**Documentation Technologies**:
- **Sphinx** with MyST parser (Markdown support) - Main documentation
- **Sphinx Autodoc** - Automatic Python API documentation from docstrings
- **TypeDoc** - Automatic TypeScript API documentation from code comments
- **GitHub Actions** - Automated doc building on every push (`.github/workflows/docs.yml`)
- **Droid Skill** - `update-docs-from-commits` skill for AI-powered doc updates

**Documentation URLs**:
- Sphinx docs: `docs/_build/html/index.html`
- TypeScript API docs: `nemoclaw/docs/api/index.html`

**Automated Documentation Generation**:
1. **Python API docs**: Run `make docs` - Sphinx autodoc extracts from docstrings
2. **TypeScript API docs**: Run `cd nemoclaw && npm run docs` - TypeDoc generates from TSDoc comments
3. **Doc updates from commits**: Use skill `update-docs-from-commits` via droid
4. **CI validation**: GitHub Actions builds docs on every push, uploads artifacts

---

## Key Conventions

### Code Style

#### TypeScript
- **Strict TypeScript**: `strict: true` in tsconfig.json
- **Naming**:
  - Variables/functions: `camelCase`
  - Classes/interfaces/types: `PascalCase`
  - Constants: `UPPER_CASE` or `camelCase`
- **Imports**: Use `type` imports for types (`import type { ... }`)
- **Async**: No floating promises (enforced by ESLint)

#### Python
- **PEP 8 Compliance**: Enforced via Ruff's pep8-naming
- **Naming**:
  - Functions/variables: `snake_case`
  - Classes: `PascalCase`
  - Constants: `SCREAMING_SNAKE_CASE`
- **Line length**: 100 characters
- **Docstrings**: Encouraged for public APIs

### Git Workflow

- **Commits**: Must be signed off (`git commit -s`)
- **Branches**: Protected - cannot commit directly to `main`
- **Pre-commit**: Hooks must pass before commit
- **Messages**: Descriptive commit messages with context
- **Code Ownership**: Automatic reviewer assignment via CODEOWNERS
  - TypeScript changes: `@NVIDIA/typescript-reviewers`
  - Python changes: `@NVIDIA/python-reviewers`
  - Security files: `@NVIDIA/security-team`
  - CI/CD: `@NVIDIA/devops-team`
  - Documentation: `@NVIDIA/docs-team`
  - All changes require `@NVIDIA/nemoclaw-maintainers` approval

### Issue Reporting

When creating issues, GitHub will prompt you to select the appropriate template:

- **Bug Report**: Reproducible bugs or unexpected behavior
- **Feature Request**: Suggestions for new features or enhancements
- **Documentation**: Incorrect, missing, or unclear documentation
- **Security** (Public): Low-severity security improvements only
  - For serious vulnerabilities, use the private reporting process in SECURITY.md

Templates ensure you provide all necessary context for maintainers and autonomous agents to understand and address the issue effectively.

### Pull Request Template

When opening a pull request, GitHub automatically loads `.github/pull_request_template.md` with structured sections:

- **Description**: What changed and why
- **Type of Change**: Bug fix, feature, breaking change, etc.
- **Testing Done**: Manual testing, automated tests, linting results
- **Security Considerations**: Critical checklist for secrets/credentials review
- **Breaking Changes**: Impact and migration path
- **Dependencies**: New or updated dependencies with justification
- **Pre-Submission Checklist**: Code quality, git hygiene, agent readability

**For Autonomous Agents**: The template includes specific guidance on providing detailed testing evidence, redacting sensitive information, and ensuring changes are understandable by future AI contributors. All checkboxes must be appropriately marked with evidence.

### File Organization

- **TypeScript source**: `nemoclaw/src/`
- **Python source**: `nemoclaw-blueprint/`
- **Tests**: `test/` (unit tests with `.test.js` extension)
- **Build output**: `nemoclaw/dist/` (gitignored, except in npm package)

---

## Common Tasks

### Add a New CLI Command

1. Create command file: `nemoclaw/src/commands/my-command.ts`
2. Implement command handler function
3. Register in `nemoclaw/src/cli.ts`
4. Build: `cd nemoclaw && npm run build`
5. Test: Verify command works via `node bin/nemoclaw.js my-command`

### Modify Blueprint Logic

1. Edit Python files in `nemoclaw-blueprint/orchestrator/`
2. Run linter: `cd nemoclaw-blueprint && make check`
3. Format: `make format`
4. Test integration manually with `nemoclaw onboard`

### Update Documentation

1. Edit Markdown files in `docs/`
2. Build docs: `make docs-live` (auto-reloads on changes)
3. Verify rendering in browser
4. Commit changes

### Add Environment Variable

1. Document in `.env.example` with description
2. Add usage in code (`process.env.VAR_NAME`)
3. Update AGENTS.md (this file) if critical
4. Document in README Security section if sensitive

---

## Troubleshooting

### TypeScript Compilation Errors

```bash
# Check for type errors without building
cd nemoclaw
npx tsc --noEmit

# Check specific file
npx tsc --noEmit src/commands/my-file.ts
```

### Pre-commit Hook Failures

```bash
# Skip hooks temporarily (NOT RECOMMENDED)
git commit --no-verify

# Fix issues automatically
pre-commit run --all-files

# Debug specific hook
pre-commit run eslint --all-files --verbose
```

### ESLint/Prettier Conflicts

Prettier is already integrated with ESLint (`eslint-config-prettier`). If conflicts occur:
1. Format with Prettier first: `npm run format`
2. Then fix ESLint issues: `npm run lint:fix`

### Python Import Errors

```bash
# Ensure dependencies are installed
cd nemoclaw-blueprint
uv sync  # or: pip install -e .

# Check Python version
python3 --version  # Should be 3.11+
```

---

## Testing Strategy

- **Unit Tests**: Node.js test runner in `test/` directory
- **Integration**: Manual testing via `nemoclaw onboard` command
- **Pre-commit**: Automated quality checks before commit
- **CI**: (To be implemented - see failing signals)

---

## Security Notes

- **Never commit secrets**: `.env` files are gitignored and blocked by pre-commit hooks
- **API Keys**: Store in `.env`, never hardcode
- **Credentials**: Use `bin/lib/credentials.js` for persistent storage (mode 600)
- **SSH Keys**: Automatically excluded by comprehensive `.gitignore`
- **Dependency Updates**: Dependabot automatically creates PRs for dependency updates every Monday
  - Configuration: `.github/dependabot.yml`
  - Covers: npm (TypeScript), pip (Python), GitHub Actions, Docker
  - Grouped updates to reduce PR noise

---

## Quick Reference

| Task | Command |
|------|---------|
| **Setup dev environment (one command)** | `make dev` |
| Install dependencies (TS) | `cd nemoclaw && npm install` |
| Install dependencies (Py) | `uv sync --group docs` |
| Build TypeScript | `cd nemoclaw && npm run build` |
| Run tests (unit, parallel) | `npm test` |
| Run tests (all: unit + integration) | `npm run test:all` |
| Run tests (integration only) | `npm run test:integration` |
| Run tests (serial/debug) | `npm run test:serial` |
| Run tests (with timing) | `npm run test:timing` |
| Run tests (with coverage) | `npm run test:coverage` |
| Lint everything | `make lint` |
| Format everything | `make format` |
| Check everything | `make check` |
| Complexity analysis | `make complexity` |
| Dead code detection | `make dead-code` |
| Duplicate code detection | `make duplicates` |
| Technical debt tracking | `make tech-debt` |
| Build docs | `make docs` |
| Run pre-commit checks | `pre-commit run --all-files` |
| Install pre-commit hooks | `pre-commit install` |

---

## Feature Flags

NemoClaw uses feature flags to enable safe rollout of experimental features. This is critical for autonomous agents shipping changes incrementally.

**Available flags:**

- `NEMOCLAW_EXPERIMENTAL=1`: Enable all experimental features (local inference, new endpoints)
- `NEMOCLAW_LOCAL_INFERENCE=1`: Enable local inference endpoints only (NIM, vLLM, Ollama)
- `NEMOCLAW_AUTO_SELECT=1`: Auto-select detected providers during onboarding
- `NEMOCLAW_VERBOSE=1`: Enable verbose debug logging

**Check flag status:**

```bash
nemoclaw feature-flags  # Show all flags and their current state
```

**Full documentation:** [docs/feature-flags.md](docs/feature-flags.md)

**For agents:** When implementing new features, ship them behind feature flags to reduce risk. See the feature flags documentation for how to add new flags.

---

## Release Notes and Changelog

NemoClaw uses automated release notes generation to document all changes, including agent contributions.

**Automated systems:**
- **GitHub Actions**: Auto-generates release notes on version tags
- **CHANGELOG.md**: Automatically updated with categorized changes
- **Manual generation**: `npm run changelog` for local updates

**Commit message conventions** (important for agents):
- `feat:` → Listed under Features in release notes
- `fix:` → Listed under Bug Fixes
- `docs:` → Listed under Documentation
- `security:` → Listed under Security

**Create a release:**
```bash
git tag -a v0.2.0 -m "Release v0.2.0"
git push origin v0.2.0
# GitHub Actions automatically generates release notes and updates CHANGELOG.md
```

**Full documentation:** [docs/releases.md](docs/releases.md)

---

## Deployment and Release Automation

NemoClaw has fully automated release pipelines that publish Docker images and npm packages.

**Automated workflows:**
- **Docker images**: Published to GitHub Container Registry (`ghcr.io/nvidia/nemoclaw`)
- **npm packages**: Published to npm registry (`nemoclaw` package)
- **SBOM generation**: Software Bill of Materials attached to releases

**Create a release:**
```bash
npm version minor  # Updates version and creates tag
git push origin main --tags
# Automation handles: release notes, Docker publish, npm publish, CHANGELOG update
```

**Using published artifacts:**
```bash
# Docker
docker pull ghcr.io/nvidia/nemoclaw:latest

# npm
npm install -g nemoclaw
```

**Full documentation:** [docs/deployment.md](docs/deployment.md)

---

## Observability and Logging

NemoClaw uses **structured logging** with [pino](https://getpino.io/), **distributed tracing**, **metrics collection**, and **error tracking** (Sentry) for comprehensive observability and debugging.

### Structured Logging

**Logger module**: `bin/lib/logger.js`

**Basic usage:**
```javascript
const { logger } = require("./lib/logger");

// Structured logging with context (trace context added automatically)
logger.info({ sandbox: "my-sandbox", model: "nemotron" }, "Inference completed");
logger.error({ err: error, operation: "connect" }, "Failed to connect");

// Convenience functions
const { logCommand, logSandboxOperation } = require("./lib/logger");
logCommand("onboard", { profile: "vllm" });
logSandboxOperation("my-sandbox", "start", { duration: 1500 });
```

**Log levels:**
- `logger.trace()` - Very detailed debug (enabled with `NEMOCLAW_LOG_LEVEL=trace`)
- `logger.debug()` - Debug information (enabled with `NEMOCLAW_VERBOSE=1`)
- `logger.info()` - General information (default)
- `logger.warn()` - Warnings
- `logger.error()` - Errors
- `logger.fatal()` - Fatal errors

**Configuration:**
```bash
export NEMOCLAW_VERBOSE=1        # Enable verbose debug logging
export NEMOCLAW_LOG_LEVEL=debug  # Set specific log level
export NODE_ENV=production       # JSON output (vs pretty print)
```

### Distributed Tracing

**Trace context module**: `bin/lib/trace-context.js`

Every CLI command automatically gets a unique trace ID that propagates through all operations.

**Usage:**
```javascript
const { runWithTraceContext, getTraceId, getTraceHeaders } = require("./lib/trace-context");

// Run operation within trace context
await runWithTraceContext("sandbox-create", async () => {
  logger.info({ sandbox: "test" }, "Creating sandbox");
  // traceId is automatically included in logs
}, { sandbox: "test" });

// Get current trace ID
const traceId = getTraceId();

// Add trace headers to HTTP requests
const headers = { ...getTraceHeaders() };
// Adds: X-Request-ID, X-Trace-ID, X-Span-ID
```

**Debugging with trace IDs:**
```bash
# All logs for a specific CLI invocation
nemoclaw onboard 2>&1 | jq 'select(.traceId == "...")'

# Show operation timeline
nemoclaw onboard 2>&1 | jq -s 'sort_by(.time) | .[] | {time, operation: .traceOperation, duration}'
```

### Metrics Collection

**Metrics module**: `bin/lib/metrics.js`

All CLI commands automatically collect performance metrics (duration, error rates, etc.).

**Usage:**
```javascript
const { recordCommandExecution, recordInferenceRequest, startTimer } = require("./lib/metrics");

// Record command execution
recordCommandExecution("onboard", duration, { status: "success" });

// Record inference request
recordInferenceRequest("nvidia/nemotron", 420, { tokens: 150, cached: false });

// Time an operation
const timer = startTimer("nemoclaw.operation.duration", { operation: "create" });
await performOperation();
timer(); // Records duration automatically
```

**Built-in metrics:**
- `nemoclaw.command.executions` - Command invocations (counter)
- `nemoclaw.command.duration` - Command execution time (histogram)
- `nemoclaw.inference.requests` - Inference requests (counter)
- `nemoclaw.inference.latency` - Inference duration (histogram)
- `nemoclaw.sandbox.operations` - Sandbox operations (counter)
- `nemoclaw.errors` - Error count (counter)

**Configuration:**
```bash
export NEMOCLAW_METRICS=0                   # Disable metrics
export NEMOCLAW_METRICS_BACKEND=console     # Use console backend (vs logger)
```

**Querying metrics:**
```bash
# Find all metrics
nemoclaw onboard 2>&1 | jq 'select(.metric_type)'

# Calculate average command duration
nemoclaw onboard 2>&1 | jq -s '[.[] | select(.metric_name == "nemoclaw.command.duration") | .metric_value] | add / length'

# Count errors
nemoclaw onboard 2>&1 | jq -s '[.[] | select(.metric_name == "nemoclaw.errors")] | length'
```

### Error Tracking (Sentry)

**Sentry module**: `bin/lib/sentry.js`

Production error tracking with Sentry (opt-in via SENTRY_DSN).

**Features:**
- **Source maps**: TypeScript stack traces in production
- **Breadcrumbs**: Timeline of events before errors
- **Trace context**: Automatic trace ID correlation
- **User context**: Non-PII user identification

**Setup:**
```bash
# .env file (get DSN from https://sentry.io/)
export SENTRY_DSN=https://abc123@o123456.ingest.sentry.io/789
export SENTRY_ENVIRONMENT=production
```

**Usage:**
```javascript
const { captureException, addBreadcrumb } = require("./lib/sentry");

// Add breadcrumb
addBreadcrumb({
  category: "sandbox",
  message: "Creating sandbox",
  data: { sandbox: "my-sandbox" },
});

// Capture error with context
try {
  await createSandbox(name);
} catch (error) {
  captureException(error, {
    tags: { sandbox: name, operation: "create" },
    extra: { model: "nemotron", gpu: true },
  });
  throw error;
}
```

**Full documentation:** [docs/observability.md](docs/observability.md)

### Deployment Observability

**Monitoring dashboards**: Track deployment impact in real-time.

NemoClaw integrates with major monitoring platforms for deployment observability:

**Dashboard platforms:**
- **Datadog**: Create dashboard with `nemoclaw.command.duration`, `nemoclaw.errors` metrics
- **Grafana**: Query Prometheus metrics for error rates and latencies
- **New Relic**: Use NRQL to query transaction performance
- **CloudWatch**: Parse structured logs with Insights queries

**Example queries:**
```bash
# Prometheus: Error rate
rate(nemoclaw_errors_total{env="production"}[5m])

# Datadog: Command latency
avg:nemoclaw.command.duration{env:production} by {command}

# CloudWatch Insights: Error count
fields @timestamp, level, msg
| filter level = "error"
| stats count() by bin(5m)
```

**Deploy notifications:**
- Configure Slack/Discord/Teams webhooks
- Send notifications from CI/CD pipelines
- Include dashboard links in notifications

**Deployment markers:**
```bash
# Datadog event API
curl -X POST "https://api.datadoghq.com/api/v1/events" \
  -H "DD-API-KEY: $DD_API_KEY" \
  -d '{"title": "NemoClaw deployed", "text": "v1.2.3", "tags": ["service:nemoclaw"]}'

# Grafana annotation
curl -X POST "https://grafana.example.com/api/annotations" \
  -H "Authorization: Bearer $GRAFANA_API_KEY" \
  -d '{"text": "Deployed v1.2.3", "tags": ["deployment"]}'
```

**Dashboard links** (add your organization's dashboards):
```markdown
- Metrics: https://app.datadoghq.com/dashboard/[your-id]
- Errors: https://sentry.io/organizations/[org]/projects/nemoclaw/
- Logs: https://your-logging-platform.com
```

**Deployment health check:**
```bash
# Monitor error rate after deployment
nemoclaw <command> 2>&1 | jq 'select(.level >= 50)' | jq -s 'length'

# Check command duration
nemoclaw <command> 2>&1 | jq -s '[.[] | select(.metric_name == "nemoclaw.command.duration") | .metric_value] | add / length'
```

**Full documentation:** [docs/observability.md](docs/observability.md#deployment-observability)

---

## Incident Response and Runbooks

**Runbook documentation**: [docs/runbooks.md](docs/runbooks.md)

NemoClaw provides incident response playbooks for common production issues.

**Runbook categories:**
1. **General Troubleshooting**: Commands, logs, monitoring checks
2. **Sandbox Incidents**: Creation failures, startup issues, inference errors
3. **Inference Incidents**: Performance, invalid responses, API issues
4. **Deployment Incidents**: Error spikes, failed deploys, rollbacks
5. **Performance Incidents**: Memory, CPU, resource exhaustion
6. **Security Incidents**: API key leaks, unauthorized access
7. **Escalation Procedures**: When and how to escalate

**Quick diagnostic commands:**

```bash
# System status
nemoclaw status                    # Sandbox and service status
nemoclaw list                      # List all sandboxes
docker ps                          # Check containers

# Recent errors
nemoclaw <command> 2>&1 | jq 'select(.level >= 50)'

# Command performance
nemoclaw <command> 2>&1 | jq -s '[.[] | select(.metric_name == "nemoclaw.command.duration") | .metric_value] | add / length'

# Trace specific request
export NEMOCLAW_VERBOSE=1
nemoclaw <command> 2>&1 | jq 'select(.traceId == "TRACE_ID")'
```

**Common incidents:**

**Sandbox creation fails:**
```bash
# Check Docker
docker ps && docker info

# Check OpenShell
which openshell && openshell --version

# Check disk space
df -h  # Need at least 5GB free
```

**Inference requests failing:**
```bash
# Verify API key
echo $NVIDIA_API_KEY | head -c 10

# Test API directly
curl https://api.nvidia.com/v1/health \
  -H "Authorization: Bearer $NVIDIA_API_KEY"
```

**Deployment caused errors:**
```bash
# Check error rate increase
# If >2x baseline: ROLLBACK IMMEDIATELY
git checkout <previous-commit>
npm install && npm run build

# Notify team
curl -X POST "$SLACK_WEBHOOK_URL" \
  -d '{"text": "⚠️ Rolled back due to error spike"}'
```

**Escalation:**
- **Level 1**: On-call engineer (Slack: #nemoclaw-oncall, PagerDuty)
- **Level 2**: Team lead
- **Level 3**: Engineering manager

**Escalate immediately if:**
- Production down >15 minutes
- Security incident detected
- Data loss suspected
- Unable to resolve within 30 minutes

**Full runbooks:** [docs/runbooks.md](docs/runbooks.md)

### Alerting

**Alert configuration**: [docs/observability.md](docs/observability.md#alerting)

NemoClaw provides recommended alert rules for production monitoring.

**Critical alerts** (page on-call):
1. **High error rate**: > 10 errors/minute for 5 minutes
2. **Service down**: No metrics received for 5 minutes
3. **Inference API down**: Success rate < 50% for 5 minutes

**Warning alerts** (notify channel):
1. **Elevated errors**: > 5 errors/minute for 10 minutes
2. **High latency**: p95 > 5s for 10 minutes
3. **High memory**: > 80% for 15 minutes

**Alert integrations:**
- **PagerDuty**: For critical alerts (error spikes, service down)
- **OpsGenie**: Alternative to PagerDuty
- **Slack**: For warning/info alerts (#nemoclaw-alerts, #nemoclaw-deploys)

**Example alert queries:**

**Prometheus:**
```promql
# Error rate alert
rate(nemoclaw_errors_total{env="production"}[5m]) > 10/60

# Latency alert
histogram_quantile(0.95, rate(nemoclaw_command_duration_bucket[5m])) > 5
```

**Datadog:**
```
# Error rate
avg(last_5m):avg:nemoclaw.errors{env:production}.as_rate() > 0.16

# Latency
avg(last_10m):p95:nemoclaw.command.duration{env:production} > 5000
```

**CloudWatch:**
```sql
# Error count
SELECT COUNT(*) FROM Logs WHERE level='error' | COUNT > 50
```

**Alert best practices:**
- Alert on symptoms (error rate), not causes (disk space)
- Include runbook links in notifications
- Set appropriate thresholds to reduce false positives
- Test alerts monthly

**Full alert documentation:** [docs/observability.md](docs/observability.md#alerting)

### Product Analytics

**Analytics documentation**: [docs/product-analytics.md](docs/product-analytics.md)

NemoClaw supports optional product analytics to measure feature usage and impact.

**Platform**: Post Hog (recommended for CLI tools)
- Open source, can be self-hosted
- Privacy-focused, GDPR compliant
- Good for measuring feature adoption

**Setup** (opt-in only):
```bash
# .env file
POSTHOG_API_KEY=phc_your_api_key_here
POSTHOG_HOST=https://app.posthog.com
```

**What to track:**
- **Command execution**: Which commands users run, duration, success rate
- **Feature usage**: Feature flag adoption, feature retention
- **Sandbox operations**: Creation success rate, model selection
- **Inference requests**: Token usage, latency, caching effectiveness
- **Errors**: Error types, operation failures

**What NOT to track:**
- Never track API keys, credentials, or secrets
- Never track user code, prompts, or sandbox names
- Never track PII (unless anonymized/hashed)

**For autonomous agents:**

When adding a new feature:
1. Add analytics tracking: `trackFeature('feature_name', {context})`
2. Monitor adoption after 7 days (PostHog dashboard)
3. Make data-driven decisions:
   - High adoption + low errors = keep feature
   - Low adoption + high errors = improve or deprecate
   - High adoption + high errors = fix urgently

**Example analytics integration:**
```javascript
const { initAnalytics, trackCommand } = require('./lib/analytics');

// Initialize (only if POSTHOG_API_KEY set)
initAnalytics();

// Track command
const startTime = Date.now();
await executeCommand(cmd);
const duration = Date.now() - startTime;
trackCommand(cmd, duration, 'success');
```

**Measuring feature impact:**
```bash
# Query PostHog API for feature adoption
curl https://app.posthog.com/api/projects/$PROJECT_ID/insights/trend \
  -H "Authorization: Bearer $POSTHOG_API_KEY" \
  -d '{"events": [{"id": "feature_used", "properties": [{"key": "feature", "value": "new_feature"}]}]}'
```

**Privacy:**
- Anonymous by default (hashed user IDs)
- Opt-out: `export NEMOCLAW_TELEMETRY=0`
- GDPR compliant with data retention policies
- Self-hosting option for sensitive environments

**Full documentation:** [docs/product-analytics.md](docs/product-analytics.md)

### Error to Insight Pipeline

**Pipeline documentation**: [docs/error-to-insight-pipeline.md](docs/error-to-insight-pipeline.md)

The error-to-insight pipeline automatically converts production errors into GitHub issues.

**Flow:**
```
Production Error → Sentry → GitHub Issue → Fix → Deploy → Verify
```

**Setup:**
```bash
# .env file
SENTRY_ORG=your-organization-slug
SENTRY_PROJECT=nemoclaw
```

**Sentry-GitHub integration:**
1. Install GitHub integration in Sentry (Settings → Integrations → GitHub)
2. Configure alert rules (Alerts → Create Alert Rule)
3. Set trigger: "First seen" for new errors
4. Set action: "Create GitHub issue"
5. Configure issue template (title, labels, assignees)

**Alert rules** (recommended):
- **New errors**: Create issue for first-seen errors in production
- **High volume**: Create issue for >100 events/hour
- **Regressions**: Create issue when resolved error recurs
- **High impact**: Create issue + page on-call for >50 users affected

**Example GitHub issue** (auto-created):
```markdown
## [Sentry] ConnectionError: Failed to connect to inference API

Events: 42  
Users Affected: 12  
Stack Trace: [link]  
Sentry: [view full error]

Labels: bug, sentry, production
```

**For autonomous agents:**

When Sentry creates an issue:
1. Query Sentry API for unresolved errors
2. Prioritize by user impact (`userCount`)
3. Analyze stack trace and breadcrumbs
4. Implement fix
5. Commit with `Fixes #[issue-number]`
6. Verify error resolved in Sentry after deployment

**Query errors:**
```bash
# Get recent unresolved errors
curl https://sentry.io/api/0/projects/$SENTRY_ORG/$SENTRY_PROJECT/issues/ \
  -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
  -G --data-urlencode "query=is:unresolved" \
  | jq 'sort_by(.userCount) | reverse | .[] | {title, userCount, permalink}'
```

**Fix workflow:**
```bash
# 1. Get top error by user impact
# 2. Analyze stack trace
# 3. Implement fix
# 4. Commit with issue reference
git commit -m "Fix inference connection timeout

Fixes #456

- Increase timeout to 60s
- Add retry logic"

# 5. After deploy, verify in Sentry
```

**Benefits:**
- Automatic issue creation (no manual copying)
- Rich error context in GitHub
- Deduplication (one issue per error group)
- Workflow integration
- Automatic issue closure when fixed

**Metrics to track:**
- Time to triage (error → issue assigned)
- Time to fix (issue created → PR merged)
- Time to resolve (PR merged → error resolved)
- Regression rate (% errors that recur)

**Full documentation:** [docs/error-to-insight-pipeline.md](docs/error-to-insight-pipeline.md)

---

## Repository Skills

NemoClaw provides reusable skills (automation capabilities) for common development tasks. Skills are located in `.factory/skills/` and follow the Claude skills standard.

**Available Skills:**

1. **run-full-test-suite** - Execute complete test suite with coverage
   - Run all unit and integration tests
   - Generate coverage reports
   - Check test performance
   - Location: `.factory/skills/run-full-test-suite/SKILL.md`

2. **lint-and-format-code** - Lint and format TypeScript and Python
   - Auto-fix ESLint and Ruff issues
   - Apply Prettier and Ruff formatting
   - Verify pre-commit checks pass
   - Location: `.factory/skills/lint-and-format-code/SKILL.md`

3. **check-code-quality** - Analyze code quality metrics
   - Check cyclomatic complexity
   - Detect dead code (knip, vulture)
   - Find duplicate code (jscpd)
   - Track technical debt (TODO/FIXME)
   - Location: `.factory/skills/check-code-quality/SKILL.md`

4. **build-project** - Build TypeScript plugin
   - Compile TypeScript to JavaScript
   - Verify type checking passes
   - Generate type definitions
   - Location: `.factory/skills/build-project/SKILL.md`

5. **generate-release-notes** - Create changelog from commits
   - Generate release notes automatically
   - Update CHANGELOG.md
   - Follow conventional commits
   - Location: `.factory/skills/generate-release-notes/SKILL.md`

6. **update-docs-from-commits** - Sync docs with code changes
   - Scan git commits for user-facing changes
   - Identify affected documentation pages
   - Draft documentation updates
   - Location: `.agents/skills/update-docs-from-commits/SKILL.md`

**Using Skills:**

Skills provide step-by-step instructions for common tasks. Read the SKILL.md file for:
- When to use the skill
- Prerequisites and commands
- Best practices and examples
- Troubleshooting and success criteria

**Example:**
```bash
# To run the full test suite, see:
cat .factory/skills/run-full-test-suite/SKILL.md

# To check code quality, see:
cat .factory/skills/check-code-quality/SKILL.md
```

---

## Additional Resources

- **README.md**: User-facing documentation and quick start
- **CONTRIBUTING.md**: Contribution guidelines and code style details
- **SECURITY.md**: Security vulnerability reporting
- **docs/**: Full Sphinx documentation (build with `make docs`)
- **docs/feature-flags.md**: Complete feature flag documentation
- **docs/releases.md**: Release notes and changelog automation
- **.env.example**: Environment variable template and documentation

---

## Project-Specific Knowledge

### Blueprint Lifecycle

The Python blueprint follows a 4-stage lifecycle:
1. **Resolve**: Locate and verify blueprint version
2. **Verify**: Check artifact digest for integrity
3. **Plan**: Determine OpenShell resources to create
4. **Apply**: Execute plan via OpenShell CLI

### Sandbox Architecture

- **OpenShell Gateway**: Routes inference calls
- **Sandbox Container**: Isolated environment for OpenClaw
- **Policy**: Network egress and filesystem access controls
- **Inference**: NVIDIA cloud API calls routed through gateway

### Key Files to Understand

- `nemoclaw/src/index.ts`: Plugin registration and initialization
- `nemoclaw-blueprint/orchestrator/runner.py`: Main blueprint orchestration
- `bin/nemoclaw.js`: CLI dispatcher (all commands route through here)
- `bin/lib/onboard.js`: Onboarding wizard implementation
- `.pre-commit-config.yaml`: Quality enforcement configuration

---

**Last Updated**: 2026-03-22  
**Maintained by**: NVIDIA NemoClaw Team  
**For Agent Questions**: Refer to this file first, then README.md, then source code comments
