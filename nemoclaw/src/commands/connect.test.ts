// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeLogger } from "../__test-helpers__/factories.js";
import { createSpawnMock, type SpawnResult } from "../__test-helpers__/mock-child-process.js";
import type { PluginLogger } from "../index.js";

let spawnResult: SpawnResult = { exitCode: 0 };
const mockSpawn = createSpawnMock(spawnResult);

vi.mock("node:child_process", () => ({
  spawn: (...args: unknown[]) => mockSpawn(...(args as [string, string[], unknown])),
}));

import { cliConnect } from "./connect.js";

describe("commands/connect", () => {
  let logger: PluginLogger;

  beforeEach(() => {
    logger = makeLogger();
    vi.clearAllMocks();
    spawnResult = { exitCode: 0 };
    mockSpawn.mockImplementation((_cmd, _args, _opts) => {
      const { EventEmitter } = require("node:events");
      const proc = new EventEmitter();
      proc.stdout = new (require("node:stream").Readable)({ read() {} });
      proc.stderr = new (require("node:stream").Readable)({ read() {} });
      queueMicrotask(() => {
        if (spawnResult.error) {
          proc.emit("error", spawnResult.error);
        } else {
          proc.emit("close", spawnResult.exitCode ?? 0);
        }
      });
      return proc;
    });
  });

  it("connects to sandbox successfully", async () => {
    spawnResult = { exitCode: 0 };
    await cliConnect({ sandbox: "openclaw", logger });
    expect(mockSpawn).toHaveBeenCalledWith(
      "openshell",
      ["sandbox", "connect", "openclaw"],
      expect.anything(),
    );
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("Connecting"));
  });

  it("reports ENOENT when openshell not found", async () => {
    spawnResult = { error: new Error("spawn openshell ENOENT") };
    await cliConnect({ sandbox: "openclaw", logger });
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("not found"));
  });

  it("reports generic error on spawn failure", async () => {
    spawnResult = { error: new Error("Permission denied") };
    await cliConnect({ sandbox: "openclaw", logger });
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("Permission denied"));
  });

  it("logs error on non-zero exit code", async () => {
    spawnResult = { exitCode: 127 };
    await cliConnect({ sandbox: "test-sb", logger });
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("exited with code 127"));
  });

  it("logs introductory messages", async () => {
    await cliConnect({ sandbox: "openclaw", logger });
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("exit"));
  });
});
