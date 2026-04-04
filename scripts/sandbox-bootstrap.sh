#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────
# sandbox-bootstrap.sh — Run on every fresh sandbox start to set up
# the OpenClaw agent workspace, clone repos, verify connectivity,
# and generate a WORKSPACE.md status document.
#
# Usage:  bash /sandbox/NemoClaw/scripts/sandbox-bootstrap.sh
# ──────────────────────────────────────────────────────────────────────

set -uo pipefail

# ── Colors ────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ── Paths ─────────────────────────────────────────────────────────────
WORKSPACE_ROOT="/sandbox/.openclaw/workspace"
MEMORY_DIR="${WORKSPACE_ROOT}/memory"
SKILLS_DIR="${WORKSPACE_ROOT}/skills"
REPOS_DIR="/sandbox"
OPENCLAW_CONFIG="${HOME}/.openclaw/openclaw.json"
WORKSPACE_MD="${WORKSPACE_ROOT}/WORKSPACE.md"
GATEWAY_URL="http://127.0.0.1:18789/"
TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# ── Helpers ───────────────────────────────────────────────────────────
info()  { echo -e "${GREEN}[+]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
fail()  { echo -e "${RED}[x]${NC} $1"; }
header(){ echo -e "\n${CYAN}${BOLD}=== $1 ===${NC}"; }
ok()    { echo -e "  ${GREEN}✓${NC} $1"; }
nok()   { echo -e "  ${RED}✗${NC} $1"; }

# Accumulator arrays for the WORKSPACE.md report
declare -a REPO_STATUS=()
declare -a CONNECTIVITY_STATUS=()
GATEWAY_HEALTH="unknown"
CURRENT_MODEL="unknown"

# ── 1. Workspace structure ────────────────────────────────────────────
header "Setting up workspace structure"

for dir in "$MEMORY_DIR" "$SKILLS_DIR"; do
  if [ -d "$dir" ]; then
    ok "$dir (already exists)"
  else
    mkdir -p "$dir"
    ok "$dir (created)"
  fi
done

# ── 2. Clone repos ───────────────────────────────────────────────────
header "Cloning repositories"

declare -A REPOS=(
  ["mcp-reasoning"]="https://github.com/quanticsoul4772/mcp-reasoning.git"
  ["github-mcp"]="https://github.com/quanticsoul4772/github-mcp.git"
  ["NemoClaw"]="https://github.com/quanticsoul4772/NemoClaw.git"
)

for name in "${!REPOS[@]}"; do
  url="${REPOS[$name]}"
  dest="${REPOS_DIR}/${name}"

  if [ -d "${dest}/.git" ]; then
    ok "${name} — already cloned at ${dest}"
    REPO_STATUS+=("${name}: already present")
  else
    info "Cloning ${name} from ${url} ..."
    if git clone --depth 1 "${url}" "${dest}" 2>/dev/null; then
      ok "${name} — cloned successfully"
      REPO_STATUS+=("${name}: freshly cloned")
    else
      nok "${name} — clone failed"
      REPO_STATUS+=("${name}: CLONE FAILED")
    fi
  fi
done

# ── 3. Verify connectivity ───────────────────────────────────────────
header "Verifying connectivity"

ENDPOINTS=(
  "github.com"
  "api.github.com"
  "integrate.api.nvidia.com"
  "registry.npmjs.org"
)

for endpoint in "${ENDPOINTS[@]}"; do
  if curl -sf --max-time 5 "https://${endpoint}/" -o /dev/null 2>/dev/null; then
    ok "${endpoint} — reachable"
    CONNECTIVITY_STATUS+=("${endpoint}: reachable")
  else
    nok "${endpoint} — unreachable"
    CONNECTIVITY_STATUS+=("${endpoint}: UNREACHABLE")
  fi
done

# ── 4. Verify gateway health ─────────────────────────────────────────
header "Checking gateway health"

if curl -sf --max-time 5 "${GATEWAY_URL}" -o /dev/null 2>/dev/null; then
  ok "Gateway at ${GATEWAY_URL} — healthy"
  GATEWAY_HEALTH="healthy"
else
  nok "Gateway at ${GATEWAY_URL} — not responding"
  GATEWAY_HEALTH="NOT RESPONDING"
fi

# ── 5. Verify model config ───────────────────────────────────────────
header "Verifying model configuration"

if [ -f "$OPENCLAW_CONFIG" ]; then
  ok "Config file found: ${OPENCLAW_CONFIG}"

  # Extract model field — try jq first, fall back to grep/sed
  if command -v jq &>/dev/null; then
    CURRENT_MODEL="$(jq -r '.model // empty' "$OPENCLAW_CONFIG" 2>/dev/null)"
  else
    # Portable fallback: extract the value after "model":
    CURRENT_MODEL="$(sed -n 's/.*"model"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$OPENCLAW_CONFIG" | head -1)"
  fi

  if [ -n "$CURRENT_MODEL" ] && [ "$CURRENT_MODEL" != "null" ]; then
    ok "Model: ${CURRENT_MODEL}"
  else
    nok "Model field is missing or empty in ${OPENCLAW_CONFIG}"
    CURRENT_MODEL="NOT CONFIGURED"
  fi
else
  nok "Config file not found: ${OPENCLAW_CONFIG}"
  CURRENT_MODEL="CONFIG FILE MISSING"
fi

# ── 6. Discover available skills ─────────────────────────────────────
header "Discovering available skills"

AVAILABLE_SKILLS=()

if [ -d "$SKILLS_DIR" ]; then
  while IFS= read -r -d '' skill_file; do
    skill_name="$(basename "${skill_file}" | sed 's/\.[^.]*$//')"
    AVAILABLE_SKILLS+=("$skill_name")
  done < <(find "$SKILLS_DIR" -maxdepth 1 -type f -print0 2>/dev/null)
fi

# Also scan for skills in the NemoClaw repo if present
NEMOCLAW_SKILLS_DIR="${REPOS_DIR}/NemoClaw/skills"
if [ -d "$NEMOCLAW_SKILLS_DIR" ]; then
  while IFS= read -r -d '' skill_file; do
    skill_name="$(basename "${skill_file}" | sed 's/\.[^.]*$//')"
    AVAILABLE_SKILLS+=("$skill_name")
  done < <(find "$NEMOCLAW_SKILLS_DIR" -maxdepth 1 -type f -print0 2>/dev/null)
fi

if [ ${#AVAILABLE_SKILLS[@]} -eq 0 ]; then
  warn "No skills discovered yet (skills directory is empty)"
else
  for s in "${AVAILABLE_SKILLS[@]}"; do
    ok "Skill: ${s}"
  done
fi

# ── 7. Generate WORKSPACE.md ─────────────────────────────────────────
header "Generating WORKSPACE.md"

cat > "$WORKSPACE_MD" <<MDEOF
# OpenClaw Workspace Status

> Auto-generated by \`sandbox-bootstrap.sh\` at **${TIMESTAMP}**

## Repositories

| Repository | Status |
|------------|--------|
MDEOF

for entry in "${REPO_STATUS[@]}"; do
  repo_name="${entry%%:*}"
  repo_state="${entry#*: }"
  echo "| ${repo_name} | ${repo_state} |" >> "$WORKSPACE_MD"
done

cat >> "$WORKSPACE_MD" <<MDEOF

## Connectivity

| Endpoint | Status |
|----------|--------|
MDEOF

for entry in "${CONNECTIVITY_STATUS[@]}"; do
  ep_name="${entry%%:*}"
  ep_state="${entry#*: }"
  echo "| ${ep_name} | ${ep_state} |" >> "$WORKSPACE_MD"
done

cat >> "$WORKSPACE_MD" <<MDEOF

## Gateway

- **URL**: ${GATEWAY_URL}
- **Status**: ${GATEWAY_HEALTH}

## Model

- **Current model**: \`${CURRENT_MODEL}\`
- **Config path**: \`${OPENCLAW_CONFIG}\`

## Available Skills

MDEOF

if [ ${#AVAILABLE_SKILLS[@]} -eq 0 ]; then
  echo "_No skills discovered. Add skill files to \`${SKILLS_DIR}/\` to register them._" >> "$WORKSPACE_MD"
else
  for s in "${AVAILABLE_SKILLS[@]}"; do
    echo "- \`${s}\`" >> "$WORKSPACE_MD"
  done
fi

cat >> "$WORKSPACE_MD" <<MDEOF

## Agent Work Queue

The agent should prioritize the following on startup:

1. **Verify tool connectivity** — Confirm MCP servers (mcp-reasoning, github-mcp) are reachable.
2. **Load memory** — Read any persisted state from \`${MEMORY_DIR}/\`.
3. **Check pending tasks** — Look for open GitHub issues or assigned work items.
4. **Resume interrupted work** — If a previous session left partial state, pick up where it stopped.
5. **Run health self-test** — Validate that inference through the gateway returns a coherent response.
MDEOF

ok "Written to ${WORKSPACE_MD}"

# ── 8. Summary ────────────────────────────────────────────────────────
header "Bootstrap Summary"

echo ""
echo -e "  ${BOLD}Timestamp${NC}:   ${TIMESTAMP}"
echo -e "  ${BOLD}Model${NC}:       ${CURRENT_MODEL}"
echo -e "  ${BOLD}Gateway${NC}:     ${GATEWAY_HEALTH}"
echo -e "  ${BOLD}Repos${NC}:       ${#REPO_STATUS[@]} checked"
echo -e "  ${BOLD}Endpoints${NC}:   ${#CONNECTIVITY_STATUS[@]} tested"
echo -e "  ${BOLD}Skills${NC}:      ${#AVAILABLE_SKILLS[@]} discovered"
echo -e "  ${BOLD}Workspace${NC}:   ${WORKSPACE_MD}"
echo ""

# Count failures for exit code
FAILURE_COUNT=0
for entry in "${REPO_STATUS[@]}"; do
  [[ "$entry" == *"FAILED"* ]] && FAILURE_COUNT=$((FAILURE_COUNT + 1))
done
for entry in "${CONNECTIVITY_STATUS[@]}"; do
  [[ "$entry" == *"UNREACHABLE"* ]] && FAILURE_COUNT=$((FAILURE_COUNT + 1))
done
[[ "$GATEWAY_HEALTH" != "healthy" ]] && FAILURE_COUNT=$((FAILURE_COUNT + 1))
[[ "$CURRENT_MODEL" == "NOT CONFIGURED" || "$CURRENT_MODEL" == "CONFIG FILE MISSING" ]] && FAILURE_COUNT=$((FAILURE_COUNT + 1))

if [ "$FAILURE_COUNT" -eq 0 ]; then
  info "Bootstrap complete — all checks passed."
else
  warn "Bootstrap complete with ${FAILURE_COUNT} issue(s). Review WORKSPACE.md for details."
fi

exit 0
