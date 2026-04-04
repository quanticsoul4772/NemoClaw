#!/usr/bin/env bash
# Back up the sandbox workspace to the host before destroy.
# Usage: ./sandbox-backup.sh [sandbox-name]

set -euo pipefail

SANDBOX="${1:-rawcell}"
BACKUP_DIR="$HOME/.nemoclaw/backups/$SANDBOX-$(date -u +%Y%m%dT%H%M%SZ)"

mkdir -p "$BACKUP_DIR"

echo "[backup] Downloading workspace from sandbox '$SANDBOX'..."
openshell sandbox download "$SANDBOX" /sandbox/.openclaw/workspace "$BACKUP_DIR/workspace" 2>&1 || true
openshell sandbox download "$SANDBOX" /sandbox/.openclaw/openclaw.json "$BACKUP_DIR/openclaw.json" 2>&1 || true
openshell sandbox download "$SANDBOX" /sandbox/.openclaw/agents "$BACKUP_DIR/agents" 2>&1 || true
openshell sandbox download "$SANDBOX" /sandbox/.nemoclaw "$BACKUP_DIR/nemoclaw-config" 2>&1 || true

echo "[backup] Saved to: $BACKUP_DIR"
ls -la "$BACKUP_DIR"

# Keep a symlink to latest backup
ln -sfn "$BACKUP_DIR" "$HOME/.nemoclaw/backups/$SANDBOX-latest"
echo "[backup] Latest symlink: $HOME/.nemoclaw/backups/$SANDBOX-latest"
