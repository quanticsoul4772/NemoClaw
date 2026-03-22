# Observability and Logging

NemoClaw uses structured logging and distributed tracing to provide better observability and debugging capabilities for both humans and autonomous agents.

## Table of Contents

- [Structured Logging](#structured-logging)
- [Distributed Tracing](#distributed-tracing)
- [Metrics Collection](#metrics-collection)
- [Error Tracking](#error-tracking)
- [Alerting](#alerting)
- [Deployment Observability](#deployment-observability)
- [Log Aggregation](#log-aggregation)
- [Best Practices](#best-practices)
- [References](#references)

---

## Structured Logging

### Overview

NemoClaw uses [pino](https://getpino.io/) for high-performance structured logging:

- **JSON output**: All logs are structured JSON for easy parsing and analysis
- **Log levels**: trace, debug, info, warn, error, fatal
- **Contextual fields**: Every log includes operation context (sandbox, command, etc.)
- **Pretty printing**: Human-readable output in development
- **Performance**: Low overhead, non-blocking logging

### Logger Module

**Location**: `bin/lib/logger.js`

The logger module provides a centralized logging interface with helper functions for common operations.

### Basic Usage

```javascript
const { logger } = require("./lib/logger");

// Simple logging
logger.info("Sandbox created successfully");
logger.error("Failed to connect to inference endpoint");

// Logging with context
logger.info({ sandbox: "my-sandbox", model: "nemotron" }, "Inference completed");
logger.error({ err: new Error("Connection timeout"), sandbox: "my-sandbox" }, "Sandbox startup failed");

// Different log levels
logger.trace("Very detailed debug info");  // Not shown by default
logger.debug("Debugging information");     // Shown with NEMOCLAW_VERBOSE=1
logger.info("General information");        // Default level
logger.warn("Warning message");
logger.error("Error occurred");
logger.fatal("Fatal error, app will exit");
```

### Convenience Functions

The logger module includes convenience functions for common operations:

**Operation tracking**:
```javascript
const { logOperationStart, logOperationSuccess, logOperationFailure } = require("./lib/logger");

// Track an operation lifecycle
logOperationStart("sandbox-create", { sandbox: "my-sandbox" });
try {
  // ... perform operation ...
  logOperationSuccess("sandbox-create", { sandbox: "my-sandbox", duration: 1500 });
} catch (err) {
  logOperationFailure("sandbox-create", err, { sandbox: "my-sandbox" });
}
```

**CLI command logging**:
```javascript
const { logCommand } = require("./lib/logger");

logCommand("onboard", { profile: "vllm", experimental: true });
// Output: {"level":30,"command":"onboard","args":{"profile":"vllm","experimental":true},...}
```

**Sandbox operations**:
```javascript
const { logSandboxOperation } = require("./lib/logger");

logSandboxOperation("my-sandbox", "connect", { user: "alice" });
logSandboxOperation("my-sandbox", "stop", { reason: "user-request" });
```

**Inference requests**:
```javascript
const { logInference } = require("./lib/logger");

logInference("nvidia/nemotron-3-super-120b-a12b", {
  tokens: 150,
  latency: 420,
  cached: false,
});
```

**Policy operations**:
```javascript
const { logPolicy } = require("./lib/logger");

logPolicy("my-sandbox", "github", "apply", { endpoints: 2 });
```

### Child Loggers

Create child loggers with additional context for specific components:

```javascript
const { createLogger } = require("./lib/logger");

const sandboxLogger = createLogger({ sandbox: "my-sandbox" });
const commandLogger = createLogger({ command: "onboard" });

sandboxLogger.info("Starting sandbox");
// Output: {"level":30,"sandbox":"my-sandbox","msg":"Starting sandbox",...}

commandLogger.debug({ step: 1 }, "Detecting providers");
// Output: {"level":20,"command":"onboard","step":1,"msg":"Detecting providers",...}
```

### Configuration

#### Log Level

Control log verbosity via environment variables:

```bash
# Set specific log level
export NEMOCLAW_LOG_LEVEL=debug  # trace, debug, info, warn, error, fatal

# Enable verbose mode (sets level to debug)
export NEMOCLAW_VERBOSE=1

# General log level (fallback)
export LOG_LEVEL=warn
```

**Precedence**: `NEMOCLAW_VERBOSE` > `NEMOCLAW_LOG_LEVEL` > `LOG_LEVEL` > `info` (default)

#### Output Format

**Development mode** (default):
- Pretty-printed, colorized output
- Human-readable timestamps
- Suitable for local development

**Production mode**:
```bash
export NODE_ENV=production
```
- JSON output (one line per log)
- ISO timestamps
- Suitable for log aggregation systems

**Force JSON output** (even in dev):
```bash
export NEMOCLAW_LOG_JSON=1
```

### Log Fields

Every log entry includes:

**Standard fields**:
- `level`: Log level number (30 = info, 40 = warn, 50 = error)
- `time`: ISO 8601 timestamp
- `pid`: Process ID
- `hostname`: Machine hostname
- `msg`: Human-readable message

**Context fields** (added by specific loggers):
- `sandbox`: Sandbox name
- `command`: CLI command name
- `operation`: Operation name
- `model`: Inference model
- `preset`: Policy preset name
- `type`: Event type (cli, sandbox, inference, policy)

**Error fields** (when logging errors):
- `err`: Error object with stack trace
- `err.type`: Error type
- `err.message`: Error message
- `err.stack`: Stack trace

---

## Log Examples

### Development Mode (Pretty)

```bash
$ nemoclaw onboard
[2026-03-22 11:30:45.123] INFO (nemoclaw/12345): Executing command: onboard
    command: "onboard"
    args: {}
    type: "cli"
[2026-03-22 11:30:45.456] INFO (nemoclaw/12345): Starting: provider-detection
    operation: "provider-detection"
    phase: "start"
[2026-03-22 11:30:46.789] INFO (nemoclaw/12345): Sandbox created successfully
    sandbox: "my-sandbox"
    model: "nvidia/nemotron-3-super-120b-a12b"
```

### Production Mode (JSON)

```bash
$ NODE_ENV=production nemoclaw onboard
{"level":30,"time":"2026-03-22T11:30:45.123Z","pid":12345,"hostname":"dev-machine","command":"onboard","args":{},"type":"cli","msg":"Executing command: onboard"}
{"level":30,"time":"2026-03-22T11:30:45.456Z","pid":12345,"hostname":"dev-machine","operation":"provider-detection","phase":"start","msg":"Starting: provider-detection"}
{"level":30,"time":"2026-03-22T11:30:46.789Z","pid":12345,"hostname":"dev-machine","sandbox":"my-sandbox","model":"nvidia/nemotron-3-super-120b-a12b","msg":"Sandbox created successfully"}
```

### Error Logging

```javascript
const { logger } = require("./lib/logger");

try {
  // ... some operation ...
} catch (error) {
  logger.error({
    err: error,
    sandbox: "my-sandbox",
    operation: "connect",
  }, "Failed to connect to sandbox");
}
```

**Output**:
```json
{
  "level": 50,
  "time": "2026-03-22T11:30:47.000Z",
  "err": {
    "type": "Error",
    "message": "ECONNREFUSED: Connection refused",
    "stack": "Error: ECONNREFUSED...\n    at ..."
  },
  "sandbox": "my-sandbox",
  "operation": "connect",
  "msg": "Failed to connect to sandbox"
}
```

---

## Distributed Tracing

### Overview

NemoClaw implements distributed tracing to track requests through the entire system. Every CLI command gets a unique trace ID that propagates through all operations.

**Why distributed tracing?**
- **End-to-end visibility**: Follow a request from CLI → Blueprint → Sandbox → Inference
- **Debug complex flows**: Understand the path a request took through the system
- **Performance analysis**: Measure operation durations across components
- **Error correlation**: Connect errors back to the originating request

### Trace Context Module

**Location**: `bin/lib/trace-context.js`

The trace context module provides trace ID generation, context propagation, and HTTP header management.

### Automatic Trace ID Injection

**All CLI commands automatically get trace IDs:**

```bash
$ nemoclaw onboard
[2026-03-22 11:45:23.123] INFO (nemoclaw): Executing command: onboard
    traceId: "a7f3e8d2-4b1c-4f9e-8a3d-5c2e1f4b6a9d"
    spanId: "abc12345"
    command: "onboard"
```

**Every log automatically includes trace context:**
- `traceId`: Unique identifier for the entire request/operation
- `spanId`: Unique identifier for the current operation step
- `parentSpanId`: Parent operation (for nested operations)
- `traceOperation`: Operation name

### Using Trace Context in Code

**Get current trace ID:**

```javascript
const { getTraceId, getTraceFields } = require("./lib/trace-context");

// Get trace ID
const traceId = getTraceId();
console.log(`Processing request ${traceId}`);

// Get all trace fields for logging
const { logger } = require("./lib/logger");
logger.info({ ...getTraceFields(), sandbox: "test" }, "Sandbox started");
// Trace fields (traceId, spanId, etc.) are added automatically via logger mixin
```

**Run operations within trace context:**

```javascript
const { runWithTraceContext } = require("./lib/trace-context");

async function createSandbox(name) {
  // Create a nested span within the current trace
  await runWithTraceContext("sandbox-create", async () => {
    logger.info({ sandbox: name }, "Creating sandbox");
    // ... create sandbox ...
    logger.info({ sandbox: name }, "Sandbox created");
  }, { sandbox: name });
}
```

**Measure operation duration:**

```javascript
const { measureOperation } = require("./lib/trace-context");

async function queryDatabase(query) {
  return await measureOperation("database-query", async () => {
    return await db.query(query);
  }, { query });
}
// Automatically logs operation duration with trace context
```

### HTTP Header Propagation

**Propagate trace context to downstream services:**

```javascript
const { getTraceHeaders } = require("./lib/trace-context");
const fetch = require("node-fetch");

// Add trace headers to HTTP requests
const headers = {
  "Authorization": `Bearer ${token}`,
  ...getTraceHeaders(),  // Adds X-Request-ID, X-Trace-ID, X-Span-ID
};

const response = await fetch("https://inference.nvidia.com/v1/completions", {
  method: "POST",
  headers,
  body: JSON.stringify({ ... }),
});
```

**Standard headers added:**
- `X-Request-ID`: The trace ID (compatible with common logging systems)
- `X-Trace-ID`: Alternative trace ID header
- `X-Span-ID`: Current span ID
- `X-Parent-Span-ID`: Parent span ID (if nested operation)

**Extract trace context from incoming requests:**

```javascript
const { extractTraceContext, runWithTraceContext } = require("./lib/trace-context");

// HTTP server example
server.on("request", async (req, res) => {
  const context = extractTraceContext(req.headers);

  if (context) {
    // Continue the trace from the incoming request
    await runWithTraceContext("http-request", async () => {
      // Handle request with trace context
      logger.info({ path: req.url }, "Processing request");
      // traceId from the incoming X-Request-ID header is automatically included
    }, context.metadata);
  }
});
```

### Trace Context Structure

Each trace context contains:

```javascript
{
  traceId: "a7f3e8d2-4b1c-4f9e-8a3d-5c2e1f4b6a9d",  // UUID v4
  spanId: "abc12345",                                // 8-char hex ID
  parentSpanId: "def67890",                          // Parent span (null for root)
  operation: "sandbox-create",                        // Operation name
  metadata: { sandbox: "my-sandbox", model: "..." }, // Additional context
  startTime: 1711111111123                           // Milliseconds since epoch
}
```

### Nested Operations (Spans)

Trace context automatically handles nested operations:

```bash
# Root operation
nemoclaw onboard
  traceId: "trace-123"
  spanId: "span-001"

  # Nested operation: provider detection
  └─> provider-detection
      traceId: "trace-123"        # Same trace ID
      spanId: "span-002"          # New span ID
      parentSpanId: "span-001"    # Points to parent

  # Nested operation: sandbox creation
  └─> sandbox-create
      traceId: "trace-123"
      spanId: "span-003"
      parentSpanId: "span-001"
```

### Example: Tracing a CLI Command

```bash
$ NEMOCLAW_VERBOSE=1 nemoclaw onboard

[2026-03-22 11:45:23.123] DEBUG: Executing command: onboard
    traceId: "a7f3e8d2-4b1c-4f9e-8a3d-5c2e1f4b6a9d"
    spanId: "abc12345"
    command: "onboard"

[2026-03-22 11:45:23.456] INFO: Starting: provider-detection
    traceId: "a7f3e8d2-4b1c-4f9e-8a3d-5c2e1f4b6a9d"
    spanId: "def67890"
    parentSpanId: "abc12345"
    operation: "provider-detection"

[2026-03-22 11:45:24.789] INFO: Creating sandbox
    traceId: "a7f3e8d2-4b1c-4f9e-8a3d-5c2e1f4b6a9d"
    spanId: "ghi12345"
    parentSpanId: "abc12345"
    sandbox: "my-sandbox"

[2026-03-22 11:45:26.123] INFO: Completed: sandbox-create
    traceId: "a7f3e8d2-4b1c-4f9e-8a3d-5c2e1f4b6a9d"
    spanId: "ghi12345"
    duration: 1334
    phase: "complete"
```

**Notice**: All logs share the same `traceId`, allowing you to filter all logs for this specific `nemoclaw onboard` invocation.

### Searching Logs by Trace ID

**Find all logs for a specific request:**

```bash
# Get trace ID from first log
nemoclaw onboard 2>&1 | head -1 | jq -r '.traceId'
# a7f3e8d2-4b1c-4f9e-8a3d-5c2e1f4b6a9d

# Filter all logs for this trace
nemoclaw onboard 2>&1 | jq 'select(.traceId == "a7f3e8d2-4b1c-4f9e-8a3d-5c2e1f4b6a9d")'

# Show operation timeline (sorted by time)
nemoclaw onboard 2>&1 | jq -s 'sort_by(.time) | .[] | {time, operation: .traceOperation, duration}'
```

### Integration with External Tracing Systems

**OpenTelemetry compatible:**

The trace context module uses standard headers (`X-Request-ID`, `X-Trace-ID`) that are compatible with:
- **OpenTelemetry**: Standard distributed tracing framework
- **Datadog APM**: Accepts X-Request-ID for trace correlation
- **New Relic**: Supports X-Request-ID header propagation
- **AWS X-Ray**: Compatible with custom trace IDs
- **Jaeger/Zipkin**: Can be mapped to trace/span IDs

**Future integration path:**

To integrate with OpenTelemetry:

```javascript
// Example: OpenTelemetry integration (not yet implemented)
const { trace } = require("@opentelemetry/api");
const { getTraceContext } = require("./lib/trace-context");

const tracer = trace.getTracer("nemoclaw");
const context = getTraceContext();

const span = tracer.startSpan("operation-name", {
  attributes: {
    "trace.id": context.traceId,
    "span.id": context.spanId,
  },
});
```

---

## Metrics Collection

### Overview

NemoClaw implements comprehensive metrics collection for performance monitoring and telemetry. Metrics track command execution time, inference latency, sandbox operations, and errors.

**Why metrics collection?**
- **Performance monitoring**: Track command and operation durations
- **Usage analytics**: Understand which features are being used
- **Error rates**: Monitor failure rates and error types
- **Capacity planning**: Identify performance bottlenecks
- **SLO/SLA tracking**: Measure service level objectives

### Metrics Module

**Location**: `bin/lib/metrics.js`

The metrics module provides a pluggable architecture for collecting and exporting metrics to various backends.

### Automatic Metrics Collection

**All CLI commands automatically tracked:**

```bash
$ nemoclaw onboard
# Automatically records:
# - nemoclaw.command.executions (counter)
# - nemoclaw.command.duration (histogram)
```

**Metrics are automatically enriched with trace context:**
- `trace_id`: Current trace ID (for correlation with logs)
- `span_id`: Current span ID
- Plus any custom tags you provide

### Built-in Metrics

**Command metrics:**
- `nemoclaw.command.executions`: Number of command invocations (counter)
- `nemoclaw.command.duration`: Command execution time (histogram)

**Inference metrics:**
- `nemoclaw.inference.requests`: Number of inference requests (counter)
- `nemoclaw.inference.latency`: Inference request duration (histogram)
- `nemoclaw.inference.tokens`: Total tokens processed (counter)

**Sandbox metrics:**
- `nemoclaw.sandbox.operations`: Number of sandbox operations (counter)
- `nemoclaw.sandbox.operation_duration`: Sandbox operation duration (histogram)

**Policy metrics:**
- `nemoclaw.policy.operations`: Number of policy operations (counter)

**Error metrics:**
- `nemoclaw.errors`: Number of errors (counter)

### Using Metrics in Code

**Record command execution:**

```javascript
const { recordCommandExecution } = require("./lib/metrics");

const startTime = Date.now();
try {
  // ... execute command ...
  const duration = Date.now() - startTime;
  recordCommandExecution("onboard", duration, { status: "success" });
} catch (error) {
  const duration = Date.now() - startTime;
  recordCommandExecution("onboard", duration, { status: "error", error: error.message });
}
```

**Record inference request:**

```javascript
const { recordInferenceRequest } = require("./lib/metrics");

const startTime = Date.now();
const response = await fetch(inferenceUrl, { ... });
const duration = Date.now() - startTime;

recordInferenceRequest("nvidia/nemotron-3-super-120b-a12b", duration, {
  tokens: 150,
  cached: false,
  status: response.status,
});
```

**Record sandbox operation:**

```javascript
const { recordSandboxOperation } = require("./lib/metrics");

const startTime = Date.now();
await createSandbox("my-sandbox");
const duration = Date.now() - startTime;

recordSandboxOperation("my-sandbox", "create", duration, {
  model: "nemotron",
  gpu: true,
});
```

**Record policy operation:**

```javascript
const { recordPolicyOperation } = require("./lib/metrics");

recordPolicyOperation("my-sandbox", "github", "apply", {
  endpoints: 2,
});
```

**Record errors:**

```javascript
const { recordError } = require("./lib/metrics");

try {
  // ... operation ...
} catch (error) {
  recordError("sandbox-create", error.constructor.name, {
    sandbox: "my-sandbox",
    message: error.message,
  });
  throw error;
}
```

### Timing Operations

**Using a timer:**

```javascript
const { startTimer } = require("./lib/metrics");

const timer = startTimer("nemoclaw.operation.duration", { operation: "create" });
// ... perform operation ...
const duration = timer(); // Stops timer and records metric
console.log(`Operation took ${duration}ms`);
```

**Measure async operations:**

```javascript
const { measureAsync } = require("./lib/metrics");

const result = await measureAsync("nemoclaw.database.query", async () => {
  return await db.query("SELECT * FROM users");
}, { query: "users" });
// Automatically records duration and errors
```

### Custom Metrics

**Using the metrics collector directly:**

```javascript
const { metrics } = require("./lib/metrics");

// Counter: increment by 1
metrics.counter("nemoclaw.custom.events", 1, { event_type: "signup" });

// Gauge: current value
metrics.gauge("nemoclaw.active.sandboxes", 5, { region: "us-west" });

// Histogram: duration in milliseconds
metrics.histogram("nemoclaw.operation.duration", 1500, { operation: "backup" });
```

### Metrics Backends

NemoClaw supports multiple metrics backends:

**1. Logger Backend (default):**
Writes metrics to the structured logger:

```javascript
// Metrics appear in logs as structured events
{
  "level": 30,
  "metric_type": "counter",
  "metric_name": "nemoclaw.command.executions",
  "metric_value": 1,
  "command": "onboard",
  "status": "success",
  "msg": "Counter: nemoclaw.command.executions=1"
}
```

**2. Console Backend:**
Prints metrics to console (for development):

```bash
export NEMOCLAW_METRICS_BACKEND=console
nemoclaw onboard
# Output:
# [METRIC] counter nemoclaw.command.executions=1 command=onboard status=success
# [METRIC] histogram nemoclaw.command.duration=1234ms command=onboard status=success
```

**3. Custom Backends:**
Implement custom backends for Prometheus, Datadog, etc.:

```javascript
const { MetricsBackend, metrics } = require("./lib/metrics");

class PrometheusBackend extends MetricsBackend {
  constructor(client) {
    super();
    this.client = client;
    this.counters = new Map();
    this.histograms = new Map();
  }

  counter(name, value, tags) {
    if (!this.counters.has(name)) {
      this.counters.set(name, new this.client.Counter({
        name: name.replace(/\./g, "_"),
        help: `Counter metric ${name}`,
        labelNames: Object.keys(tags),
      }));
    }
    this.counters.get(name).inc(tags, value);
  }

  histogram(name, duration, tags) {
    if (!this.histograms.has(name)) {
      this.histograms.set(name, new this.client.Histogram({
        name: name.replace(/\./g, "_"),
        help: `Histogram metric ${name}`,
        labelNames: Object.keys(tags),
      }));
    }
    this.histograms.get(name).observe(tags, duration / 1000); // Convert to seconds
  }

  gauge(name, value, tags) {
    // Similar to counter
  }
}

// Register custom backend
const promClient = require("prom-client");
metrics.registerBackend(new PrometheusBackend(promClient));
```

### Configuration

**Enable/disable metrics:**

```bash
# Disable metrics collection
export NEMOCLAW_METRICS=0

# Enable with specific backend
export NEMOCLAW_METRICS_BACKEND=console
```

**Metrics are enabled by default** and use the logger backend.

### Example: Metrics Output

**Logger backend (default):**

```bash
$ NEMOCLAW_VERBOSE=1 nemoclaw onboard

[2026-03-22 12:00:00.123] DEBUG: Executing command: onboard
    traceId: "abc-123"
    command: "onboard"

[2026-03-22 12:00:05.456] INFO: Counter: nemoclaw.command.executions=1
    metric_type: "counter"
    metric_name: "nemoclaw.command.executions"
    metric_value: 1
    command: "onboard"
    status: "success"
    trace_id: "abc-123"

[2026-03-22 12:00:05.456] INFO: Histogram: nemoclaw.command.duration=5333ms
    metric_type: "histogram"
    metric_name: "nemoclaw.command.duration"
    metric_value: 5333
    duration: 5333
    command: "onboard"
    status: "success"
    trace_id: "abc-123"
```

**Console backend:**

```bash
$ NEMOCLAW_METRICS_BACKEND=console nemoclaw onboard

[METRIC] counter nemoclaw.command.executions=1 command=onboard status=success trace_id=abc-123
[METRIC] histogram nemoclaw.command.duration=5333ms command=onboard status=success trace_id=abc-123
```

### Querying Metrics

**From logs (logger backend):**

```bash
# Find all metrics
nemoclaw onboard 2>&1 | jq 'select(.metric_type)'

# Find specific metric
nemoclaw onboard 2>&1 | jq 'select(.metric_name == "nemoclaw.command.duration")'

# Average command duration
nemoclaw onboard 2>&1 | jq -s '
  [.[] | select(.metric_name == "nemoclaw.command.duration") | .metric_value]
  | add / length
'

# Count errors
nemoclaw onboard 2>&1 | jq -s '
  [.[] | select(.metric_name == "nemoclaw.errors")] | length
'
```

### Integration with Monitoring Platforms

**Prometheus:**

1. Implement PrometheusBackend (see example above)
2. Expose metrics endpoint: `app.get("/metrics", (req, res) => res.send(register.metrics()))`
3. Configure Prometheus scraper

**Datadog:**

```javascript
const { MetricsBackend, metrics } = require("./lib/metrics");
const StatsD = require("hot-shots");

class DatadogBackend extends MetricsBackend {
  constructor() {
    super();
    this.statsd = new StatsD({
      host: process.env.DD_AGENT_HOST || "localhost",
      port: 8125,
      prefix: "nemoclaw.",
    });
  }

  counter(name, value, tags) {
    const tagArray = Object.entries(tags).map(([k, v]) => `${k}:${v}`);
    this.statsd.increment(name, value, tagArray);
  }

  histogram(name, duration, tags) {
    const tagArray = Object.entries(tags).map(([k, v]) => `${k}:${v}`);
    this.statsd.timing(name, duration, tagArray);
  }

  gauge(name, value, tags) {
    const tagArray = Object.entries(tags).map(([k, v]) => `${k}:${v}`);
    this.statsd.gauge(name, value, tagArray);
  }
}

metrics.registerBackend(new DatadogBackend());
```

**CloudWatch:**

```javascript
const { MetricsBackend, metrics } = require("./lib/metrics");
const AWS = require("aws-sdk");

class CloudWatchBackend extends MetricsBackend {
  constructor() {
    super();
    this.cloudwatch = new AWS.CloudWatch({ region: "us-west-2" });
    this.namespace = "NemoClaw";
  }

  async counter(name, value, tags) {
    await this.cloudwatch.putMetricData({
      Namespace: this.namespace,
      MetricData: [{
        MetricName: name,
        Value: value,
        Unit: "Count",
        Dimensions: Object.entries(tags).map(([Name, Value]) => ({ Name, Value: String(Value) })),
      }],
    }).promise();
  }

  // Similar for histogram and gauge
}
```

---

## Error Tracking

### Overview

NemoClaw integrates with [Sentry](https://sentry.io/) for contextualized error tracking in production. Sentry provides:

- **Full stack traces** with source maps for TypeScript
- **Breadcrumbs** showing what happened before an error
- **Trace context** integration for correlating errors with logs/metrics
- **User context** for understanding who experienced the error
- **Error grouping** and deduplication
- **Release tracking** for identifying when bugs were introduced

**Why error tracking?**
- **Production visibility**: See all errors happening in production
- **Context-rich debugging**: Full stack traces with breadcrumbs and user context
- **Prioritization**: Error frequency and user impact metrics
- **Regression detection**: Know when new errors appear
- **Source map support**: TypeScript code locations in stack traces

### Sentry Module

**Location**: `bin/lib/sentry.js`

The Sentry module provides a comprehensive integration with automatic enrichment.

### Setup

**1. Get Sentry DSN:**

Create a project at [sentry.io](https://sentry.io/) and copy your DSN from:
```
https://sentry.io/settings/[org]/projects/[project]/keys/
```

**2. Configure environment variables:**

```bash
# .env file
SENTRY_DSN=https://abc123@o123456.ingest.sentry.io/789
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=v1.2.3                # Optional: auto-detected from git
SENTRY_SAMPLE_RATE=1.0                # Optional: 0.0-1.0 (default: 1.0)
SENTRY_TRACES_SAMPLE_RATE=0.1         # Optional: 0.0-1.0 (default: 0.1)
```

**3. Sentry initializes automatically:**

Sentry is initialized at CLI startup in `bin/nemoclaw.js`. No additional setup needed.

**Opt-in**: Sentry is **disabled by default** and only activates when `SENTRY_DSN` is set.

### Automatic Error Capture

**All uncaught errors are automatically captured:**

```bash
$ nemoclaw onboard
# If an error occurs, it's automatically sent to Sentry with:
# - Full stack trace
# - Source maps (TypeScript -> JavaScript mapping)
# - Trace context (trace ID, span ID)
# - Breadcrumbs (CLI command, operations performed)
# - User context (username, hostname)
# - System context (Node.js version, platform)
```

**Every error includes:**
- **Stack trace**: Full call stack with source-mapped TypeScript locations
- **Trace context**: `trace_id`, `span_id`, `operation` from distributed tracing
- **Breadcrumbs**: Timeline of events leading to the error
- **Tags**: `command`, `trace_id`, `node_version`, `platform`
- **User**: Non-PII user identification (username, hostname)

### Manual Error Capture

**Capture exceptions explicitly:**

```javascript
const { captureException } = require("./lib/sentry");

try {
  await createSandbox(name);
} catch (error) {
  captureException(error, {
    tags: { sandbox: name, operation: "create" },
    extra: { model: "nemotron", gpu: true },
    level: "error",
  });
  throw error;
}
```

**Capture messages:**

```javascript
const { captureMessage } = require("./lib/sentry");

captureMessage("Sandbox creation failed", "warning", {
  tags: { sandbox: "my-sandbox" },
  extra: { reason: "timeout", duration: 30000 },
});
```

### Breadcrumbs

Breadcrumbs provide a timeline of events before an error:

**Automatically added:**
- CLI command execution
- (Future: Sandbox operations, inference requests)

**Add custom breadcrumbs:**

```javascript
const { addBreadcrumb } = require("./lib/sentry");

addBreadcrumb({
  category: "sandbox",
  message: "Creating sandbox",
  level: "info",
  data: { sandbox: "my-sandbox", model: "nemotron" },
});

addBreadcrumb({
  category: "inference",
  message: "Inference request started",
  level: "info",
  data: { model: "nvidia/nemotron", tokens: 150 },
});
```

**Breadcrumb timeline in Sentry:**
```
1. [cli] Executing command: onboard
2. [sandbox] Creating sandbox (sandbox=my-sandbox, model=nemotron)
3. [inference] Inference request started (model=nvidia/nemotron, tokens=150)
4. ERROR: Connection timeout
```

### Context Enrichment

**Set user context:**

```javascript
const { setUser } = require("./lib/sentry");

setUser({
  id: "user-123",
  username: "alice",
  email: "alice@example.com", // Optional, PII warning
  data: { subscription: "enterprise" },
});
```

**Set tags for filtering:**

```javascript
const { setTags } = require("./lib/sentry");

setTags({
  sandbox: "my-sandbox",
  environment: "production",
  region: "us-west",
  feature_flag: "local_inference",
});
```

**Set extra context:**

```javascript
const { setExtra } = require("./lib/sentry");

setExtra("request_payload", {
  model: "nvidia/nemotron",
  tokens: 150,
  temperature: 0.7,
});

setExtra("system_info", {
  memory: os.freemem(),
  uptime: os.uptime(),
});
```

### Source Maps

**TypeScript source maps are automatically enabled:**

The TypeScript compiler (`nemoclaw/tsconfig.json`) generates source maps:
```json
{
  "compilerOptions": {
    "sourceMap": true,
    "inlineSourceMap": false,
    "sourceRoot": "../src"
  }
}
```

**Sentry configuration:**
- Source maps are uploaded automatically with releases (future CI integration)
- Stack traces show original TypeScript code locations
- Line numbers match your source files, not compiled JavaScript

**Example stack trace in Sentry:**
```
Error: Connection timeout
  at createSandbox (nemoclaw/src/commands/onboard.ts:42:15)  ← TypeScript source
  at onboard (nemoclaw/src/cli.ts:18:5)
  at main (bin/nemoclaw.js:350:9)
```

### Performance Monitoring (Distributed Tracing)

**Sentry integrates with distributed tracing:**

```javascript
const { startTransaction } = require("./lib/sentry");

const transaction = startTransaction({
  name: "nemoclaw.onboard",
  op: "cli.command",
});

try {
  // ... perform operation ...
  transaction.setStatus("ok");
} catch (error) {
  transaction.setStatus("internal_error");
  throw error;
} finally {
  transaction.finish();
}
```

**Automatic trace correlation:**
- Sentry errors include `trace_id` from distributed tracing
- Correlate Sentry errors with logs and metrics using trace ID
- See full request timeline: logs → traces → errors → metrics

### Wrapping Functions

**Automatically capture errors from async functions:**

```javascript
const { withSentry } = require("./lib/sentry");

const createSandbox = withSentry(
  async (name) => {
    // ... create sandbox ...
  },
  { tags: { operation: "sandbox-create" } }
);

// Errors are automatically captured and re-thrown
await createSandbox("my-sandbox");
```

### Flushing Before Exit

**Ensure all errors are sent before process exit:**

```javascript
const { flushSentry } = require("./lib/sentry");

process.on("exit", async () => {
  await flushSentry(5000); // Wait up to 5 seconds
});

process.on("SIGINT", async () => {
  await flushSentry(2000);
  process.exit(0);
});
```

### Configuration Options

**Environment variables:**

| Variable | Description | Default |
|----------|-------------|---------|
| `SENTRY_DSN` | Sentry Data Source Name (required to enable) | None |
| `SENTRY_ENVIRONMENT` | Environment name | `NODE_ENV` or `development` |
| `SENTRY_RELEASE` | Release version | Auto-detected from git |
| `SENTRY_SAMPLE_RATE` | Error sampling rate (0.0-1.0) | 1.0 (all errors) |
| `SENTRY_TRACES_SAMPLE_RATE` | Performance sampling (0.0-1.0) | 0.1 (10%) |

**Check if Sentry is enabled:**

```javascript
const { isSentryEnabled } = require("./lib/sentry");

if (isSentryEnabled()) {
  console.log("Sentry error tracking is active");
}
```

### Example: Production Error

**Error in production:**
```javascript
// Code in nemoclaw/src/commands/onboard.ts
async function createSandbox(name) {
  throw new Error("Failed to connect to inference endpoint");
}
```

**What Sentry captures:**

```json
{
  "message": "Failed to connect to inference endpoint",
  "level": "error",
  "platform": "node",
  "release": "nemoclaw@abc123",
  "environment": "production",
  "user": {
    "id": "alice",
    "username": "alice"
  },
  "tags": {
    "command": "onboard",
    "trace_id": "a7f3e8d2-4b1c-4f9e-8a3d-5c2e1f4b6a9d",
    "node_version": "v20.11.0",
    "platform": "linux"
  },
  "contexts": {
    "trace": {
      "trace_id": "a7f3e8d2-4b1c-4f9e-8a3d-5c2e1f4b6a9d",
      "span_id": "abc12345",
      "operation": "onboard"
    },
    "runtime": {
      "hostname": "prod-server-1",
      "platform": "linux",
      "arch": "x64"
    }
  },
  "breadcrumbs": [
    {
      "timestamp": 1711111111,
      "category": "cli",
      "message": "Executing command: onboard",
      "level": "info",
      "data": { "command": "onboard", "trace_id": "..." }
    }
  ],
  "exception": {
    "values": [{
      "type": "Error",
      "value": "Failed to connect to inference endpoint",
      "stacktrace": {
        "frames": [
          {
            "filename": "nemoclaw/src/commands/onboard.ts",
            "function": "createSandbox",
            "lineno": 42,
            "colno": 15
          }
        ]
      }
    }]
  }
}
```

### Best Practices

**1. Don't log PII in context:**

❌ **Bad**:
```javascript
setExtra("email", user.email);
setExtra("ip_address", req.ip);
```

✅ **Good**:
```javascript
setExtra("user_id", user.id);
setExtra("region", user.region);
```

**2. Add breadcrumbs for debugging:**

```javascript
addBreadcrumb({ category: "sandbox", message: "Creating sandbox", data: { name } });
addBreadcrumb({ category: "inference", message: "Sending request", data: { model } });
```

**3. Use meaningful tags:**

```javascript
captureException(error, {
  tags: {
    operation: "sandbox-create",
    provider: "nvidia-cloud",
    model: "nemotron",
  },
});
```

**4. Set context before errors:**

```javascript
setTags({ sandbox: name, model: "nemotron" });
setExtra("config", sandboxConfig);
// Now all subsequent errors include this context
```

---

## Alerting

### Overview

Alerting ensures teams are notified when NemoClaw experiences issues. This section documents recommended alert rules and integration with incident management platforms.

**Why alerting?**
- **Proactive detection**: Know about issues before users report them
- **Rapid response**: Immediate notification enables faster resolution
- **SLA protection**: Meet uptime commitments with early warning
- **On-call efficiency**: Alert on-call engineers only when action is needed

### Alert Rules

**Recommended alerts for NemoClaw:**

#### Critical Alerts (Page On-Call)

**1. High Error Rate**
```yaml
name: NemoClaw High Error Rate
severity: critical
condition: error_rate > 10/minute for 5 minutes
query: |
  # Prometheus
  rate(nemoclaw_errors_total{env="production"}[5m]) > 10/60

  # Datadog
  avg(last_5m):avg:nemoclaw.errors{env:production}.as_rate() > 0.16

  # CloudWatch
  SELECT COUNT(*) FROM Logs WHERE level='error' | COUNT > 50
notification: PagerDuty, Slack #nemoclaw-critical
runbook: https://docs.example.com/runbooks#high-error-rate
```

**2. Service Down**
```yaml
name: NemoClaw Service Down
severity: critical
condition: no metrics received for 5 minutes
query: |
  # Prometheus
  absent(up{service="nemoclaw"}) == 1

  # Datadog
  avg(last_5m):avg:nemoclaw.command.executions{env:production}.as_count() < 1
notification: PagerDuty, Slack #nemoclaw-critical
runbook: https://docs.example.com/runbooks#service-down
```

**3. Inference API Unavailable**
```yaml
name: NemoClaw Inference API Down
severity: critical
condition: inference_success_rate < 50% for 5 minutes
query: |
  # Prometheus
  sum(rate(nemoclaw_inference_requests_total{status="success"}[5m]))
  / sum(rate(nemoclaw_inference_requests_total[5m])) < 0.5

  # Datadog
  (sum:nemoclaw.inference.requests{status:success}.as_rate()
  / sum:nemoclaw.inference.requests{*}.as_rate()) < 0.5
notification: PagerDuty, Slack #nemoclaw-critical
runbook: https://docs.example.com/runbooks#inference-api-down
```

#### Warning Alerts (Notify Channel)

**4. Elevated Error Rate**
```yaml
name: NemoClaw Elevated Errors
severity: warning
condition: error_rate > 5/minute for 10 minutes
query: |
  # Prometheus
  rate(nemoclaw_errors_total{env="production"}[5m]) > 5/60

  # Datadog
  avg(last_10m):avg:nemoclaw.errors{env:production}.as_rate() > 0.083
notification: Slack #nemoclaw-alerts
runbook: https://docs.example.com/runbooks#elevated-errors
```

**5. High Latency**
```yaml
name: NemoClaw High Latency
severity: warning
condition: p95_latency > 5 seconds for 10 minutes
query: |
  # Prometheus
  histogram_quantile(0.95,
    rate(nemoclaw_command_duration_bucket[5m])
  ) > 5

  # Datadog
  avg(last_10m):p95:nemoclaw.command.duration{env:production} > 5000
notification: Slack #nemoclaw-alerts
runbook: https://docs.example.com/runbooks#high-latency
```

**6. High Memory Usage**
```yaml
name: NemoClaw High Memory
severity: warning
condition: memory_usage > 80% for 15 minutes
query: |
  # Prometheus
  container_memory_usage_bytes{container="nemoclaw"}
  / container_spec_memory_limit_bytes{container="nemoclaw"} > 0.8

  # Datadog
  avg(last_15m):avg:docker.mem.in_use{container_name:nemoclaw} > 0.8
notification: Slack #nemoclaw-alerts
runbook: https://docs.example.com/runbooks#high-memory
```

#### Informational Alerts

**7. Deployment Notification**
```yaml
name: NemoClaw Deployment
severity: info
condition: new deployment detected
query: deployment event
notification: Slack #nemoclaw-deploys
```

**8. New Error Type**
```yaml
name: NemoClaw New Error Type
severity: info
condition: new error type in Sentry
query: Sentry first_seen event
notification: Slack #nemoclaw-errors
runbook: https://docs.example.com/runbooks#new-errors
```

### Alert Configuration

#### PagerDuty Integration

**1. Create PagerDuty service:**
```bash
# Via PagerDuty UI
# 1. Go to https://[your-org].pagerduty.com/services
# 2. Click "New Service"
# 3. Name: NemoClaw Production
# 4. Escalation Policy: On-Call Engineers
# 5. Copy Integration Key
```

**2. Configure alert routing:**

**Datadog → PagerDuty:**
```bash
# In Datadog UI
# 1. Integrations → PagerDuty → Configuration
# 2. Add Service: NemoClaw Production
# 3. Service Key: [integration-key]
# 4. In Monitor, set: "@pagerduty-NemoClaw-Production"
```

**Prometheus Alertmanager → PagerDuty:**
```yaml
# alertmanager.yml
receivers:
  - name: 'pagerduty-nemoclaw'
    pagerduty_configs:
      - service_key: '<integration-key>'
        description: '{{ .CommonAnnotations.summary }}'
        details:
          firing: '{{ .Alerts.Firing | len }}'
          resolved: '{{ .Alerts.Resolved | len }}'

route:
  receiver: 'pagerduty-nemoclaw'
  routes:
    - match:
        severity: critical
      receiver: 'pagerduty-nemoclaw'
      continue: true
```

**Sentry → PagerDuty:**
```bash
# In Sentry UI
# 1. Settings → Integrations → PagerDuty
# 2. Add Installation
# 3. Map severity levels to PagerDuty priorities
```

**3. Test PagerDuty integration:**
```bash
# Trigger test alert
curl -X POST https://events.pagerduty.com/v2/enqueue \
  -H "Content-Type: application/json" \
  -d '{
    "routing_key": "<integration-key>",
    "event_action": "trigger",
    "payload": {
      "summary": "NemoClaw Test Alert",
      "severity": "warning",
      "source": "nemoclaw-test"
    }
  }'
```

#### OpsGenie Integration

**1. Create OpsGenie integration:**
```bash
# Via OpsGenie UI
# 1. Go to Settings → Integrations
# 2. Add Integration → API
# 3. Name: NemoClaw
# 4. Copy API Key
```

**2. Configure alert routing:**

**Datadog → OpsGenie:**
```bash
# In Datadog UI
# 1. Integrations → Opsgenie → Configuration
# 2. API Key: [your-api-key]
# 3. In Monitor: "@opsgenie-NemoClaw"
```

**Prometheus Alertmanager → OpsGenie:**
```yaml
# alertmanager.yml
receivers:
  - name: 'opsgenie-nemoclaw'
    opsgenie_configs:
      - api_key: '<api-key>'
        message: '{{ .CommonAnnotations.summary }}'
        description: '{{ .CommonAnnotations.description }}'
        priority: '{{ .CommonLabels.severity }}'

route:
  routes:
    - match:
        severity: critical
      receiver: 'opsgenie-nemoclaw'
```

**3. Test OpsGenie integration:**
```bash
# Trigger test alert
curl -X POST https://api.opsgenie.com/v2/alerts \
  -H "Authorization: GenieKey <api-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "NemoClaw Test Alert",
    "description": "Testing alert integration",
    "priority": "P3"
  }'
```

#### Slack Integration

**For non-critical alerts:**

```bash
# Create Slack webhook
# 1. Go to https://api.slack.com/apps
# 2. Create App → Incoming Webhooks
# 3. Activate → Add to Workspace
# 4. Select channel: #nemoclaw-alerts
# 5. Copy Webhook URL
```

**Datadog → Slack:**
```bash
# In monitor notification:
@slack-nemoclaw-alerts Error rate elevated
```

**Prometheus Alertmanager → Slack:**
```yaml
receivers:
  - name: 'slack-nemoclaw'
    slack_configs:
      - api_url: '<webhook-url>'
        channel: '#nemoclaw-alerts'
        title: '{{ .CommonAnnotations.summary }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
```

### Alert Best Practices

**1. Alert on symptoms, not causes:**
- ✅ Good: "Error rate > 10/min" (symptom)
- ❌ Bad: "Disk usage > 80%" (cause, unless it directly impacts users)

**2. Make alerts actionable:**
- Every alert should have a clear action
- Include runbook links in notifications
- Provide context (traces, logs, dashboards)

**3. Reduce alert fatigue:**
- Only page for critical issues
- Use warning alerts for informational issues
- Set appropriate thresholds and durations
- Implement alert grouping and deduplication

**4. Test alerts regularly:**
```bash
# Monthly: Trigger test alert
# Verify: Notification received, runbook accessible, escalation works
```

**5. Alert thresholds:**
```yaml
Critical (Page):
  - Error rate > 10/minute for 5 minutes
  - Latency p95 > 10s for 5 minutes
  - Success rate < 50% for 5 minutes

Warning (Notify):
  - Error rate > 5/minute for 10 minutes
  - Latency p95 > 5s for 10 minutes
  - Memory usage > 80% for 15 minutes

Info (Log):
  - New deployment
  - New error type
  - Configuration change
```

### Example Alert Definitions

**Datadog Monitor:**
```json
{
  "name": "NemoClaw High Error Rate",
  "type": "metric alert",
  "query": "avg(last_5m):avg:nemoclaw.errors{env:production}.as_rate() > 0.16",
  "message": "{{#is_alert}}🚨 Critical{{/is_alert}} NemoClaw error rate is {{value}} errors/sec\n\nRunbook: https://docs.example.com/runbooks#high-error-rate\nDashboard: https://app.datadoghq.com/dashboard/[id]\n\n@pagerduty-NemoClaw @slack-nemoclaw-critical",
  "tags": ["service:nemoclaw", "env:production"],
  "options": {
    "notify_no_data": true,
    "no_data_timeframe": 10,
    "notify_audit": true,
    "require_full_window": false,
    "thresholds": {
      "critical": 0.16,
      "warning": 0.083
    }
  }
}
```

**Prometheus Alert Rule:**
```yaml
groups:
  - name: nemoclaw
    interval: 30s
    rules:
      - alert: NemoClawHighErrorRate
        expr: rate(nemoclaw_errors_total{env="production"}[5m]) > 10/60
        for: 5m
        labels:
          severity: critical
          service: nemoclaw
        annotations:
          summary: "NemoClaw high error rate"
          description: "Error rate is {{ $value }} errors/sec (threshold: 0.16/sec)"
          runbook_url: "https://docs.example.com/runbooks#high-error-rate"
          dashboard_url: "https://grafana.example.com/d/nemoclaw"

      - alert: NemoClawHighLatency
        expr: histogram_quantile(0.95, rate(nemoclaw_command_duration_bucket[5m])) > 5
        for: 10m
        labels:
          severity: warning
          service: nemoclaw
        annotations:
          summary: "NemoClaw high latency"
          description: "p95 latency is {{ $value }}s (threshold: 5s)"
          runbook_url: "https://docs.example.com/runbooks#high-latency"
```

**CloudWatch Alarm:**
```bash
# Create CloudWatch alarm via CLI
aws cloudwatch put-metric-alarm \
  --alarm-name nemoclaw-high-error-rate \
  --alarm-description "NemoClaw error rate exceeded threshold" \
  --metric-name Errors \
  --namespace NemoClaw \
  --statistic Sum \
  --period 300 \
  --threshold 50 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --alarm-actions arn:aws:sns:us-east-1:123456789:nemoclaw-critical
```

### Alert Documentation Template

**For each alert, document:**

```markdown
## Alert: [Name]

**Severity:** [Critical/Warning/Info]  
**Condition:** [When does it fire?]  
**Impact:** [What's the user impact?]  
**Runbook:** [Link to resolution steps]  
**Notifications:** [Who gets notified?]

**False Positive Scenarios:**
- [Scenario 1]
- [Scenario 2]

**Resolution:**
1. [Step 1]
2. [Step 2]

**Prevention:**
- [How to prevent in future]
```

---

## Deployment Observability

### Overview

Deployment observability enables teams to see the impact of deployments in real-time. This section documents how to set up monitoring dashboards and deploy notifications for NemoClaw.

**Why deployment observability?**
- **Instant feedback**: See deployment impact within seconds
- **Rapid rollback**: Detect issues immediately and rollback if needed
- **Confidence**: Deploy with confidence knowing you can monitor impact
- **Correlation**: Connect deployments to error spikes, performance changes
- **Learning**: Understand which changes affect which metrics

### Monitoring Dashboards

#### Recommended Dashboard Platforms

**1. Datadog**

Create a NemoClaw deployment dashboard at:
```
https://app.datadoghq.com/dashboard/lists
```

**Recommended widgets:**
- **Error Rate**: `nemoclaw.errors` metric over time
- **Command Duration**: `nemoclaw.command.duration` p50/p95/p99 percentiles
- **Inference Latency**: `nemoclaw.inference.latency` percentiles
- **Active Sandboxes**: `nemoclaw.sandbox.operations` count
- **Deployment Markers**: Vertical lines for each deployment

**Example Datadog query:**
```sql
avg:nemoclaw.command.duration{env:production} by {command}
```

**Dashboard URL format:**
```
https://app.datadoghq.com/dashboard/[dashboard-id]
```

**2. Grafana**

Create a NemoClaw dashboard at your Grafana instance:
```
https://grafana.example.com/dashboards
```

**Recommended panels:**
- **Error Rate**: Prometheus query `rate(nemoclaw_errors_total[5m])`
- **Command Throughput**: `rate(nemoclaw_command_executions_total[5m])`
- **Latency Heatmap**: `nemoclaw_command_duration_bucket`
- **Trace Volume**: `count(traces{service="nemoclaw"})`
- **Log Errors**: `count_over_time({app="nemoclaw",level="error"}[5m])`

**Example Prometheus query:**
```promql
histogram_quantile(0.95,
  rate(nemoclaw_command_duration_bucket[5m])
)
```

**Dashboard URL format:**
```
https://grafana.example.com/d/[dashboard-id]/nemoclaw-deployment
```

**3. New Relic**

Create a custom dashboard at:
```
https://one.newrelic.com/dashboards
```

**NRQL queries:**
```sql
-- Error rate
SELECT count(*) FROM Log WHERE app.name = 'nemoclaw' AND level = 'error' TIMESERIES

-- Command duration
SELECT percentile(duration, 50, 95, 99) FROM Transaction
WHERE appName = 'nemoclaw' FACET command TIMESERIES

-- Deployment impact
SELECT count(*) FROM Deployment WHERE appName = 'nemoclaw' TIMESERIES
```

**4. CloudWatch**

Create a NemoClaw dashboard in AWS Console:
```
https://console.aws.amazon.com/cloudwatch/home#dashboards:
```

**Recommended metrics:**
- **Custom Metrics**: `NemoClaw/CommandDuration`, `NemoClaw/Errors`
- **Lambda Metrics** (if applicable): Duration, Errors, Throttles
- **ECS Metrics** (if applicable): CPUUtilization, MemoryUtilization
- **Log Insights Queries**: Parse structured logs for error rates

**Example CloudWatch Insights query:**
```sql
fields @timestamp, level, msg, command, duration
| filter level = "error" or level = "fatal"
| stats count() by bin(5m)
```

#### Creating Your Dashboard

**Minimum viable dashboard should include:**

1. **Error Rate**: Errors per minute (from `nemoclaw.errors` metric or error logs)
2. **Command Duration**: p50/p95/p99 latencies (from `nemoclaw.command.duration` metric)
3. **Throughput**: Commands per minute (from `nemoclaw.command.executions` counter)
4. **Deployment Markers**: Vertical lines showing when deployments happened
5. **Recent Errors**: Top 10 errors from Sentry or logs

**Example dashboard layout:**
```
┌─────────────────────────────────────────────────────────┐
│ NemoClaw Production Deployment Dashboard               │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────┐ ┌─────────────────┐ ┌────────────┐ │
│ │ Error Rate      │ │ Command P95     │ │ Throughput │ │
│ │ 2.3/min ↓ 15%   │ │ 1.2s ↑ 5%      │ │ 45/min     │ │
│ └─────────────────┘ └─────────────────┘ └────────────┘ │
├─────────────────────────────────────────────────────────┤
│ ┌───────────────────────────────────────────────────────┐│
│ │ Command Duration Over Time (with deployment markers) ││
│ │     ▲                                                ││
│ │ 2s  │      *     Deploy                             ││
│ │     │     * *      ↓                                ││
│ │ 1s  │ * *     * *  |  * *                          ││
│ │     │              |      * *                       ││
│ │     └──────────────┴─────────────────────────────> ││
│ └───────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────┤
│ ┌────────────────┐ ┌──────────────────────────────────┐ │
│ │ Recent Errors  │ │ Top Commands by Duration         │ │
│ │ 1. Timeout (5) │ │ 1. onboard (1.8s)               │ │
│ │ 2. Connect (3) │ │ 2. deploy (1.2s)                │ │
│ └────────────────┘ └──────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Deployment Markers

**Annotate deployments in monitoring dashboards:**

**Datadog:**
```bash
# Send deployment event
curl -X POST "https://api.datadoghq.com/api/v1/events" \
  -H "DD-API-KEY: ${DD_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "NemoClaw deployed",
    "text": "Version v1.2.3 deployed to production",
    "tags": ["service:nemoclaw", "env:production", "version:v1.2.3"],
    "alert_type": "info"
  }'
```

**New Relic:**
```bash
# Record deployment
curl -X POST "https://api.newrelic.com/v2/applications/${APP_ID}/deployments.json" \
  -H "X-Api-Key: ${NEW_RELIC_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "deployment": {
      "revision": "abc123",
      "changelog": "v1.2.3 release",
      "description": "Feature flag infrastructure added",
      "user": "github-actions"
    }
  }'
```

**Grafana (via annotations):**
```bash
# Create annotation
curl -X POST "https://grafana.example.com/api/annotations" \
  -H "Authorization: Bearer ${GRAFANA_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Deployed v1.2.3",
    "tags": ["deployment", "nemoclaw"],
    "time": '$(date +%s000)'
  }'
```

### Deploy Notifications

#### Slack Integration

**1. Create incoming webhook:**
- Go to https://api.slack.com/apps
- Create app → Incoming Webhooks → Add New Webhook to Workspace
- Copy webhook URL

**2. Send deployment notification:**

```bash
# In GitHub Actions workflow or deployment script
curl -X POST "$SLACK_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "text": ":rocket: NemoClaw deployed to production",
    "blocks": [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": "*NemoClaw Deployment* :rocket:\n*Version:* v1.2.3\n*Environment:* production\n*Status:* Success :white_check_mark:"
        }
      },
      {
        "type": "section",
        "fields": [
          {
            "type": "mrkdwn",
            "text": "*Commit:* abc123"
          },
          {
            "type": "mrkdwn",
            "text": "*By:* github-actions"
          }
        ]
      },
      {
        "type": "actions",
        "elements": [
          {
            "type": "button",
            "text": {
              "type": "plain_text",
              "text": "View Dashboard"
            },
            "url": "https://app.datadoghq.com/dashboard/[id]"
          },
          {
            "type": "button",
            "text": {
              "type": "plain_text",
              "text": "View Errors"
            },
            "url": "https://sentry.io/organizations/[org]/issues/"
          }
        ]
      }
    ]
  }'
```

**3. Example GitHub Actions integration:**

```yaml
# .github/workflows/deploy-notify.yml
name: Deploy Notification

on:
  deployment_status:

jobs:
  notify:
    runs-on: ubuntu-latest
    if: github.event.deployment_status.state == 'success'
    steps:
      - name: Send Slack notification
        env:
          SLACK_WEBHOOK: ${{ secrets.SLACK_WEBHOOK_URL }}
        run: |
          curl -X POST "$SLACK_WEBHOOK" \
            -H "Content-Type: application/json" \
            -d "{
              \"text\": \":rocket: NemoClaw deployed to ${{ github.event.deployment.environment }}\",
              \"attachments\": [{
                \"color\": \"good\",
                \"fields\": [
                  {\"title\": \"Version\", \"value\": \"${{ github.ref_name }}\", \"short\": true},
                  {\"title\": \"Environment\", \"value\": \"${{ github.event.deployment.environment }}\", \"short\": true}
                ]
              }]
            }"
```

#### Discord Integration

**Webhook format:**
```bash
curl -X POST "$DISCORD_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "🚀 **NemoClaw deployed to production**",
    "embeds": [{
      "title": "Deployment v1.2.3",
      "description": "Feature flag infrastructure added",
      "color": 3066993,
      "fields": [
        {"name": "Environment", "value": "production", "inline": true},
        {"name": "Commit", "value": "abc123", "inline": true},
        {"name": "Dashboard", "value": "[View Metrics](https://grafana.example.com/d/nemoclaw)"}
      ]
    }]
  }'
```

#### Microsoft Teams Integration

**Webhook format:**
```bash
curl -X POST "$TEAMS_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    "themeColor": "0076D7",
    "summary": "NemoClaw Deployment",
    "sections": [{
      "activityTitle": "🚀 NemoClaw deployed to production",
      "activitySubtitle": "Version v1.2.3",
      "facts": [
        {"name": "Environment", "value": "production"},
        {"name": "Commit", "value": "abc123"},
        {"name": "Status", "value": "Success ✅"}
      ],
      "markdown": true
    }],
    "potentialAction": [{
      "@type": "OpenUri",
      "name": "View Dashboard",
      "targets": [{
        "os": "default",
        "uri": "https://app.datadoghq.com/dashboard/[id]"
      }]
    }]
  }'
```

### Querying Deployment Impact

#### Using Logs

**Check error rate after deployment:**
```bash
# Get errors in last 15 minutes
nemoclaw <command> 2>&1 | \
  jq -s '[.[] | select(.level >= 50 and .time > "'$(date -u -d '15 minutes ago' +%Y-%m-%dT%H:%M:%S)'")]' | \
  jq 'length'

# Compare to previous 15 minutes
# If error count increased significantly, consider rollback
```

**Check command duration:**
```bash
# Average duration since deployment
nemoclaw <command> 2>&1 | \
  jq -s '[.[] | select(.metric_name == "nemoclaw.command.duration" and .time > "'$(date -u -d '15 minutes ago' +%Y-%m-%dT%H:%M:%S)'") | .metric_value] | add / length'
```

#### Using Metrics

**Query Datadog:**
```python
from datadog import api

# Get average error rate before and after deployment
deployment_time = "2026-03-22T12:00:00"

before = api.Metric.query(
    start=deployment_time - 900,  # 15 min before
    end=deployment_time,
    query="avg:nemoclaw.errors{env:production}.as_count()"
)

after = api.Metric.query(
    start=deployment_time,
    end=deployment_time + 900,  # 15 min after
    query="avg:nemoclaw.errors{env:production}.as_count()"
)

if after['series'][0]['pointlist'][-1][1] > before['series'][0]['pointlist'][-1][1] * 1.5:
    print("⚠️  Error rate increased by 50%+ - consider rollback")
```

**Query Prometheus:**
```promql
# Error rate increase after deployment
(
  rate(nemoclaw_errors_total{env="production"}[5m] @ end())
  -
  rate(nemoclaw_errors_total{env="production"}[5m] @ start())
) / rate(nemoclaw_errors_total{env="production"}[5m] @ start()) * 100
```

#### Using Sentry

**Check for new errors:**
```bash
# List errors since deployment
curl "https://sentry.io/api/0/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/issues/" \
  -H "Authorization: Bearer ${SENTRY_AUTH_TOKEN}" \
  -G \
  --data-urlencode "query=firstSeen:>$(date -u -d '15 minutes ago' +%Y-%m-%dT%H:%M:%S)" \
  | jq '.[] | {title: .title, count: .count}'
```

### Rollback Procedures

**If deployment causes issues:**

**1. Check metrics/errors:**
```bash
# Quick health check
make status                           # Show sandbox status
nemoclaw list                         # Show all sandboxes
nemoclaw <sandbox> logs --follow      # Check for errors
```

**2. View deployment impact:**
- Open monitoring dashboard
- Check error rate (should be flat or declining)
- Check command duration (should be stable or improving)
- Check Sentry for new error types

**3. Rollback if needed:**
```bash
# Rollback to previous release
git checkout v1.2.2
npm install
npm run build
# Redeploy
```

**4. Notify team:**
```bash
curl -X POST "$SLACK_WEBHOOK_URL" \
  -d '{"text": "⚠️ Rolled back NemoClaw to v1.2.2 due to elevated error rate"}'
```

### Monitoring Dashboard Links

**Add dashboard links to your organization's documentation:**

**Example documentation section:**

```markdown
## NemoClaw Monitoring

**Production Dashboards:**
- [Datadog: NemoClaw Overview](https://app.datadoghq.com/dashboard/[id])
- [Grafana: NemoClaw Performance](https://grafana.example.com/d/[id])
- [Sentry: Error Tracking](https://sentry.io/organizations/[org]/projects/nemoclaw/)

**Deploy Notifications:**
- Slack: #nemoclaw-deploys
- Email: nemoclaw-alerts@example.com

**On-Call:**
- PagerDuty: [NemoClaw Service](https://example.pagerduty.com/services/[id])
```

**Add to README.md:**
```markdown
## Monitoring

Production monitoring dashboards:
- **Metrics**: [Datadog Dashboard](https://app.datadoghq.com/dashboard/[your-dashboard-id])
- **Errors**: [Sentry Project](https://sentry.io/organizations/[org]/projects/nemoclaw/)
- **Logs**: [CloudWatch Logs](https://console.aws.amazon.com/cloudwatch/logs)

Deploy notifications go to `#nemoclaw-deploys` Slack channel.
```

### Best Practices

**1. Monitor key metrics:**
- Error rate (errors per minute)
- Command duration (p50, p95, p99)
- Throughput (commands per minute)
- Sandbox operations (creates, starts, stops)

**2. Set up alerts:**
- Error rate > 5/min
- p95 latency > 5s
- Deployment failure rate > 10%

**3. Deployment checklist:**
- [ ] Monitor error rate for 15 minutes post-deploy
- [ ] Check Sentry for new error types
- [ ] Verify command duration hasn't regressed
- [ ] Send deploy notification to Slack
- [ ] Add deployment marker to dashboards

**4. Document dashboard URLs:**
- Add links to README.md
- Add to AGENTS.md for autonomous agents
- Pin dashboards in Slack channel topic
- Include in on-call runbooks

---

## Log Aggregation

### Parsing JSON Logs

**Using jq** (filter logs):
```bash
# Show only error logs
nemoclaw onboard 2>&1 | jq 'select(.level >= 50)'

# Extract specific fields
nemoclaw onboard 2>&1 | jq '{time, level, msg, sandbox}'

# Filter by sandbox name
nemoclaw onboard 2>&1 | jq 'select(.sandbox == "my-sandbox")'
```

**Using pino CLI** (pretty print JSON):
```bash
npm install -g pino-pretty
nemoclaw onboard 2>&1 | pino-pretty
```

### Integration with Log Systems

**Datadog**:
```bash
# JSON logs can be parsed by Datadog agent
NODE_ENV=production nemoclaw onboard >> /var/log/nemoclaw.log
```

**CloudWatch**:
```bash
# Stream JSON logs to CloudWatch
NODE_ENV=production nemoclaw onboard | aws logs put-log-events ...
```

**Splunk**:
```bash
# Splunk automatically parses JSON logs
NODE_ENV=production nemoclaw onboard >> /var/log/nemoclaw.log
```

---

## Best Practices

### For Developers

**1. Record metrics for all significant operations:**

✅ **Good**:
```javascript
const { recordSandboxOperation, startTimer } = require("./lib/metrics");

const timer = startTimer("nemoclaw.sandbox.create", { model: "nemotron" });
await createSandbox(name);
timer(); // Records duration automatically
```

❌ **Bad**:
```javascript
// No metrics - performance issues won't be visible
await createSandbox(name);
```

**2. Use meaningful tags:**

✅ **Good**:
```javascript
recordInferenceRequest(model, duration, {
  tokens: 150,
  cached: false,
  provider: "nvidia-cloud",
  status: "success",
});
```

❌ **Bad**:
```javascript
// No tags - can't filter or aggregate metrics
recordInferenceRequest(model, duration);
```

**3. Record both success and failure:**

✅ **Good**:
```javascript
try {
  await operation();
  recordCommandExecution("deploy", duration, { status: "success" });
} catch (error) {
  recordCommandExecution("deploy", duration, { status: "error" });
  recordError("deploy", error.constructor.name, { message: error.message });
  throw error;
}
```

**4. Trace context is automatic - don't override it:**

✅ **Good**:
```javascript
// Trace context is added automatically via logger mixin
logger.info({ sandbox: "my-sandbox" }, "Sandbox started");
```

❌ **Bad**:
```javascript
// Don't manually add traceId - it's already included
logger.info({ traceId: someValue, sandbox: "my-sandbox" }, "Sandbox started");
```

**2. Use runWithTraceContext for major operations:**

✅ **Good**:
```javascript
async function createSandbox(name) {
  await runWithTraceContext("sandbox-create", async () => {
    // All logs in here automatically get the right trace context
    logger.info({ sandbox: name }, "Creating sandbox");
  }, { sandbox: name });
}
```

**3. Propagate trace headers to HTTP requests:**

✅ **Good**:
```javascript
const headers = {
  "Authorization": `Bearer ${token}`,
  ...getTraceHeaders(),  // Propagates trace context
};
await fetch(url, { method: "POST", headers, body });
```

❌ **Bad**:
```javascript
// Missing trace headers - downstream service can't correlate logs
await fetch(url, { method: "POST", body });
```

**4. Use structured fields, not string interpolation:**

❌ **Bad**:
```javascript
logger.info(`Sandbox ${sandboxName} started with model ${model}`);
```

✅ **Good**:
```javascript
logger.info({ sandbox: sandboxName, model }, "Sandbox started");
```

**Why**: Structured fields are searchable and filterable in log aggregation systems.

**2. Include operation context:**

❌ **Bad**:
```javascript
logger.info("Connection failed");
```

✅ **Good**:
```javascript
logger.error({
  sandbox: "my-sandbox",
  endpoint: "inference.local",
  retries: 3,
}, "Connection failed after retries");
```

**3. Use child loggers for components:**

❌ **Bad**:
```javascript
logger.info({ component: "nim", ... }, "Message");
logger.info({ component: "nim", ... }, "Another message");
```

✅ **Good**:
```javascript
const nimLogger = createLogger({ component: "nim" });
nimLogger.info("Message");
nimLogger.info("Another message");
```

**4. Log errors with full context:**

```javascript
logger.error({
  err: error,            // Always include the error object
  sandbox: "my-sandbox", // Operation context
  operation: "start",    // What was being done
  retries: 3,            // Relevant state
}, "Failed to start sandbox");
```

### For Autonomous Agents

**When debugging issues**:
1. Enable verbose logging: `export NEMOCLAW_VERBOSE=1`
2. **Get the trace ID**: Extract `traceId` from first log to track the entire request
3. **Filter by trace ID**: `jq 'select(.traceId == "...")'` to see all logs for that request
4. **Check metrics**: Filter logs by `metric_type` to see performance data
5. Look for `level >= 40` (warnings and errors) in JSON logs
6. Filter by `sandbox` or `operation` to track specific workflows
7. Check `err.stack` for full stack traces
8. **Find slow operations**: Look for high `duration` values in histogram metrics
9. **Check error rates**: Count metrics with `metric_name == "nemoclaw.errors"`

**When contributing code**:
1. Use the logger module instead of `console.log`
2. Add structured fields for searchability
3. **Wrap major operations** in `runWithTraceContext()` for tracing
4. **Add trace headers** to HTTP requests with `getTraceHeaders()`
5. **Record metrics** for all significant operations (commands, inference, sandboxes)
6. **Use `measureAsync()` or `startTimer()`** for automatic duration tracking
7. Log operation start/success/failure for trackability
8. Never log sensitive data (API keys, tokens, passwords)

**Log searching**:
```bash
# Find all errors
nemoclaw onboard 2>&1 | jq 'select(.level >= 50)'

# Find all logs for a specific trace (end-to-end request)
nemoclaw onboard 2>&1 | jq 'select(.traceId == "a7f3e8d2-4b1c-4f9e-8a3d-5c2e1f4b6a9d")'

# Find all metrics
nemoclaw onboard 2>&1 | jq 'select(.metric_type)'

# Find specific metric (command duration)
nemoclaw onboard 2>&1 | jq 'select(.metric_name == "nemoclaw.command.duration")'

# Calculate average command duration
nemoclaw onboard 2>&1 | jq -s '[.[] | select(.metric_name == "nemoclaw.command.duration") | .metric_value] | add / length'

# Count total errors
nemoclaw onboard 2>&1 | jq -s '[.[] | select(.metric_name == "nemoclaw.errors")] | length'

# Find sandbox-specific logs
nemoclaw onboard 2>&1 | jq 'select(.sandbox == "my-sandbox")'

# Track an operation
nemoclaw onboard 2>&1 | jq 'select(.traceOperation == "sandbox-create")'

# Find inference requests
nemoclaw onboard 2>&1 | jq 'select(.type == "inference")'

# Show operation timeline with durations
nemoclaw onboard 2>&1 | jq -s 'sort_by(.time) | .[] | {time, operation: .traceOperation, duration, phase}'

# Find slow operations (> 1 second)
nemoclaw onboard 2>&1 | jq 'select(.duration > 1000)'
```

---

## References

**Structured Logging:**
- [pino Documentation](https://getpino.io/)
- [pino Best Practices](https://getpino.io/#/docs/best-practices)
- [Structured Logging](https://www.thoughtworks.com/radar/techniques/structured-logging)
- [Logging Levels](https://sematext.com/blog/logging-levels/)

**Distributed Tracing:**
- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [Distributed Tracing Concepts](https://opentelemetry.io/docs/concepts/observability-primer/#distributed-tracing)
- [W3C Trace Context](https://www.w3.org/TR/trace-context/)
- [Datadog APM](https://docs.datadoghq.com/tracing/)

**Metrics Collection:**
- [Prometheus Best Practices](https://prometheus.io/docs/practices/naming/)
- [Datadog Metrics Guide](https://docs.datadoghq.com/metrics/)
- [StatsD Protocol](https://github.com/statsd/statsd/blob/master/docs/metric_types.md)
- [CloudWatch Metrics](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/working_with_metrics.html)
- [OpenTelemetry Metrics](https://opentelemetry.io/docs/concepts/signals/metrics/)

**Error Tracking:**
- [Sentry Documentation](https://docs.sentry.io/)
- [Sentry Node.js SDK](https://docs.sentry.io/platforms/node/)
- [Source Maps in Sentry](https://docs.sentry.io/platforms/javascript/sourcemaps/)
- [Sentry Breadcrumbs](https://docs.sentry.io/platforms/node/enriching-events/breadcrumbs/)
- [Sentry Context](https://docs.sentry.io/platforms/node/enriching-events/context/)

**Deployment Observability:**
- [Datadog Deployment Tracking](https://docs.datadoghq.com/tracing/deployment_tracking/)
- [Grafana Annotations](https://grafana.com/docs/grafana/latest/dashboards/build-dashboards/annotate-visualizations/)
- [New Relic Deployments](https://docs.newrelic.com/docs/apm/new-relic-apm/maintenance/record-monitor-deployments/)
- [Slack Incoming Webhooks](https://api.slack.com/messaging/webhooks)

**Alerting:**
- [PagerDuty Integration](https://www.pagerduty.com/docs/guides/datadog-integration-guide/)
- [OpsGenie Integration](https://support.atlassian.com/opsgenie/docs/integrate-opsgenie-with-prometheus/)
- [Prometheus Alerting](https://prometheus.io/docs/alerting/latest/overview/)
- [Datadog Monitors](https://docs.datadoghq.com/monitors/)
- [CloudWatch Alarms](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/AlarmThatSendsEmail.html)

**Incident Response:**
- **Runbooks**: [docs/runbooks.md](../runbooks.md)
- Comprehensive incident response playbooks for production operations
- Covers sandbox, inference, deployment, performance, and security incidents

---

**Last Updated**: 2026-03-22  
**For Questions**: See AGENTS.md or open a GitHub issue
