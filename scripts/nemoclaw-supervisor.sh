#!/usr/bin/env bash
# =============================================================================
# NemoClaw Supervisor v2 — keeps the entire agent stack alive
# =============================================================================
#
# Monitors and auto-recovers all components:
#   1. Docker daemon
#   2. OpenShell gateway (k3s cluster)
#   3. Sandbox health
#   4. OpenClaw gateway (inside sandbox)
#   5. Port forward (18789) — managed as child process
#   6. Periodic workspace + session backup
#   7. Auto-bootstrap on fresh sandbox
#   8. Log rotation
#
# Run: nohup bash scripts/nemoclaw-supervisor.sh &

set -uo pipefail

SANDBOX="${SANDBOX_NAME:-rawcell}"
CHECK_INTERVAL="${CHECK_INTERVAL:-30}"
BACKUP_INTERVAL="${BACKUP_INTERVAL:-900}"
DASHBOARD_PORT="${DASHBOARD_PORT:-18789}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_FILE="/tmp/nemoclaw-supervisor.log"
MAX_LOG_BYTES=10485760  # 10MB
LAST_BACKUP=0
CONSECUTIVE_FAILURES=0
MAX_FAILURES_BEFORE_FULL_RESTART=5
FORWARD_PID=""
FIXED_GATEWAY_TOKEN="${GATEWAY_TOKEN:?Set GATEWAY_TOKEN env var}"
MODEL="nvidia/llama-3.3-nemotron-super-49b-v1.5"
DAILY_RESTART_HOUR=4  # UTC hour for proactive daily restart
LAST_DAILY_RESTART_DAY=""
USE_SOCAT=true  # Use socat instead of openshell forward

# NVM setup
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 20 2>/dev/null || true

# ── Logging ──────────────────────────────────────────────────────
log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] [supervisor] $*" | tee -a "$LOG_FILE"; }
warn() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] [WARN] $*" | tee -a "$LOG_FILE"; }
err() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] [ERROR] $*" | tee -a "$LOG_FILE"; }

# ── Log rotation ─────────────────────────────────────────────────
rotate_log() {
  local size
  size=$(stat -c%s "$LOG_FILE" 2>/dev/null || echo 0)
  if [ "$size" -gt "$MAX_LOG_BYTES" ]; then
    mv "$LOG_FILE" "${LOG_FILE}.old"
    log "Log rotated (was ${size} bytes)"
  fi
}

# ── Telegram alerts ──────────────────────────────────────────────
alert() {
  local msg="🔧 NemoClaw: $1"
  log "ALERT: $1"
  if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${ALERT_CHAT_ID:-}" ]; then
    curl -sf -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      -H "Content-Type: application/json" \
      -d "{\"chat_id\": \"${ALERT_CHAT_ID}\", \"text\": \"${msg}\"}" > /dev/null 2>&1 || true
  fi
}

# ── SSH helper ───────────────────────────────────────────────────
sandbox_ssh() {
  ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR \
    -o ConnectTimeout=10 \
    -o "ProxyCommand=openshell ssh-proxy --gateway-name nemoclaw --name $SANDBOX" \
    "sandbox@openshell-$SANDBOX" "$@" 2>/dev/null
}

# ── Health checks ────────────────────────────────────────────────
check_docker() {
  docker info > /dev/null 2>&1
}

check_gateway_container() {
  docker inspect --format='{{.State.Running}}' openshell-cluster-nemoclaw 2>/dev/null | grep -q "true"
}

check_gateway_cluster() {
  openshell doctor exec -- kubectl get nodes > /dev/null 2>&1
}

check_sandbox() {
  local output
  output=$(openshell sandbox list 2>/dev/null)
  echo "$output" | grep -q "$SANDBOX.*Ready"
}

check_sandbox_gateway() {
  local result
  result=$(sandbox_ssh 'curl -sf http://127.0.0.1:18789/ > /dev/null 2>&1 && echo OK') || true
  [ "$result" = "OK" ]
}

check_port_forward() {
  [ -n "$FORWARD_PID" ] && kill -0 "$FORWARD_PID" 2>/dev/null
}

# ── Port forward management ─────────────────────────────────────
get_sandbox_ip() {
  # Get the sandbox pod IP from k3s
  openshell doctor exec -- kubectl get pod -n openshell -l "sandbox-name=$SANDBOX" \
    -o jsonpath='{.items[0].status.podIP}' 2>/dev/null
}

start_port_forward() {
  # Kill any existing forward
  if [ -n "$FORWARD_PID" ]; then
    kill "$FORWARD_PID" 2>/dev/null || true
    FORWARD_PID=""
  fi
  openshell forward stop "$DASHBOARD_PORT" "$SANDBOX" 2>/dev/null || true
  pkill -f "socat.*TCP-LISTEN:${DASHBOARD_PORT}" 2>/dev/null || true
  sleep 1

  if $USE_SOCAT; then
    # Install socat if missing
    command -v socat > /dev/null 2>&1 || {
      log "Installing socat..."
      sudo apt-get install -y socat > /dev/null 2>&1 || true
    }

    local pod_ip
    pod_ip=$(get_sandbox_ip)
    if [ -z "$pod_ip" ]; then
      warn "Could not get sandbox pod IP — falling back to openshell forward"
      openshell forward start "$DASHBOARD_PORT" "$SANDBOX" > /dev/null 2>&1 &
      FORWARD_PID=$!
    else
      socat "TCP-LISTEN:${DASHBOARD_PORT},fork,reuseaddr" "TCP:${pod_ip}:${DASHBOARD_PORT}" &
      FORWARD_PID=$!
      log "socat forward started: localhost:${DASHBOARD_PORT} -> ${pod_ip}:${DASHBOARD_PORT} (PID $FORWARD_PID)"
    fi
  else
    openshell forward start "$DASHBOARD_PORT" "$SANDBOX" > /dev/null 2>&1 &
    FORWARD_PID=$!
  fi

  sleep 2
  if [ -n "$FORWARD_PID" ] && kill -0 "$FORWARD_PID" 2>/dev/null; then
    log "Port forward running (PID $FORWARD_PID)"
    return 0
  else
    FORWARD_PID=""
    warn "Port forward failed to start"
    return 1
  fi
}

# ── Recovery actions ─────────────────────────────────────────────
start_docker() {
  warn "Docker not running — starting..."
  sudo service docker start 2>&1 || true
  sleep 3
  if check_docker; then
    alert "Docker restarted"
    return 0
  fi
  err "Failed to start Docker"
  return 1
}

start_gateway_container() {
  warn "Gateway container not running — starting..."
  docker start openshell-cluster-nemoclaw 2>&1 || true
  # Ensure restart policy is set
  docker update --restart=always openshell-cluster-nemoclaw 2>/dev/null || true
  sleep 15
  if check_gateway_container; then
    # Wait for k3s to become healthy inside the container
    local tries=0
    while [ "$tries" -lt 6 ]; do
      if check_gateway_cluster; then
        alert "Gateway container restarted and cluster healthy"
        return 0
      fi
      tries=$((tries + 1))
      sleep 10
    done
    warn "Gateway container running but cluster not healthy yet"
    return 0
  fi
  err "Failed to start gateway container"
  return 1
}

restart_sandbox_gateway() {
  warn "OpenClaw gateway inside sandbox is down — restarting..."
  sandbox_ssh 'openclaw gateway stop 2>/dev/null; nohup openclaw gateway run >> /tmp/gateway.log 2>&1 &' || true
  sleep 5
  if check_sandbox_gateway; then
    alert "OpenClaw gateway restarted"
    return 0
  fi
  return 1
}

# ── Auto-bootstrap ───────────────────────────────────────────────
# Runs after any sandbox create/restore to ensure the agent has context
bootstrap_sandbox() {
  log "Bootstrapping sandbox..."

  # Fix model config inside sandbox
  sandbox_ssh "python3 -c \"
import json, os
path = os.path.expanduser('~/.openclaw/openclaw.json')
cfg = json.load(open(path))
cfg['agents']['defaults']['model']['primary'] = '$MODEL'
cfg['models']['providers']['nvidia']['models'][0]['id'] = '$(echo $MODEL | sed 's|nvidia/||')'
cfg['models']['providers']['nvidia']['models'][0]['name'] = 'NVIDIA Nemotron Super 49B v1.5'
cfg['gateway']['auth'] = {'mode': 'token', 'token': '$FIXED_GATEWAY_TOKEN'}
json.dump(cfg, open(path, 'w'), indent=2)
os.chmod(path, 0o600)
print('Config updated: model=$MODEL, token=fixed')
\"" || warn "Config update failed"

  # Ensure workspace directory exists
  sandbox_ssh 'mkdir -p /sandbox/.openclaw/workspace/memory' || true

  # Upload bootstrap context if workspace is empty
  local file_count
  file_count=$(sandbox_ssh 'ls /sandbox/.openclaw/workspace/*.md 2>/dev/null | wc -l') || file_count="0"
  if [ "${file_count:-0}" -lt 2 ]; then
    log "Workspace empty — uploading bootstrap context..."

    # Create bootstrap files on host
    mkdir -p /tmp/nemoclaw-bootstrap/memory

    cat > /tmp/nemoclaw-bootstrap/USER.md << 'USEREOF'
# User Profile: quanticsoul4772

## GitHub
- 32 public repos, active since Sept 2020
- Focus: MCP servers, AI agent frameworks, developer tooling
- Key repos: analytical-mcp, bear-mcp, exa-mcp-server, github-mcp, grafana-mcp, obsidian-mcp, mcp-reasoning, mcp-roblox, mcp-server-win-cli, mcplint
- Languages: TypeScript (11), Python (5), Rust (4), Go (2), Java (2)

## Current Project
- Forked NVIDIA/NemoClaw to quanticsoul4772/NemoClaw
- Improving OpenClaw sandbox reliability, policies, and observability
- Working with Claude Code agent on the host to fix CI, tests, and policies
- This sandbox agent (Rawcell) is building skills and tools

## Preferences
- Wants concise, actionable responses — not long status updates
- Wants to see progress, not repeated summaries
- Gets frustrated when agent appears idle or unresponsive
- Prefers the agent to just keep working without asking permission
USEREOF

    cat > /tmp/nemoclaw-bootstrap/memory/context.md << CTXEOF
# Session Context — $(date -u +%Y-%m-%d)

## Environment
- Model: $MODEL (faster than the original 120b)
- Sandbox: $SANDBOX
- Dashboard: http://127.0.0.1:${DASHBOARD_PORT}/#token=${FIXED_GATEWAY_TOKEN}
- Fork: https://github.com/quanticsoul4772/NemoClaw
- Upstream: https://github.com/NVIDIA/NemoClaw (read-only, never push)

## What to do on startup
1. Read USER.md for user profile
2. Clone repos if not present: analytical-mcp, github-mcp from quanticsoul4772
3. Continue building the metrics-skill for OpenClaw observability
4. Keep working — don't ask for permission, just make progress
CTXEOF

    openshell sandbox upload "$SANDBOX" /tmp/nemoclaw-bootstrap /sandbox/.openclaw/workspace 2>&1 || warn "Bootstrap upload failed"
    rm -rf /tmp/nemoclaw-bootstrap
    log "Bootstrap context uploaded"
  else
    log "Workspace has files — skipping bootstrap upload"
  fi

  # Clone repos if missing
  sandbox_ssh 'cd /sandbox/.openclaw/workspace && [ ! -d analytical-mcp ] && git clone https://github.com/quanticsoul4772/analytical-mcp.git 2>&1 || echo "analytical-mcp exists"' || true
  sandbox_ssh 'cd /sandbox/.openclaw/workspace && [ ! -d github-mcp ] && git clone https://github.com/quanticsoul4772/github-mcp.git 2>&1 || echo "github-mcp exists"' || true

  log "Bootstrap complete"
}

# ── Full restart ─────────────────────────────────────────────────
full_sandbox_restart() {
  alert "Full sandbox restart ($CONSECUTIVE_FAILURES consecutive failures)"

  # Kill port forward
  if [ -n "$FORWARD_PID" ]; then
    kill "$FORWARD_PID" 2>/dev/null || true
    FORWARD_PID=""
  fi

  # Backup first
  log "Backing up workspace..."
  bash "$SCRIPT_DIR/sandbox-backup.sh" "$SANDBOX" 2>&1 | tee -a "$LOG_FILE" || true

  # Destroy and recreate
  log "Destroying sandbox..."
  openshell sandbox delete "$SANDBOX" 2>&1 || true
  sleep 2

  log "Recreating sandbox..."
  openshell sandbox create \
    --name "$SANDBOX" \
    --from openshell/sandbox-from:1774474867 \
    --provider nvidia-nim \
    --policy "$HOME/.nemoclaw/sandbox-policy.yaml" \
    --no-tty \
    -- nemoclaw-start 2>&1 | tee -a "$LOG_FILE"

  sleep 5

  # Restore workspace
  log "Restoring workspace..."
  bash "$SCRIPT_DIR/sandbox-restore.sh" "$SANDBOX" 2>&1 | tee -a "$LOG_FILE" || true

  # Bootstrap (fix config, ensure repos)
  bootstrap_sandbox

  # Restart port forward
  start_port_forward || true

  alert "Restart complete — dashboard: http://127.0.0.1:${DASHBOARD_PORT}/#token=${FIXED_GATEWAY_TOKEN}"
  CONSECUTIVE_FAILURES=0
}

# ── Periodic backup (workspace + sessions) ───────────────────────
maybe_backup() {
  local now
  now=$(date +%s)
  if [ $((now - LAST_BACKUP)) -ge "$BACKUP_INTERVAL" ]; then
    log "Periodic backup..."
    bash "$SCRIPT_DIR/sandbox-backup.sh" "$SANDBOX" >> "$LOG_FILE" 2>&1 || warn "Backup failed"
    LAST_BACKUP=$now
  fi
}

# ── Cleanup on exit ──────────────────────────────────────────────
cleanup() {
  log "Supervisor shutting down..."
  if [ -n "$FORWARD_PID" ]; then
    kill "$FORWARD_PID" 2>/dev/null || true
  fi
  pkill -f "socat.*TCP-LISTEN:${DASHBOARD_PORT}" 2>/dev/null || true
  alert "Supervisor stopped"
  exit 0
}
trap cleanup SIGTERM SIGINT

# ── Main ─────────────────────────────────────────────────────────
log "NemoClaw Supervisor v2 starting"
log "  Sandbox: $SANDBOX"
log "  Model: $MODEL"
log "  Check interval: ${CHECK_INTERVAL}s"
log "  Backup interval: ${BACKUP_INTERVAL}s"
log "  Dashboard: http://127.0.0.1:${DASHBOARD_PORT}/#token=${FIXED_GATEWAY_TOKEN}"
alert "Supervisor v2 started"

# Initial bootstrap
bootstrap_sandbox

# Start port forward as child process
start_port_forward || true

while true; do
  FAILED=false

  # Rotate log if too big
  rotate_log

  # Proactive daily restart at configured hour
  local current_hour current_day
  current_hour=$(date -u +%H)
  current_day=$(date -u +%Y-%m-%d)
  if [ "$current_hour" = "$(printf '%02d' $DAILY_RESTART_HOUR)" ] && [ "$current_day" != "$LAST_DAILY_RESTART_DAY" ]; then
    log "Proactive daily restart (${DAILY_RESTART_HOUR}:00 UTC)"
    LAST_DAILY_RESTART_DAY="$current_day"
    full_sandbox_restart
    continue
  fi

  # Check Docker
  if ! check_docker; then
    start_docker || FAILED=true
  fi

  # Check gateway container (between Docker and cluster)
  if ! $FAILED && ! check_gateway_container; then
    start_gateway_container || FAILED=true
  fi

  # Check gateway cluster
  if ! $FAILED && ! check_gateway_cluster; then
    warn "Gateway cluster unhealthy"
    FAILED=true
  fi

  # Check sandbox
  if ! $FAILED && ! check_sandbox; then
    err "Sandbox not found or not Ready"
    FAILED=true
  fi

  # Check openclaw gateway inside sandbox
  if ! $FAILED && ! check_sandbox_gateway; then
    restart_sandbox_gateway || FAILED=true
  fi

  # Check port forward (non-fatal, just restart it)
  if ! $FAILED && ! check_port_forward; then
    start_port_forward || true
  fi

  # Track failures
  if $FAILED; then
    CONSECUTIVE_FAILURES=$((CONSECUTIVE_FAILURES + 1))
    err "Health check failed (consecutive: $CONSECUTIVE_FAILURES)"
    if [ "$CONSECUTIVE_FAILURES" -ge "$MAX_FAILURES_BEFORE_FULL_RESTART" ]; then
      full_sandbox_restart
    fi
  else
    if [ "$CONSECUTIVE_FAILURES" -gt 0 ]; then
      log "Recovered after $CONSECUTIVE_FAILURES failures"
    fi
    CONSECUTIVE_FAILURES=0
    maybe_backup
  fi

  sleep "$CHECK_INTERVAL"
done
