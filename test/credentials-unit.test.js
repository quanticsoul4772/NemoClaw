// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");

// Isolate to temp directory so tests don't touch real ~/.nemoclaw
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nemoclaw-cred-test-"));
const origHome = process.env.HOME;
process.env.HOME = tmpDir;

// Must require AFTER setting HOME so paths resolve to tmpDir
const credPath = path.join(__dirname, "..", "bin", "lib", "credentials");
delete require.cache[require.resolve(credPath)];
const creds = require(credPath);

const credsFile = path.join(tmpDir, ".nemoclaw", "credentials.json");

beforeEach(() => {
  // Clean credentials file between tests
  if (fs.existsSync(credsFile)) fs.unlinkSync(credsFile);
  // Clear any env vars tests may set
  delete process.env.NVIDIA_API_KEY;
  delete process.env.GITHUB_TOKEN;
});

afterEach(() => {
  delete process.env.NVIDIA_API_KEY;
  delete process.env.GITHUB_TOKEN;
});

describe("credentials unit tests", () => {
  describe("loadCredentials", () => {
    it("returns empty object when no file exists", () => {
      assert.deepEqual(creds.loadCredentials(), {});
    });

    it("loads valid credentials file", () => {
      fs.mkdirSync(path.dirname(credsFile), { recursive: true });
      fs.writeFileSync(credsFile, JSON.stringify({ FOO: "bar" }));
      assert.deepEqual(creds.loadCredentials(), { FOO: "bar" });
    });

    it("handles corrupt JSON gracefully", () => {
      fs.mkdirSync(path.dirname(credsFile), { recursive: true });
      fs.writeFileSync(credsFile, "NOT VALID JSON {{{");
      // Should not throw, returns empty object
      assert.deepEqual(creds.loadCredentials(), {});
    });

    it("handles empty file gracefully", () => {
      fs.mkdirSync(path.dirname(credsFile), { recursive: true });
      fs.writeFileSync(credsFile, "");
      assert.deepEqual(creds.loadCredentials(), {});
    });
  });

  describe("saveCredential", () => {
    it("creates directory and saves credential", () => {
      creds.saveCredential("TEST_KEY", "test-value");
      assert.ok(fs.existsSync(credsFile), "credentials file should exist");
      const data = JSON.parse(fs.readFileSync(credsFile, "utf-8"));
      assert.equal(data.TEST_KEY, "test-value");
    });

    it("preserves existing credentials when adding new", () => {
      creds.saveCredential("KEY_A", "value-a");
      creds.saveCredential("KEY_B", "value-b");
      const data = JSON.parse(fs.readFileSync(credsFile, "utf-8"));
      assert.equal(data.KEY_A, "value-a");
      assert.equal(data.KEY_B, "value-b");
    });

    it("overwrites existing credential with same key", () => {
      creds.saveCredential("SAME", "old");
      creds.saveCredential("SAME", "new");
      const data = JSON.parse(fs.readFileSync(credsFile, "utf-8"));
      assert.equal(data.SAME, "new");
    });

    it("sets restrictive file permissions", () => {
      creds.saveCredential("PERM_TEST", "secret");
      const stat = fs.statSync(credsFile);
      // mode 0o600 = owner read/write only (on Unix)
      if (process.platform !== "win32") {
        assert.equal(stat.mode & 0o777, 0o600);
      }
    });
  });

  describe("getCredential", () => {
    it("returns env var if set", () => {
      process.env.NVIDIA_API_KEY = "nvapi-from-env";
      assert.equal(creds.getCredential("NVIDIA_API_KEY"), "nvapi-from-env");
    });

    it("falls back to saved credential when env var not set", () => {
      creds.saveCredential("MY_TOKEN", "from-file");
      assert.equal(creds.getCredential("MY_TOKEN"), "from-file");
    });

    it("prefers env var over saved credential", () => {
      creds.saveCredential("NVIDIA_API_KEY", "from-file");
      process.env.NVIDIA_API_KEY = "from-env";
      assert.equal(creds.getCredential("NVIDIA_API_KEY"), "from-env");
    });

    it("returns null when neither env var nor file has key", () => {
      assert.equal(creds.getCredential("NONEXISTENT_KEY"), null);
    });
  });

  describe("isRepoPrivate", () => {
    it("returns false when gh CLI is not available", () => {
      // gh api will fail in test environments without auth
      // The function catches errors and returns false
      const result = creds.isRepoPrivate("definitely/not-a-real-repo-12345");
      assert.equal(result, false);
    });
  });
});
