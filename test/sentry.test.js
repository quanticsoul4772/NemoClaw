// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");

describe("Sentry Error Tracking", () => {
  let originalDSN;
  
  beforeEach(() => {
    // Save original environment
    originalDSN = process.env.SENTRY_DSN;
    
    // Clear require cache to get fresh module
    delete require.cache[require.resolve("../bin/lib/sentry")];
  });
  
  afterEach(() => {
    // Restore original environment
    if (originalDSN) {
      process.env.SENTRY_DSN = originalDSN;
    } else {
      delete process.env.SENTRY_DSN;
    }
  });

  it("should be disabled when SENTRY_DSN is not set", () => {
    delete process.env.SENTRY_DSN;
    
    const { initSentry, isSentryEnabled } = require("../bin/lib/sentry");
    initSentry();
    
    assert.strictEqual(isSentryEnabled(), false);
  });

  it("should not throw when calling functions with Sentry disabled", () => {
    delete process.env.SENTRY_DSN;
    
    const {
      initSentry,
      captureException,
      captureMessage,
      addBreadcrumb,
      setUser,
      setTags,
      setExtra,
    } = require("../bin/lib/sentry");
    
    initSentry();
    
    // None of these should throw
    assert.doesNotThrow(() => {
      captureException(new Error("test"), { tags: { test: "value" } });
      captureMessage("test message", "info");
      addBreadcrumb({ category: "test", message: "test" });
      setUser({ id: "test" });
      setTags({ test: "value" });
      setExtra("test", "value");
    });
  });

  it("should wrap functions with withSentry even when disabled", async () => {
    delete process.env.SENTRY_DSN;
    
    const { initSentry, withSentry } = require("../bin/lib/sentry");
    initSentry();
    
    const testFn = withSentry(async () => {
      return "result";
    });
    
    const result = await testFn();
    assert.strictEqual(result, "result");
  });

  it("should propagate errors from wrapped functions", async () => {
    delete process.env.SENTRY_DSN;
    
    const { initSentry, withSentry } = require("../bin/lib/sentry");
    initSentry();
    
    const testFn = withSentry(async () => {
      throw new Error("test error");
    });
    
    await assert.rejects(
      async () => await testFn(),
      { message: "test error" }
    );
  });

  it("should return null for event IDs when disabled", () => {
    delete process.env.SENTRY_DSN;
    
    const { initSentry, captureException, captureMessage } = require("../bin/lib/sentry");
    initSentry();
    
    const eventId1 = captureException(new Error("test"));
    const eventId2 = captureMessage("test", "info");
    
    assert.strictEqual(eventId1, null);
    assert.strictEqual(eventId2, null);
  });

  it("should return null transaction when disabled", () => {
    delete process.env.SENTRY_DSN;
    
    const { initSentry, startTransaction } = require("../bin/lib/sentry");
    initSentry();
    
    const transaction = startTransaction({ name: "test", op: "test" });
    
    assert.strictEqual(transaction, null);
  });

  it("should flush successfully when disabled", async () => {
    delete process.env.SENTRY_DSN;
    
    const { initSentry, flushSentry } = require("../bin/lib/sentry");
    initSentry();
    
    const result = await flushSentry(1000);
    
    assert.strictEqual(result, true);
  });

  it("should initialize only once", () => {
    delete process.env.SENTRY_DSN;
    
    const { initSentry, isSentryEnabled } = require("../bin/lib/sentry");
    
    initSentry();
    initSentry();
    initSentry();
    
    // Should still be disabled (no DSN)
    assert.strictEqual(isSentryEnabled(), false);
  });

  it("should accept all capture context options", () => {
    delete process.env.SENTRY_DSN;
    
    const { initSentry, captureException } = require("../bin/lib/sentry");
    initSentry();
    
    assert.doesNotThrow(() => {
      captureException(new Error("test"), {
        tags: { key: "value" },
        extra: { data: { nested: true } },
        user: { id: "user-123" },
        level: "warning",
        contexts: { custom: { field: "value" } },
      });
    });
  });

  it("should accept all breadcrumb options", () => {
    delete process.env.SENTRY_DSN;
    
    const { initSentry, addBreadcrumb } = require("../bin/lib/sentry");
    initSentry();
    
    assert.doesNotThrow(() => {
      addBreadcrumb({
        category: "test",
        message: "test message",
        level: "info",
        data: { key: "value" },
      });
    });
  });
});
