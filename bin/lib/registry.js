// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0
//
// Multi-sandbox registry at ~/.nemoclaw/sandboxes.json

const fs = require("fs");
const path = require("path");

const REGISTRY_FILE = path.join(process.env.HOME || "/tmp", ".nemoclaw", "sandboxes.json");

// In-memory cache — avoids re-reading/re-parsing the registry on every
// getSandbox(), getDefault(), listSandboxes(), etc.
let _registryCache = null;
let _registryCacheMtime = 0;

function load() {
  try {
    if (!fs.existsSync(REGISTRY_FILE)) return { sandboxes: {}, defaultSandbox: null };
    const mtime = fs.statSync(REGISTRY_FILE).mtimeMs;
    if (_registryCache && _registryCacheMtime === mtime) return _registryCache;
    _registryCache = JSON.parse(fs.readFileSync(REGISTRY_FILE, "utf-8"));
    _registryCacheMtime = mtime;
    return _registryCache;
  } catch (err) {
    if (process.env.NEMOCLAW_VERBOSE === "1") {
      console.error(`  Warning: failed to load sandbox registry: ${err.message}`);
    }
    return { sandboxes: {}, defaultSandbox: null };
  }
}

function _invalidateRegistryCache() {
  _registryCache = null;
  _registryCacheMtime = 0;
}

function save(data) {
  const dir = path.dirname(REGISTRY_FILE);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(REGISTRY_FILE, JSON.stringify(data, null, 2), { mode: 0o600 });
  _invalidateRegistryCache();
}

function getSandbox(name) {
  const data = load();
  return data.sandboxes[name] || null;
}

function getDefault() {
  const data = load();
  if (data.defaultSandbox && data.sandboxes[data.defaultSandbox]) {
    return data.defaultSandbox;
  }
  // Fall back to first sandbox if default is missing
  const names = Object.keys(data.sandboxes);
  return names.length > 0 ? names[0] : null;
}

function registerSandbox(entry) {
  const data = load();
  data.sandboxes[entry.name] = {
    name: entry.name,
    createdAt: entry.createdAt || new Date().toISOString(),
    model: entry.model || null,
    nimContainer: entry.nimContainer || null,
    provider: entry.provider || null,
    gpuEnabled: entry.gpuEnabled || false,
    policies: entry.policies || [],
  };
  if (!data.defaultSandbox) {
    data.defaultSandbox = entry.name;
  }
  save(data);
}

function updateSandbox(name, updates) {
  const data = load();
  if (!data.sandboxes[name]) return false;
  Object.assign(data.sandboxes[name], updates);
  save(data);
  return true;
}

function removeSandbox(name) {
  const data = load();
  if (!data.sandboxes[name]) return false;
  delete data.sandboxes[name];
  if (data.defaultSandbox === name) {
    const remaining = Object.keys(data.sandboxes);
    data.defaultSandbox = remaining.length > 0 ? remaining[0] : null;
  }
  save(data);
  return true;
}

function listSandboxes() {
  const data = load();
  return {
    sandboxes: Object.values(data.sandboxes),
    defaultSandbox: data.defaultSandbox,
  };
}

function setDefault(name) {
  const data = load();
  if (!data.sandboxes[name]) return false;
  data.defaultSandbox = name;
  save(data);
  return true;
}

module.exports = {
  load,
  save,
  getSandbox,
  getDefault,
  registerSandbox,
  updateSandbox,
  removeSandbox,
  listSandboxes,
  setDefault,
};
