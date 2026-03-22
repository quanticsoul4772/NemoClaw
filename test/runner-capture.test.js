// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { runCapture } = require("../bin/lib/runner");

describe("runCapture", () => {
  it("captures stdout and trims whitespace", () => {
    const result = runCapture("printf '  hello  '");
    assert.equal(result, "hello");
  });

  it("captures multi-line output", () => {
    const result = runCapture("printf 'line1\\nline2'");
    assert.ok(result.includes("line1"));
    assert.ok(result.includes("line2"));
  });

  it("returns empty string on failure when ignoreError is set", () => {
    const result = runCapture("exit 1", { ignoreError: true });
    assert.equal(result, "");
  });

  it("throws on failure when ignoreError is not set", () => {
    assert.throws(() => runCapture("exit 1"));
  });

  it("returns empty string for command with no output when ignoreError is set", () => {
    const result = runCapture("false", { ignoreError: true });
    assert.equal(result, "");
  });

  it("merges custom env vars with process env", () => {
    const result = runCapture("node -e \"process.stdout.write(process.env.TEST_CAPTURE_VAR)\"", {
      env: { TEST_CAPTURE_VAR: "captured-value" },
    });
    assert.equal(result, "captured-value");
  });

  it("does not leak stderr into captured output", () => {
    const result = runCapture("node -e \"process.stdout.write('stdout'); process.stderr.write('stderr')\"");
    assert.equal(result, "stdout");
  });
});
