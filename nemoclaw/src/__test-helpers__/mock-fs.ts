// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * Shared in-memory filesystem mock for vitest.
 *
 * Usage in test files:
 *
 *   import { store, addFile, addDir, createFsMockImpl } from "../__test-helpers__/mock-fs.js";
 *   vi.mock("node:fs", () => createFsMockImpl());
 *
 * Call `store.clear()` in `beforeEach()` to reset between tests.
 */

import { vi } from "vitest";

export interface FsEntry {
  type: "file" | "dir" | "symlink";
  content?: string;
}

export const store = new Map<string, FsEntry>();

/** Normalize paths to forward slashes so tests work on Windows and Unix. */
function norm(p: string): string {
  return p.replace(/\\/g, "/");
}

export function addFile(p: string, content: string): void {
  store.set(norm(p), { type: "file", content });
}

export function addDir(p: string): void {
  store.set(norm(p), { type: "dir" });
}

export function addSymlink(p: string): void {
  store.set(norm(p), { type: "symlink" });
}

export function createFsMockImpl(): Record<string, unknown> {
  return {
    existsSync: (p: string) => store.has(norm(p)),

    mkdirSync: vi.fn((p: string) => {
      addDir(p);
    }),

    readFileSync: (p: string, _encoding?: string) => {
      const np = norm(p);
      const entry = store.get(np);
      if (!entry || entry.type !== "file") throw new Error(`ENOENT: ${p}`);
      return entry.content ?? "";
    },

    writeFileSync: vi.fn((p: string, data: string) => {
      store.set(norm(p), { type: "file", content: data });
    }),

    copyFileSync: vi.fn((src: string, dest: string) => {
      const entry = store.get(norm(src));
      if (!entry) throw new Error(`ENOENT: ${src}`);
      store.set(norm(dest), { ...entry });
    }),

    cpSync: vi.fn((src: string, dest: string) => {
      const ns = norm(src);
      const nd = norm(dest);
      for (const [k, v] of store) {
        if (k === ns || k.startsWith(ns + "/")) {
          const relative = k.slice(ns.length);
          store.set(nd + relative, { ...v });
        }
      }
    }),

    rmSync: vi.fn(),

    renameSync: vi.fn((oldPath: string, newPath: string) => {
      const no = norm(oldPath);
      const nn = norm(newPath);
      for (const [k, v] of store) {
        if (k === no || k.startsWith(no + "/")) {
          const relative = k.slice(no.length);
          store.set(nn + relative, v);
          store.delete(k);
        }
      }
    }),

    unlinkSync: vi.fn((p: string) => {
      store.delete(norm(p));
    }),

    lstatSync: (p: string) => {
      const entry = store.get(norm(p));
      if (!entry) throw new Error(`ENOENT: ${p}`);
      return {
        isSymbolicLink: () => entry.type === "symlink",
        isDirectory: () => entry.type === "dir",
        isFile: () => entry.type === "file",
      };
    },

    statSync: (p: string) => {
      const entry = store.get(norm(p));
      if (!entry) throw new Error(`ENOENT: ${p}`);
      return {
        isDirectory: () => entry.type === "dir",
        isFile: () => entry.type === "file" || entry.type === "symlink",
      };
    },

    readdirSync: (p: string) => {
      const prefix = norm(p.endsWith("/") || p.endsWith("\\") ? p : p + "/");
      const entries = new Set<string>();
      for (const k of store.keys()) {
        if (k.startsWith(prefix)) {
          const rest = k.slice(prefix.length);
          const firstSegment = rest.split("/")[0];
          if (firstSegment) entries.add(firstSegment);
        }
      }
      return [...entries].sort();
    },
  };
}
