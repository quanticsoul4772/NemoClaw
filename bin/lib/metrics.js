// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0
//
// Metrics Collection Module
//
// Provides telemetry instrumentation for performance monitoring.
// Tracks command execution time, inference latency, sandbox operations, and more.

const { getTraceId, getSpanId } = require("./trace-context");

/**
 * Metrics backend interface
 * Implement this to create custom metrics backends (Prometheus, Datadog, etc.)
 */
class MetricsBackend {
  /**
   * Record a counter metric (incremental value)
   * @param {string} name - Metric name
   * @param {number} value - Value to add (default: 1)
   * @param {Object} tags - Metric tags/labels
   */
  counter(name, value = 1, tags = {}) {
    throw new Error("Not implemented");
  }

  /**
   * Record a gauge metric (current value)
   * @param {string} name - Metric name
   * @param {number} value - Current value
   * @param {Object} tags - Metric tags/labels
   */
  gauge(name, value, tags = {}) {
    throw new Error("Not implemented");
  }

  /**
   * Record a histogram/timing metric (duration in milliseconds)
   * @param {string} name - Metric name
   * @param {number} duration - Duration in milliseconds
   * @param {Object} tags - Metric tags/labels
   */
  histogram(name, duration, tags = {}) {
    throw new Error("Not implemented");
  }

  /**
   * Flush any buffered metrics
   */
  flush() {
    // Optional: implement if backend needs flushing
  }
}

/**
 * Console metrics backend for development
 * Logs metrics to console for local debugging
 */
class ConsoleMetricsBackend extends MetricsBackend {
  counter(name, value = 1, tags = {}) {
    const tagsStr = Object.entries(tags).map(([k, v]) => `${k}=${v}`).join(" ");
    console.log(`[METRIC] counter ${name}=${value} ${tagsStr}`.trim());
  }

  gauge(name, value, tags = {}) {
    const tagsStr = Object.entries(tags).map(([k, v]) => `${k}=${v}`).join(" ");
    console.log(`[METRIC] gauge ${name}=${value} ${tagsStr}`.trim());
  }

  histogram(name, duration, tags = {}) {
    const tagsStr = Object.entries(tags).map(([k, v]) => `${k}=${v}`).join(" ");
    console.log(`[METRIC] histogram ${name}=${duration}ms ${tagsStr}`.trim());
  }
}

/**
 * Logger metrics backend
 * Writes metrics to the structured logger
 */
class LoggerMetricsBackend extends MetricsBackend {
  constructor() {
    super();
    try {
      const { logger } = require("./logger");
      this.logger = logger;
    } catch {
      // Logger not available, use console
      this.logger = console;
    }
  }

  counter(name, value = 1, tags = {}) {
    this.logger.info({
      metric_type: "counter",
      metric_name: name,
      metric_value: value,
      ...tags,
    }, `Counter: ${name}=${value}`);
  }

  gauge(name, value, tags = {}) {
    this.logger.info({
      metric_type: "gauge",
      metric_name: name,
      metric_value: value,
      ...tags,
    }, `Gauge: ${name}=${value}`);
  }

  histogram(name, duration, tags = {}) {
    this.logger.info({
      metric_type: "histogram",
      metric_name: name,
      metric_value: duration,
      duration,
      ...tags,
    }, `Histogram: ${name}=${duration}ms`);
  }
}

/**
 * In-memory metrics backend for testing
 * Stores metrics in memory for inspection
 */
class InMemoryMetricsBackend extends MetricsBackend {
  constructor() {
    super();
    this.metrics = [];
  }

  counter(name, value = 1, tags = {}) {
    this.metrics.push({ type: "counter", name, value, tags, timestamp: Date.now() });
  }

  gauge(name, value, tags = {}) {
    this.metrics.push({ type: "gauge", name, value, tags, timestamp: Date.now() });
  }

  histogram(name, duration, tags = {}) {
    this.metrics.push({ type: "histogram", name, value: duration, tags, timestamp: Date.now() });
  }

  getMetrics() {
    return this.metrics;
  }

  clear() {
    this.metrics = [];
  }
}

/**
 * Metrics collector singleton
 */
class MetricsCollector {
  constructor() {
    this.backends = [];
    this.enabled = process.env.NEMOCLAW_METRICS !== "0"; // Enabled by default
    
    // Auto-configure default backend based on environment
    if (this.enabled) {
      if (process.env.NEMOCLAW_METRICS_BACKEND === "console") {
        this.backends.push(new ConsoleMetricsBackend());
      } else {
        // Use logger backend by default
        this.backends.push(new LoggerMetricsBackend());
      }
    }
  }

  /**
   * Register a custom metrics backend
   * @param {MetricsBackend} backend - Backend instance
   */
  registerBackend(backend) {
    if (!(backend instanceof MetricsBackend)) {
      throw new Error("Backend must extend MetricsBackend");
    }
    this.backends.push(backend);
  }

  /**
   * Remove all backends
   */
  clearBackends() {
    this.backends = [];
  }

  /**
   * Record a counter metric
   * @param {string} name - Metric name
   * @param {number} value - Value to add
   * @param {Object} tags - Metric tags
   */
  counter(name, value = 1, tags = {}) {
    if (!this.enabled) return;
    
    const enrichedTags = this._enrichTags(tags);
    this.backends.forEach(backend => {
      try {
        backend.counter(name, value, enrichedTags);
      } catch (err) {
        console.error(`Metrics backend error: ${err.message}`);
      }
    });
  }

  /**
   * Record a gauge metric
   * @param {string} name - Metric name
   * @param {number} value - Current value
   * @param {Object} tags - Metric tags
   */
  gauge(name, value, tags = {}) {
    if (!this.enabled) return;
    
    const enrichedTags = this._enrichTags(tags);
    this.backends.forEach(backend => {
      try {
        backend.gauge(name, value, enrichedTags);
      } catch (err) {
        console.error(`Metrics backend error: ${err.message}`);
      }
    });
  }

  /**
   * Record a histogram/timing metric
   * @param {string} name - Metric name
   * @param {number} duration - Duration in milliseconds
   * @param {Object} tags - Metric tags
   */
  histogram(name, duration, tags = {}) {
    if (!this.enabled) return;
    
    const enrichedTags = this._enrichTags(tags);
    this.backends.forEach(backend => {
      try {
        backend.histogram(name, duration, enrichedTags);
      } catch (err) {
        console.error(`Metrics backend error: ${err.message}`);
      }
    });
  }

  /**
   * Enrich tags with trace context
   * @private
   */
  _enrichTags(tags) {
    const traceId = getTraceId();
    const spanId = getSpanId();
    
    return {
      ...tags,
      ...(traceId && { trace_id: traceId }),
      ...(spanId && { span_id: spanId }),
    };
  }

  /**
   * Flush all backends
   */
  flush() {
    this.backends.forEach(backend => {
      try {
        backend.flush();
      } catch (err) {
        console.error(`Metrics backend flush error: ${err.message}`);
      }
    });
  }
}

// Global metrics collector instance
const metrics = new MetricsCollector();

/**
 * Convenience functions for common metrics
 */

/**
 * Record CLI command execution
 * @param {string} command - Command name
 * @param {number} duration - Execution duration in milliseconds
 * @param {Object} tags - Additional tags (status, error, etc.)
 */
function recordCommandExecution(command, duration, tags = {}) {
  metrics.counter("nemoclaw.command.executions", 1, { command, ...tags });
  metrics.histogram("nemoclaw.command.duration", duration, { command, ...tags });
}

/**
 * Record inference request
 * @param {string} model - Model name
 * @param {number} duration - Request duration in milliseconds
 * @param {Object} tags - Additional tags (tokens, cached, etc.)
 */
function recordInferenceRequest(model, duration, tags = {}) {
  metrics.counter("nemoclaw.inference.requests", 1, { model, ...tags });
  metrics.histogram("nemoclaw.inference.latency", duration, { model, ...tags });
  
  if (tags.tokens) {
    metrics.counter("nemoclaw.inference.tokens", tags.tokens, { model, ...tags });
  }
}

/**
 * Record sandbox operation
 * @param {string} sandbox - Sandbox name
 * @param {string} operation - Operation type (create, start, stop, destroy)
 * @param {number} duration - Operation duration in milliseconds
 * @param {Object} tags - Additional tags
 */
function recordSandboxOperation(sandbox, operation, duration, tags = {}) {
  metrics.counter("nemoclaw.sandbox.operations", 1, { sandbox, operation, ...tags });
  metrics.histogram("nemoclaw.sandbox.operation_duration", duration, { sandbox, operation, ...tags });
}

/**
 * Record policy operation
 * @param {string} sandbox - Sandbox name
 * @param {string} preset - Policy preset name
 * @param {string} action - Action type (apply, remove)
 * @param {Object} tags - Additional tags
 */
function recordPolicyOperation(sandbox, preset, action, tags = {}) {
  metrics.counter("nemoclaw.policy.operations", 1, { sandbox, preset, action, ...tags });
}

/**
 * Record error
 * @param {string} operation - Operation that failed
 * @param {string} errorType - Error type or class name
 * @param {Object} tags - Additional tags
 */
function recordError(operation, errorType, tags = {}) {
  metrics.counter("nemoclaw.errors", 1, { operation, error_type: errorType, ...tags });
}

/**
 * Create a timer for measuring operation duration
 * Returns a function that, when called, records the duration
 * 
 * @param {string} metricName - Metric name
 * @param {Object} tags - Metric tags
 * @returns {Function} - Call this to stop timer and record metric
 * 
 * @example
 * const timer = startTimer('nemoclaw.operation.duration', { operation: 'create' });
 * // ... perform operation ...
 * timer(); // Records duration automatically
 */
function startTimer(metricName, tags = {}) {
  const startTime = Date.now();
  
  return () => {
    const duration = Date.now() - startTime;
    metrics.histogram(metricName, duration, tags);
    return duration;
  };
}

/**
 * Measure async operation duration
 * @param {string} metricName - Metric name
 * @param {Function} fn - Async function to measure
 * @param {Object} tags - Metric tags
 * @returns {Promise<*>} - Result of the function
 * 
 * @example
 * const result = await measureAsync('nemoclaw.db.query', async () => {
 *   return await db.query('SELECT * FROM users');
 * }, { query: 'users' });
 */
async function measureAsync(metricName, fn, tags = {}) {
  const timer = startTimer(metricName, tags);
  
  try {
    const result = await fn();
    timer();
    return result;
  } catch (error) {
    const duration = timer();
    recordError(metricName, error.constructor.name, { duration, ...tags });
    throw error;
  }
}

module.exports = {
  // Core metrics collector
  metrics,
  
  // Backend classes (for custom backends)
  MetricsBackend,
  ConsoleMetricsBackend,
  LoggerMetricsBackend,
  InMemoryMetricsBackend,
  
  // Convenience functions
  recordCommandExecution,
  recordInferenceRequest,
  recordSandboxOperation,
  recordPolicyOperation,
  recordError,
  startTimer,
  measureAsync,
};
