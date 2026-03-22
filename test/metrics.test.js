// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert");
const {
  metrics,
  InMemoryMetricsBackend,
  recordCommandExecution,
  recordInferenceRequest,
  recordSandboxOperation,
  recordError,
  startTimer,
  measureAsync,
} = require("../bin/lib/metrics");

describe("Metrics Collection", () => {
  let backend;

  beforeEach(() => {
    // Use in-memory backend for testing
    backend = new InMemoryMetricsBackend();
    metrics.clearBackends();
    metrics.registerBackend(backend);
  });

  it("should record counter metrics", () => {
    metrics.counter("test.counter", 5, { tag: "value" });
    
    const recorded = backend.getMetrics();
    assert.strictEqual(recorded.length, 1);
    assert.strictEqual(recorded[0].type, "counter");
    assert.strictEqual(recorded[0].name, "test.counter");
    assert.strictEqual(recorded[0].value, 5);
    assert.strictEqual(recorded[0].tags.tag, "value");
  });

  it("should record gauge metrics", () => {
    metrics.gauge("test.gauge", 42, { region: "us-west" });
    
    const recorded = backend.getMetrics();
    assert.strictEqual(recorded.length, 1);
    assert.strictEqual(recorded[0].type, "gauge");
    assert.strictEqual(recorded[0].value, 42);
  });

  it("should record histogram metrics", () => {
    metrics.histogram("test.duration", 1234, { operation: "create" });
    
    const recorded = backend.getMetrics();
    assert.strictEqual(recorded.length, 1);
    assert.strictEqual(recorded[0].type, "histogram");
    assert.strictEqual(recorded[0].value, 1234);
  });

  it("should record command execution", () => {
    recordCommandExecution("onboard", 5000, { status: "success" });
    
    const recorded = backend.getMetrics();
    assert.strictEqual(recorded.length, 2); // counter + histogram
    assert.ok(recorded.some(m => m.name === "nemoclaw.command.executions"));
    assert.ok(recorded.some(m => m.name === "nemoclaw.command.duration"));
  });

  it("should record inference requests", () => {
    recordInferenceRequest("nvidia/nemotron", 420, { tokens: 150, cached: false });
    
    const recorded = backend.getMetrics();
    assert.strictEqual(recorded.length, 3); // requests counter, latency histogram, tokens counter
    assert.ok(recorded.some(m => m.name === "nemoclaw.inference.requests"));
    assert.ok(recorded.some(m => m.name === "nemoclaw.inference.latency"));
    assert.ok(recorded.some(m => m.name === "nemoclaw.inference.tokens" && m.value === 150));
  });

  it("should record sandbox operations", () => {
    recordSandboxOperation("my-sandbox", "create", 800, { model: "nemotron" });
    
    const recorded = backend.getMetrics();
    assert.strictEqual(recorded.length, 2); // counter + histogram
    assert.ok(recorded.some(m => m.tags.operation === "create"));
    assert.ok(recorded.some(m => m.tags.sandbox === "my-sandbox"));
  });

  it("should record errors", () => {
    recordError("sandbox-create", "ConnectionError", { message: "timeout" });
    
    const recorded = backend.getMetrics();
    assert.strictEqual(recorded.length, 1);
    assert.strictEqual(recorded[0].name, "nemoclaw.errors");
    assert.strictEqual(recorded[0].tags.error_type, "ConnectionError");
  });

  it("should measure duration with timer", (t, done) => {
    const timer = startTimer("test.timer", { op: "test" });
    
    setTimeout(() => {
      const duration = timer();
      
      const recorded = backend.getMetrics();
      assert.strictEqual(recorded.length, 1);
      assert.strictEqual(recorded[0].name, "test.timer");
      assert.ok(recorded[0].value >= 50); // Should be at least 50ms
      done();
    }, 50);
  });

  it("should measure async operations", async () => {
    const result = await measureAsync("test.async", async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
      return "result";
    }, { operation: "test" });
    
    assert.strictEqual(result, "result");
    
    const recorded = backend.getMetrics();
    assert.strictEqual(recorded.length, 1);
    assert.strictEqual(recorded[0].name, "test.async");
    assert.ok(recorded[0].value >= 50);
  });

  it("should record errors from failed async operations", async () => {
    await assert.rejects(
      async () => {
        await measureAsync("test.async.error", async () => {
          throw new Error("test error");
        });
      },
      { message: "test error" }
    );
    
    const recorded = backend.getMetrics();
    // Should have histogram for duration and counter for error
    assert.ok(recorded.length >= 2);
    assert.ok(recorded.some(m => m.name === "nemoclaw.errors"));
  });

  it("should enrich metrics with trace context", () => {
    const { runWithTraceContext } = require("../bin/lib/trace-context");
    
    runWithTraceContext("test-op", () => {
      metrics.counter("test.traced", 1);
      
      const recorded = backend.getMetrics();
      assert.strictEqual(recorded.length, 1);
      assert.ok(recorded[0].tags.trace_id); // Should have trace_id
      assert.ok(recorded[0].tags.span_id); // Should have span_id
    }, { test: true });
  });
});
