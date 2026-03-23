// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventEmitter } from "node:events";
import { makeLogger, makePluginConfig, makeState } from "../__test-helpers__/factories.js";
import type { PluginLogger } from "../index.js";

vi.mock("../blueprint/state.js", () => ({
  loadState: vi.fn(),
}));

const { mockExecAsync, mockSpawn } = vi.hoisted(() => ({
  mockExecAsync: vi.fn(),
  mockSpawn: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  exec: vi.fn(),
  spawn: (...args: unknown[]) => mockSpawn(...args),
}));

vi.mock("node:util", () => ({
  promisify: () => mockExecAsync,
}));

import { cliLogs } from "./logs.js";
import { loadState } from "../blueprint/state.js";

const mockedLoadState = vi.mocked(loadState);

describe("commands/logs", () => {
  let logger: PluginLogger;
  const pluginConfig = makePluginConfig();

  beforeEach(() => {
    logger = makeLogger();
    vi.clearAllMocks();
    mockedLoadState.mockReturnValue(makeState());
  });

  it("shows run ID when state has one", async () => {
    mockedLoadState.mockReturnValue(makeState({ lastRunId: "run-abc", lastAction: "launch" }));
    mockExecAsync.mockRejectedValue(new Error("not found"));

    await cliLogs({ follow: false, lines: 50, logger, pluginConfig });
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("run-abc"));
  });

  it("reports sandbox not running when check fails", async () => {
    mockExecAsync.mockRejectedValue(new Error("not found"));
    await cliLogs({ follow: false, lines: 50, logger, pluginConfig });
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("not running"));
  });

  it("streams logs when sandbox is running", async () => {
    mockExecAsync.mockResolvedValue({
      stdout: JSON.stringify({ state: "running" }),
    });

    const proc = new EventEmitter();
    mockSpawn.mockReturnValue(proc);
    setTimeout(() => proc.emit("close", 0), 0);

    await cliLogs({ follow: false, lines: 50, logger, pluginConfig });
    expect(mockSpawn).toHaveBeenCalledWith(
      "openshell",
      expect.arrayContaining(["tail"]),
      expect.anything(),
    );
  });

  it("passes -f flag when follow is true", async () => {
    mockExecAsync.mockResolvedValue({
      stdout: JSON.stringify({ state: "running" }),
    });

    const proc = new EventEmitter();
    mockSpawn.mockReturnValue(proc);
    setTimeout(() => proc.emit("close", 0), 0);

    await cliLogs({ follow: true, lines: 100, logger, pluginConfig });
    expect(mockSpawn).toHaveBeenCalledWith(
      "openshell",
      expect.arrayContaining(["-f", "-n", "100"]),
      expect.anything(),
    );
  });

  it("handles spawn error gracefully", async () => {
    mockExecAsync.mockResolvedValue({
      stdout: JSON.stringify({ state: "running" }),
    });

    const proc = new EventEmitter();
    mockSpawn.mockReturnValue(proc);
    setTimeout(() => proc.emit("error", new Error("spawn failed")), 0);

    await cliLogs({ follow: false, lines: 50, logger, pluginConfig });
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("spawn failed"));
  });
});
