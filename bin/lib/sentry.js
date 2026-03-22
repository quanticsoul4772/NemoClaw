// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0
//
// Error Tracking Module (Sentry Integration)
//
// Provides contextualized error tracking with Sentry.
// Includes source maps, breadcrumbs, trace context, and user information.

const Sentry = require("@sentry/node");
const os = require("os");
const { getTraceId, getSpanId, getTraceContext } = require("./trace-context");

// Track initialization state
let initialized = false;
let enabled = false;

/**
 * Initialize Sentry error tracking
 * 
 * Requires SENTRY_DSN environment variable to be set.
 * Optional configuration via environment variables:
 * - SENTRY_ENVIRONMENT: Environment name (default: development)
 * - SENTRY_RELEASE: Release version (default: auto-detected from git)
 * - SENTRY_SAMPLE_RATE: Error sample rate 0.0-1.0 (default: 1.0)
 * - SENTRY_TRACES_SAMPLE_RATE: Traces sample rate 0.0-1.0 (default: 0.1)
 * 
 * @example
 * // Set SENTRY_DSN in .env file or environment
 * export SENTRY_DSN=https://abc123@o123456.ingest.sentry.io/789
 * 
 * // Initialize at application startup
 * const { initSentry } = require('./lib/sentry');
 * initSentry();
 */
function initSentry() {
  // Only initialize once
  if (initialized) {
    return;
  }
  initialized = true;

  const dsn = process.env.SENTRY_DSN;
  
  // Sentry is opt-in via SENTRY_DSN environment variable
  if (!dsn) {
    // Not an error - Sentry is optional
    return;
  }

  enabled = true;

  const environment = process.env.SENTRY_ENVIRONMENT || 
                     process.env.NODE_ENV || 
                     "development";

  // Try to get release version from git or package.json
  let release = process.env.SENTRY_RELEASE;
  if (!release) {
    try {
      const { execSync } = require("child_process");
      const gitHash = execSync("git rev-parse --short HEAD", { 
        encoding: "utf-8", 
        stdio: ["pipe", "pipe", "ignore"],
      }).trim();
      release = `nemoclaw@${gitHash}`;
    } catch {
      // Git not available or not a git repo
      try {
        const pkg = require("../../package.json");
        release = `nemoclaw@${pkg.version}`;
      } catch {
        release = "nemoclaw@unknown";
      }
    }
  }

  Sentry.init({
    dsn,
    environment,
    release,
    
    // Error sampling (default: capture all errors)
    sampleRate: parseFloat(process.env.SENTRY_SAMPLE_RATE || "1.0"),
    
    // Performance monitoring (default: 10% of transactions)
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || "0.1"),
    
    // Enable source maps for better stack traces
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.OnUncaughtException(),
      new Sentry.Integrations.OnUnhandledRejection(),
      new Sentry.Integrations.ContextLines(),
    ],
    
    // Attach stack traces to all messages
    attachStacktrace: true,
    
    // Maximum breadcrumbs to keep
    maxBreadcrumbs: 100,
    
    // Add context to every event
    beforeSend(event, hint) {
      // Enrich with trace context
      const traceContext = getTraceContext();
      if (traceContext) {
        event.contexts = event.contexts || {};
        event.contexts.trace = {
          trace_id: traceContext.traceId,
          span_id: traceContext.spanId,
          parent_span_id: traceContext.parentSpanId,
          operation: traceContext.operation,
        };
        
        // Add trace ID as tag for easier searching
        event.tags = event.tags || {};
        event.tags.trace_id = traceContext.traceId;
      }
      
      // Add system context
      event.contexts = event.contexts || {};
      event.contexts.runtime = event.contexts.runtime || {};
      event.contexts.runtime.hostname = os.hostname();
      event.contexts.runtime.platform = os.platform();
      event.contexts.runtime.arch = os.arch();
      
      return event;
    },
    
    // Before sending breadcrumb
    beforeBreadcrumb(breadcrumb, hint) {
      // Enrich breadcrumbs with trace context
      const traceId = getTraceId();
      if (traceId) {
        breadcrumb.data = breadcrumb.data || {};
        breadcrumb.data.trace_id = traceId;
      }
      return breadcrumb;
    },
  });

  // Set user context (non-PII)
  Sentry.setUser({
    id: os.userInfo().username,
    username: os.userInfo().username,
  });

  // Set global tags
  Sentry.setTags({
    node_version: process.version,
    platform: os.platform(),
  });
}

/**
 * Check if Sentry is enabled
 * @returns {boolean} - True if Sentry is initialized and enabled
 */
function isSentryEnabled() {
  return enabled;
}

/**
 * Capture an exception with Sentry
 * Automatically enriches with trace context and breadcrumbs
 * 
 * @param {Error} error - Error to capture
 * @param {Object} context - Additional context (tags, extra data, user, level)
 * @returns {string|null} - Event ID if sent, null if Sentry not enabled
 * 
 * @example
 * try {
 *   await createSandbox(name);
 * } catch (error) {
 *   captureException(error, {
 *     tags: { sandbox: name, operation: 'create' },
 *     extra: { model: 'nemotron', gpu: true },
 *     level: 'error',
 *   });
 *   throw error;
 * }
 */
function captureException(error, context = {}) {
  if (!enabled) {
    return null;
  }

  return Sentry.captureException(error, {
    tags: context.tags,
    extra: context.extra,
    user: context.user,
    level: context.level || "error",
    contexts: context.contexts,
  });
}

/**
 * Capture a message with Sentry
 * 
 * @param {string} message - Message to capture
 * @param {string} level - Message level (debug, info, warning, error, fatal)
 * @param {Object} context - Additional context
 * @returns {string|null} - Event ID if sent, null if Sentry not enabled
 * 
 * @example
 * captureMessage('Sandbox creation failed', 'warning', {
 *   tags: { sandbox: 'my-sandbox' },
 *   extra: { reason: 'timeout' },
 * });
 */
function captureMessage(message, level = "info", context = {}) {
  if (!enabled) {
    return null;
  }

  return Sentry.captureMessage(message, {
    level,
    tags: context.tags,
    extra: context.extra,
    user: context.user,
    contexts: context.contexts,
  });
}

/**
 * Add a breadcrumb for tracking user actions
 * Breadcrumbs provide context about what happened before an error
 * 
 * @param {Object} breadcrumb - Breadcrumb data
 * @param {string} breadcrumb.category - Category (e.g., 'cli', 'sandbox', 'inference')
 * @param {string} breadcrumb.message - Human-readable message
 * @param {string} breadcrumb.level - Level (debug, info, warning, error)
 * @param {Object} breadcrumb.data - Additional structured data
 * 
 * @example
 * addBreadcrumb({
 *   category: 'sandbox',
 *   message: 'Creating sandbox',
 *   level: 'info',
 *   data: { sandbox: 'my-sandbox', model: 'nemotron' },
 * });
 */
function addBreadcrumb(breadcrumb) {
  if (!enabled) {
    return;
  }

  Sentry.addBreadcrumb({
    category: breadcrumb.category || "default",
    message: breadcrumb.message,
    level: breadcrumb.level || "info",
    data: breadcrumb.data || {},
    timestamp: Date.now() / 1000,
  });
}

/**
 * Set user context for error reports
 * 
 * @param {Object} user - User information (non-PII)
 * @param {string} user.id - User ID
 * @param {string} user.username - Username
 * @param {string} user.email - Email (optional, sanitized)
 * @param {Object} user.data - Additional user data
 * 
 * @example
 * setUser({
 *   id: 'user-123',
 *   username: 'alice',
 *   data: { subscription: 'enterprise' },
 * });
 */
function setUser(user) {
  if (!enabled) {
    return;
  }

  Sentry.setUser(user);
}

/**
 * Set tags for filtering/grouping errors
 * 
 * @param {Object} tags - Key-value pairs
 * 
 * @example
 * setTags({
 *   sandbox: 'my-sandbox',
 *   environment: 'production',
 *   region: 'us-west',
 * });
 */
function setTags(tags) {
  if (!enabled) {
    return;
  }

  Sentry.setTags(tags);
}

/**
 * Set extra context data
 * 
 * @param {string} key - Context key
 * @param {*} value - Context value
 * 
 * @example
 * setExtra('request_payload', { model: 'nemotron', tokens: 150 });
 */
function setExtra(key, value) {
  if (!enabled) {
    return;
  }

  Sentry.setExtra(key, value);
}

/**
 * Start a performance transaction
 * Used for distributed tracing integration
 * 
 * @param {Object} context - Transaction context
 * @param {string} context.name - Transaction name
 * @param {string} context.op - Operation type
 * @returns {Object|null} - Transaction object or null if not enabled
 * 
 * @example
 * const transaction = startTransaction({
 *   name: 'nemoclaw.onboard',
 *   op: 'cli.command',
 * });
 * 
 * try {
 *   // ... perform operation ...
 *   transaction.setStatus('ok');
 * } catch (error) {
 *   transaction.setStatus('internal_error');
 *   throw error;
 * } finally {
 *   transaction.finish();
 * }
 */
function startTransaction(context) {
  if (!enabled) {
    return null;
  }

  const traceContext = getTraceContext();
  
  return Sentry.startTransaction({
    name: context.name,
    op: context.op,
    ...(traceContext && {
      traceId: traceContext.traceId,
      parentSpanId: traceContext.parentSpanId,
    }),
  });
}

/**
 * Flush pending events and wait for them to be sent
 * Call before process exit to ensure all errors are sent
 * 
 * @param {number} timeout - Timeout in milliseconds (default: 2000)
 * @returns {Promise<boolean>} - True if all events were sent
 * 
 * @example
 * process.on('exit', async () => {
 *   await flushSentry(5000);
 * });
 */
async function flushSentry(timeout = 2000) {
  if (!enabled) {
    return true;
  }

  return await Sentry.flush(timeout);
}

/**
 * Wrap an async function with Sentry error capture
 * 
 * @param {Function} fn - Async function to wrap
 * @param {Object} context - Context for error capture
 * @returns {Function} - Wrapped function
 * 
 * @example
 * const createSandbox = withSentry(async (name) => {
 *   // ... create sandbox ...
 * }, { tags: { operation: 'sandbox-create' } });
 */
function withSentry(fn, context = {}) {
  return async function(...args) {
    try {
      return await fn(...args);
    } catch (error) {
      captureException(error, context);
      throw error;
    }
  };
}

module.exports = {
  // Initialization
  initSentry,
  isSentryEnabled,
  
  // Error capture
  captureException,
  captureMessage,
  
  // Breadcrumbs
  addBreadcrumb,
  
  // Context
  setUser,
  setTags,
  setExtra,
  
  // Performance
  startTransaction,
  
  // Utilities
  flushSentry,
  withSentry,
  
  // Direct Sentry access (for advanced use cases)
  Sentry,
};
