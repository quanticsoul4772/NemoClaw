// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0
//
// Distributed Tracing Context Module
//
// Provides trace ID generation and propagation for distributed tracing.
// Trace IDs allow following a request through the entire system (CLI → Blueprint → Sandbox → Inference).

const { v4: uuidv4 } = require("uuid");
const { AsyncLocalStorage } = require("async_hooks");

// AsyncLocalStorage provides request-scoped storage for trace context
// This allows us to access the trace ID from anywhere in the call chain
// without explicitly passing it through every function
const asyncLocalStorage = new AsyncLocalStorage();

/**
 * Trace context structure
 * @typedef {Object} TraceContext
 * @property {string} traceId - Unique identifier for this request/operation (UUID v4)
 * @property {string} parentSpanId - Parent span ID for nested operations
 * @property {string} spanId - Current span ID
 * @property {string} operation - Operation name (e.g., "onboard", "sandbox-create")
 * @property {Object} metadata - Additional context (sandbox, model, etc.)
 * @property {number} startTime - Operation start time (milliseconds since epoch)
 */

/**
 * Generate a new trace ID
 * @returns {string} - UUID v4 trace ID
 */
function generateTraceId() {
  return uuidv4();
}

/**
 * Generate a new span ID
 * @returns {string} - Short hex span ID (8 characters)
 */
function generateSpanId() {
  return Math.random().toString(16).slice(2, 10);
}

/**
 * Create a new trace context
 * @param {string} operation - Operation name
 * @param {Object} metadata - Additional context
 * @returns {TraceContext} - New trace context
 */
function createTraceContext(operation, metadata = {}) {
  const traceId = generateTraceId();
  const spanId = generateSpanId();

  return {
    traceId,
    spanId,
    parentSpanId: null,
    operation,
    metadata,
    startTime: Date.now(),
  };
}

/**
 * Get the current trace context
 * @returns {TraceContext|null} - Current trace context or null if none
 */
function getTraceContext() {
  return asyncLocalStorage.getStore();
}

/**
 * Get the current trace ID
 * @returns {string|null} - Current trace ID or null if none
 */
function getTraceId() {
  const context = getTraceContext();
  return context ? context.traceId : null;
}

/**
 * Get the current span ID
 * @returns {string|null} - Current span ID or null if none
 */
function getSpanId() {
  const context = getTraceContext();
  return context ? context.spanId : null;
}

/**
 * Run a function within a trace context
 * @param {string} operation - Operation name
 * @param {Function} fn - Function to run
 * @param {Object} metadata - Additional context
 * @returns {Promise<*>} - Result of the function
 *
 * @example
 * await runWithTraceContext('sandbox-create', async () => {
 *   const traceId = getTraceId();
 *   logger.info({ traceId }, 'Creating sandbox');
 *   // ... create sandbox ...
 * }, { sandbox: 'my-sandbox' });
 */
async function runWithTraceContext(operation, fn, metadata = {}) {
  const existingContext = getTraceContext();

  let context;
  if (existingContext) {
    // Create a child span within the existing trace
    context = {
      ...existingContext,
      parentSpanId: existingContext.spanId,
      spanId: generateSpanId(),
      operation,
      metadata: { ...existingContext.metadata, ...metadata },
      startTime: Date.now(),
    };
  } else {
    // Create a new root trace
    context = createTraceContext(operation, metadata);
  }

  return asyncLocalStorage.run(context, fn);
}

/**
 * Get HTTP headers for trace propagation
 * Returns headers that should be added to outgoing HTTP requests
 * to propagate the trace context to downstream services.
 *
 * Uses standard header names:
 * - X-Request-ID: The trace ID
 * - X-Trace-ID: Alternative trace ID header
 * - X-Span-ID: Current span ID
 * - X-Parent-Span-ID: Parent span ID (if any)
 *
 * @returns {Object} - Headers object
 *
 * @example
 * const headers = getTraceHeaders();
 * fetch('https://api.example.com', { headers });
 */
function getTraceHeaders() {
  const context = getTraceContext();

  if (!context) {
    return {};
  }

  const headers = {
    "X-Request-ID": context.traceId,
    "X-Trace-ID": context.traceId,
    "X-Span-ID": context.spanId,
  };

  if (context.parentSpanId) {
    headers["X-Parent-Span-ID"] = context.parentSpanId;
  }

  return headers;
}

/**
 * Extract trace context from HTTP headers
 * Used to continue a trace from an incoming request
 *
 * @param {Object} headers - HTTP headers object
 * @returns {TraceContext|null} - Extracted trace context or null
 *
 * @example
 * const context = extractTraceContext(req.headers);
 * if (context) {
 *   asyncLocalStorage.run(context, () => {
 *     // Handle request with trace context
 *   });
 * }
 */
function extractTraceContext(headers) {
  const traceId = headers["x-request-id"] || headers["x-trace-id"];
  const spanId = headers["x-span-id"];
  const parentSpanId = headers["x-parent-span-id"];

  if (!traceId) {
    return null;
  }

  return {
    traceId,
    spanId: spanId || generateSpanId(),
    parentSpanId: parentSpanId || null,
    operation: "http-request",
    metadata: {},
    startTime: Date.now(),
  };
}

/**
 * Get trace context for logging
 * Returns an object with trace fields that should be added to log entries
 *
 * @returns {Object} - Trace fields for logging
 *
 * @example
 * const { logger } = require('./logger');
 * logger.info({ ...getTraceFields(), sandbox: 'test' }, 'Message');
 * // Output: {"traceId":"123-456","spanId":"abc123","sandbox":"test",...}
 */
function getTraceFields() {
  const context = getTraceContext();

  if (!context) {
    return {};
  }

  const fields = {
    traceId: context.traceId,
    spanId: context.spanId,
  };

  if (context.parentSpanId) {
    fields.parentSpanId = context.parentSpanId;
  }

  if (context.operation) {
    fields.traceOperation = context.operation;
  }

  return fields;
}

/**
 * Measure operation duration and log with trace context
 * @param {string} operation - Operation name
 * @param {Function} fn - Function to measure
 * @param {Object} metadata - Additional context
 * @returns {Promise<*>} - Result of the function
 *
 * @example
 * const result = await measureOperation('database-query', async () => {
 *   return await db.query('SELECT * FROM users');
 * }, { query: 'SELECT * FROM users' });
 */
async function measureOperation(operation, fn, metadata = {}) {
  const startTime = Date.now();

  try {
    const result = await runWithTraceContext(operation, fn, metadata);
    const duration = Date.now() - startTime;

    const { logger } = require("./logger");
    logger.debug({
      ...getTraceFields(),
      duration,
      operation,
      ...metadata,
      phase: "complete",
    }, `Completed: ${operation}`);

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;

    const { logger } = require("./logger");
    logger.error({
      ...getTraceFields(),
      duration,
      operation,
      ...metadata,
      err: error,
      phase: "failed",
    }, `Failed: ${operation}`);

    throw error;
  }
}

module.exports = {
  // Core functions
  generateTraceId,
  generateSpanId,
  createTraceContext,
  getTraceContext,
  getTraceId,
  getSpanId,
  runWithTraceContext,

  // HTTP propagation
  getTraceHeaders,
  extractTraceContext,

  // Logging integration
  getTraceFields,
  measureOperation,
};
