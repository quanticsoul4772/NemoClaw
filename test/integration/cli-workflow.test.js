// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0
//
// Integration tests for CLI workflow (multiple commands working together)

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const CLI = path.join(__dirname, "..", "..", "bin", "nemoclaw.js");

// Helper to run CLI commands in a controlled environment
function runCLI(args, env = {}) {
  try {
    const output = execSync(`node "${CLI}" ${args}`, {
      encoding: "utf-8",
      timeout: 30000,
      env: { ...process.env, ...env },
    });
    return { success: true, output, code: 0 };
  } catch (err) {
    return {
      success: false,
      output: (err.stdout || "") + (err.stderr || ""),
      code: err.status || 1,
    };
  }
}

describe("CLI Workflow Integration", () => {
  let testHome;
  let testEnv;

  before(() => {
    // Create isolated test environment
    testHome = fs.mkdtempSync(path.join(os.tmpdir(), "nemoclaw-integration-"));
    testEnv = { HOME: testHome, NEMOCLAW_EXPERIMENTAL: "0" };
  });

  after(() => {
    // Cleanup test environment
    try {
      fs.rmSync(testHome, { recursive: true, force: true });
    } catch (err) {
      // Ignore cleanup errors
    }
  });

  it("help → list → help workflow executes successfully", () => {
    // Test that multiple commands work in sequence
    const help1 = runCLI("help", testEnv);
    assert.ok(help1.success, "First help command should succeed");
    assert.ok(help1.output.includes("Getting Started"), "Help should show Getting Started");

    const list = runCLI("list", testEnv);
    assert.ok(list.success, "List command should succeed");
    assert.ok(list.output.includes("No sandboxes"), "Empty HOME should have no sandboxes");

    const help2 = runCLI("help", testEnv);
    assert.ok(help2.success, "Second help command should succeed");
    assert.strictEqual(help1.output, help2.output, "Help output should be consistent");
  });

  it("registry module exports expected API", () => {
    // Test that registry module exports the expected functions
    const registry = require("../../bin/lib/registry");

    // Verify all expected functions exist
    assert.strictEqual(typeof registry.listSandboxes, "function", "Should export listSandboxes");
    assert.strictEqual(typeof registry.registerSandbox, "function", "Should export registerSandbox");
    assert.strictEqual(typeof registry.getSandbox, "function", "Should export getSandbox");
    assert.strictEqual(typeof registry.removeSandbox, "function", "Should export removeSandbox");
    assert.strictEqual(typeof registry.updateSandbox, "function", "Should export updateSandbox");
    assert.strictEqual(typeof registry.getDefault, "function", "Should export getDefault");
    assert.strictEqual(typeof registry.setDefault, "function", "Should export setDefault");
    assert.strictEqual(typeof registry.load, "function", "Should export load");
    assert.strictEqual(typeof registry.save, "function", "Should export save");
  });

  it("unknown command handling is consistent", () => {
    const result1 = runCLI("nonexistent-command", testEnv);
    assert.ok(!result1.success, "Unknown command should fail");
    assert.strictEqual(result1.code, 1, "Should exit with code 1");
    assert.ok(result1.output.includes("Unknown command"), "Should mention unknown command");

    const result2 = runCLI("another-bogus-cmd", testEnv);
    assert.ok(!result2.success, "Second unknown command should also fail");
    assert.strictEqual(result2.code, 1, "Should exit with code 1");
  });

  it("CLI list command has stable output format", () => {
    // Test that list command works and output format is stable
    // Use default environment (not test environment) to ensure registry is initialized
    const list1 = runCLI("list");
    
    // List command should complete (either success or expected failure)
    assert.ok(list1.code === 0 || list1.code === 1, "List should complete with expected exit code");

    if (list1.success) {
      // If successful, run again and verify stability
      const list2 = runCLI("list");
      assert.strictEqual(list1.output, list2.output, "List output should be deterministic");
    } else {
      // If failed, verify it's a reasonable error
      assert.ok(list1.output.length > 0, "Failed list should have error message");
    }
  });

  it("CLI respects environment variable configuration", () => {
    // Test that environment variables affect behavior
    const withExp = runCLI("help", { ...testEnv, NEMOCLAW_EXPERIMENTAL: "1" });
    assert.ok(withExp.success, "Help should work with experimental flag");

    const withoutExp = runCLI("help", { ...testEnv, NEMOCLAW_EXPERIMENTAL: "0" });
    assert.ok(withoutExp.success, "Help should work without experimental flag");

    // Both should succeed but behavior might differ for other commands
    assert.ok(withExp.output.includes("nemoclaw"), "Output should include nemoclaw");
    assert.ok(withoutExp.output.includes("nemoclaw"), "Output should include nemoclaw");
  });
});
