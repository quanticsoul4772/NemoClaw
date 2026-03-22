# Contributing

## Quick Start

Get the development environment set up with one command:

```bash
git clone https://github.com/NVIDIA/NemoClaw.git
cd NemoClaw
make dev  # Installs dependencies, builds plugin, sets up pre-commit hooks
```

This will:
- Install TypeScript dependencies (`npm install`)
- Install Python documentation dependencies (`uv sync`)
- Set up pre-commit hooks (`pre-commit install`)
- Build the TypeScript plugin (`npm run build`)

After setup completes, you're ready to make changes, run tests (`npm test`), and submit pull requests!

---

## Development Setup

### Pre-commit Hooks

This repository uses [pre-commit](https://pre-commit.com/) to enforce code quality checks before commits. Pre-commit hooks automatically run linters, formatters, and security checks to catch issues early.

**Install pre-commit hooks:**

```bash
pip install pre-commit
pre-commit install
```

**What gets checked:**

- **Python** (nemoclaw-blueprint/): Ruff linter and formatter
- **TypeScript** (nemoclaw/): ESLint, Prettier, and type checking
- **All files**: Trailing whitespace, end-of-file fixes, YAML/JSON validation, secret detection
- **Large files**: Prevents commits of files > 1MB
- **Branch protection**: Prevents direct commits to main branch

**Run hooks manually:**

```bash
# Run on all files
pre-commit run --all-files

# Run on staged files only
pre-commit run

# Skip hooks (not recommended)
git commit --no-verify
```

**Update hooks to latest versions:**

```bash
pre-commit autoupdate
```

### Code Style and Naming Conventions

This repository enforces consistent naming conventions through ESLint (TypeScript) and Ruff (Python). Violations will be caught by pre-commit hooks and CI.

**TypeScript Naming Conventions:**

- **Variables and functions**: `camelCase`
  ```typescript
  const userName = "alice";
  function getUserData() { }
  ```
- **Classes, interfaces, types, enums**: `PascalCase`
  ```typescript
  class UserManager { }
  interface PluginConfig { }
  type ResponseData = { };
  enum Status { }
  ```
- **Constants**: `UPPER_CASE` or `camelCase` (both allowed)
  ```typescript
  const MAX_RETRIES = 3;
  const apiEndpoint = "https://api.example.com";
  ```
- **Type parameters**: `PascalCase`
  ```typescript
  function map<TInput, TOutput>() { }
  ```
- **Private/unused parameters**: Prefix with `_`
  ```typescript
  function handler(_req: Request, res: Response) { }
  ```

**Python Naming Conventions (PEP 8):**

- **Variables and functions**: `snake_case`
  ```python
  user_name = "alice"
  def get_user_data():
  ```
- **Classes and type aliases**: `PascalCase`
  ```python
  class UserManager:
  class PluginConfig:
  ```
- **Constants**: `SCREAMING_SNAKE_CASE`
  ```python
  MAX_RETRIES = 3
  API_ENDPOINT = "https://api.example.com"
  ```
- **Module names**: `lowercase_with_underscores`
  ```
  user_manager.py
  plugin_config.py
  ```
- **Private attributes/methods**: Prefix with `_`
  ```python
  def _internal_helper():
  self._private_data = None
  ```

These conventions are automatically enforced by:
- **TypeScript**: `@typescript-eslint/naming-convention` rule in ESLint
- **Python**: `pep8-naming` (N) rules in Ruff

### Dependency Management

Dependencies are automatically kept up-to-date via **Dependabot**:

- **Schedule**: Weekly pull requests on Mondays
- **What's covered**: 
  - npm packages (TypeScript plugin and root)
  - Python packages (documentation dependencies)
  - GitHub Actions versions
  - Docker base images
- **PR grouping**: Minor and patch updates grouped together
- **Auto-labels**: PRs tagged with `dependencies` + language

When a Dependabot PR is created:
1. Review the changelog/release notes
2. Check if tests pass in CI
3. Approve and merge if safe
4. Major version updates require manual review

Configuration: `.github/dependabot.yml`

### Code Ownership and Reviews

The repository uses **CODEOWNERS** to automatically assign reviewers based on which files you modify:

- **TypeScript plugin** (`nemoclaw/`): `@NVIDIA/typescript-reviewers`
- **Python blueprint** (`nemoclaw-blueprint/`): `@NVIDIA/python-reviewers`
- **Security files** (policies, secrets, SECURITY.md): `@NVIDIA/security-team`
- **CI/CD** (`.github/workflows/`, Dependabot): `@NVIDIA/devops-team`
- **Documentation** (`docs/`, README, AGENTS.md): `@NVIDIA/docs-team`
- **Tests** (`test/`): `@NVIDIA/qa-team`
- **All changes**: Require approval from `@NVIDIA/nemoclaw-maintainers`

**How it works:**
1. You open a pull request
2. GitHub automatically adds reviewers based on changed files
3. The last matching pattern in CODEOWNERS takes precedence
4. All PRs require at least one approval from the maintainers team

**For external contributors:** GitHub will suggest reviewers, but only maintainers can approve and merge.

Configuration: `.github/CODEOWNERS`

### Reporting Issues

Before creating a new issue, please:

1. **Search existing issues** to avoid duplicates
2. **Choose the right template**:
   - **Bug Report**: For reproducible bugs or unexpected behavior
   - **Feature Request**: For new feature suggestions
   - **Documentation**: For docs that are incorrect, missing, or unclear
   - **Security (Public)**: For non-critical security improvements only
3. **Fill out all required fields** in the template
4. **Redact sensitive information** (API keys, tokens, passwords)

**For serious security vulnerabilities**, do NOT file a public issue. Follow the responsible disclosure process in [SECURITY.md](SECURITY.md).

The issue templates ensure maintainers and autonomous agents have all the context needed to understand and address your issue effectively.

### Submitting Pull Requests

When you open a pull request, GitHub automatically loads a comprehensive template (`.github/pull_request_template.md`). Please fill out all relevant sections:

**Required Information:**
1. **Description**: Clear explanation of what changed and why
2. **Type of Change**: Bug fix, feature, breaking change, documentation, etc.
3. **Component(s) Affected**: Which parts of the codebase are modified
4. **Testing Done**: Evidence that your changes work (commands + output)
5. **Security Considerations**: **CRITICAL** - Verify no secrets exposed
6. **Pre-Submission Checklist**: Code quality, tests, linting, signed commits

**Security Checklist (MANDATORY):**
- ✅ I have reviewed the diff for API keys, tokens, or credentials
- ✅ I have redacted all sensitive information from logs/screenshots
- ✅ Changes to security-sensitive files reviewed appropriately

**For Autonomous Agents:**
The template includes specific sections for AI contributors to ensure:
- Detailed testing evidence (exact commands and output)
- Security verification (no secrets in code or logs)
- Agent readability (future AI agents can understand the changes)
- Clear documentation of dependencies and breaking changes

**Before submitting:**
1. Run all tests: `npm test`
2. Run all linters: TypeScript (`cd nemoclaw && npm run check`), Python (`cd nemoclaw-blueprint && make check`)
3. Run pre-commit hooks: `pre-commit run --all-files`
4. Sign all commits: `git commit -s`
5. Fill out the PR template completely
6. Review your own diff for secrets/credentials

## Signing Your Work

* We require that all contributors "sign-off" on their commits. This certifies
  that the contribution is your original work, or you have rights to submit it
  under the same license, or a compatible license.

  * Any contribution which contains commits that are not Signed-Off will not be
    accepted.

* To sign off on a commit you simply use the `--signoff` (or `-s`) option when
  committing your changes:

  ```bash
  git commit -s -m "Add cool feature."
  ```

  This will append the following to your commit message:

  ```text
  Signed-off-by: Your Name <your@email.com>
  ```

* Full text of the DCO:

  ```text
    Developer Certificate of Origin
    Version 1.1

    Copyright (C) 2004, 2006 The Linux Foundation and its contributors.
    1 Letterman Drive
    Suite D4700
    San Francisco, CA, 94129

    Everyone is permitted to copy and distribute verbatim copies of this
    license document, but changing it is not allowed.
  ```

  ```text
    Developer's Certificate of Origin 1.1

    By making a contribution to this project, I certify that:

    (a) The contribution was created in whole or in part by me and I have the
    right to submit it under the open source license indicated in the file; or

    (b) The contribution is based upon previous work that, to the best of my
    knowledge, is covered under an appropriate open source license and I have
    the right under that license to submit that work with modifications,
    whether created in whole or in part by me, under the same open source
    license (unless I am permitted to submit under a different license), as
    indicated in the file; or

    (c) The contribution was provided directly to me by some other person who
    certified (a), (b) or (c) and I have not modified it.

    (d) I understand and agree that this project and the contribution are
    public and that a record of the contribution (including all personal
    information I submit with it, including my sign-off) is maintained
    indefinitely and may be redistributed consistent with this project or the
    open source license(s) involved.
  ```
