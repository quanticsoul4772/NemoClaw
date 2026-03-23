// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeEach, vi } from "vitest";

const mockQuestion = vi.fn();
const mockClose = vi.fn();

vi.mock("node:readline/promises", () => ({
  createInterface: () => ({
    question: mockQuestion,
    close: mockClose,
  }),
}));

import { promptInput, promptConfirm, promptSelect } from "./prompt.js";

describe("onboard/prompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("promptInput", () => {
    it("returns user input trimmed", async () => {
      mockQuestion.mockResolvedValue("  hello  ");
      const result = await promptInput("Enter name");
      expect(result).toBe("hello");
      expect(mockClose).toHaveBeenCalled();
    });

    it("returns default when user enters empty string", async () => {
      mockQuestion.mockResolvedValue("");
      const result = await promptInput("Enter name", "world");
      expect(result).toBe("world");
    });

    it("returns empty string when no default and empty input", async () => {
      mockQuestion.mockResolvedValue("");
      const result = await promptInput("Enter name");
      expect(result).toBe("");
    });
  });

  describe("promptConfirm", () => {
    it("returns true on 'y'", async () => {
      mockQuestion.mockResolvedValue("y");
      expect(await promptConfirm("Continue?")).toBe(true);
    });

    it("returns true on 'yes'", async () => {
      mockQuestion.mockResolvedValue("yes");
      expect(await promptConfirm("Continue?")).toBe(true);
    });

    it("returns false on 'n'", async () => {
      mockQuestion.mockResolvedValue("n");
      expect(await promptConfirm("Continue?")).toBe(false);
    });

    it("returns default (true) on empty input", async () => {
      mockQuestion.mockResolvedValue("");
      expect(await promptConfirm("Continue?", true)).toBe(true);
    });

    it("returns default (false) on empty input when defaultYes=false", async () => {
      mockQuestion.mockResolvedValue("");
      expect(await promptConfirm("Continue?", false)).toBe(false);
    });
  });

  describe("promptSelect", () => {
    const options = [
      { label: "Option A", value: "a" },
      { label: "Option B", value: "b" },
      { label: "Option C", value: "c", hint: "recommended" },
    ];

    it("returns selected option by number", async () => {
      mockQuestion.mockResolvedValue("2");
      const result = await promptSelect("Choose", options);
      expect(result).toBe("b");
    });

    it("returns default option on empty input", async () => {
      mockQuestion.mockResolvedValue("");
      const result = await promptSelect("Choose", options, 0);
      expect(result).toBe("a");
    });

    it("retries on invalid input then accepts valid", async () => {
      mockQuestion
        .mockResolvedValueOnce("99")
        .mockResolvedValueOnce("abc")
        .mockResolvedValueOnce("1");
      const result = await promptSelect("Choose", options);
      expect(result).toBe("a");
      expect(mockQuestion).toHaveBeenCalledTimes(3);
    });
  });
});
