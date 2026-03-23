// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeLogger, makePluginConfig } from "../__test-helpers__/factories.js";
import type { PluginLogger } from "../index.js";

vi.mock("../onboard/config.js", () => ({
  loadOnboardConfig: vi.fn(),
  saveOnboardConfig: vi.fn(),
}));

vi.mock("../onboard/prompt.js", () => ({
  promptInput: vi.fn(),
  promptConfirm: vi.fn(),
  promptSelect: vi.fn(),
}));

vi.mock("../onboard/validate.js", () => ({
  validateApiKey: vi.fn(),
  maskApiKey: vi.fn((k: string) => `****${k.slice(-4)}`),
}));

vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(),
  execSync: vi.fn(() => "1.0.0"),
}));

import { cliOnboard } from "./onboard.js";
import { saveOnboardConfig } from "../onboard/config.js";
import { validateApiKey } from "../onboard/validate.js";

const mockedSaveConfig = vi.mocked(saveOnboardConfig);
const mockedValidateKey = vi.mocked(validateApiKey);

describe("commands/onboard", () => {
  let logger: PluginLogger;

  beforeEach(() => {
    logger = makeLogger();
    vi.clearAllMocks();
    mockedValidateKey.mockResolvedValue({ valid: true, models: ["model-a"], error: null });
  });

  it("completes non-interactive onboard with all flags", async () => {
    await cliOnboard({
      apiKey: "test-key",
      endpoint: "build",
      model: "nvidia/nemotron-3-super-120b-a12b",
      logger,
      pluginConfig: makePluginConfig(),
    });
    expect(mockedSaveConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        endpointType: "build",
        model: "nvidia/nemotron-3-super-120b-a12b",
      }),
    );
  });

  it("errors on invalid endpoint type", async () => {
    await cliOnboard({
      endpoint: "invalid-endpoint",
      logger,
      pluginConfig: makePluginConfig(),
    });
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("endpoint"));
  });

  it("errors when API key validation fails for non-local endpoint", async () => {
    mockedValidateKey.mockResolvedValue({
      valid: false,
      models: [],
      error: "HTTP 401: Unauthorized",
    });
    await cliOnboard({
      apiKey: "bad-key",
      endpoint: "build",
      logger,
      pluginConfig: makePluginConfig(),
    });
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("401"));
  });
});
