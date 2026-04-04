#!/usr/bin/env bash
# Watchdog for openclaw gateway inside the sandbox.
# Checks if the gateway process is alive every 30 seconds.
# If dead, restarts it. Logs to /tmp/watchdog.log.

LOG=/tmp/watchdog.log
CHECK_INTERVAL=30
MAX_RESTARTS=10
RESTART_COUNT=0

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*" >> "$LOG"; }

is_gateway_alive() {
  pgrep -f "openclaw gateway run" > /dev/null 2>&1
}

restart_gateway() {
  log "Gateway process not found. Restarting (attempt $((RESTART_COUNT + 1))/$MAX_RESTARTS)..."
  nohup openclaw gateway run >> /tmp/gateway.log 2>&1 &
  sleep 3
  if is_gateway_alive; then
    log "Gateway restarted successfully (pid $!)"
    RESTART_COUNT=$((RESTART_COUNT + 1))
    return 0
  else
    log "Gateway failed to restart"
    return 1
  fi
}

log "Watchdog started. Checking gateway every ${CHECK_INTERVAL}s."

while true; do
  if ! is_gateway_alive; then
    if [ "$RESTART_COUNT" -ge "$MAX_RESTARTS" ]; then
      log "Max restarts ($MAX_RESTARTS) reached. Watchdog exiting."
      exit 1
    fi
    restart_gateway
  else
    # Reset restart counter after 10 minutes of stability
    RESTART_COUNT=0
  fi
  sleep "$CHECK_INTERVAL"
done
