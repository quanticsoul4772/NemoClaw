// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeLogger, makePluginConfig, makeState } from "../__test-helpers__/factories.js";
import type { PluginLogger } from "../index.js";

vi.mock("../blueprint/resolve.js", () => ({
  resolveBlueprint: vi.fn(),
}));

vi.mock("../blueprint/verify.js", () => ({
  verifyBlueprintDigest: vi.fn(),
}));

vi.mock("../blueprint/exec.js", () => ({
  execBlueprint: vi.fn(),
}));

vi.mock("../blueprint/state.js", () => ({
  loadState: vi.fn(),
  saveState: vi.fn(),
}));

vi.mock("./migration-state.js", () => ({
  detectHostOpenClaw: vi.fn(),
  createSnapshotBundle: vi.fn(),
  cleanupSnapshotBundle: vi.fn(),
  createArchiveFromDirectory: vi.fn(),
  loadSnapshotManifest: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(),
}));

import { cliMigrate } from "./migrate.js";
import { resolveBlueprint } from "../blueprint/resolve.js";
import { verifyBlueprintDigest } from "../blueprint/verify.js";
import { execBlueprint } from "../blueprint/exec.js";
import { loadState, saveState } from "../blueprint/state.js";
import {
  detectHostOpenClaw,
  createSnapshotBundle,
  cleanupSnapshotBundle,
  createArchiveFromDirectory,
  loadSnapshotManifest,
} from "./migration-state.js";

const mockedDetect = vi.mocked(detectHostOpenClaw);
const mockedResolve = vi.mocked(resolveBlueprint);
const mockedVerify = vi.mocked(verifyBlueprintDigest);
const mockedExec = vi.mocked(execBlueprint);
const mockedLoadState = vi.mocked(loadState);
const mockedSaveState = vi.mocked(saveState);
const mockedCreateSnapshot = vi.mocked(createSnapshotBundle);
const mockedCleanup = vi.mocked(cleanupSnapshotBundle);
const mockedCreateArchive = vi.mocked(createArchiveFromDirectory);
const mockedLoadManifest = vi.mocked(loadSnapshotManifest);

const MOCK_HOST_STATE = {
  exists: true,
  stateDir: "/home/.openclaw",
  configPath: "/home/.openclaw/openclaw.json",
  hasExternalConfig: false,
  workspaceDir: null,
  extensionsDir: null,
  skillsDir: null,
  hooksDir: null,
  externalRoots: [],
  warnings: [],
  errors: [],
};

const MOCK_BLUEPRINT = {
  version: "0.1.0",
  localPath: "/bp/0.1.0",
  manifest: {
    version: "0.1.0",
    minOpenShellVersion: "1.0.0",
    minOpenClawVersion: "2026.3.0",
    profiles: ["default"],
    digest: "",
  },
  cached: true,
};

const MOCK_BUNDLE = {
  snapshotDir: "/snap/1",
  preparedStateDir: "/snap/1/state",
  archivesDir: "/snap/1/archives",
  manifest: { stateDir: "/home/.openclaw", externalRoots: [] },
};

describe("commands/migrate", () => {
  let logger: PluginLogger;

  beforeEach(() => {
    logger = makeLogger();
    vi.clearAllMocks();
    mockedDetect.mockReturnValue(MOCK_HOST_STATE);
    mockedResolve.mockResolvedValue(MOCK_BLUEPRINT);
    mockedVerify.mockReturnValue({ valid: true, expectedDigest: "", actualDigest: "", errors: [] });
    mockedExec.mockResolvedValue({
      success: true,
      runId: "run-1",
      action: "plan",
      output: "",
      exitCode: 0,
    });
    mockedLoadState.mockReturnValue(makeState());
    mockedCreateSnapshot.mockReturnValue(
      MOCK_BUNDLE as unknown as ReturnType<typeof createSnapshotBundle>,
    );
    mockedCreateArchive.mockResolvedValue(undefined);
    mockedLoadManifest.mockReturnValue({
      stateDir: "/home/.openclaw",
      externalRoots: [],
    } as unknown as ReturnType<typeof loadSnapshotManifest>);
  });

  it("errors when no host installation found", async () => {
    mockedDetect.mockReturnValue({ ...MOCK_HOST_STATE, exists: false, stateDir: null });
    await cliMigrate({
      dryRun: false,
      profile: "default",
      skipBackup: false,
      logger,
      pluginConfig: makePluginConfig(),
    });
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("No OpenClaw installation"));
  });

  it("errors when host state has errors", async () => {
    mockedDetect.mockReturnValue({
      ...MOCK_HOST_STATE,
      errors: ["Cannot resolve external root /data"],
    });
    await cliMigrate({
      dryRun: false,
      profile: "default",
      skipBackup: false,
      logger,
      pluginConfig: makePluginConfig(),
    });
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("Cannot resolve"));
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("Refusing to migrate"));
  });

  it("shows dry run plan without executing", async () => {
    await cliMigrate({
      dryRun: true,
      profile: "default",
      skipBackup: false,
      logger,
      pluginConfig: makePluginConfig(),
    });
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("Dry run"));
    expect(mockedResolve).not.toHaveBeenCalled();
  });

  it("stops on blueprint verification failure", async () => {
    mockedVerify.mockReturnValue({
      valid: false,
      expectedDigest: "a",
      actualDigest: "b",
      errors: ["Digest mismatch"],
    });
    await cliMigrate({
      dryRun: false,
      profile: "default",
      skipBackup: false,
      logger,
      pluginConfig: makePluginConfig(),
    });
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("verification failed"));
  });

  it("stops on plan failure", async () => {
    mockedExec.mockResolvedValueOnce({
      success: false,
      runId: "err",
      action: "plan",
      output: "plan error",
      exitCode: 1,
    });
    await cliMigrate({
      dryRun: false,
      profile: "default",
      skipBackup: false,
      logger,
      pluginConfig: makePluginConfig(),
    });
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("plan failed"));
  });

  it("stops on apply failure", async () => {
    mockedExec
      .mockResolvedValueOnce({ success: true, runId: "p", action: "plan", output: "", exitCode: 0 })
      .mockResolvedValueOnce({
        success: false,
        runId: "err",
        action: "apply",
        output: "apply error",
        exitCode: 1,
      });
    await cliMigrate({
      dryRun: false,
      profile: "default",
      skipBackup: false,
      logger,
      pluginConfig: makePluginConfig(),
    });
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("apply failed"));
  });

  it("returns early when snapshot creation fails", async () => {
    mockedExec
      .mockResolvedValueOnce({ success: true, runId: "p", action: "plan", output: "", exitCode: 0 })
      .mockResolvedValueOnce({
        success: true,
        runId: "a",
        action: "apply",
        output: "",
        exitCode: 0,
      });
    mockedCreateSnapshot.mockReturnValue(null);
    await cliMigrate({
      dryRun: false,
      profile: "default",
      skipBackup: false,
      logger,
      pluginConfig: makePluginConfig(),
    });
    expect(mockedSaveState).not.toHaveBeenCalled();
  });

  it("saves state on successful migration", async () => {
    mockedExec
      .mockResolvedValueOnce({
        success: true,
        runId: "plan-1",
        action: "plan",
        output: "",
        exitCode: 0,
      })
      .mockResolvedValueOnce({
        success: true,
        runId: "apply-1",
        action: "apply",
        output: "",
        exitCode: 0,
      });
    await cliMigrate({
      dryRun: false,
      profile: "default",
      skipBackup: false,
      logger,
      pluginConfig: makePluginConfig(),
    });
    expect(mockedSaveState).toHaveBeenCalledWith(
      expect.objectContaining({ lastAction: "migrate", lastRunId: "apply-1" }),
    );
    expect(mockedCleanup).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("Migration complete"));
  });
});
