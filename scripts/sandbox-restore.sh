#!/usr/bin/env bash
# Restore workspace into a sandbox from the latest backup.
# Usage: ./sandbox-restore.sh [sandbox-name]

set -euo pipefail

SANDBOX="${1:-rawcell}"
BACKUP_DIR="$HOME/.nemoclaw/backups/$SANDBOX-latest"

if [ ! -d "$BACKUP_DIR" ]; then
  echo "[restore] No backup found at $BACKUP_DIR"
  echo "[restore] Run sandbox-backup.sh before destroying the sandbox."
  exit 1
fi

echo "[restore] Restoring from: $(readlink -f "$BACKUP_DIR")"

if [ -d "$BACKUP_DIR/workspace" ]; then
  echo "[restore] Uploading workspace..."
  openshell sandbox upload "$SANDBOX" "$BACKUP_DIR/workspace" /sandbox/.openclaw/workspace
fi

if [ -d "$BACKUP_DIR/agents" ]; then
  echo "[restore] Uploading agent data..."
  openshell sandbox upload "$SANDBOX" "$BACKUP_DIR/agents" /sandbox/.openclaw/agents
fi

if [ -d "$BACKUP_DIR/nemoclaw-config" ]; then
  echo "[restore] Uploading nemoclaw config..."
  openshell sandbox upload "$SANDBOX" "$BACKUP_DIR/nemoclaw-config" /sandbox/.nemoclaw
fi

echo "[restore] Done. Workspace restored to sandbox '$SANDBOX'."
