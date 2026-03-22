// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { resolveOpenshell } = require("../bin/lib/resolve-openshell");

describe("resolveOpenshell", () => {
  it("returns commandVResult when it is an absolute path", () => {
    const result = resolveOpenshell({ commandVResult: "/usr/local/bin/openshell" });
    assert.equal(result, "/usr/local/bin/openshell");
  });

  it("ignores commandVResult when it is not an absolute path", () => {
    // Relative paths could be alias injection — should be rejected
    const result = resolveOpenshell({
      commandVResult: "openshell",
      checkExecutable: () => false,
      home: "/nonexistent",
    });
    assert.equal(result, null);
  });

  it("ignores empty commandVResult", () => {
    const result = resolveOpenshell({
      commandVResult: "",
      checkExecutable: () => false,
      home: "/nonexistent",
    });
    assert.equal(result, null);
  });

  it("falls back to home/.local/bin if commandV fails", () => {
    const result = resolveOpenshell({
      commandVResult: null,
      home: "/home/testuser",
      checkExecutable: (p) => p === "/home/testuser/.local/bin/openshell",
    });
    assert.equal(result, "/home/testuser/.local/bin/openshell");
  });

  it("falls back to /usr/local/bin", () => {
    const result = resolveOpenshell({
      commandVResult: null,
      home: "/nonexistent",
      checkExecutable: (p) => p === "/usr/local/bin/openshell",
    });
    assert.equal(result, "/usr/local/bin/openshell");
  });

  it("falls back to /usr/bin", () => {
    const result = resolveOpenshell({
      commandVResult: null,
      home: "/nonexistent",
      checkExecutable: (p) => p === "/usr/bin/openshell",
    });
    assert.equal(result, "/usr/bin/openshell");
  });

  it("returns null when openshell is nowhere", () => {
    const result = resolveOpenshell({
      commandVResult: null,
      checkExecutable: () => false,
      home: "/nonexistent",
    });
    assert.equal(result, null);
  });

  it("skips home candidate when home does not start with /", () => {
    const checked = [];
    resolveOpenshell({
      commandVResult: null,
      home: "relative/path",
      checkExecutable: (p) => { checked.push(p); return false; },
    });
    // Should NOT check relative/path/.local/bin/openshell
    assert.ok(!checked.some((p) => p.includes("relative")));
    // Should still check system paths
    assert.ok(checked.includes("/usr/local/bin/openshell"));
  });

  it("prefers commandV over fallback candidates", () => {
    const result = resolveOpenshell({
      commandVResult: "/opt/custom/openshell",
      checkExecutable: (p) => p === "/usr/local/bin/openshell",
    });
    // commandV should win even though fallback would also match
    assert.equal(result, "/opt/custom/openshell");
  });

  it("checks candidates in priority order", () => {
    const checked = [];
    resolveOpenshell({
      commandVResult: null,
      home: "/home/user",
      checkExecutable: (p) => { checked.push(p); return false; },
    });
    assert.equal(checked[0], "/home/user/.local/bin/openshell");
    assert.equal(checked[1], "/usr/local/bin/openshell");
    assert.equal(checked[2], "/usr/bin/openshell");
  });
});
