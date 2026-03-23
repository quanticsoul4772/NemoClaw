// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { validateApiKey, maskApiKey } from "./validate.js";

describe("onboard/validate", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
  });

  describe("validateApiKey", () => {
    it("returns valid result with model list on success", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ id: "model-a" }, { id: "model-b" }],
        }),
      }) as unknown as typeof fetch;

      const result = await validateApiKey("test-key", "https://api.example.com/v1");
      expect(result.valid).toBe(true);
      expect(result.models).toEqual(["model-a", "model-b"]);
      expect(result.error).toBeNull();
    });

    it("returns invalid on HTTP error", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => "Unauthorized",
      }) as unknown as typeof fetch;

      const result = await validateApiKey("bad-key", "https://api.example.com/v1");
      expect(result.valid).toBe(false);
      expect(result.models).toEqual([]);
      expect(result.error).toContain("401");
    });

    it("returns invalid on network error", async () => {
      globalThis.fetch = vi
        .fn()
        .mockRejectedValue(new Error("Network failure")) as unknown as typeof fetch;

      const result = await validateApiKey("key", "https://api.example.com/v1");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Network failure");
    });

    it("returns invalid on abort/timeout error", async () => {
      const abortError = new Error("The operation was aborted");
      abortError.name = "AbortError";
      globalThis.fetch = vi.fn().mockRejectedValue(abortError) as unknown as typeof fetch;

      const result = await validateApiKey("key", "https://api.example.com/v1");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Request timed out (10s)");
    });

    it("strips trailing slashes from endpoint URL", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      }) as unknown as typeof fetch;

      await validateApiKey("key", "https://api.example.com/v1///");
      expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith(
        "https://api.example.com/v1/models",
        expect.any(Object),
      );
    });

    it("handles empty data array gracefully", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      }) as unknown as typeof fetch;

      const result = await validateApiKey("key", "https://api.example.com/v1");
      expect(result.valid).toBe(true);
      expect(result.models).toEqual([]);
    });
  });

  describe("maskApiKey", () => {
    it("masks short keys completely", () => {
      expect(maskApiKey("12345678")).toBe("****");
      expect(maskApiKey("short")).toBe("****");
    });

    it("masks nvapi- prefix keys showing prefix and last 4", () => {
      expect(maskApiKey("nvapi-1234567890abcdef")).toBe("nvapi-****cdef");
    });

    it("masks generic keys showing only last 4", () => {
      expect(maskApiKey("sk-1234567890abcdef")).toBe("****cdef");
    });
  });
});
