# Feature Flags

NemoClaw uses feature flags to enable safe rollout of experimental features and gradual deprecation. This allows both human developers and autonomous agents to ship changes behind toggles, reducing the risk of new code affecting all users immediately.

## Available Feature Flags

### Global Flags

#### `NEMOCLAW_EXPERIMENTAL`

**Status**: Experimental  
**Default**: `false` (disabled)  
**Since**: 0.1.0

Enables all experimental features. This is a master switch that activates:
- Local inference endpoints (NIM, vLLM, Ollama)
- Automatic provider detection and selection
- Experimental CLI options and commands

**Usage:**

```bash
# Enable experimental features
export NEMOCLAW_EXPERIMENTAL=1
nemoclaw onboard

# Or set for a single command
NEMOCLAW_EXPERIMENTAL=1 nemoclaw onboard
```

**When to use:**
- Testing new features before they're production-ready
- Development and debugging
- Advanced users who understand the risks

**⚠️ Warning:** Experimental features may be unstable, have incomplete error handling, or change behavior without notice.

---

### Granular Flags

These flags provide more fine-grained control over specific features. They can be used independently or combined with `NEMOCLAW_EXPERIMENTAL`.

#### `NEMOCLAW_LOCAL_INFERENCE`

**Status**: Experimental  
**Default**: `false`  
**Since**: 0.1.0

Enables local inference endpoints without enabling all experimental features.

**Allows:**
- Local NIM containers (requires NVIDIA GPU)
- Local vLLM instances (localhost:8000)
- Local Ollama instances (localhost:11434)

**Usage:**

```bash
export NEMOCLAW_LOCAL_INFERENCE=1
nemoclaw onboard  # Will show local inference options
```

**Use case:** Testing local models while keeping other experimental features disabled.

#### `NEMOCLAW_AUTO_SELECT`

**Status**: Experimental  
**Default**: `false`  
**Since**: 0.1.0

Automatically selects detected inference providers during onboarding instead of prompting the user.

**Behavior:**
- If vLLM is running on localhost:8000 → auto-select vLLM
- If Ollama is running on localhost:11434 → auto-select Ollama
- Otherwise → prompt user as normal

**Usage:**

```bash
export NEMOCLAW_AUTO_SELECT=1
nemoclaw onboard  # May auto-select if providers detected
```

**Use case:** Automated onboarding scripts, CI/CD pipelines, agent-driven setup.

**⚠️ Caution:** Silent auto-selection can lead to unexpected configurations. Only use in controlled environments.

#### `NEMOCLAW_VERBOSE`

**Status**: Stable  
**Default**: `false`  
**Since**: 0.1.0

Enables verbose debug logging throughout the CLI.

**Usage:**

```bash
export NEMOCLAW_VERBOSE=1
nemoclaw onboard  # Shows detailed debug output
```

**Use case:** Debugging issues, understanding internal behavior, agent troubleshooting.

#### `NEMOCLAW_TELEMETRY`

**Status**: Experimental (not yet implemented)  
**Default**: `false`  
**Since**: 0.2.0

Placeholder for future anonymous usage telemetry. Currently has no effect.

**Future behavior:** Will send anonymous usage statistics to help improve NemoClaw.

---

## Checking Feature Flag Status

### From Command Line

```bash
# Check which flags are active
node -e "require('./bin/lib/feature-flags').printStatus()"
```

**Output:**

```
=== Feature Flags ===
✓ ENABLED  experimental          [experimental]  Enable all experimental features
  disabled localInference        [experimental]  Enable local inference endpoints
  disabled autoSelectProviders   [experimental]  Automatically select detected providers
  disabled telemetry             [experimental]  Enable anonymous usage telemetry
  disabled verboseLogging        [stable]        Enable verbose debug logging
         Set via: NEMOCLAW_VERBOSE=0
```

### Programmatic Access

```javascript
const featureFlags = require("./bin/lib/feature-flags");

// Check specific flag
if (featureFlags.isEnabled("experimental")) {
  console.log("Experimental mode active");
}

// Check common flags
if (featureFlags.isExperimental()) {
  // Show experimental features
}

if (featureFlags.isLocalInferenceEnabled()) {
  // Enable local inference providers
}

if (featureFlags.isAutoSelectEnabled()) {
  // Auto-select providers if available
}

// Get all flags with metadata
const allFlags = featureFlags.getAllFlags();
console.log(allFlags);
// {
//   experimental: { enabled: true, env: 'NEMOCLAW_EXPERIMENTAL', ... },
//   localInference: { enabled: false, env: 'NEMOCLAW_LOCAL_INFERENCE', ... },
//   ...
// }
```

---

## For Autonomous Agents

When developing new features for NemoClaw, use feature flags to:

1. **Ship incrementally**: Land code behind a flag, test in production, then enable for all users
2. **Reduce risk**: New agent-authored code doesn't immediately affect all users
3. **Enable rollback**: Disable a flag instantly if issues arise
4. **A/B testing**: Compare behavior with flag on vs. off
5. **Gradual rollout**: Enable for a subset of users first

### Adding a New Feature Flag

**1. Define the flag in `bin/lib/feature-flags.js`:**

```javascript
const FLAGS = {
  // ... existing flags ...
  MY_NEW_FEATURE: {
    name: "myNewFeature",
    env: "NEMOCLAW_MY_FEATURE",
    default: false,
    description: "Enable my new experimental feature",
    since: "0.3.0",
    status: "experimental",
  },
};
```

**2. Add a convenience function (optional):**

```javascript
function isMyFeatureEnabled() {
  return isEnabled("myNewFeature");
}

module.exports = {
  // ... existing exports ...
  isMyFeatureEnabled,
};
```

**3. Use the flag in your code:**

```javascript
const featureFlags = require("./lib/feature-flags");

if (featureFlags.isEnabled("myNewFeature")) {
  // New behavior
} else {
  // Old behavior
}
```

**4. Document the flag in this file (`docs/feature-flags.md`)**

**5. Update `.env.example` with the new flag:**

```bash
# Enable my new feature (experimental)
# NEMOCLAW_MY_FEATURE=1
```

### Feature Flag Lifecycle

1. **Experimental** → Flag introduced, disabled by default, documentation marks as experimental
2. **Beta** → Flag enabled by default for testing, still documented as beta
3. **Stable** → Feature is stable, flag remains for backwards compatibility or emergency rollback
4. **Deprecated** → Flag scheduled for removal, documentation shows deprecation notice
5. **Removed** → Flag and old code paths removed from codebase

### Best Practices

- **Default to false**: New features should be disabled by default
- **Document thoroughly**: Explain what the flag controls and when to use it
- **Test both paths**: Ensure code works with flag both on and off
- **Monitor usage**: Track how many users enable experimental flags
- **Clean up**: Remove flags once features are fully rolled out
- **Use granular flags**: Prefer specific flags over `EXPERIMENTAL` for production features
- **Combine flags logically**: `localInference || experimental` pattern for experimental sub-features

---

## Troubleshooting

### Flag not taking effect

1. **Check value format**: Use `1`, `true`, `yes`, or `on` (case-insensitive)
2. **Check environment**: Ensure the variable is exported (`export NEMOCLAW_EXPERIMENTAL=1`)
3. **Restart shell**: Some shells require restarting to pick up new environment variables
4. **Verify precedence**: Check if another flag is overriding behavior

### Experimental features still hidden

Even with `NEMOCLAW_EXPERIMENTAL=1`, some features may have additional requirements:
- **Local inference**: Requires providers to be installed/running
- **Auto-select**: Requires both `EXPERIMENTAL` or `AUTO_SELECT` flag AND detected providers
- **GPU features**: Requires NVIDIA GPU hardware

### Debugging flag state

```bash
# Print all flags and their current values
node -e "require('./bin/lib/feature-flags').printStatus()"

# Check specific flag
node -e "console.log(require('./bin/lib/feature-flags').isEnabled('experimental'))"

# Get summary
node -e "console.log(require('./bin/lib/feature-flags').getStatusSummary())"
```

---

## References

- [Environment Variables](./env-variables.md) - Full list of environment variables
- [AGENTS.md](../AGENTS.md) - Development guide with setup instructions
- [.env.example](../.env.example) - Template with all supported environment variables

---

**Last Updated**: 2026-03-22  
**For Questions**: See AGENTS.md or open a GitHub issue
