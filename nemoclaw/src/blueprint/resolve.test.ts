// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeEach, vi } from "vitest";
import { join } from "node:path";
import { store, addFile, addDir, createFsMockImpl } from "../__test-helpers__/mock-fs.js";
import { makePluginConfig } from "../__test-helpers__/factories.js";

vi.mock("node:fs", () => createFsMockImpl());

vi.mock("./fetch.js", () => ({
  fetchBlueprint: vi.fn(),
}));

import {
  getCacheDir,
  getCachedBlueprintPath,
  isCached,
  readCachedManifest,
  resolveBlueprint,
} from "./resolve.js";
import { fetchBlueprint } from "./fetch.js";

const mockedFetchBlueprint = vi.mocked(fetchBlueprint);

const HOME = process.env.HOME ?? "/tmp";
const CACHE_DIR = join(HOME, ".nemoclaw", "blueprints");

const SAMPLE_MANIFEST_YAML = `version: 0.1.0
min_openshell_version: 1.0.0
min_openclaw_version: 2026.3.11
profiles: default, ncp, nim-local
digest: abc123
`;

describe("blueprint/resolve", () => {
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
  });

  describe("getCacheDir", () => {
    it("returns the cache directory path", () => {
      expect(getCacheDir()).toBe(CACHE_DIR);
    });
  });

  describe("getCachedBlueprintPath", () => {
    it("joins cache dir with version", () => {
      expect(getCachedBlueprintPath("0.1.0")).toBe(join(CACHE_DIR, "0.1.0"));
    });
  });

  describe("isCached", () => {
    it("returns true when manifest exists", () => {
      addFile(join(CACHE_DIR, "0.1.0", "blueprint.yaml"), SAMPLE_MANIFEST_YAML);
      expect(isCached("0.1.0")).toBe(true);
    });

    it("returns false when manifest does not exist", () => {
      expect(isCached("0.1.0")).toBe(false);
    });
  });

  describe("readCachedManifest", () => {
    it("parses YAML header into manifest object", () => {
      addFile(join(CACHE_DIR, "0.1.0", "blueprint.yaml"), SAMPLE_MANIFEST_YAML);
      const manifest = readCachedManifest("0.1.0");
      expect(manifest).not.toBeNull();
      expect(manifest!.version).toBe("0.1.0");
      expect(manifest!.minOpenShellVersion).toBe("1.0.0");
      expect(manifest!.minOpenClawVersion).toBe("2026.3.11");
      expect(manifest!.profiles).toEqual(["default", "ncp", "nim-local"]);
      expect(manifest!.digest).toBe("abc123");
    });

    it("returns null when file does not exist", () => {
      expect(readCachedManifest("0.1.0")).toBeNull();
    });

    it("returns default profiles when profiles line is missing", () => {
      addFile(join(CACHE_DIR, "0.2.0", "blueprint.yaml"), "version: 0.2.0\n");
      const manifest = readCachedManifest("0.2.0");
      expect(manifest!.profiles).toEqual(["default"]);
    });
  });

  describe("resolveBlueprint", () => {
    it("returns cached blueprint when version is cached", async () => {
      addFile(join(CACHE_DIR, "0.1.0", "blueprint.yaml"), SAMPLE_MANIFEST_YAML);
      addDir(join(CACHE_DIR, "0.1.0"));
      const result = await resolveBlueprint(makePluginConfig({ blueprintVersion: "0.1.0" }));
      expect(result.cached).toBe(true);
      expect(result.version).toBe("0.1.0");
      expect(result.localPath).toBe(getCachedBlueprintPath("0.1.0"));
      expect(mockedFetchBlueprint).not.toHaveBeenCalled();
    });

    it("calls fetchBlueprint when version is not cached", async () => {
      const mockResolved = {
        version: "0.2.0",
        localPath: getCachedBlueprintPath("0.2.0"),
        manifest: {
          version: "0.2.0",
          minOpenShellVersion: "",
          minOpenClawVersion: "",
          profiles: ["default"],
          digest: "",
        },
        cached: false,
      };
      mockedFetchBlueprint.mockResolvedValue(mockResolved);

      const result = await resolveBlueprint(makePluginConfig({ blueprintVersion: "0.2.0" }));
      expect(result).toEqual(mockResolved);
      expect(mockedFetchBlueprint).toHaveBeenCalledWith(
        "ghcr.io/nvidia/nemoclaw-blueprint",
        "0.2.0",
      );
    });

    it("always fetches when version is 'latest' even if cached", async () => {
      addFile(join(CACHE_DIR, "latest", "blueprint.yaml"), SAMPLE_MANIFEST_YAML);
      addDir(join(CACHE_DIR, "latest"));
      const mockResolved = {
        version: "latest",
        localPath: getCachedBlueprintPath("latest"),
        manifest: {
          version: "0.1.0",
          minOpenShellVersion: "",
          minOpenClawVersion: "",
          profiles: ["default"],
          digest: "",
        },
        cached: false,
      };
      mockedFetchBlueprint.mockResolvedValue(mockResolved);

      await resolveBlueprint(makePluginConfig({ blueprintVersion: "latest" }));
      expect(mockedFetchBlueprint).toHaveBeenCalled();
    });
  });
});
