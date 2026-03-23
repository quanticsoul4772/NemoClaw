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
  checkCompatibility: vi.fn(),
}));

vi.mock("../blueprint/exec.js", () => ({
  execBlueprint: vi.fn(),
}));

vi.mock("../blueprint/state.js", () => ({
  loadState: vi.fn(),
  saveState: vi.fn(),
}));

vi.mock("./migrate.js", () => ({
  detectHostOpenClaw: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execSync: vi.fn(() => "1.0.0"),
}));

import { cliLaunch } from "./launch.js";
import { resolveBlueprint } from "../blueprint/resolve.js";
import { verifyBlueprintDigest, checkCompatibility } from "../blueprint/verify.js";
import { execBlueprint } from "../blueprint/exec.js";
import { loadState, saveState } from "../blueprint/state.js";
import { detectHostOpenClaw } from "./migrate.js";

const mockedResolve = vi.mocked(resolveBlueprint);
const mockedVerify = vi.mocked(verifyBlueprintDigest);
const mockedCompat = vi.mocked(checkCompatibility);
const mockedExec = vi.mocked(execBlueprint);
const mockedLoadState = vi.mocked(loadState);
const mockedSaveState = vi.mocked(saveState);
const mockedDetect = vi.mocked(detectHostOpenClaw);

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

describe("commands/launch", () => {
  let logger: PluginLogger;

  beforeEach(() => {
    logger = makeLogger();
    vi.clearAllMocks();
    mockedDetect.mockReturnValue({
      exists: false,
      stateDir: null,
      configPath: null,
      hasExternalConfig: false,
      workspaceDir: null,
      extensionsDir: null,
      skillsDir: null,
      hooksDir: null,
      externalRoots: [],
      warnings: [],
      errors: [],
    });
    mockedResolve.mockResolvedValue(MOCK_BLUEPRINT);
    mockedVerify.mockReturnValue({ valid: true, expectedDigest: "", actualDigest: "", errors: [] });
    mockedCompat.mockReturnValue([]);
    mockedExec.mockResolvedValue({
      success: true,
      runId: "run-1",
      action: "plan",
      output: "",
      exitCode: 0,
    });
    mockedLoadState.mockReturnValue(makeState());
  });

  it("suggests native setup when no host and no force", async () => {
    await cliLaunch({ force: false, profile: "default", logger, pluginConfig: makePluginConfig() });
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("native setup"));
    expect(mockedResolve).not.toHaveBeenCalled();
  });

  it("suggests migrate when host exists and no force", async () => {
    mockedDetect.mockReturnValue({
      exists: true,
      stateDir: "/home/.openclaw",
      configPath: null,
      hasExternalConfig: false,
      workspaceDir: null,
      extensionsDir: null,
      skillsDir: null,
      hooksDir: null,
      externalRoots: [],
      warnings: [],
      errors: [],
    });
    await cliLaunch({ force: false, profile: "default", logger, pluginConfig: makePluginConfig() });
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("migrate"));
  });

  it("proceeds with force flag even with no host", async () => {
    await cliLaunch({ force: true, profile: "default", logger, pluginConfig: makePluginConfig() });
    expect(mockedResolve).toHaveBeenCalled();
  });

  it("stops on verification failure", async () => {
    mockedVerify.mockReturnValue({
      valid: false,
      expectedDigest: "abc",
      actualDigest: "def",
      errors: ["Digest mismatch"],
    });
    await cliLaunch({ force: true, profile: "default", logger, pluginConfig: makePluginConfig() });
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("verification failed"));
    expect(mockedExec).not.toHaveBeenCalled();
  });

  it("stops on compatibility failure", async () => {
    mockedCompat.mockReturnValue(["OpenShell version too low"]);
    await cliLaunch({ force: true, profile: "default", logger, pluginConfig: makePluginConfig() });
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("Compatibility"));
    expect(mockedExec).not.toHaveBeenCalled();
  });

  it("stops on plan failure", async () => {
    mockedExec.mockResolvedValueOnce({
      success: false,
      runId: "err",
      action: "plan",
      output: "plan error",
      exitCode: 1,
    });
    await cliLaunch({ force: true, profile: "default", logger, pluginConfig: makePluginConfig() });
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("plan failed"));
  });

  it("stops on apply failure", async () => {
    // Plan succeeds
    mockedExec.mockResolvedValueOnce({
      success: true,
      runId: "run-1",
      action: "plan",
      output: "",
      exitCode: 0,
    });
    // Apply fails
    mockedExec.mockResolvedValueOnce({
      success: false,
      runId: "err",
      action: "apply",
      output: "apply error",
      exitCode: 1,
    });
    await cliLaunch({ force: true, profile: "default", logger, pluginConfig: makePluginConfig() });
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("apply failed"));
  });

  it("saves state and shows next steps on success", async () => {
    // Plan succeeds
    mockedExec.mockResolvedValueOnce({
      success: true,
      runId: "plan-1",
      action: "plan",
      output: "",
      exitCode: 0,
    });
    // Apply succeeds
    mockedExec.mockResolvedValueOnce({
      success: true,
      runId: "apply-1",
      action: "apply",
      output: "",
      exitCode: 0,
    });
    await cliLaunch({ force: true, profile: "default", logger, pluginConfig: makePluginConfig() });
    expect(mockedSaveState).toHaveBeenCalledWith(
      expect.objectContaining({ lastAction: "launch", lastRunId: "apply-1" }),
    );
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("running inside OpenShell"));
  });
});
