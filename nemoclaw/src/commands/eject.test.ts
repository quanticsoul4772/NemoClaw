// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeEach, vi } from "vitest";
import { store, addDir, createFsMockImpl } from "../__test-helpers__/mock-fs.js";
import { makeLogger, makePluginConfig, makeState } from "../__test-helpers__/factories.js";
import type { PluginLogger } from "../index.js";

vi.mock("node:fs", () => createFsMockImpl());

vi.mock("../blueprint/state.js", () => ({
  loadState: vi.fn(),
  clearState: vi.fn(),
}));

vi.mock("../blueprint/exec.js", () => ({
  execBlueprint: vi.fn(),
}));

vi.mock("./migration-state.js", () => ({
  restoreSnapshotToHost: vi.fn(),
}));

import { cliEject } from "./eject.js";
import { loadState, clearState } from "../blueprint/state.js";
import { execBlueprint } from "../blueprint/exec.js";
import { restoreSnapshotToHost } from "./migration-state.js";

const mockedLoadState = vi.mocked(loadState);
const mockedClearState = vi.mocked(clearState);
const mockedExecBlueprint = vi.mocked(execBlueprint);
const mockedRestoreSnapshot = vi.mocked(restoreSnapshotToHost);

describe("commands/eject", () => {
  let logger: PluginLogger;
  const pluginConfig = makePluginConfig();

  beforeEach(() => {
    logger = makeLogger();
    store.clear();
    vi.clearAllMocks();
  });

  it("errors when no deployment found", async () => {
    mockedLoadState.mockReturnValue(makeState());
    await cliEject({ confirm: true, logger, pluginConfig });
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("No NemoClaw deployment"));
  });

  it("errors when no migration snapshot exists", async () => {
    mockedLoadState.mockReturnValue(makeState({ lastAction: "launch" }));
    await cliEject({ confirm: true, logger, pluginConfig });
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("No migration snapshot"));
  });

  it("errors when snapshot directory does not exist on disk", async () => {
    mockedLoadState.mockReturnValue(
      makeState({ lastAction: "launch", migrationSnapshot: "/snap/1" }),
    );
    // Don't add the dir to store so existsSync returns false
    await cliEject({ confirm: true, logger, pluginConfig });
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("Snapshot directory"));
  });

  it("shows plan when confirm=false", async () => {
    mockedLoadState.mockReturnValue(
      makeState({ lastAction: "migrate", migrationSnapshot: "/snap/1" }),
    );
    addDir("/snap/1/openclaw");
    await cliEject({ confirm: false, logger, pluginConfig });
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("Eject will"));
    expect(mockedExecBlueprint).not.toHaveBeenCalled();
  });

  it("completes eject with rollback and restore", async () => {
    mockedLoadState.mockReturnValue(
      makeState({
        lastAction: "migrate",
        lastRunId: "run-1",
        blueprintVersion: "0.1.0",
        migrationSnapshot: "/snap/1",
      }),
    );
    addDir("/snap/1/openclaw");
    const home = process.env.HOME ?? "/tmp";
    addDir(`${home}/.nemoclaw/blueprints/0.1.0`);
    mockedExecBlueprint.mockResolvedValue({
      success: true,
      runId: "run-1",
      action: "rollback",
      output: "",
      exitCode: 0,
    });
    mockedRestoreSnapshot.mockReturnValue(true);

    await cliEject({ confirm: true, logger, pluginConfig });
    expect(mockedExecBlueprint).toHaveBeenCalledWith(
      expect.objectContaining({ action: "rollback" }),
      logger,
    );
    expect(mockedRestoreSnapshot).toHaveBeenCalledWith("/snap/1", logger);
    expect(mockedClearState).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("Eject complete"));
  });

  it("continues when blueprint rollback fails", async () => {
    mockedLoadState.mockReturnValue(
      makeState({
        lastAction: "migrate",
        lastRunId: "run-1",
        blueprintVersion: "0.1.0",
        migrationSnapshot: "/snap/1",
      }),
    );
    addDir("/snap/1/openclaw");
    const home = process.env.HOME ?? "/tmp";
    addDir(`${home}/.nemoclaw/blueprints/0.1.0`);
    mockedExecBlueprint.mockResolvedValue({
      success: false,
      runId: "run-1",
      action: "rollback",
      output: "rollback error",
      exitCode: 1,
    });
    mockedRestoreSnapshot.mockReturnValue(true);

    await cliEject({ confirm: true, logger, pluginConfig });
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("rollback returned errors"));
    expect(mockedClearState).toHaveBeenCalled();
  });

  it("stops when restore fails", async () => {
    mockedLoadState.mockReturnValue(
      makeState({
        lastAction: "migrate",
        migrationSnapshot: "/snap/1",
      }),
    );
    addDir("/snap/1/openclaw");
    mockedRestoreSnapshot.mockReturnValue(false);

    await cliEject({ confirm: true, logger, pluginConfig });
    expect(mockedClearState).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("Manual restore"));
  });
});
