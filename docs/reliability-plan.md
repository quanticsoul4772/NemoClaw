# NemoClaw Reliability Plan

## Goal
Make the OpenClaw agent available 24/7 with zero manual intervention.

## Status Key
- [ ] Not started
- [x] Done

## Tier 1: Critical

### 1. Windows Task Scheduler watchdog
- [x] Create `scripts/watchdog.ps1` that checks if supervisor is running in WSL
- [x] Create `scripts/install-watchdog-task.ps1` installer
- [ ] Run installer from elevated PowerShell: `powershell -ExecutionPolicy Bypass -File scripts\install-watchdog-task.ps1`
- [ ] Test: sleep laptop, wake, verify agent comes back within 60s

### 2. Proactive daily restart at 4am UTC
- [x] Add time check in supervisor main loop
- [x] At 4am: full_sandbox_restart (backup, destroy, recreate, restore, bootstrap)

### 3. Replace openshell forward with socat
- [x] Install socat in WSL
- [x] Replace port forward logic in supervisor with socat child process
- [x] Get sandbox pod IP dynamically via kubectl
- [x] Fallback to openshell forward if pod IP unavailable

### 4. Passwordless sudo for docker start
- [x] Add sudoers entry via /etc/sudoers.d/nemoclaw-docker

### 5. Telegram bot commands
- [x] /status — sandbox health, model, uptime, message count, last response
- [x] /health — Docker, gateway cluster, sandbox, supervisor, agent gateway
- [x] /restart — trigger full sandbox restart from phone
- [x] /logs — last 15 lines of supervisor log
- [x] /help — list all commands

## Tier 2: High Impact (next)

### 6. Continuous workspace sync
- [ ] Background rsync loop every 60s from sandbox to host
- [ ] Only sync changed files (rsync delta)
- [ ] Store mirror at ~/.nemoclaw/workspace-mirror/

### 7. Model fallback chain with circuit breaker
- [ ] Primary: nemotron-super-49b, fallback: nemotron-nano-30b, last resort: nano-8b
- [ ] Circuit breaker: 3 failures -> open for 5 min -> half-open retry
- [ ] Track state in /tmp/circuit-breaker.json

## Tier 3: Polish (when stable)

### 8. HTTP health endpoint
### 9. Session sync every 2 min
### 10. Async Telegram bridge
### 11. Progress updates after 30s
