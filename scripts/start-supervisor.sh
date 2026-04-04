#!/usr/bin/env bash
# One-command start for the full NemoClaw stack.
# Run: bash scripts/start-supervisor.sh

set -uo pipefail

export SANDBOX_NAME="rawcell"
export CHECK_INTERVAL="30"
export BACKUP_INTERVAL="900"
export DASHBOARD_PORT="18789"
export TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:?Set TELEGRAM_BOT_TOKEN env var}"
export ALERT_CHAT_ID="${ALERT_CHAT_ID:-}"
FIXED_TOKEN="${GATEWAY_TOKEN:?Set GATEWAY_TOKEN env var}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== NemoClaw Full Stack Start ==="

# Kill any existing processes
echo "Killing old processes..."
pkill -f "nemoclaw-supervisor" 2>/dev/null || true
pkill -f "tg-bridge" 2>/dev/null || true
pkill -f "openshell forward start" 2>/dev/null || true
sleep 1

# Ensure NVM is loaded
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 20 2>/dev/null || true

# Ensure Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "Starting Docker..."
  sudo service docker start
  sleep 3
fi

# Start supervisor in background (manages port forward internally)
echo "Starting supervisor..."
nohup bash "$SCRIPT_DIR/nemoclaw-supervisor.sh" >> /tmp/nemoclaw-supervisor.log 2>&1 &
SUPERVISOR_PID=$!
echo "  Supervisor PID: $SUPERVISOR_PID"

# Wait for supervisor to bootstrap
sleep 10

# Start Telegram bridge in background
echo "Starting Telegram bridge..."
nohup node "$SCRIPT_DIR/tg-bridge-reliable.js" >> /tmp/nemoclaw-telegram.log 2>&1 &
TG_PID=$!
echo "  Telegram PID: $TG_PID"

echo ""
echo "=== Stack Running ==="
echo "  Supervisor:  PID $SUPERVISOR_PID"
echo "  Telegram:    PID $TG_PID"
echo "  Dashboard:   http://127.0.0.1:${DASHBOARD_PORT}/#token=${FIXED_TOKEN}"
echo ""
echo "  Logs:        tail -f /tmp/nemoclaw-supervisor.log"
echo "  Stop:        pkill -f nemoclaw-supervisor; pkill -f tg-bridge"
