// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from "vitest";
import { fetchBlueprint, resolveLatestVersion } from "./fetch.js";

describe("blueprint/fetch", () => {
  describe("fetchBlueprint", () => {
    it("rejects with not yet implemented error", async () => {
      await expect(fetchBlueprint("ghcr.io/test", "0.1.0")).rejects.toThrow("not yet implemented");
    });

    it("includes registry and version in error message", async () => {
      await expect(fetchBlueprint("my-registry", "2.0.0")).rejects.toThrow("my-registry");
    });
  });

  describe("resolveLatestVersion", () => {
    it("throws not yet implemented error", async () => {
      await expect(resolveLatestVersion("ghcr.io/test")).rejects.toThrow("not yet implemented");
    });
  });
});
