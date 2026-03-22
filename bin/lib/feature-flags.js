// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0
//
// Feature Flag System
//
// Enables safe rollout of experimental features and gradual deprecation.
// Agents can use feature flags to ship changes behind toggles, reducing
// risk of new code affecting all users immediately.

/**
 * Feature flag definitions with metadata.
 * Each flag has:
 * - name: Unique identifier
 * - env: Environment variable name
 * - default: Default value if not set
 * - description: What this flag controls
 * - since: When this flag was introduced (version or date)
 * - status: 'experimental', 'stable', 'deprecated'
 */
const FLAGS = {
  EXPERIMENTAL: {
    name: "experimental",
    env: "NEMOCLAW_EXPERIMENTAL",
    default: false,
    description: "Enable all experimental features (local inference, new endpoints)",
    since: "0.1.0",
    status: "experimental",
  },
  LOCAL_INFERENCE: {
    name: "localInference",
    env: "NEMOCLAW_LOCAL_INFERENCE",
    default: false,
    description: "Enable local inference endpoints (NIM, vLLM, Ollama)",
    since: "0.1.0",
    status: "experimental",
  },
  AUTO_SELECT_PROVIDERS: {
    name: "autoSelectProviders",
    env: "NEMOCLAW_AUTO_SELECT",
    default: false,
    description: "Automatically select detected inference providers during onboarding",
    since: "0.1.0",
    status: "experimental",
  },
  TELEMETRY: {
    name: "telemetry",
    env: "NEMOCLAW_TELEMETRY",
    default: false,
    description: "Enable anonymous usage telemetry (not yet implemented)",
    since: "0.2.0",
    status: "experimental",
  },
  VERBOSE_LOGGING: {
    name: "verboseLogging",
    env: "NEMOCLAW_VERBOSE",
    default: false,
    description: "Enable verbose debug logging",
    since: "0.1.0",
    status: "stable",
  },
};

/**
 * Parse environment variable value to boolean.
 * Supports: "1", "true", "yes", "on" (case-insensitive) = true
 * Everything else = false
 */
function parseEnvBoolean(value) {
  if (!value) return false;
  const normalized = String(value).toLowerCase().trim();
  return ["1", "true", "yes", "on"].includes(normalized);
}

/**
 * Check if a feature flag is enabled.
 * @param {string} flagName - Name of the flag (e.g., 'experimental', 'localInference')
 * @returns {boolean} - True if flag is enabled
 */
function isEnabled(flagName) {
  const flag = Object.values(FLAGS).find((f) => f.name === flagName);
  if (!flag) {
    console.warn(`Unknown feature flag: ${flagName}`);
    return false;
  }

  // Check environment variable
  const envValue = process.env[flag.env];
  if (envValue !== undefined) {
    return parseEnvBoolean(envValue);
  }

  // Fall back to default
  return flag.default;
}

/**
 * Check if experimental features are enabled.
 * This is a convenience function for the most common flag.
 * @returns {boolean}
 */
function isExperimental() {
  return isEnabled("experimental");
}

/**
 * Check if local inference is enabled.
 * Local inference is enabled if either the specific flag or the global experimental flag is on.
 * @returns {boolean}
 */
function isLocalInferenceEnabled() {
  return isEnabled("localInference") || isExperimental();
}

/**
 * Check if auto-selection of providers is enabled.
 * Auto-selection is enabled if either the specific flag or the global experimental flag is on.
 * @returns {boolean}
 */
function isAutoSelectEnabled() {
  return isEnabled("autoSelectProviders") || isExperimental();
}

/**
 * Get all feature flags with their current values.
 * Useful for debugging and displaying feature flag status.
 * @returns {Object} - Map of flag names to their current status
 */
function getAllFlags() {
  const result = {};
  for (const [key, flag] of Object.entries(FLAGS)) {
    result[flag.name] = {
      enabled: isEnabled(flag.name),
      env: flag.env,
      description: flag.description,
      status: flag.status,
      since: flag.since,
    };
  }
  return result;
}

/**
 * Get feature flag status for display/debugging.
 * @returns {string} - Human-readable summary of active flags
 */
function getStatusSummary() {
  const flags = getAllFlags();
  const enabled = Object.entries(flags)
    .filter(([_, flag]) => flag.enabled)
    .map(([name, flag]) => `${name} (${flag.env})`);

  if (enabled.length === 0) {
    return "No feature flags enabled";
  }

  return `Active flags: ${enabled.join(", ")}`;
}

/**
 * Print feature flag status to console.
 * Useful for debugging and --version output.
 */
function printStatus() {
  console.log("=== Feature Flags ===");
  const flags = getAllFlags();
  for (const [name, flag] of Object.entries(flags)) {
    const status = flag.enabled ? "✓ ENABLED" : "  disabled";
    const badge = `[${flag.status}]`;
    console.log(`${status}  ${name.padEnd(20)} ${badge.padEnd(15)} ${flag.description}`);
    console.log(`         Set via: ${flag.env}=${flag.enabled ? "1" : "0"}`);
  }
}

module.exports = {
  FLAGS,
  isEnabled,
  isExperimental,
  isLocalInferenceEnabled,
  isAutoSelectEnabled,
  getAllFlags,
  getStatusSummary,
  printStatus,
};
