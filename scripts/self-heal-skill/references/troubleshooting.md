# Troubleshooting Decision Tree

## Agent Not Responding

```
Is the gateway alive?
├─ Run: curl -sf http://127.0.0.1:18789/ > /dev/null && echo OK
├─ YES → Is inference working?
│  ├─ Run: curl -sf https://inference.local/v1/models && echo OK
│  ├─ YES → Agent may be stuck on a long response. Check gateway logs:
│  │         tail -20 /tmp/gateway.log
│  └─ NO  → Inference route broken. Check NVIDIA API:
│            curl -sf https://integrate.api.nvidia.com/v1/models && echo OK
│            If NVIDIA is down: wait and retry. Nothing you can fix.
│            If NVIDIA is up: restart gateway (bash scripts/restart-gateway.sh)
└─ NO  → Gateway is dead. Restart it:
         bash scripts/restart-gateway.sh
         If restart fails: sandbox may be broken. Ask operator to run:
         bash scripts/sandbox-restart.sh rawcell
```

## Gateway Down

```
Can you reach the gateway at all?
├─ Run: curl -sf http://127.0.0.1:18789/ > /dev/null && echo OK
├─ YES → Gateway is actually fine. Problem is elsewhere.
└─ NO  → Is the process running?
   ├─ Run: lsof -i :18789 2>/dev/null || echo "no process"
   ├─ Process found → Gateway is starting or unhealthy. Wait 10s, retry.
   └─ No process   → Restart it:
      openclaw gateway stop 2>/dev/null
      nohup openclaw gateway run >> /tmp/gateway.log 2>&1 &
      sleep 3
      curl -sf http://127.0.0.1:18789/ && echo "OK" || echo "STILL DOWN"
```

## Inference Timeout

```
Is the NVIDIA API reachable?
├─ Run: curl -sf --max-time 10 https://integrate.api.nvidia.com/v1/models
├─ YES → Model may be overloaded. Options:
│  ├─ Retry with a shorter prompt
│  ├─ Check current model: python3 -c "import json; print(json.load(open('$HOME/.openclaw/openclaw.json'))['agents']['defaults']['model']['primary'])"
│  └─ If using 120b model: ask operator to switch to 49b (faster)
└─ NO  → Network issue or NVIDIA outage.
   ├─ Run: bash scripts/check-connectivity.sh
   ├─ If all fail → sandbox network is broken, ask operator to restart sandbox
   └─ If only NVIDIA fails → NVIDIA API outage, wait and retry
```

## Network Blocked

```
Run: bash scripts/check-connectivity.sh
├─ All pass → Network is fine. Problem is elsewhere.
├─ Only some fail → Missing network policy for that endpoint.
│  Ask operator to approve via: openshell term
│  Or ask operator to add a policy preset: nemoclaw rawcell policy-add
└─ All fail → Sandbox has no network.
   ├─ Check DNS: cat /etc/resolv.conf
   ├─ Check proxy: env | grep -i proxy
   └─ Likely fix: operator needs to restart the sandbox
```

## Disk Full

```
Check disk space:
├─ Run: df -h /sandbox /tmp
├─ /sandbox over 90% → Clean up:
│  rm -rf /tmp/*.log /sandbox/.openclaw/workspace/*/node_modules
│  git -C /sandbox/.openclaw/workspace/NemoClaw gc --aggressive
└─ /tmp over 90% → Truncate logs:
   : > /tmp/gateway.log
   : > /tmp/watchdog.log
   : > /tmp/self-heal.log
```

## Model Errors / Wrong Model

```
Check current model config:
├─ Run: bash scripts/verify-config.sh
├─ Model is correct → Problem is elsewhere
└─ Model is wrong or missing → Fix it:
   python3 -c "
   import json, os
   path = os.path.expanduser('~/.openclaw/openclaw.json')
   cfg = json.load(open(path))
   cfg['agents']['defaults']['model']['primary'] = 'nvidia/llama-3.3-nemotron-super-49b-v1.5'
   json.dump(cfg, open(path, 'w'), indent=2)
   print('Model updated')
   "
   Then restart gateway: bash scripts/restart-gateway.sh
```

## Quick Reference Commands

| Problem | Diagnostic Command |
|---|---|
| Gateway health | `curl -sf http://127.0.0.1:18789/ && echo OK` |
| Inference health | `curl -sf https://inference.local/v1/models` |
| Network check | `bash scripts/check-connectivity.sh` |
| Current model | `python3 -c "import json; print(json.load(open('$HOME/.openclaw/openclaw.json'))['agents']['defaults']['model']['primary'])"` |
| Disk space | `df -h /sandbox /tmp` |
| Gateway logs | `tail -20 /tmp/gateway.log` |
| Restart gateway | `bash scripts/restart-gateway.sh` |
| Full health check | `bash scripts/check-health.sh` |
