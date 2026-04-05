#!/usr/bin/env python3
# SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

"""Blueprint orchestration runner.

Handles the full lifecycle for executing NemoClaw blueprints against OpenShell:
resolve, verify, plan, apply.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import uuid
from pathlib import Path

import yaml

# ---------------------------------------------------------------------------
# Utility helpers
# ---------------------------------------------------------------------------


def log(msg: str) -> None:
    """Print a message to stdout."""
    print(msg)


def progress(pct: int, msg: str) -> None:
    """Emit a structured progress line consumed by the CLI progress bar."""
    print(f"PROGRESS:{pct}:{msg}")


def emit_run_id() -> str:
    """Generate and announce a unique run ID.

    Returns:
        The generated run ID string (e.g. ``nc-a1b2c3d4e5f6``).
    """
    rid = f"nc-{uuid.uuid4().hex[:12]}"
    print(f"RUN_ID:{rid}")
    return rid


def run_cmd(
    args: list[str],
    *,
    capture: bool = False,
    check: bool = True,
) -> subprocess.CompletedProcess:
    """Run a subprocess command.

    Args:
        args: Command and arguments as a list (never passed through a shell).
        capture: If True, capture stdout and stderr and return them.
        check: If True (default), raise on non-zero exit code.

    Returns:
        A :class:`subprocess.CompletedProcess` instance.
    """
    return subprocess.run(
        args,
        capture_output=capture,
        text=True,
        check=check,
    )


def openshell_available() -> bool:
    """Return True if the ``openshell`` binary is on PATH."""
    return shutil.which("openshell") is not None


# ---------------------------------------------------------------------------
# Blueprint loading
# ---------------------------------------------------------------------------


def load_blueprint() -> dict:
    """Load and return the blueprint YAML from the configured path.

    Reads from the directory given by ``$NEMOCLAW_BLUEPRINT_PATH``
    (defaults to the current directory).  Exits with code 1 if the file
    does not exist.
    """
    bp_dir = Path(os.environ.get("NEMOCLAW_BLUEPRINT_PATH", "."))
    bp_file = bp_dir / "blueprint.yaml"
    if not bp_file.exists():
        log(f"ERROR: Blueprint not found: {bp_file}")
        sys.exit(1)
    with bp_file.open() as fh:
        return yaml.safe_load(fh)


# ---------------------------------------------------------------------------
# Actions
# ---------------------------------------------------------------------------


def action_plan(
    profile: str,
    blueprint: dict,
    *,
    dry_run: bool = False,
    endpoint_url: str | None = None,
) -> dict:
    """Build and return an execution plan for the given inference profile.

    Args:
        profile: The inference profile name (key under ``components.inference.profiles``).
        blueprint: Parsed blueprint dictionary.
        dry_run: If True, mark the plan as a dry run (nothing will be applied).
        endpoint_url: Override the inference endpoint URL from the profile.

    Returns:
        A plan dictionary with keys ``profile``, ``sandbox``, ``inference``,
        and ``dry_run``.

    Raises:
        SystemExit(1): If ``openshell`` is unavailable or the profile is unknown.
    """
    progress(10, "Checking prerequisites")

    if not openshell_available():
        log("ERROR: openshell is not available on PATH")
        sys.exit(1)

    components = blueprint.get("components", {})
    sandbox_spec = components.get("sandbox", {})
    inference_profiles = components.get("inference", {}).get("profiles", {})

    if profile not in inference_profiles:
        log(f"ERROR: Unknown inference profile: {profile!r}")
        sys.exit(1)

    inf = dict(inference_profiles[profile])
    if endpoint_url is not None:
        inf["endpoint"] = endpoint_url

    plan: dict = {
        "profile": profile,
        "sandbox": {
            "name": sandbox_spec.get("name", "nemoclaw-sandbox"),
            "image": sandbox_spec.get("image", ""),
            "forward_ports": sandbox_spec.get("forward_ports", []),
        },
        "inference": inf,
        "dry_run": dry_run,
    }

    progress(100, "Plan complete")
    return plan


def action_status(*, rid: str | None = None) -> None:
    """Print status for one or all blueprint runs.

    Reads persisted run state from ``~/.nemoclaw/state/runs/``.
    Exits with code 0 if no runs are found.

    Args:
        rid: If given, show status for this specific run ID only.
    """
    state_dir = Path.home() / ".nemoclaw" / "state" / "runs"

    if not state_dir.exists():
        log("No runs found.")
        sys.exit(0)

    if rid is not None:
        run_dir = state_dir / rid
        if not run_dir.exists():
            log(f"Run not found: {rid}")
            sys.exit(1)
        plan_file = run_dir / "plan.json"
        if plan_file.exists():
            data = json.loads(plan_file.read_text())
            log(json.dumps(data, indent=2))
        return

    run_dirs = sorted(state_dir.iterdir())
    if not run_dirs:
        log("No runs found.")
        sys.exit(0)

    for run_dir in run_dirs:
        plan_file = run_dir / "plan.json"
        if plan_file.exists():
            data = json.loads(plan_file.read_text())
            log(f"  {data.get('run_id', run_dir.name)}: {data.get('profile', 'unknown')}")


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="NemoClaw blueprint runner")
    subparsers = parser.add_subparsers(dest="command")

    plan_cmd = subparsers.add_parser("plan", help="Build an execution plan")
    plan_cmd.add_argument("profile", help="Inference profile to use")
    plan_cmd.add_argument("--dry-run", action="store_true")
    plan_cmd.add_argument("--endpoint", help="Override inference endpoint URL")

    status_cmd = subparsers.add_parser("status", help="Show run status")
    status_cmd.add_argument("--run-id", help="Specific run ID")

    args = parser.parse_args()

    if args.command == "plan":
        bp = load_blueprint()
        action_plan(args.profile, bp, dry_run=args.dry_run, endpoint_url=args.endpoint)
    elif args.command == "status":
        action_status(rid=getattr(args, "run_id", None))
    else:
        parser.print_help()
        sys.exit(1)
