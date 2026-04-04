#!/usr/bin/env bash
# Stop the openclaw gateway, wait for clean shutdown, restart, and verify.
# Logs all actions to /tmp/self-heal.log.
# Exits 0 on successful restart, 1 on failure.

set -uo pipefail

LOG="/tmp/self-heal.log"
GATEWAY_PORT="${GATEWAY_PORT:-18789}"
GATEWAY_URL="http://localhost:${GATEWAY_PORT}"
MAX_ATTEMPTS=3
SHUTDOWN_WAIT=5
STARTUP_WAIT=8

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] [restart] $*" | tee -a "$LOG"; }

get_gateway_pids() {
  pgrep -f "openclaw gateway" 2>/dev/null || true
}

stop_gateway() {
  local pids
  pids="$(get_gateway_pids)"

  if [ -z "$pids" ]; then
    log "No gateway process found to stop"
    return 0
  fi

  log "Stopping gateway (pids: $(echo $pids | tr '\n' ' '))"

  # Graceful shutdown first (SIGTERM)
  echo "$pids" | xargs kill 2>/dev/null || true

  local waited=0
  while [ "$waited" -lt "$SHUTDOWN_WAIT" ]; do
    if [ -z "$(get_gateway_pids)" ]; then
      log "Gateway stopped gracefully after ${waited}s"
      return 0
    fi
    sleep 1
    waited=$((waited + 1))
  done

  # Force kill if still running (SIGKILL)
  pids="$(get_gateway_pids)"
  if [ -n "$pids" ]; then
    log "Gateway did not stop gracefully, sending SIGKILL"
    echo "$pids" | xargs kill -9 2>/dev/null || true
    sleep 1
  fi

  if [ -z "$(get_gateway_pids)" ]; then
    log "Gateway stopped after SIGKILL"
    return 0
  fi

  log "ERROR: Could not stop gateway"
  return 1
}

release_port() {
  # Ensure port is free before starting
  if command -v fuser > /dev/null 2>&1; then
    fuser -k "${GATEWAY_PORT}/tcp" 2>/dev/null || true
    sleep 1
  fi
}

start_gateway() {
  log "Starting openclaw gateway..."
  nohup openclaw gateway run >> /tmp/gateway.log 2>&1 &
  local new_pid=$!
  log "Gateway process launched (pid ${new_pid})"
}

verify_gateway() {
  local waited=0
  while [ "$waited" -lt "$STARTUP_WAIT" ]; do
    local http_code
    http_code="$(curl -sf -o /dev/null -w '%{http_code}' -m 3 "${GATEWAY_URL}/" 2>/dev/null)" || http_code="000"

    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 500 ] 2>/dev/null; then
      log "Gateway verified (HTTP ${http_code}) after ${waited}s"
      return 0
    fi
    sleep 1
    waited=$((waited + 1))
  done

  # Even if HTTP is not yet serving, check the process is alive
  if [ -n "$(get_gateway_pids)" ]; then
    log "Gateway process is running but HTTP not yet responding after ${STARTUP_WAIT}s"
    return 0
  fi

  log "Gateway failed to start (no process, no HTTP)"
  return 1
}

# ── Main ──────────────────────────────────────────────────────────

log "=== Gateway restart initiated ==="

attempt=0
while [ "$attempt" -lt "$MAX_ATTEMPTS" ]; do
  attempt=$((attempt + 1))
  log "Restart attempt ${attempt}/${MAX_ATTEMPTS}"

  if ! stop_gateway; then
    log "Failed to stop gateway on attempt ${attempt}"
    continue
  fi

  release_port
  start_gateway

  if verify_gateway; then
    log "=== Gateway restart successful (attempt ${attempt}) ==="
    echo "Gateway restarted successfully."
    exit 0
  fi

  log "Verify failed on attempt ${attempt}, retrying..."
  sleep 2
done

log "=== Gateway restart FAILED after ${MAX_ATTEMPTS} attempts ==="
echo "ERROR: Gateway could not be restarted after ${MAX_ATTEMPTS} attempts."
echo "Check /tmp/gateway.log and /tmp/self-heal.log for details."
exit 1
