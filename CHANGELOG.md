# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - 2026-03-22

### Features

- Merge pull request #21 from NVIDIA/feat/openclaw-gateway-start (a9d8b48)
- Remove model catalog monkeypatch, add JensenClaw web UI (8394e58)

### Bug Fixes

- fix: gate local-model onboarding behind NEMOCLAW_EXPERIMENTAL=1 (#73) (0227e1c)
- fix: detect cgroup v2 misconfiguration during onboard preflight (#62) (65dad39)
- fix: verify nemoclaw is on PATH after install (#70) (6a6fb1e)
- Merge pull request #42 from martinmose/fix/colima-xdg-socket-path (39dc36d)
- fix: support XDG-compliant Colima socket path (7dbc61f)
- fix: fail fast on unsupported installer runtimes (740c701)
- Merge pull request #31 from BunsDev/patch-1 (e1760c9)
- Fix link to NVIDIA Agent Toolkit documentation (64e5ccf)
- Merge pull request #27 from NVIDIA/fix/remove-easter-egg (f0a9a1a)
- fix: remove JensenClaw easter egg (command injection vulnerability) (ad112d2)
- Merge pull request #7 from NVIDIA/fix/update-repo-references (45e9433)
- fix: update all repo references from openshell-openclaw-plugin to NemoClaw (8fab991)
- fix docs landing page (864675f)
- Merge pull request #22 from kedarpotdar-nv/kedar/spark-setup-fix (2d987da)
- Merge pull request #23 from NVIDIA/fix-ollama-firewall-dns (b99ac19)
- Fix ollama access through firewall (fbe2b8e)
- fix: detect DGX Spark GB10 GPU with unified memory fallback (841e1e2)
- fixed build api keys instructions (16be33c)
- Merge pull request #19 from NVIDIA/fix-api-onboarding (cc18fea)
- Fix onboarding fix (f109a74)
- Fix vLLM install: fallback when --break-system-packages unsupported (66d14fe)
- Fix github.com and npmjs.org 403: use access: full instead of tls: terminate (24a1b4e)
- Fix policy-add: add version: 1 when no existing policy found (f6a23ac)
- Fix install.sh: use fail() not return 1 for Docker not running (021f21b)
- Fix brev-setup: install python3-pip before vLLM if missing (604c6af)
- Fix CoreDNS: use container resolv.conf DNS, always run on macOS (27f656c)
- Fix policy schema: rules inside endpoints, version field, sandbox create flow (8a9c583)
- Merge pull request #5 from vincentkoc/vincentkoc-code/nemoclaw-migrate-hooks (7f321cd)
- fix: migrate OpenClaw state into sandbox (b3869c8)
- Merge pull request #4 from NVIDIA/fix-brev-cli-link (7c009f3)
- Fix Brev CLI link and add Brev account link in README (067759f)
- Fix CoreDNS CrashLoop and improve sandbox failure detection (195c87b)
- Fix setup.sh silently swallowing sandbox build failures (12e9497)
- Fix Ubuntu 24.04 E2E install: ship dist/, fix OOM, fix setup bugs (fd4ec7f)
- Fix egg command: use nohup so processes survive SSH disconnect (ef651c9)
- Fix OpenShell install: it's a binary, not a pip package (a59d9fa)
- Fix pipx PATH in Ubuntu instructions (de31ce2)
- Fix README for pre-publish install and Ubuntu 24.04 (21c836b)
- Fix deploy credential passing via .env file (8176cef)
- Fix deploy: check exit codes, use scp instead of brev copy (3fd3114)
- Fix brev deploy: use correct brev copy and ssh syntax (0d497fd)
- Fix model ID (double nvidia/ prefix) and plugin ID mismatch (ac3efff)
- Fix .dockerignore: only exclude root dist/, not nemoclaw/dist/ (6d0d783)
- Fix Docker build from npm install path (8cccb16)
- Remove GitHub token requirement, simplify install flow (47e2dd4)
- Fix info box alignment — right border off by one (5384dd7)
- Fix stale logs.ts references, update README to match implementation (f9e9a56)
- Fix plugin ID mismatch warning (6536804)
- Fix test fixtures and plugin install format (cc92547)
- Fix README architecture diagram alignment and formatting (4b5b0a4)

### Documentation

- docs: update quickstart command, improve top of TOC doc pages (#85) (496d827)
- Merge pull request #64 from NVIDIA/vdr-13-1 (ba72229)
- Merge pull request #26 from NVIDIA/llane-vdr-docs-sweep (8e2e5dc)
- Merge pull request #28 from NVIDIA/miyoungc-patch-2 (80da663)
- docs: fix README links (22525dd)
- docs: replace deprecated nemoclaw setup with onboard, add missing commands (055c5f7)
- Merge pull request #28 from NVIDIA/vdr-fixes (459b640)
- Merge pull request #26 from NVIDIA/readme-and-quickstart (069f49a)
- Merge pull request #8 from NVIDIA/miyoungc/search-ext (3b5b445)
- Merge pull request #7 from NVIDIA/miyoungc/setup-initial-doc (16d89a8)
- docs: initiate nemoclaw doc (0aef9a6)

### Security

- security: verify integrity of downloaded scripts before execution (#106) (3baea92)

### Other Changes

- Miscellaneous improvements
