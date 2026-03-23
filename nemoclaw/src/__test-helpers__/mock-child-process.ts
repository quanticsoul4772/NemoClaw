// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * Shared child_process mocking utilities for vitest.
 *
 * Provides helpers for mocking spawn, execSync, execFileSync, and exec (promisified).
 */

import { vi } from "vitest";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";

export interface SpawnResult {
  stdout?: string;
  stderr?: string;
  exitCode?: number | null;
  error?: Error;
}

/**
 * Create a mock spawn function that returns a controllable child process.
 * Call `flush()` on the returned mock to trigger all pending events.
 */
export function createSpawnMock(defaultResult: SpawnResult = { exitCode: 0 }) {
  const pending: Array<{ proc: MockChildProcess; result: SpawnResult }> = [];

  const mockSpawn = vi.fn((_cmd: string, _args?: string[], _opts?: unknown) => {
    const proc = new MockChildProcess();
    pending.push({ proc, result: defaultResult });
    // Defer event emission so callers can attach listeners
    queueMicrotask(() => {
      const entry = pending.find((p) => p.proc === proc);
      if (entry) emitResult(entry.proc, entry.result);
    });
    return proc;
  });

  return mockSpawn;
}

/**
 * Create a mock spawn function with per-call result configuration.
 */
export function createSpawnMockWithResults(results: SpawnResult[]) {
  let callIndex = 0;
  const mockSpawn = vi.fn((_cmd: string, _args?: string[], _opts?: unknown) => {
    const proc = new MockChildProcess();
    const result = results[callIndex] ?? { exitCode: 0 };
    callIndex++;
    queueMicrotask(() => {
      emitResult(proc, result);
    });
    return proc;
  });
  return mockSpawn;
}

/**
 * Create a mock for promisified exec (util.promisify(child_process.exec)).
 */
export function createExecAsyncMock(
  results: Record<string, { stdout?: string; stderr?: string; error?: Error }> = {},
) {
  return vi.fn(async (cmd: string) => {
    // Match by command prefix
    for (const [pattern, result] of Object.entries(results)) {
      if (cmd.includes(pattern)) {
        if (result.error) throw result.error;
        return { stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
      }
    }
    return { stdout: "", stderr: "" };
  });
}

/**
 * Create a mock for execSync / execFileSync.
 */
export function createExecSyncMock(results: Record<string, string | Error> = {}) {
  return vi.fn((cmd: string) => {
    for (const [pattern, result] of Object.entries(results)) {
      if (cmd.includes(pattern)) {
        if (result instanceof Error) throw result;
        return result;
      }
    }
    return "";
  });
}

class MockChildProcess extends EventEmitter {
  stdout = new Readable({ read() {} });
  stderr = new Readable({ read() {} });
  stdin = { write: vi.fn(), end: vi.fn() };
  pid = 12345;
  killed = false;

  kill() {
    this.killed = true;
  }
}

function emitResult(proc: MockChildProcess, result: SpawnResult): void {
  if (result.error) {
    proc.emit("error", result.error);
    return;
  }
  if (result.stdout) {
    proc.stdout.push(Buffer.from(result.stdout));
    proc.stdout.push(null);
  } else {
    proc.stdout.push(null);
  }
  if (result.stderr) {
    proc.stderr.push(Buffer.from(result.stderr));
    proc.stderr.push(null);
  } else {
    proc.stderr.push(null);
  }
  proc.emit("close", result.exitCode ?? 0);
}
