#!/usr/bin/env bash
# Test network connectivity from inside the sandbox to critical external services.
# Checks DNS resolution and HTTPS reachability for each endpoint.
# Exits 0 if all pass, 1 if any fail.
# Logs to /tmp/self-heal.log.

set -uo pipefail

LOG="/tmp/self-heal.log"
TIMEOUT=8
FAIL_COUNT=0
CHECK_COUNT=0

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] [connectivity] $*" | tee -a "$LOG"; }

pass() {
  CHECK_COUNT=$((CHECK_COUNT + 1))
  log "PASS: $1"
}

fail() {
  CHECK_COUNT=$((CHECK_COUNT + 1))
  FAIL_COUNT=$((FAIL_COUNT + 1))
  log "FAIL: $1"
}

# Test DNS resolution for a hostname
test_dns() {
  local host="$1"
  if command -v getent > /dev/null 2>&1; then
    getent hosts "$host" > /dev/null 2>&1
  elif command -v nslookup > /dev/null 2>&1; then
    nslookup "$host" > /dev/null 2>&1
  elif command -v dig > /dev/null 2>&1; then
    dig +short "$host" > /dev/null 2>&1
  elif command -v python3 > /dev/null 2>&1; then
    python3 -c "import socket; socket.getaddrinfo('${host}', 443)" > /dev/null 2>&1
  else
    # Fall through to curl-based check
    return 0
  fi
}

# Test HTTPS connectivity to a URL
test_https() {
  local url="$1"
  curl -sf -o /dev/null -m "$TIMEOUT" --head "$url" 2>/dev/null
}

# Combined DNS + HTTPS check for a service
check_service() {
  local name="$1"
  local host="$2"
  local url="$3"

  # DNS check
  if ! test_dns "$host"; then
    fail "${name}: DNS resolution failed for ${host}"
    return 1
  fi

  # HTTPS reachability check
  if test_https "$url"; then
    pass "${name}: ${host} reachable"
    return 0
  else
    fail "${name}: HTTPS connection failed to ${url}"
    return 1
  fi
}

# ── Run checks ────────────────────────────────────────────────────

log "=== Connectivity check started ==="

# GitHub (code hosting, API)
check_service "GitHub" \
  "github.com" \
  "https://github.com" || true

check_service "GitHub API" \
  "api.github.com" \
  "https://api.github.com" || true

# NVIDIA (inference API)
check_service "NVIDIA NIM API" \
  "integrate.api.nvidia.com" \
  "https://integrate.api.nvidia.com" || true

# npm registry (package installs)
check_service "npm Registry" \
  "registry.npmjs.org" \
  "https://registry.npmjs.org" || true

# PyPI (Python packages)
check_service "PyPI" \
  "pypi.org" \
  "https://pypi.org" || true

# Also test the inference.local internal endpoint
log "Checking inference.local (internal sandbox routing)..."
if curl -sf -o /dev/null -m "$TIMEOUT" "https://inference.local/v1/models" \
  -H "Authorization: Bearer ${NVIDIA_API_KEY:-}" 2>/dev/null; then
  pass "inference.local: internal routing working"
else
  # inference.local may legitimately fail without a valid API key
  if [ -z "${NVIDIA_API_KEY:-}" ]; then
    log "SKIP: inference.local check skipped (NVIDIA_API_KEY not set)"
  else
    fail "inference.local: internal routing failed"
  fi
fi

# Basic internet connectivity test (fallback diagnostic)
if [ "$FAIL_COUNT" -gt 0 ]; then
  log "Running fallback diagnostics..."

  # Check if we can reach any IP at all (bypassing DNS)
  if ping -c 1 -W 3 8.8.8.8 > /dev/null 2>&1; then
    log "INFO: Raw IP connectivity works (ping 8.8.8.8 OK)"
    log "INFO: Failures are likely DNS-related"
    log "INFO: Current resolv.conf:"
    cat /etc/resolv.conf 2>/dev/null | while IFS= read -r line; do
      log "INFO:   ${line}"
    done
  else
    log "INFO: Raw IP connectivity also failed"
    log "INFO: Network namespace may be broken or sandbox has no network"
  fi
fi

log "=== Connectivity check complete: ${FAIL_COUNT} failures out of ${CHECK_COUNT} checks ==="

echo ""
echo "Summary: ${CHECK_COUNT} checks, $((CHECK_COUNT - FAIL_COUNT)) passed, ${FAIL_COUNT} failed"

if [ "$FAIL_COUNT" -gt 0 ]; then
  exit 1
fi
exit 0
