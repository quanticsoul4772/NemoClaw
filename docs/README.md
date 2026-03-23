# NemoClaw Documentation

This directory contains the source files for NemoClaw's documentation, built with Sphinx.

## Automated Documentation Generation

NemoClaw uses multiple automated documentation systems:

### 1. Sphinx with Autodoc (Python API)

**What**: Automatically extracts API documentation from Python docstrings in `nemoclaw-blueprint/`

**How to generate**:
```bash
make docs              # From repository root
# or
uv run --group docs sphinx-build -b html docs docs/_build/html
```

**Output**: `docs/_build/html/`

**Extensions used**:
- `sphinx.ext.autodoc` - Extract docs from Python docstrings
- `sphinx.ext.autosummary` - Generate summary tables
- `sphinx.ext.napoleon` - Support Google/NumPy style docstrings
- `myst_parser` - Markdown support in Sphinx

### 2. TypeDoc (TypeScript API)

**What**: Automatically generates API documentation from TypeScript source code and TSDoc comments

**How to generate**:
```bash
cd nemoclaw
npm run docs
```

**Output**: `nemoclaw/docs/api/`

**Configuration**: `nemoclaw/typedoc.json`

### 3. GitHub Actions CI (Continuous Integration)

**What**: Automatically builds and validates documentation on every push/PR

**Workflow**: `.github/workflows/docs.yml`

**What it does**:
1. Builds Sphinx documentation with warnings-as-errors (`-W`)
2. Validates all links in documentation
3. Uploads documentation as artifacts (available for 30 days)
4. Uploads link check results

**Triggers**:
- Push to `main` branch (docs/, nemoclaw/, nemoclaw-blueprint/ changes)
- Pull requests touching documentation

### 4. AI-Powered Doc Updates

**What**: Droid skill that scans git commits and generates documentation updates

**Skill**: `.agents/skills/update-docs-from-commits/`

**How to use**:
```bash
# Via droid CLI (when integrated with Factory/Claude)
droid exec "update docs from last 20 commits"
```

**What it does**:
1. Analyzes recent git commits for user-facing changes
2. Maps code changes to relevant documentation pages
3. Generates documentation updates based on commit content
4. Suggests new documentation pages when needed

## Building Documentation Locally

### Prerequisites

```bash
pip install uv  # or use pip directly
uv sync --group docs
```

### Build Commands

```bash
# Full Sphinx build
make docs

# Live reload during writing
make docs-live  # Opens browser, auto-refreshes on changes

# Clean build artifacts
make docs-clean

# TypeScript API docs
cd nemoclaw && npm run docs
```

### Viewing Built Docs

After building:
- **Sphinx HTML**: Open `docs/_build/html/index.html` in a browser
- **TypeScript API**: Open `nemoclaw/docs/api/index.html` in a browser

## Documentation Structure

```
docs/
├── conf.py                     # Sphinx configuration
├── index.md                    # Documentation home
├── _build/                     # Generated HTML (gitignored)
├── _ext/                       # Custom Sphinx extensions
├── about/                      # Overview, architecture, how it works
├── get-started/                # Quickstart guides
├── inference/                  # Inference configuration
├── network-policy/             # Policy configuration
├── reference/                  # API references, CLI commands
└── deployment/                 # Deployment guides
```

## Contributing to Documentation

1. **Edit Markdown files** in `docs/` subdirectories
2. **Build locally** with `make docs-live` to preview changes
3. **Commit changes** - CI will validate on PR
4. **Add TSDoc comments** to TypeScript code for API docs
5. **Add docstrings** to Python code for API docs

## Continuous Documentation

Documentation is built automatically:
- ✅ On every commit to `main` (GitHub Actions)
- ✅ On every pull request (validation)
- ✅ From Python docstrings (Sphinx Autodoc)
- ✅ From TypeScript comments (TypeDoc)
- ✅ From git commits (AI skill)

No manual documentation steps required - everything is automated!
