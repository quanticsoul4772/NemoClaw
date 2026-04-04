#!/usr/bin/env bash
# Verify the openclaw.json model configuration is correct and complete.
# Checks: file existence, valid JSON, model name, provider, API key presence.
# Exits 0 if config is valid, 1 if any problem is found.
# Logs to /tmp/self-heal.log.

set -uo pipefail

LOG="/tmp/self-heal.log"
CONFIG_PATH="${OPENCLAW_CONFIG:-$(eval echo '~/.openclaw/openclaw.json')}"
FAIL_COUNT=0
CHECK_COUNT=0

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] [config] $*" | tee -a "$LOG"; }

pass() {
  CHECK_COUNT=$((CHECK_COUNT + 1))
  log "PASS: $1"
}

fail() {
  CHECK_COUNT=$((CHECK_COUNT + 1))
  FAIL_COUNT=$((FAIL_COUNT + 1))
  log "FAIL: $1"
}

# ── 1. File existence ─────────────────────────────────────────────
check_file_exists() {
  if [ -f "$CONFIG_PATH" ]; then
    pass "Config file exists at ${CONFIG_PATH}"
    return 0
  else
    fail "Config file not found at ${CONFIG_PATH}"
    log "FIX: Run 'openclaw doctor --fix' to regenerate default config"
    return 1
  fi
}

# ── 2. Valid JSON ─────────────────────────────────────────────────
check_valid_json() {
  if python3 -c "import json; json.load(open('${CONFIG_PATH}'))" 2>/dev/null; then
    pass "Config file is valid JSON"
    return 0
  else
    fail "Config file is not valid JSON"
    log "FIX: Back up and regenerate: cp '${CONFIG_PATH}'{,.bak} && openclaw doctor --fix"
    return 1
  fi
}

# ── 3. Model name ─────────────────────────────────────────────────
check_model_name() {
  local model_name
  model_name="$(python3 -c "
import json, sys
try:
    cfg = json.load(open('${CONFIG_PATH}'))
    # Check multiple possible locations for model name
    name = None
    # models.default.name
    models = cfg.get('models', {})
    if isinstance(models, dict):
        default = models.get('default', {})
        if isinstance(default, dict):
            name = default.get('name') or default.get('model')
    # Top-level model field
    if not name:
        name = cfg.get('model', {}).get('name', '') if isinstance(cfg.get('model'), dict) else ''
    # inference.model
    if not name:
        name = cfg.get('inference', {}).get('model', '') if isinstance(cfg.get('inference'), dict) else ''
    print(name or '')
except Exception as e:
    print('', file=sys.stderr)
    print('')
" 2>/dev/null)" || model_name=""

  if [ -n "$model_name" ]; then
    pass "Model name configured: ${model_name}"
    return 0
  else
    fail "Model name missing from config"
    log "FIX: Add models.default.name to ${CONFIG_PATH} (e.g., nvidia/nemotron-3-super-120b-a12b)"
    return 1
  fi
}

# ── 4. Provider ───────────────────────────────────────────────────
check_provider() {
  local provider
  provider="$(python3 -c "
import json, sys
try:
    cfg = json.load(open('${CONFIG_PATH}'))
    prov = None
    # models.default.provider
    models = cfg.get('models', {})
    if isinstance(models, dict):
        default = models.get('default', {})
        if isinstance(default, dict):
            prov = default.get('provider')
    # Top-level provider
    if not prov:
        prov = cfg.get('provider', '')
    # inference.provider
    if not prov:
        prov = cfg.get('inference', {}).get('provider', '') if isinstance(cfg.get('inference'), dict) else ''
    print(prov or '')
except Exception as e:
    print('')
" 2>/dev/null)" || provider=""

  if [ -n "$provider" ]; then
    pass "Provider configured: ${provider}"
    return 0
  else
    fail "Provider missing from config"
    log "FIX: Add models.default.provider to ${CONFIG_PATH} (e.g., nvidia-nim)"
    return 1
  fi
}

# ── 5. API key / token ───────────────────────────────────────────
check_api_key() {
  # Check environment variable first
  if [ -n "${NVIDIA_API_KEY:-}" ]; then
    local key_preview="${NVIDIA_API_KEY:0:8}..."
    pass "NVIDIA_API_KEY set in environment (${key_preview})"
    return 0
  fi

  # Check if auth profile references the key
  local auth_profile
  auth_profile="$(eval echo '~/.openclaw/agents/main/agent/auth-profiles.json')"
  if [ -f "$auth_profile" ]; then
    local has_nvidia
    has_nvidia="$(python3 -c "
import json
try:
    data = json.load(open('${auth_profile}'))
    for k, v in data.items():
        if isinstance(v, dict) and v.get('provider') == 'nvidia':
            print('yes')
            break
    else:
        print('no')
except:
    print('no')
" 2>/dev/null)" || has_nvidia="no"

    if [ "$has_nvidia" = "yes" ]; then
      pass "NVIDIA auth profile found in auth-profiles.json"
      return 0
    fi
  fi

  # Check config for gateway auth token
  local has_token
  has_token="$(python3 -c "
import json
try:
    cfg = json.load(open('${CONFIG_PATH}'))
    token = cfg.get('gateway', {}).get('auth', {}).get('token', '')
    print('yes' if token else 'no')
except:
    print('no')
" 2>/dev/null)" || has_token="no"

  if [ "$has_token" = "yes" ]; then
    pass "Gateway auth token present in config"
    return 0
  fi

  fail "No API key or auth token found"
  log "FIX: Set NVIDIA_API_KEY environment variable or run onboarding again"
  return 1
}

# ── 6. File permissions ───────────────────────────────────────────
check_permissions() {
  local perms
  perms="$(stat -c '%a' "$CONFIG_PATH" 2>/dev/null || stat -f '%Lp' "$CONFIG_PATH" 2>/dev/null)" || perms=""

  if [ -z "$perms" ]; then
    log "SKIP: Could not check file permissions"
    return 0
  fi

  if [ "$perms" = "600" ] || [ "$perms" = "644" ] || [ "$perms" = "640" ]; then
    pass "Config file permissions: ${perms}"
    return 0
  else
    fail "Config file permissions too open: ${perms} (expected 600 or 640)"
    log "FIX: chmod 600 '${CONFIG_PATH}'"
    return 1
  fi
}

# ── Run all checks ────────────────────────────────────────────────

log "=== Config verification started (${CONFIG_PATH}) ==="

if ! check_file_exists; then
  log "=== Config verification aborted: file not found ==="
  echo "Config file not found. Run: openclaw doctor --fix"
  exit 1
fi

if ! check_valid_json; then
  log "=== Config verification aborted: invalid JSON ==="
  echo "Config file is corrupt. Back up and regenerate with: openclaw doctor --fix"
  exit 1
fi

check_model_name || true
check_provider || true
check_api_key || true
check_permissions || true

log "=== Config verification complete: ${FAIL_COUNT} failures out of ${CHECK_COUNT} checks ==="

echo ""
echo "Config: ${CONFIG_PATH}"
echo "Summary: ${CHECK_COUNT} checks, $((CHECK_COUNT - FAIL_COUNT)) passed, ${FAIL_COUNT} failed"

if [ "$FAIL_COUNT" -gt 0 ]; then
  exit 1
fi
exit 0
