#!/usr/bin/env bash
# Safe sandbox restart: backup -> destroy -> recreate -> restore -> start
# Usage: ./sandbox-restart.sh [sandbox-name]

set -euo pipefail

SANDBOX="${1:-rawcell}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
POLICY_FILE="/tmp/nemoclaw-policies.yaml"

echo "=== NemoClaw Safe Sandbox Restart ==="
echo "Sandbox: $SANDBOX"
echo ""

# Step 1: Backup
echo "[1/5] Backing up workspace..."
bash "$SCRIPT_DIR/sandbox-backup.sh" "$SANDBOX"
echo ""

# Step 2: Destroy
echo "[2/5] Destroying sandbox..."
openshell sandbox delete "$SANDBOX" 2>&1 || true
echo ""

# Step 3: Write policy file
echo "[3/5] Writing policy file..."
cat > "$POLICY_FILE" << 'EOF'
version: 1
filesystem_policy:
  include_workdir: true
  read_only:
    - /usr
    - /lib
    - /proc
    - /dev/urandom
    - /app
    - /etc
    - /var/log
  read_write:
    - /sandbox
    - /tmp
    - /dev/null
landlock:
  compatibility: best_effort
process:
  run_as_user: sandbox
  run_as_group: sandbox
network_policies:
  npm_yarn:
    name: npm_yarn
    endpoints:
      - host: registry.npmjs.org
        port: 443
        access: full
      - host: registry.yarnpkg.com
        port: 443
        access: full
  pypi:
    name: pypi
    endpoints:
      - host: pypi.org
        port: 443
        access: full
      - host: files.pythonhosted.org
        port: 443
        access: full
  github:
    name: github
    endpoints:
      - host: github.com
        port: 443
        access: full
      - host: api.github.com
        port: 443
        access: full
      - host: raw.githubusercontent.com
        port: 443
        access: full
EOF

# Step 4: Recreate
echo "[4/5] Creating sandbox with gateway..."
openshell sandbox create \
  --name "$SANDBOX" \
  --from openshell/sandbox-from:1773722029 \
  --provider nvidia-nim \
  --policy "$POLICY_FILE" \
  --no-tty \
  -- nemoclaw-start

echo ""

# Step 5: Restore
echo "[5/5] Restoring workspace..."
sleep 3  # Wait for sandbox to stabilize
bash "$SCRIPT_DIR/sandbox-restore.sh" "$SANDBOX"

echo ""
echo "=== Restart complete ==="
echo "Start port forward: openshell forward start 18789 $SANDBOX"
echo "Start Telegram:     TELEGRAM_BOT_TOKEN=... node scripts/tg-bridge-reliable.js"
