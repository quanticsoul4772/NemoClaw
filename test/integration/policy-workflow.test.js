// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0
//
// Integration tests for policy management workflow

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const policies = require("../../bin/lib/policies");

describe("Policy Workflow Integration", () => {
  it("lists available presets from file system", () => {
    const presets = policies.listPresets();

    assert.ok(Array.isArray(presets), "listPresets should return an array");
    assert.ok(presets.length > 0, "Should have at least one preset available");

    // Verify preset structure
    const preset = presets[0];
    assert.ok(preset.file, "Preset should have file property");
    assert.ok(preset.name, "Preset should have name property");
    assert.ok(preset.file.endsWith(".yaml"), "Preset file should be YAML");
  });

  it("loads preset content from disk", () => {
    const presets = policies.listPresets();
    assert.ok(presets.length > 0, "Need at least one preset for this test");

    const presetName = presets[0].name;
    const content = policies.loadPreset(presetName);

    assert.ok(content, "loadPreset should return content");
    assert.strictEqual(typeof content, "string", "Content should be a string");
    assert.ok(content.length > 0, "Content should not be empty");
    assert.ok(content.includes("network_policies"), "Preset should contain network_policies");
  });

  it("extracts endpoints from preset YAML", () => {
    const presets = policies.listPresets();
    assert.ok(presets.length > 0, "Need at least one preset for this test");

    const presetName = presets[0].name;
    const content = policies.loadPreset(presetName);
    const endpoints = policies.getPresetEndpoints(content);

    assert.ok(Array.isArray(endpoints), "getPresetEndpoints should return array");
    // Endpoints might be empty for some presets, just verify structure
    assert.ok(endpoints.every((ep) => typeof ep === "string"), "All endpoints should be strings");
  });

  it("preset content structure is valid", () => {
    const presets = policies.listPresets();
    assert.ok(presets.length > 0, "Need at least one preset for this test");

    const presetName = presets[0].name;
    const content = policies.loadPreset(presetName);

    // Verify preset has metadata section
    assert.ok(content.includes("preset:"), "Preset should have metadata section");

    // Verify it has network policies (if applicable)
    // Some presets might not have network_policies, that's okay
    assert.ok(content.trim().length > 0, "Should have actual policy content");
  });

  it("handles missing preset gracefully", () => {
    const content = policies.loadPreset("nonexistent-preset-name");
    assert.strictEqual(content, null, "Should return null for missing preset");
  });

  it("list → load → endpoints workflow", () => {
    // Full workflow: discover presets → load → parse endpoints
    const presets = policies.listPresets();
    assert.ok(presets.length > 0, "Should have presets");

    for (const preset of presets) {
      // Load each preset
      const content = policies.loadPreset(preset.name);
      assert.ok(content, `Should load content for ${preset.name}`);

      // Extract endpoints
      const endpoints = policies.getPresetEndpoints(content);
      assert.ok(Array.isArray(endpoints), `Should get endpoints array for ${preset.name}`);

      // Verify content structure
      assert.ok(
        content.includes("preset:") || content.includes("network_policies"),
        `${preset.name} should have valid structure`
      );
    }
  });

  it("policy module exports required functions", () => {
    // Test that policy module exports all expected functions
    assert.strictEqual(typeof policies.listPresets, "function", "Should export listPresets");
    assert.strictEqual(typeof policies.loadPreset, "function", "Should export loadPreset");
    assert.strictEqual(typeof policies.getPresetEndpoints, "function", "Should export getPresetEndpoints");
    assert.strictEqual(typeof policies.applyPreset, "function", "Should export applyPreset");
    assert.ok(policies.PRESETS_DIR, "Should export PRESETS_DIR constant");

    // Verify policies module also exports getAppliedPresets
    assert.ok(
      "getAppliedPresets" in policies,
      "Should have getAppliedPresets function"
    );
  });
});
