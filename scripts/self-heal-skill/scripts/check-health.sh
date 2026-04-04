#!/usr/bin/env bash
# Full health check for the NemoClaw sandbox environment.
# Exits 0 if all checks pass, 1 if any check fails.
# Outputs a structured report to stdout and logs to /tmp/self-heal.log.

set -uo pipefail

LOG="/tmp/self-heal.log"
GATEWAY_PORT="${GATEWAY_PORT:-18789}"
GATEWAY_URL="http://localhost:${GATEWAY_PORT}"
INFERENCE_URL="https://inference.local/v1/models"
DISK_THRESHOLD=90
MEMORY_MIN_MB=200
FAIL_COUNT=0
CHECK_COUNT=0

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] [health] $*" | tee -a "$LOG"; }

pass() {
  CHECK_COUNT=$((CHECK_COUNT + 1))
  log "PASS: $1"
}

fail() {
  CHECK_COUNT=$((CHECK_COUNT + 1))
  FAIL_COUNT=$((FAIL_COUNT + 1))
  log "FAIL: $1"
}

# ── 1. Gateway HTTP ────────────────────────────────────────────────
check_gateway() {
  local http_code
  http_code="$(curl -sf -o /dev/null -w '%{http_code}' -m 5 "${GATEWAY_URL}/" 2>/dev/null)" || http_code="000"

  if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 500 ] 2>/dev/null; then
    pass "Gateway HTTP responding (status ${http_code})"
  else
    fail "Gateway HTTP unreachable (status ${http_code})"
  fi
}

# ── 2. Gateway process ────────────────────────────────────────────
check_gateway_process() {
  if pgrep -f "openclaw gateway" > /dev/null 2>&1; then
    local pid
    pid="$(pgrep -f 'openclaw gateway' | head -1)"
    pass "Gateway process running (pid ${pid})"
  else
    fail "Gateway process not found"
  fi
}

# ── 3. Inference endpoint ─────────────────────────────────────────
check_inference() {
  local result
  result="$(curl -sf -m 10 "${INFERENCE_URL}" \
    -H "Authorization: Bearer ${NVIDIA_API_KEY:-}" 2>/dev/null)" || result=""

  if [ -n "$result" ]; then
    pass "Inference endpoint responding"
  else
    fail "Inference endpoint unreachable or returned empty response"
  fi
}

# ── 4. Disk space ─────────────────────────────────────────────────
check_disk() {
  local mount pct
  local any_critical=0

  while IFS= read -r line; do
    mount="$(echo "$line" | awk '{print $6}')"
    pct="$(echo "$line" | awk '{gsub(/%/,""); print $5}')"
    if [ -n "$pct" ] && [ "$pct" -ge "$DISK_THRESHOLD" ] 2>/dev/null; then
      fail "Disk usage critical: ${mount} at ${pct}%"
      any_critical=1
    fi
  done < <(df -h / /tmp /sandbox 2>/dev/null | awk 'NR>1')

  if [ "$any_critical" -eq 0 ]; then
    pass "Disk usage within limits (threshold ${DISK_THRESHOLD}%)"
  fi
}

# ── 5. Memory ─────────────────────────────────────────────────────
check_memory() {
  local avail_mb=0

  if command -v free > /dev/null 2>&1; then
    avail_mb="$(free -m 2>/dev/null | awk '/^Mem:/{print $7}')" || avail_mb=0
  elif [ -f /proc/meminfo ]; then
    local avail_kb
    avail_kb="$(awk '/MemAvailable/{print $2}' /proc/meminfo 2>/dev/null)" || avail_kb=0
    avail_mb=$((avail_kb / 1024))
  fi

  if [ "$avail_mb" -gt "$MEMORY_MIN_MB" ] 2>/dev/null; then
    pass "Available memory: ${avail_mb} MB (min ${MEMORY_MIN_MB} MB)"
  elif [ "$avail_mb" -gt 0 ] 2>/dev/null; then
    fail "Low memory: ${avail_mb} MB available (min ${MEMORY_MIN_MB} MB)"
  else
    log "SKIP: Could not determine available memory"
  fi
}

# ── 6. Running processes ──────────────────────────────────────────
check_processes() {
  local procs
  procs="$(ps aux 2>/dev/null | wc -l)" || procs=0

  if [ "$procs" -gt 2 ]; then
    pass "Process table accessible (${procs} processes)"
  else
    fail "Process table empty or inaccessible"
  fi

  # Check for zombie processes
  local zombies
  zombies="$(ps aux 2>/dev/null | awk '$8 ~ /Z/ {count++} END {print count+0}')" || zombies=0
  if [ "$zombies" -gt 5 ]; then
    fail "High zombie process count: ${zombies}"
  else
    pass "Zombie process count normal (${zombies})"
  fi
}

# ── 7. OpenClaw config exists ─────────────────────────────────────
check_config() {
  local config_path
  config_path="$(eval echo '~/.openclaw/openclaw.json')"

  if [ -f "$config_path" ]; then
    if python3 -c "import json; json.load(open('${config_path}'))" 2>/dev/null; then
      pass "openclaw.json exists and is valid JSON"
    else
      fail "openclaw.json exists but is not valid JSON"
    fi
  else
    fail "openclaw.json not found at ${config_path}"
  fi
}

# ── Run all checks ────────────────────────────────────────────────
log "=== Health check started ==="

check_gateway
check_gateway_process
check_inference
check_disk
check_memory
check_processes
check_config

log "=== Health check complete: ${FAIL_COUNT} failures out of ${CHECK_COUNT} checks ==="

echo ""
echo "Summary: ${CHECK_COUNT} checks, $((CHECK_COUNT - FAIL_COUNT)) passed, ${FAIL_COUNT} failed"

if [ "$FAIL_COUNT" -gt 0 ]; then
  exit 1
fi
exit 0
