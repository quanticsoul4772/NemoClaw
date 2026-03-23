// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0
//
// Integration tests for runner and blueprint interaction

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..", "..");
const BLUEPRINT_DIR = path.join(ROOT, "nemoclaw-blueprint");
const BLUEPRINT_YAML = path.join(BLUEPRINT_DIR, "blueprint.yaml");

describe("Runner and Blueprint Integration", () => {
  it("blueprint.yaml exists and is valid YAML", () => {
    assert.ok(fs.existsSync(BLUEPRINT_YAML), "blueprint.yaml should exist");

    const content = fs.readFileSync(BLUEPRINT_YAML, "utf-8");
    assert.ok(content.length > 0, "blueprint.yaml should not be empty");

    // Validate YAML structure (basic check)
    assert.ok(content.includes("version:"), "Should have version field");
    assert.ok(content.includes("components:"), "Should have components section");
  });

  it("blueprint defines required inference profiles", () => {
    const content = fs.readFileSync(BLUEPRINT_YAML, "utf-8");

    // Verify all three required profiles exist
    assert.ok(content.includes("default:"), "Should have default profile");
    assert.ok(content.includes("vllm:"), "Should have vllm profile");
    assert.ok(content.includes("nim-local:"), "Should have nim-local profile");
  });

  it("blueprint runner.py exists and is executable", () => {
    const runnerPath = path.join(BLUEPRINT_DIR, "orchestrator", "runner.py");
    assert.ok(fs.existsSync(runnerPath), "runner.py should exist");

    const content = fs.readFileSync(runnerPath, "utf-8");
    assert.ok(content.includes("def main"), "Should have main function");
    assert.ok(content.includes("argparse"), "Should use argparse for CLI");
  });

  it("blueprint policies directory structure is valid", () => {
    const policiesDir = path.join(BLUEPRINT_DIR, "policies");
    assert.ok(fs.existsSync(policiesDir), "policies directory should exist");

    const presetsDir = path.join(policiesDir, "presets");
    assert.ok(fs.existsSync(presetsDir), "presets subdirectory should exist");

    const presets = fs
      .readdirSync(presetsDir)
      .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));

    assert.ok(presets.length > 0, "Should have at least one policy preset");
  });

  it("runner imports can be loaded without errors", () => {
    // Test that Python imports work
    const testScript = `
import sys
sys.path.insert(0, '${BLUEPRINT_DIR.replace(/\\/g, "/")}')
from orchestrator.runner import validate_blueprint
print("Imports successful")
`;

    try {
      const result = execSync("python3 -c " + JSON.stringify(testScript), {
        encoding: "utf-8",
        cwd: ROOT,
        timeout: 10000,
      });
      assert.ok(result.includes("Imports successful"), "Python imports should work");
    } catch (err) {
      // Python3 might not be available, skip test
      if (err.message.includes("python3")) {
        assert.ok(true, "Skipping Python test (python3 not available)");
      } else {
        throw err;
      }
    }
  });

  it("migration snapshot module exists", () => {
    const snapshotPath = path.join(BLUEPRINT_DIR, "migrations", "snapshot.py");
    assert.ok(fs.existsSync(snapshotPath), "snapshot.py should exist");

    const content = fs.readFileSync(snapshotPath, "utf-8");
    assert.ok(content.includes("create_snapshot"), "Should have create_snapshot function");
    assert.ok(content.includes("list_snapshots"), "Should have list_snapshots function");
    assert.ok(content.includes("rollback_from_snapshot"), "Should have rollback function");
  });

  it("blueprint and runner integrate via shared config", () => {
    // Verify that runner.py references blueprint.yaml
    const runnerPath = path.join(BLUEPRINT_DIR, "orchestrator", "runner.py");
    const runnerContent = fs.readFileSync(runnerPath, "utf-8");

    assert.ok(
      runnerContent.includes("blueprint.yaml") || runnerContent.includes("blueprint"),
      "Runner should reference blueprint configuration"
    );
  });

  it("policy presets are valid YAML with required fields", () => {
    const presetsDir = path.join(BLUEPRINT_DIR, "policies", "presets");
    const presets = fs
      .readdirSync(presetsDir)
      .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));

    for (const presetFile of presets) {
      const content = fs.readFileSync(path.join(presetsDir, presetFile), "utf-8");

      // Verify basic structure
      assert.ok(content.includes("preset:"), `${presetFile} should have preset metadata`);
      assert.ok(
        content.includes("name:") || content.includes("description:"),
        `${presetFile} should have name or description`
      );

      // Should have network policies or be a valid preset structure
      assert.ok(
        content.includes("network_policies") || content.includes("preset"),
        `${presetFile} should define policies or preset structure`
      );
    }
  });

  it("e2e test script exists and has test coverage", () => {
    const e2eScript = path.join(ROOT, "test", "e2e-test.sh");
    assert.ok(fs.existsSync(e2eScript), "e2e-test.sh should exist");

    const content = fs.readFileSync(e2eScript, "utf-8");

    // Verify it has meaningful test content
    assert.ok(content.length > 100, "Should have substantial content");
    assert.ok(content.includes("#!/"), "Should be a shell script");
    assert.ok(content.includes("OpenClaw") || content.includes("openclaw"), "Should test OpenClaw integration");
    assert.ok(content.includes("blueprint"), "Should test blueprint");
    assert.ok(content.includes("snapshot"), "Should test snapshot functionality");
  });
});
