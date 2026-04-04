---
name: self-heal
description: >
  Diagnose and repair the OpenClaw sandbox environment. Use when: the agent
  stops responding, the gateway returns errors or is unreachable, inference
  calls time out, network connectivity is lost, the sandbox runs out of disk
  space, or openclaw.json configuration looks wrong. This skill runs entirely
  inside the sandbox and requires no host-side access.
---

# Self-Heal

Detect, diagnose, and fix problems in the running NemoClaw sandbox without
human intervention. Follow the decision tree top-to-bottom; stop as soon as
the environment is healthy.

## Quick health check (run first, always)

```bash
bash scripts/self-heal-skill/scripts/check-health.sh
```

If every check passes, stop here. Otherwise continue to the matching section.

## 1. Gateway not reachable

**Diagnose:**

```bash
curl -sf -o /dev/null -w '%{http_code}' http://localhost:18789/ || echo "UNREACHABLE"
pgrep -af "openclaw gateway" || echo "NO_GATEWAY_PROCESS"
```

**Fix:**

```bash
bash scripts/self-heal-skill/scripts/restart-gateway.sh
```

If the gateway still fails after restart, check the log:

```bash
tail -80 /tmp/gateway.log
```

Common causes in the log:
- `EADDRINUSE` - another process holds port 18789. Kill it: `fuser -k 18789/tcp`
- `EACCES` - permission issue. Check file ownership under `~/.openclaw/`.
- `Error: Cannot find module` - corrupted install. Run `openclaw doctor --fix`.

## 2. Inference endpoint failing

**Diagnose:**

```bash
curl -sf -m 10 https://inference.local/v1/models \
  -H "Authorization: Bearer ${NVIDIA_API_KEY:-missing}" \
  && echo "OK" || echo "INFERENCE_FAIL"
```

**Fix - check config first:**

```bash
bash scripts/self-heal-skill/scripts/verify-config.sh
```

If the model name or provider is wrong in `~/.openclaw/openclaw.json`, rewrite it:

```bash
python3 -c "
import json, os
path = os.path.expanduser('~/.openclaw/openclaw.json')
cfg = json.load(open(path))
cfg.setdefault('models', {})['default'] = {
    'name': 'nvidia/nemotron-3-super-120b-a12b',
    'provider': 'nvidia-nim'
}
json.dump(cfg, open(path, 'w'), indent=2)
os.chmod(path, 0o600)
"
```

Then restart the gateway (section 1).

If config is correct but inference still fails, test external connectivity:

```bash
bash scripts/self-heal-skill/scripts/check-connectivity.sh
```

If `integrate.api.nvidia.com` is unreachable, the sandbox network policy may be
blocking egress. Escalate to the host operator.

## 3. Network connectivity issues

**Diagnose:**

```bash
bash scripts/self-heal-skill/scripts/check-connectivity.sh
```

**Fix by category:**

| Symptom | Cause | Action |
|---------|-------|--------|
| All hosts unreachable | DNS failure or network namespace broken | `cat /etc/resolv.conf` - verify nameserver. Try `ping -c1 8.8.8.8`. If ping works but DNS fails, add `nameserver 8.8.8.8` to `/etc/resolv.conf`. |
| Only some hosts blocked | Sandbox network policy restricts egress | Check policy with `cat /tmp/nemoclaw-policies.yaml` or `openshell sandbox inspect`. Escalate to host. |
| Timeouts but DNS resolves | Firewall or rate-limiting | Retry after 30s. If persistent, escalate. |

## 4. Disk space exhaustion

**Diagnose:**

```bash
df -h / /tmp /sandbox 2>/dev/null | awk 'NR>1{if(int($5)>90) print "CRITICAL: "$6" at "$5}'
```

**Fix (safe cleanup, largest first):**

```bash
# Clear old logs
find /tmp -name '*.log' -mtime +1 -delete 2>/dev/null
# Clear npm/pip caches
rm -rf /tmp/npm-* /tmp/pip-* ~/.cache/pip 2>/dev/null
# Clear old core dumps
find /tmp -name 'core.*' -delete 2>/dev/null
# Prune node_modules caches if they exist outside the project
find /tmp -maxdepth 2 -name 'node_modules' -type d -exec rm -rf {} + 2>/dev/null
```

Re-check: `df -h /`. Target: below 85% usage.

## 5. Memory pressure

**Diagnose:**

```bash
free -m 2>/dev/null || cat /proc/meminfo | head -5
```

If available memory is below 200 MB:

**Fix:**

```bash
# Kill known-heavy background processes that are not essential
pkill -f 'npm install' 2>/dev/null || true
pkill -f 'pip install' 2>/dev/null || true
# Drop filesystem caches (requires root)
sync && echo 3 > /proc/sys/vm/drop_caches 2>/dev/null || true
```

If memory is still critical, restart the gateway (it may have a leak):

```bash
bash scripts/self-heal-skill/scripts/restart-gateway.sh
```

## 6. Agent not responding (no output, stuck)

This usually means the gateway process is alive but the agent loop is hung.

**Diagnose:**

```bash
# Gateway alive?
curl -sf -m 5 http://localhost:18789/health && echo "GATEWAY_OK" || echo "GATEWAY_DOWN"
# Check if agent sessions exist
openclaw sessions list 2>/dev/null || echo "SESSIONS_CMD_FAILED"
# Check gateway log for errors
tail -30 /tmp/gateway.log | grep -i -E 'error|panic|fatal|timeout'
```

**Fix:**

1. If gateway is down, restart it (section 1).
2. If gateway is up but sessions list fails, the gateway state may be corrupted:
   ```bash
   bash scripts/self-heal-skill/scripts/restart-gateway.sh
   ```
3. If gateway is up and sessions work but the agent is hung, kill the specific
   session and let the orchestrator respawn:
   ```bash
   openclaw sessions list --json | python3 -c "
   import json,sys
   for s in json.load(sys.stdin).get('sessions',[]):
       if s.get('status') == 'stuck':
           print(s['id'])
   " | xargs -I{} openclaw sessions kill {}
   ```

## 7. Model configuration errors

**Diagnose:**

```bash
bash scripts/self-heal-skill/scripts/verify-config.sh
```

Common errors and fixes:

| Error | Fix |
|-------|-----|
| `model name missing` | Set `models.default.name` in openclaw.json |
| `provider missing` | Set `models.default.provider` to `nvidia-nim` |
| `token/API key missing` | Verify `NVIDIA_API_KEY` env var is set |
| `config file missing` | Run `openclaw doctor --fix` to regenerate defaults |
| `config file not valid JSON` | Back up and regenerate: `cp ~/.openclaw/openclaw.json{,.bak} && openclaw doctor --fix` |

## 8. Sandbox crash / unresponsive

If the sandbox itself crashed (you are reading this from the host side):

```bash
# From the host:
openshell sandbox list
# If sandbox status is not "Ready":
openshell sandbox delete <name> 2>/dev/null || true
# Recreate using the project restart script:
bash scripts/sandbox-restart.sh <name>
```

## Troubleshooting decision tree

Follow this tree from top to bottom. At each node, run the diagnostic command
and follow the matching branch.

```
START
  |
  v
[1] curl -sf http://localhost:18789/ >/dev/null
  |
  +-- SUCCESS --> [2] Test inference
  |                 |
  |                 v
  |               curl -sf -m 10 https://inference.local/v1/models
  |                 |
  |                 +-- SUCCESS --> [3] Check disk
  |                 |                 |
  |                 |                 v
  |                 |               df -h / | awk 'NR==2{print $5}'
  |                 |                 |
  |                 |                 +-- <90% --> [4] Check memory
  |                 |                 |              |
  |                 |                 |              v
  |                 |                 |            free -m (avail > 200MB?)
  |                 |                 |              |
  |                 |                 |              +-- YES --> HEALTHY
  |                 |                 |              +-- NO  --> Section 5
  |                 |                 |
  |                 |                 +-- >=90% --> Section 4
  |                 |
  |                 +-- FAIL --> [2a] Check connectivity
  |                               |
  |                               v
  |                             bash check-connectivity.sh
  |                               |
  |                               +-- ALL OK --> verify-config.sh
  |                               |               |
  |                               |               +-- CONFIG OK --> Section 6
  |                               |               +-- CONFIG BAD --> Section 7
  |                               |
  |                               +-- SOME FAIL --> Section 3
  |
  +-- FAIL --> [1a] Is gateway process running?
                |
                v
              pgrep -af "openclaw gateway"
                |
                +-- FOUND --> Check logs (Section 1)
                +-- NOT FOUND --> restart-gateway.sh (Section 1)
```

## Full automated heal sequence

When the situation is unclear, run the full sequence:

```bash
set -e
echo "=== Self-Heal: Full Diagnostic ==="

echo "[1/5] Health check..."
bash scripts/self-heal-skill/scripts/check-health.sh && { echo "All healthy."; exit 0; }

echo "[2/5] Checking connectivity..."
bash scripts/self-heal-skill/scripts/check-connectivity.sh || true

echo "[3/5] Verifying config..."
bash scripts/self-heal-skill/scripts/verify-config.sh || true

echo "[4/5] Restarting gateway..."
bash scripts/self-heal-skill/scripts/restart-gateway.sh

echo "[5/5] Re-checking health..."
bash scripts/self-heal-skill/scripts/check-health.sh && echo "Healed." || echo "Still unhealthy. Escalate to host operator."
```

## Rules

- Always run `check-health.sh` first before attempting fixes.
- Never delete user data under `/sandbox/` or `~/.openclaw/agents/`.
- Prefer restarting the gateway over rebooting the sandbox.
- Log all actions to `/tmp/self-heal.log` for post-mortem review.
- If three restart attempts fail, stop and escalate to the host operator.
- Do not modify sandbox network policies from inside the sandbox.
- Back up config files before overwriting them.
