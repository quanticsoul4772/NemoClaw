// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const STATE_DIR = join(process.env.HOME ?? "/tmp", ".nemoclaw", "state");

export interface NemoClawState {
  lastRunId: string | null;
  lastAction: string | null;
  blueprintVersion: string | null;
  sandboxName: string | null;
  migrationSnapshot: string | null;
  hostBackupPath: string | null;
  createdAt: string | null;
  updatedAt: string;
}

let stateDirCreated = false;

function ensureStateDir(): void {
  if (stateDirCreated) return;
  if (!existsSync(STATE_DIR)) {
    mkdirSync(STATE_DIR, { recursive: true });
  }
  stateDirCreated = true;
}

function statePath(): string {
  return join(STATE_DIR, "nemoclaw.json");
}

function blankState(): NemoClawState {
  return {
    lastRunId: null,
    lastAction: null,
    blueprintVersion: null,
    sandboxName: null,
    migrationSnapshot: null,
    hostBackupPath: null,
    createdAt: null,
    updatedAt: new Date().toISOString(),
  };
}

export function loadState(): NemoClawState {
  ensureStateDir();
  const path = statePath();
  if (!existsSync(path)) {
    return blankState();
  }
  return JSON.parse(readFileSync(path, "utf-8")) as NemoClawState;
}

export function saveState(state: NemoClawState): void {
  ensureStateDir();
  state.updatedAt = new Date().toISOString();
  state.createdAt ??= state.updatedAt;
  // Atomic write: write to a sibling .tmp file then rename into place.
  // If the process is killed mid-write the real state file is untouched.
  const dest = statePath();
  const tmp = `${dest}.tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 2));
  renameSync(tmp, dest);
}

export function clearState(): void {
  ensureStateDir();
  const dest = statePath();
  if (existsSync(dest)) {
    const tmp = `${dest}.tmp`;
    writeFileSync(tmp, JSON.stringify(blankState(), null, 2));
    renameSync(tmp, dest);
  }
}
