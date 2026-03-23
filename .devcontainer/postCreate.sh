#!/bin/bash
set -e

echo "🚀 Setting up NemoClaw development environment..."

# Install Python dependencies
echo "📦 Installing Python dependencies..."
python3 -m pip install --upgrade pip
pip install uv
uv sync --group docs

# Install TypeScript dependencies
echo "📦 Installing TypeScript dependencies..."
cd nemoclaw
npm install
cd ..

# Install root dependencies (test runner, code quality tools)
echo "📦 Installing root dependencies..."
npm install

# Install pre-commit hooks
echo "🪝 Installing pre-commit hooks..."
pip install pre-commit
pre-commit install

# Build TypeScript
echo "🔨 Building TypeScript plugin..."
cd nemoclaw
npm run build
cd ..

echo "✅ NemoClaw development environment ready!"
echo ""
echo "Quick start:"
echo "  - Run tests: npm test"
echo "  - Build TypeScript: cd nemoclaw && npm run build"
echo "  - Lint everything: make check"
echo "  - Build docs: make docs"
echo ""
echo "See AGENTS.md for complete development guide."
