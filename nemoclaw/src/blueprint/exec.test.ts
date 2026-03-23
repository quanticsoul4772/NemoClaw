// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeEach, vi } from "vitest";
import { store, addFile, addDir, createFsMockImpl } from "../__test-helpers__/mock-fs.js";
import { makeLogger } from "../__test-helpers__/factories.js";
import type { PluginLogger } from "../index.js";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";

vi.mock("node:fs", () => createFsMockImpl());

interface MockProc {
  stdout: Readable;
  stderr: Readable;
  emit: (event: string, ...args: unknown[]) => boolean;
  on: (event: string, handler: (...args: unknown[]) => void) => MockProc;
}

let spawnHandler: ((cmd: string, args: string[], opts: unknown) => MockProc) | null = null;

vi.mock("node:child_process", () => ({
  spawn: (cmd: string, args: string[], opts: unknown) => {
    if (spawnHandler) return spawnHandler(cmd, args, opts);
    const proc = createMockProc();
    setTimeout(() => proc.emit("close", 0));
    return proc;
  },
}));

function createMockProc(): MockProc & EventEmitter {
  const proc = new EventEmitter() as MockProc & EventEmitter;
  proc.stdout = new Readable({ read() {} });
  proc.stderr = new Readable({ read() {} });
  return proc;
}

import { execBlueprint } from "./exec.js";

describe("blueprint/exec", () => {
  let logger: PluginLogger;
  const BASE_OPTS = {
    blueprintPath: "/bp",
    action: "plan" as const,
    profile: "default",
  };

  beforeEach(() => {
    store.clear();
    logger = makeLogger();
    spawnHandler = null;
    vi.clearAllMocks();
  });

  it("returns failure when runner.py not found", async () => {
    const result = await execBlueprint(BASE_OPTS, logger);
    expect(result.success).toBe(false);
    expect(result.output).toContain("runner not found");
    expect(logger.error).toHaveBeenCalled();
  });

  it("returns success with RUN_ID on exit code 0", async () => {
    addDir("/bp/orchestrator");
    addFile("/bp/orchestrator/runner.py", "");

    spawnHandler = () => {
      const proc = createMockProc();
      setTimeout(() => {
        proc.stdout.push(Buffer.from("Starting...\nRUN_ID:run-123\nDone\n"));
        proc.stdout.push(null);
        proc.stderr.push(null);
        proc.emit("close", 0);
      });
      return proc;
    };

    const result = await execBlueprint(BASE_OPTS, logger);
    expect(result.success).toBe(true);
    expect(result.runId).toBe("run-123");
    expect(result.exitCode).toBe(0);
  });

  it("returns failure on non-zero exit code", async () => {
    addDir("/bp/orchestrator");
    addFile("/bp/orchestrator/runner.py", "");

    spawnHandler = () => {
      const proc = createMockProc();
      setTimeout(() => {
        proc.stdout.push(Buffer.from("error output\n"));
        proc.stdout.push(null);
        proc.stderr.push(null);
        proc.emit("close", 1);
      });
      return proc;
    };

    const result = await execBlueprint(BASE_OPTS, logger);
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(1);
  });

  it("handles ENOENT error (python3 not found)", async () => {
    addDir("/bp/orchestrator");
    addFile("/bp/orchestrator/runner.py", "");

    spawnHandler = () => {
      const proc = createMockProc();
      setTimeout(() => {
        const err = new Error("spawn python3 ENOENT");
        proc.emit("error", err);
      });
      return proc;
    };

    const result = await execBlueprint(BASE_OPTS, logger);
    expect(result.success).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("python3 not found"));
  });

  it("forwards stderr to logger.warn", async () => {
    addDir("/bp/orchestrator");
    addFile("/bp/orchestrator/runner.py", "");

    spawnHandler = () => {
      const proc = createMockProc();
      setTimeout(() => {
        proc.stderr.push(Buffer.from("warning message\n"));
        proc.stderr.push(null);
        proc.stdout.push(null);
        proc.emit("close", 0);
      });
      return proc;
    };

    await execBlueprint(BASE_OPTS, logger);
    expect(logger.warn).toHaveBeenCalledWith("warning message");
  });

  it("passes optional arguments correctly", async () => {
    addDir("/bp/orchestrator");
    addFile("/bp/orchestrator/runner.py", "");

    let capturedArgs: string[] = [];
    spawnHandler = (_cmd, args) => {
      capturedArgs = args;
      const proc = createMockProc();
      setTimeout(() => {
        proc.stdout.push(null);
        proc.stderr.push(null);
        proc.emit("close", 0);
      });
      return proc;
    };

    await execBlueprint(
      {
        ...BASE_OPTS,
        jsonOutput: true,
        planPath: "/plan",
        runId: "run-1",
        dryRun: true,
        endpointUrl: "https://api.example.com",
      },
      logger,
    );

    expect(capturedArgs).toContain("--json");
    expect(capturedArgs).toContain("--plan");
    expect(capturedArgs).toContain("/plan");
    expect(capturedArgs).toContain("--run-id");
    expect(capturedArgs).toContain("run-1");
    expect(capturedArgs).toContain("--dry-run");
    expect(capturedArgs).toContain("--endpoint-url");
    expect(capturedArgs).toContain("https://api.example.com");
  });

  it("returns 'unknown' runId when RUN_ID line not found", async () => {
    addDir("/bp/orchestrator");
    addFile("/bp/orchestrator/runner.py", "");

    spawnHandler = () => {
      const proc = createMockProc();
      setTimeout(() => {
        proc.stdout.push(Buffer.from("no run id here\n"));
        proc.stdout.push(null);
        proc.stderr.push(null);
        proc.emit("close", 0);
      });
      return proc;
    };

    const result = await execBlueprint(BASE_OPTS, logger);
    expect(result.runId).toBe("unknown");
  });
});
