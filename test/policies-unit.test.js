// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");

// Set up isolated HOME before requiring any modules that read HOME at load time
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nemoclaw-pol-test-"));
process.env.HOME = tmpDir;

// Clear cached modules so they pick up the new HOME
const registryPath = path.join(__dirname, "..", "bin", "lib", "registry");
const policiesPath = path.join(__dirname, "..", "bin", "lib", "policies");
delete require.cache[require.resolve(registryPath)];
delete require.cache[require.resolve(policiesPath)];

const policies = require(policiesPath);
const registry = require(registryPath);

const regFile = path.join(tmpDir, ".nemoclaw", "sandboxes.json");

beforeEach(() => {
  if (fs.existsSync(regFile)) fs.unlinkSync(regFile);
});

describe("policies unit tests", () => {
  describe("extractPresetEntries", () => {
    it("extracts content after network_policies key", () => {
      const content = [
        "preset:",
        "  name: test",
        "  description: A test preset",
        "network_policies:",
        "  - name: test-policy",
        "    endpoints:",
        "      - host: example.com",
      ].join("\n");

      const result = policies.extractPresetEntries(content);
      assert.ok(result);
      assert.ok(result.includes("- name: test-policy"));
      assert.ok(result.includes("host: example.com"));
    });

    it("returns null when no network_policies section", () => {
      const content = "preset:\n  name: test\n  description: No policies here";
      assert.equal(policies.extractPresetEntries(content), null);
    });

    it("trims trailing whitespace", () => {
      const content = "network_policies:\n  - name: test  \n  \n";
      const result = policies.extractPresetEntries(content);
      assert.ok(result);
      assert.ok(!result.endsWith("\n"));
    });

    it("handles content with only network_policies section", () => {
      // extractPresetEntries uses a regex that expects Unix line endings
      const content = "network_policies:\n  - name: test\n    endpoints:\n      - host: x.com";
      const result = policies.extractPresetEntries(content);
      assert.ok(result);
      assert.ok(result.includes("- name: test"));
    });
  });

  describe("parseCurrentPolicy", () => {
    it("returns empty string for empty/null input", () => {
      assert.equal(policies.parseCurrentPolicy(""), "");
      assert.equal(policies.parseCurrentPolicy(null), "");
      assert.equal(policies.parseCurrentPolicy(undefined), "");
    });

    it("strips metadata header before ---", () => {
      const raw = "Version: 3\nHash: abc123\n---\nversion: 1\nnetwork_policies:\n  - name: x";
      const result = policies.parseCurrentPolicy(raw);
      assert.ok(result.startsWith("version: 1"));
      assert.ok(!result.includes("Hash:"));
    });

    it("returns raw content if no --- separator", () => {
      const raw = "version: 1\nnetwork_policies:\n  - name: x";
      assert.equal(policies.parseCurrentPolicy(raw), raw);
    });

    it("handles --- at the very start", () => {
      const raw = "---\nversion: 1";
      const result = policies.parseCurrentPolicy(raw);
      assert.equal(result, "version: 1");
    });
  });

  describe("getAppliedPresets", () => {
    it("returns empty array for nonexistent sandbox", () => {
      assert.deepEqual(policies.getAppliedPresets("no-such-sandbox"), []);
    });

    it("returns policies from registry", () => {
      registry.registerSandbox({
        name: "policy-test",
        policies: ["telegram", "slack"],
      });
      assert.deepEqual(policies.getAppliedPresets("policy-test"), ["telegram", "slack"]);
    });

    it("returns empty array when sandbox has no policies", () => {
      registry.registerSandbox({ name: "bare-box" });
      assert.deepEqual(policies.getAppliedPresets("bare-box"), []);
    });
  });

  describe("applyPreset validation", () => {
    it("rejects empty sandbox name", () => {
      assert.throws(() => policies.applyPreset("", "telegram"), /Invalid/);
    });

    it("rejects sandbox name with shell metacharacters", () => {
      assert.throws(() => policies.applyPreset("test; whoami", "telegram"), /Invalid/);
    });

    it("rejects overlength sandbox name", () => {
      assert.throws(() => policies.applyPreset("a".repeat(64), "telegram"), /Invalid/);
    });

    it("rejects uppercase sandbox name", () => {
      assert.throws(() => policies.applyPreset("MyBox", "telegram"), /Invalid/);
    });

    it("returns false for nonexistent preset", () => {
      const result = policies.applyPreset("valid-sandbox", "nonexistent-preset");
      assert.equal(result, false);
    });
  });
});
