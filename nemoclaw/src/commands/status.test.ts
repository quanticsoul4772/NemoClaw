// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeLogger, makePluginConfig, makeState } from "../__test-helpers__/factories.js";
import type { PluginLogger, NemoClawConfig } from "../index.js";

vi.mock("../blueprint/state.js", () => ({
  loadState: vi.fn(),
}));

const { mockExecAsync } = vi.hoisted(() => ({
  mockExecAsync: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  exec: vi.fn(),
}));

vi.mock("node:util", () => ({
  promisify: () => mockExecAsync,
}));

import { cliStatus } from "./status.js";
import { loadState } from "../blueprint/state.js";

const mockedLoadState = vi.mocked(loadState);

describe("commands/status", () => {
  let logger: PluginLogger;
  let pluginConfig: NemoClawConfig;

  beforeEach(() => {
    logger = makeLogger();
    pluginConfig = makePluginConfig();
    vi.clearAllMocks();
    mockedLoadState.mockReturnValue(makeState());
    // Default: both subprocess calls return empty JSON
    mockExecAsync.mockResolvedValue({ stdout: "{}", stderr: "" });
  });

  it("outputs JSON when --json is set", async () => {
    mockedLoadState.mockReturnValue(makeState({ lastAction: "launch", sandboxName: "sb" }));
    await cliStatus({ json: true, logger, pluginConfig });
    const output = vi.mocked(logger.info).mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed.nemoclaw.lastAction).toBe("launch");
    expect(parsed.sandbox).toBeDefined();
    expect(parsed.inference).toBeDefined();
  });

  it("shows 'no operations' when no action has been performed", async () => {
    await cliStatus({ json: false, logger, pluginConfig });
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("No operations"));
  });

  it("shows deployment details when action exists", async () => {
    mockedLoadState.mockReturnValue(
      makeState({
        lastAction: "launch",
        blueprintVersion: "0.1.0",
        lastRunId: "run-123",
        updatedAt: "2026-03-20T12:00:00Z",
      }),
    );
    await cliStatus({ json: false, logger, pluginConfig });
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("launch"));
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("0.1.0"));
  });

  it("shows sandbox running status", async () => {
    mockExecAsync.mockImplementation(async (cmd: string) => {
      if (cmd.includes("sandbox status")) {
        return { stdout: JSON.stringify({ state: "running", uptime: "2h" }) };
      }
      return { stdout: "{}" };
    });
    await cliStatus({ json: false, logger, pluginConfig });
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("running"));
  });

  it("shows sandbox not running when exec fails", async () => {
    mockExecAsync.mockRejectedValue(new Error("not found"));
    await cliStatus({ json: false, logger, pluginConfig });
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("not running"));
  });

  it("shows inference configuration", async () => {
    mockExecAsync.mockImplementation(async (cmd: string) => {
      if (cmd.includes("inference")) {
        return {
          stdout: JSON.stringify({
            provider: "nvidia",
            model: "nemotron",
            endpoint: "https://api.nvidia.com",
          }),
        };
      }
      return { stdout: "{}" };
    });
    await cliStatus({ json: false, logger, pluginConfig });
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("nvidia"));
  });

  it("shows rollback info when snapshot exists", async () => {
    mockedLoadState.mockReturnValue(
      makeState({ lastAction: "migrate", migrationSnapshot: "/snapshots/snap-1" }),
    );
    await cliStatus({ json: false, logger, pluginConfig });
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("Rollback"));
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("snap-1"));
  });
});
