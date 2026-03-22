// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0
//
// Structured Logging Module
//
// Provides structured JSON logging for better observability and debugging.
// Uses pino for high-performance structured logging.

const pino = require("pino");

// Import trace context for distributed tracing
let getTraceFields;
try {
  ({ getTraceFields } = require("./trace-context"));
} catch {
  // trace-context not available, use no-op
  getTraceFields = () => ({});
}

// Determine log level from environment
const LOG_LEVEL = process.env.NEMOCLAW_LOG_LEVEL || process.env.LOG_LEVEL || "info";

// Determine if we're in development mode
const IS_DEV = process.env.NODE_ENV !== "production";

// Determine if verbose logging is enabled (via feature flag)
const IS_VERBOSE = process.env.NEMOCLAW_VERBOSE === "1";

// Configure pino transport for pretty printing in development
const pinoConfig = {
  level: IS_VERBOSE ? "debug" : LOG_LEVEL,
  name: "nemoclaw",
  // Add timestamp to all logs
  timestamp: pino.stdTimeFunctions.isoTime,
  // Serialize errors properly
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
  // Base fields added to every log
  base: {
    pid: process.pid,
    hostname: require("os").hostname(),
  },
  // Mixin to automatically add trace context to all logs
  mixin() {
    return getTraceFields();
  },
};

// Pretty print in development, JSON in production
if (IS_DEV && !process.env.NEMOCLAW_LOG_JSON) {
  pinoConfig.transport = {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:standard",
      ignore: "pid,hostname",
      singleLine: false,
    },
  };
}

// Create the main logger instance
const logger = pino(pinoConfig);

/**
 * Create a child logger with additional context
 * @param {object} bindings - Additional fields to add to all logs from this logger
 * @returns {pino.Logger} - Child logger instance
 * 
 * @example
 * const sandboxLogger = createLogger({ sandbox: 'my-sandbox' });
 * sandboxLogger.info('Sandbox started');
 * // Output: {"level":30,"sandbox":"my-sandbox","msg":"Sandbox started",...}
 */
function createLogger(bindings = {}) {
  return logger.child(bindings);
}

/**
 * Log levels:
 * - trace (10): Very detailed debugging, typically not enabled
 * - debug (20): Detailed debugging information
 * - info (30): General informational messages (default)
 * - warn (40): Warning messages for potentially problematic situations
 * - error (50): Error messages for error events
 * - fatal (60): Very severe error events that will lead to abort
 */

/**
 * Convenience wrappers for logging methods with common patterns
 */

/**
 * Log the start of an operation
 * @param {string} operation - Name of the operation
 * @param {object} context - Additional context
 */
function logOperationStart(operation, context = {}) {
  logger.info({ operation, ...context, phase: "start" }, `Starting: ${operation}`);
}

/**
 * Log the successful completion of an operation
 * @param {string} operation - Name of the operation
 * @param {object} context - Additional context (e.g., duration, result)
 */
function logOperationSuccess(operation, context = {}) {
  logger.info({ operation, ...context, phase: "complete" }, `Completed: ${operation}`);
}

/**
 * Log an operation failure
 * @param {string} operation - Name of the operation
 * @param {Error} error - The error that occurred
 * @param {object} context - Additional context
 */
function logOperationFailure(operation, error, context = {}) {
  logger.error({ operation, err: error, ...context, phase: "failed" }, `Failed: ${operation}`);
}

/**
 * Log a CLI command execution
 * @param {string} command - Command name
 * @param {object} args - Command arguments
 */
function logCommand(command, args = {}) {
  logger.info({ command, args, type: "cli" }, `Executing command: ${command}`);
}

/**
 * Log a sandbox operation
 * @param {string} sandbox - Sandbox name
 * @param {string} action - Action being performed
 * @param {object} context - Additional context
 */
function logSandboxOperation(sandbox, action, context = {}) {
  logger.info({ sandbox, action, type: "sandbox", ...context }, `Sandbox ${action}: ${sandbox}`);
}

/**
 * Log an inference request
 * @param {string} model - Model name
 * @param {object} context - Request context (tokens, latency, etc.)
 */
function logInference(model, context = {}) {
  logger.info({ model, type: "inference", ...context }, `Inference request to ${model}`);
}

/**
 * Log a policy operation
 * @param {string} sandbox - Sandbox name
 * @param {string} preset - Policy preset name
 * @param {string} action - Action (apply, remove, etc.)
 */
function logPolicy(sandbox, preset, action, context = {}) {
  logger.info({ sandbox, preset, action, type: "policy", ...context }, `Policy ${action}: ${preset}`);
}

/**
 * Flush logs before exiting
 * Call this before process.exit() to ensure all logs are written
 */
function flush() {
  return new Promise((resolve) => {
    logger.flush(() => resolve());
  });
}

// Export the default logger and utilities
module.exports = {
  logger,
  createLogger,
  logOperationStart,
  logOperationSuccess,
  logOperationFailure,
  logCommand,
  logSandboxOperation,
  logInference,
  logPolicy,
  flush,
  // Export log level constants
  levels: {
    TRACE: "trace",
    DEBUG: "debug",
    INFO: "info",
    WARN: "warn",
    ERROR: "error",
    FATAL: "fatal",
  },
};
