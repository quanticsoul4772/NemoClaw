// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeLogger, makeApi } from "./__test-helpers__/factories.js";
import { Command } from "commander";

vi.mock("./index.js", () => ({
  getPluginConfig: vi.fn(() => ({
    blueprintVersion: "latest",
    blueprintRegistry: "ghcr.io/nvidia/nemoclaw-blueprint",
    sandboxName: "openclaw",
    inferenceProvider: "nvidia",
  })),
}));

import { registerCliCommands } from "./cli.js";

describe("cli", () => {
  let program: Command;

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
  });

  it("registers the nemoclaw parent command", () => {
    const api = makeApi();
    const logger = makeLogger();
    registerCliCommands(
      { program, logger } as unknown as Parameters<typeof registerCliCommands>[0],
      api,
    );
    const nemoclaw = program.commands.find((c) => c.name() === "nemoclaw");
    expect(nemoclaw).toBeDefined();
  });

  it("registers all expected subcommands", () => {
    const api = makeApi();
    const logger = makeLogger();
    registerCliCommands(
      { program, logger } as unknown as Parameters<typeof registerCliCommands>[0],
      api,
    );
    const nemoclaw = program.commands.find((c) => c.name() === "nemoclaw")!;
    const subcommandNames = nemoclaw.commands.map((c) => c.name());
    expect(subcommandNames).toContain("status");
    expect(subcommandNames).toContain("migrate");
    expect(subcommandNames).toContain("launch");
    expect(subcommandNames).toContain("connect");
    expect(subcommandNames).toContain("logs");
    expect(subcommandNames).toContain("eject");
    expect(subcommandNames).toContain("onboard");
  });

  it("status command has --json option", () => {
    const api = makeApi();
    const logger = makeLogger();
    registerCliCommands(
      { program, logger } as unknown as Parameters<typeof registerCliCommands>[0],
      api,
    );
    const nemoclaw = program.commands.find((c) => c.name() === "nemoclaw")!;
    const status = nemoclaw.commands.find((c) => c.name() === "status")!;
    const optionNames = status.options.map((o) => o.long);
    expect(optionNames).toContain("--json");
  });

  it("migrate command has --dry-run and --profile options", () => {
    const api = makeApi();
    const logger = makeLogger();
    registerCliCommands(
      { program, logger } as unknown as Parameters<typeof registerCliCommands>[0],
      api,
    );
    const nemoclaw = program.commands.find((c) => c.name() === "nemoclaw")!;
    const migrate = nemoclaw.commands.find((c) => c.name() === "migrate")!;
    const optionNames = migrate.options.map((o) => o.long);
    expect(optionNames).toContain("--dry-run");
    expect(optionNames).toContain("--profile");
  });
});
