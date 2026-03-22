# Autonomous Agent Configuration

This guide explains how to configure OpenClaw agents to run autonomously without stopping to ask "what to do next".

## Problem: Interactive Mode

By default, OpenClaw agents run in **interactive mode**, which:
- Waits for user input after each response
- Asks "what should I do next?"
- Requires confirmation before executing commands
- Stops when there's no more user input

This is great for human interaction, but problematic when you want to:
- **Observe the agent working** without interrupting
- **Run background tasks** automatically
- **Process queues** of work items
- **Test agent behavior** without manual intervention

## Solution: Autonomous Operation Modes

There are **3 ways** to run OpenClaw agents autonomously:

---

## Method 1: Non-Interactive CLI Mode (Recommended for Testing)

Use the `openclaw agent` CLI command with a specific message:

### Basic Usage

```bash
# Run a single task
openclaw agent --agent main --local -m "hello" --session-id test

# Run with specific session ID (maintains conversation context)
openclaw agent --agent main --local -m "analyze the logs" --session-id debug-001

# Chain multiple commands in a script
#!/bin/bash
TASKS=(
  "check system health"
  "analyze recent errors"
  "suggest optimizations"
)

for task in "${TASKS[@]}"; do
  echo "Task: $task"
  openclaw agent --agent main --local -m "$task" --session-id batch-$(date +%s)
  echo "---"
done
```

### Parameters

- `--agent main` - Agent name (default is "main")
- `--local` - Use local agent workspace
- `-m "message"` - Message/task to execute
- `--session-id <id>` - Session identifier (maintains context across calls)

### When to Use

✅ **Good for:**
- Running specific tasks programmatically
- Batch processing
- Automated testing
- Scheduled jobs (cron)

❌ **Not good for:**
- Continuous operation
- Multi-turn conversations requiring context
- Real-time interactive debugging

---

## Method 2: TUI Mode with Auto-Messages

Use the OpenClaw TUI (Terminal User Interface) with automatic message sending:

### Usage

```bash
# Start TUI
openclaw tui

# Or connect from outside sandbox
nemoclaw my-assistant connect -- openclaw tui
```

### Configuration

Edit `~/.openclaw/openclaw.json` to configure TUI behavior:

```json
{
  "tui": {
    "autoSubmit": true,
    "autoSubmitDelay": 2000,
    "defaultMessage": "continue with the next task",
    "confirmBeforeAction": false
  }
}
```

**Options:**
- `autoSubmit` - Automatically send messages without Enter key
- `autoSubmitDelay` - Delay in milliseconds before auto-submit
- `defaultMessage` - Message to send when user provides no input
- `confirmBeforeAction` - Skip confirmation prompts

### When to Use

✅ **Good for:**
- Watching agent work in real-time
- Development and debugging
- Demonstrations

❌ **Not good for:**
- Background tasks
- Headless servers
- Production automation

---

## Method 3: Gateway Control UI (Best for Observation)

Use the built-in web dashboard to monitor and control the agent:

### Access Dashboard

```bash
# Get dashboard URL
cat ~/.openclaw/openclaw.json | jq -r '.gateway.auth.token' | \
  xargs -I {} echo "http://127.0.0.1:18789/#token={}"

# Or check logs
cat /tmp/gateway.log | grep "Local UI"
```

### Configuration for Autonomous Operation

Edit `~/.openclaw/openclaw.json`:

```json
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "nvidia/nemotron-3-super-120b-a12b"
      },
      "behavior": {
        "confirmBeforeAction": false,
        "autonomousMode": true,
        "maxIterationsWithoutHuman": 50,
        "taskCompletionBehavior": "continue"
      }
    }
  },
  "commands": {
    "native": "auto",
    "nativeSkills": "auto",
    "restart": false,
    "confirmExecution": false
  }
}
```

**Key Settings:**
- `confirmBeforeAction: false` - Don't ask before executing commands
- `autonomousMode: true` - Enable autonomous agent behavior
- `maxIterationsWithoutHuman: 50` - How many steps before pausing
- `taskCompletionBehavior: "continue"` - What to do after completing a task
- `restart: false` - Don't restart after each command
- `confirmExecution: false` - Execute commands without confirmation

### When to Use

✅ **Good for:**
- Long-running autonomous tasks
- Background processing
- Production agents
- Continuous operation

---

## Method 4: Channel-Based Automation

Use Telegram, Slack, or Discord channels for asynchronous agent interaction:

### Enable Telegram Bot

```bash
# Set bot token
export TELEGRAM_BOT_TOKEN="your-bot-token"

# Edit config
nano ~/.openclaw/openclaw.json
```

```json
{
  "channels": {
    "telegram": {
      "enabled": true,
      "dmPolicy": "open",
      "botToken": "${TELEGRAM_BOT_TOKEN}",
      "allowFrom": ["*"],
      "groupPolicy": "allowlist",
      "streaming": "partial",
      "autonomousMode": true
    }
  }
}
```

### Usage

1. Message the Telegram bot
2. Agent processes message asynchronously
3. Responds when done
4. No interactive blocking!

### When to Use

✅ **Good for:**
- Remote access
- Team collaboration
- Asynchronous workflows
- Mobile access

---

## Recommended Configuration for Your Use Case

Based on your requirement: **"I just want to observe what is going on without interrupting"**

### Step 1: Configure Agent for Autonomous Operation

Create or edit `~/.openclaw/openclaw.json`:

```json
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "nvidia/nemotron-3-super-120b-a12b"
      },
      "behavior": {
        "confirmBeforeAction": false,
        "autonomousMode": true,
        "maxIterationsWithoutHuman": 100,
        "taskCompletionBehavior": "continue"
      },
      "compaction": {
        "mode": "safeguard"
      }
    }
  },
  "commands": {
    "native": "auto",
    "nativeSkills": "auto",
    "restart": false,
    "confirmExecution": false,
    "ownerDisplay": "raw"
  },
  "gateway": {
    "mode": "local",
    "controlUi": {
      "allowedOrigins": ["http://127.0.0.1:18789"],
      "allowInsecureAuth": true,
      "dangerouslyDisableDeviceAuth": true
    },
    "auth": {
      "mode": "token"
    },
    "trustedProxies": ["127.0.0.1", "::1"]
  }
}
```

### Step 2: Start Agent in Autonomous Mode

```bash
# In sandbox, start agent with a continuous task
openclaw agent --agent main --local -m "monitor system health and report issues" --session-id autonomous-01
```

### Step 3: Observe in Real-Time

**Terminal 1: Dashboard (Browser)**
```bash
# Open http://127.0.0.1:18789
# Watch agent activity in real-time
```

**Terminal 2: Live Logs**
```bash
# Stream structured logs
nemoclaw my-assistant logs --follow | jq -C '.'
```

**Terminal 3: Gateway Activity**
```bash
# Watch gateway events
tail -f /tmp/gateway.log
```

### Step 4: Give Agent Continuous Tasks

Instead of one-off messages, give the agent ongoing responsibilities:

```bash
# Example: Continuous monitoring
openclaw agent --agent main --local -m "continuously monitor the system: 1) check logs every 5 minutes, 2) report any errors, 3) suggest fixes when issues are found. Never stop monitoring." --session-id monitor-01

# Example: Process queue
openclaw agent --agent main --local -m "process all pending tasks in the queue. When the queue is empty, check again in 60 seconds. Continue forever." --session-id worker-01

# Example: Research task
openclaw agent --agent main --local -m "research the best practices for OpenClaw plugin development. Compile a comprehensive guide. Take your time and be thorough." --session-id research-01
```

---

## Troubleshooting

### Agent Stops After Each Response

**Problem:** Agent completes task and waits for next instruction

**Solution:**
1. Set `taskCompletionBehavior: "continue"` in config
2. Give explicit instructions to "continue" in your prompt
3. Use `--session-id` to maintain context

### Agent Asks for Confirmation Before Commands

**Problem:** Agent shows "Execute this command? (y/n)"

**Solution:**
1. Set `confirmBeforeAction: false` in agent config
2. Set `confirmExecution: false` in commands config
3. Restart the agent for config to take effect

### Agent Stops After N Iterations

**Problem:** Agent pauses after X steps

**Solution:**
1. Increase `maxIterationsWithoutHuman` in config
2. Set to high number (100+) for long-running tasks
3. Or set to `-1` for unlimited (use with caution!)

### Can't See What Agent Is Doing

**Problem:** No visibility into agent activity

**Solution:**
1. Use dashboard: http://127.0.0.1:18789
2. Stream logs: `nemoclaw logs --follow`
3. Enable verbose logging: `export NEMOCLAW_VERBOSE=1`
4. Check gateway logs: `tail -f /tmp/gateway.log`

---

## Example: Complete Autonomous Setup

Here's a complete script to set up autonomous agent observation:

```bash
#!/bin/bash
# setup-autonomous-agent.sh

set -e

echo "Setting up autonomous agent configuration..."

# 1. Configure OpenClaw for autonomous operation
cat > ~/.openclaw/openclaw.json <<EOF
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "nvidia/nemotron-3-super-120b-a12b"
      },
      "behavior": {
        "confirmBeforeAction": false,
        "autonomousMode": true,
        "maxIterationsWithoutHuman": 100
      }
    }
  },
  "commands": {
    "native": "auto",
    "nativeSkills": "auto",
    "restart": false,
    "confirmExecution": false
  },
  "gateway": {
    "mode": "local",
    "controlUi": {
      "allowedOrigins": ["http://127.0.0.1:18789"],
      "allowInsecureAuth": true,
      "dangerouslyDisableDeviceAuth": true
    }
  }
}
EOF

echo "✓ Configuration updated"

# 2. Get dashboard token
TOKEN=$(cat ~/.openclaw/openclaw.json | jq -r '.gateway.auth.token')
echo "Dashboard: http://127.0.0.1:18789/#token=$TOKEN"

# 3. Start monitoring in background
echo "Starting log monitoring..."
nemoclaw my-assistant logs --follow > /tmp/agent-activity.log 2>&1 &
LOG_PID=$!
echo "✓ Log monitoring started (PID: $LOG_PID)"

# 4. Start agent with autonomous task
echo "Starting autonomous agent..."
nemoclaw my-assistant connect -- \
  openclaw agent --agent main --local \
  -m "You are now in autonomous mode. Your task: continuously monitor system health, check logs for errors, and suggest improvements. Check logs every 5 minutes. Report findings. Never stop." \
  --session-id autonomous-$(date +%s) &

AGENT_PID=$!
echo "✓ Agent started (PID: $AGENT_PID)"

echo ""
echo "=== Autonomous Agent Running ==="
echo "Dashboard: http://127.0.0.1:18789/#token=$TOKEN"
echo "Live logs: tail -f /tmp/agent-activity.log"
echo "Gateway logs: tail -f /tmp/gateway.log"
echo ""
echo "To stop:"
echo "  kill $AGENT_PID $LOG_PID"
```

Make it executable and run:

```bash
chmod +x setup-autonomous-agent.sh
./setup-autonomous-agent.sh
```

---

## Best Practices for Autonomous Agents

1. **Always specify session IDs** - Maintains context across interactions
2. **Set clear, continuous tasks** - Agent needs ongoing goals, not one-off tasks
3. **Use structured logging** - Makes observation easier
4. **Monitor via dashboard + logs** - Multiple observation points
5. **Set iteration limits** - Prevent runaway agents
6. **Test with short tasks first** - Verify autonomy before long-running tasks
7. **Use feature flags** - Enable/disable autonomous features safely

---

## Security Considerations

**Important:** Autonomous agents can execute commands without human approval. Ensure:

1. **Sandbox isolation** - Run in OpenShell sandbox with policies
2. **Network policies** - Limit egress to approved endpoints
3. **Resource limits** - Set max iterations, timeouts
4. **Monitoring** - Always observe autonomous agents
5. **Kill switch** - Have a way to stop runaway agents

**Example policy:**

```yaml
# openclaw-sandbox.yaml
egress:
  - endpoint: "https://build.nvidia.com"
    allow: ["POST"]
  - endpoint: "https://api.github.com"
    allow: ["GET"]

commands:
  allowlist:
    - curl
    - git
    - npm
  blocklist:
    - rm
    - dd
    - mkfs
```

---

## Summary

To observe your agent without interruption:

1. **Configure** `~/.openclaw/openclaw.json` with autonomous settings
2. **Open dashboard** at http://127.0.0.1:18789
3. **Stream logs** with `nemoclaw logs --follow`
4. **Start agent** with continuous task using `openclaw agent --agent main --local -m "..." --session-id ...`
5. **Observe** via dashboard + logs without interrupting!

The agent will now work autonomously while you observe all activity in real-time.
