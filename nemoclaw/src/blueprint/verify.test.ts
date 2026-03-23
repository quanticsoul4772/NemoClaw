// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeEach, vi } from "vitest";
import { store, addFile, addDir, createFsMockImpl } from "../__test-helpers__/mock-fs.js";

vi.mock("node:fs", () => createFsMockImpl());

import { verifyBlueprintDigest, checkCompatibility } from "./verify.js";
import type { BlueprintManifest } from "./resolve.js";

function makeManifest(overrides?: Partial<BlueprintManifest>): BlueprintManifest {
  return {
    version: "0.1.0",
    minOpenShellVersion: "1.0.0",
    minOpenClawVersion: "2026.3.11",
    profiles: ["default"],
    digest: "",
    ...overrides,
  };
}

describe("blueprint/verify", () => {
  beforeEach(() => {
    store.clear();
  });

  describe("verifyBlueprintDigest", () => {
    it("returns valid when manifest has no digest", () => {
      addDir("/bp");
      addFile("/bp/runner.py", "print('hello')");
      const result = verifyBlueprintDigest("/bp", makeManifest({ digest: "" }));
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("returns valid when digest matches", () => {
      addDir("/bp");
      addFile("/bp/runner.py", "print('hello')");
      // Compute the actual digest first
      const first = verifyBlueprintDigest("/bp", makeManifest({ digest: "" }));
      // Now verify with correct digest
      const result = verifyBlueprintDigest("/bp", makeManifest({ digest: first.actualDigest }));
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("returns invalid when digest mismatches", () => {
      addDir("/bp");
      addFile("/bp/runner.py", "print('hello')");
      const result = verifyBlueprintDigest("/bp", makeManifest({ digest: "deadbeef" }));
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("Digest mismatch");
      expect(result.errors[0]).toContain("deadbeef");
    });

    it("computes digest over multiple files sorted by path", () => {
      addDir("/bp");
      addFile("/bp/a.txt", "aaa");
      addFile("/bp/b.txt", "bbb");
      const result = verifyBlueprintDigest("/bp", makeManifest({ digest: "" }));
      expect(result.actualDigest).toBeDefined();
      expect(result.actualDigest.length).toBe(64); // SHA-256 hex
    });

    it("traverses subdirectories recursively", () => {
      addDir("/bp");
      addDir("/bp/sub");
      addFile("/bp/sub/nested.py", "code");
      addFile("/bp/top.py", "top");
      const result = verifyBlueprintDigest("/bp", makeManifest({ digest: "" }));
      expect(result.valid).toBe(true);
      expect(result.actualDigest.length).toBe(64);
    });
  });

  describe("checkCompatibility", () => {
    it("returns empty array when versions satisfy requirements", () => {
      const errors = checkCompatibility(
        makeManifest({ minOpenShellVersion: "1.0.0", minOpenClawVersion: "2026.3.0" }),
        "1.2.0",
        "2026.3.11",
      );
      expect(errors).toHaveLength(0);
    });

    it("reports error when openshell version is too low", () => {
      const errors = checkCompatibility(
        makeManifest({ minOpenShellVersion: "2.0.0" }),
        "1.0.0",
        "2026.3.11",
      );
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("OpenShell");
    });

    it("reports error when openclaw version is too low", () => {
      const errors = checkCompatibility(
        makeManifest({ minOpenClawVersion: "2026.4.0" }),
        "2.0.0",
        "2026.3.11",
      );
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("OpenClaw");
    });

    it("reports both errors when both versions are too low", () => {
      const errors = checkCompatibility(
        makeManifest({ minOpenShellVersion: "9.0.0", minOpenClawVersion: "9999.0.0" }),
        "1.0.0",
        "2026.3.11",
      );
      expect(errors).toHaveLength(2);
    });

    it("passes when versions are exactly equal", () => {
      const errors = checkCompatibility(
        makeManifest({ minOpenShellVersion: "1.0.0", minOpenClawVersion: "2026.3.11" }),
        "1.0.0",
        "2026.3.11",
      );
      expect(errors).toHaveLength(0);
    });

    it("passes when no minimum versions are specified", () => {
      const errors = checkCompatibility(
        makeManifest({ minOpenShellVersion: "", minOpenClawVersion: "" }),
        "1.0.0",
        "2026.3.11",
      );
      expect(errors).toHaveLength(0);
    });
  });
});
