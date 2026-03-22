#!/usr/bin/env python3
# SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

"""Tests for the blueprint runner module."""

import json
import os
import sys
import tempfile
from pathlib import Path
from unittest import mock

import pytest
import yaml

# Add parent to path so we can import the modules under test
sys.path.insert(0, str(Path(__file__).parent.parent))

from orchestrator.runner import (
    action_plan,
    action_status,
    emit_run_id,
    load_blueprint,
    log,
    openshell_available,
    progress,
    run_cmd,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

SAMPLE_BLUEPRINT = {
    "version": "0.1.0",
    "components": {
        "sandbox": {
            "image": "test-image:latest",
            "name": "test-sandbox",
            "forward_ports": [18789],
        },
        "inference": {
            "profiles": {
                "default": {
                    "provider_type": "nvidia",
                    "provider_name": "nvidia-inference",
                    "endpoint": "https://api.nvidia.com/v1",
                    "model": "nvidia/nemotron-3-super-120b-a12b",
                    "credential_env": "NVIDIA_API_KEY",
                },
                "local": {
                    "provider_type": "openai",
                    "provider_name": "nim-local",
                    "endpoint": "http://localhost:8000/v1",
                    "model": "nvidia/nemotron-3-nano-30b-a3b",
                },
            },
        },
        "policy": {"additions": {}},
    },
}


@pytest.fixture
def tmp_home(tmp_path):
    """Provide an isolated HOME directory."""
    with mock.patch.dict(os.environ, {"HOME": str(tmp_path)}):
        yield tmp_path


@pytest.fixture
def blueprint_dir(tmp_path):
    """Create a temp directory with a valid blueprint.yaml."""
    bp_file = tmp_path / "blueprint.yaml"
    bp_file.write_text(yaml.dump(SAMPLE_BLUEPRINT))
    return tmp_path


# ---------------------------------------------------------------------------
# Tests: utility functions
# ---------------------------------------------------------------------------


class TestLog:
    def test_log_writes_to_stdout(self, capsys):
        log("hello world")
        assert capsys.readouterr().out == "hello world\n"


class TestProgress:
    def test_progress_format(self, capsys):
        progress(42, "doing stuff")
        assert capsys.readouterr().out == "PROGRESS:42:doing stuff\n"

    def test_progress_zero(self, capsys):
        progress(0, "starting")
        assert "PROGRESS:0:starting" in capsys.readouterr().out

    def test_progress_hundred(self, capsys):
        progress(100, "done")
        assert "PROGRESS:100:done" in capsys.readouterr().out


class TestEmitRunId:
    def test_format(self, capsys):
        rid = emit_run_id()
        output = capsys.readouterr().out
        assert rid.startswith("nc-")
        assert f"RUN_ID:{rid}" in output

    def test_unique(self):
        """Two calls should produce different IDs."""
        id1 = emit_run_id()
        id2 = emit_run_id()
        assert id1 != id2


class TestRunCmd:
    def test_captures_stdout(self):
        result = run_cmd(["echo", "hello"], capture=True)
        assert result.stdout.strip() == "hello"

    def test_returns_exit_code(self):
        result = run_cmd(["false"], check=False)
        assert result.returncode != 0

    def test_check_raises_on_failure(self):
        with pytest.raises(Exception):
            run_cmd(["false"], check=True)

    def test_never_uses_shell(self):
        """Verify run_cmd uses list args, not shell strings."""
        # If shell=True were used, this would execute differently
        result = run_cmd(["echo", "a; echo b"], capture=True)
        assert result.stdout.strip() == "a; echo b"


class TestOpenshellAvailable:
    def test_returns_bool(self):
        result = openshell_available()
        assert isinstance(result, bool)


# ---------------------------------------------------------------------------
# Tests: load_blueprint
# ---------------------------------------------------------------------------


class TestLoadBlueprint:
    def test_loads_valid_blueprint(self, blueprint_dir):
        with mock.patch.dict(os.environ, {"NEMOCLAW_BLUEPRINT_PATH": str(blueprint_dir)}):
            bp = load_blueprint()
            assert bp["version"] == "0.1.0"
            assert "components" in bp

    def test_exits_when_file_missing(self, tmp_path):
        with mock.patch.dict(os.environ, {"NEMOCLAW_BLUEPRINT_PATH": str(tmp_path)}):
            with pytest.raises(SystemExit) as exc:
                load_blueprint()
            assert exc.value.code == 1


# ---------------------------------------------------------------------------
# Tests: action_plan
# ---------------------------------------------------------------------------


class TestActionPlan:
    def test_plan_returns_structure(self, tmp_home, capsys):
        with mock.patch("orchestrator.runner.openshell_available", return_value=True):
            plan = action_plan("default", SAMPLE_BLUEPRINT)

        assert plan["profile"] == "default"
        assert plan["sandbox"]["name"] == "test-sandbox"
        assert plan["sandbox"]["image"] == "test-image:latest"
        assert plan["inference"]["provider_type"] == "nvidia"
        assert plan["inference"]["model"] == "nvidia/nemotron-3-super-120b-a12b"
        assert plan["dry_run"] is False

    def test_plan_dry_run_flag(self, tmp_home, capsys):
        with mock.patch("orchestrator.runner.openshell_available", return_value=True):
            plan = action_plan("default", SAMPLE_BLUEPRINT, dry_run=True)
        assert plan["dry_run"] is True

    def test_plan_endpoint_override(self, tmp_home, capsys):
        with mock.patch("orchestrator.runner.openshell_available", return_value=True):
            plan = action_plan(
                "default", SAMPLE_BLUEPRINT, endpoint_url="http://custom:9000/v1"
            )
        assert plan["inference"]["endpoint"] == "http://custom:9000/v1"

    def test_plan_invalid_profile_exits(self, tmp_home):
        with mock.patch("orchestrator.runner.openshell_available", return_value=True):
            with pytest.raises(SystemExit) as exc:
                action_plan("nonexistent-profile", SAMPLE_BLUEPRINT)
            assert exc.value.code == 1

    def test_plan_no_openshell_exits(self, tmp_home):
        with mock.patch("orchestrator.runner.openshell_available", return_value=False):
            with pytest.raises(SystemExit) as exc:
                action_plan("default", SAMPLE_BLUEPRINT)
            assert exc.value.code == 1

    def test_plan_emits_progress(self, tmp_home, capsys):
        with mock.patch("orchestrator.runner.openshell_available", return_value=True):
            action_plan("default", SAMPLE_BLUEPRINT)
        output = capsys.readouterr().out
        assert "PROGRESS:10:" in output
        assert "PROGRESS:100:" in output


# ---------------------------------------------------------------------------
# Tests: action_status
# ---------------------------------------------------------------------------


class TestActionStatus:
    def test_status_no_runs(self, tmp_home, capsys):
        with pytest.raises(SystemExit) as exc:
            action_status()
        assert exc.value.code == 0

    def test_status_with_run(self, tmp_home, capsys):
        # Create a fake run state
        run_dir = tmp_home / ".nemoclaw" / "state" / "runs" / "nc-test-run"
        run_dir.mkdir(parents=True)
        plan_data = {"run_id": "nc-test-run", "profile": "default"}
        (run_dir / "plan.json").write_text(json.dumps(plan_data))

        action_status(rid="nc-test-run")
        output = capsys.readouterr().out
        assert "nc-test-run" in output

    def test_status_specific_run_id(self, tmp_home, capsys):
        run_dir = tmp_home / ".nemoclaw" / "state" / "runs" / "nc-specific"
        run_dir.mkdir(parents=True)
        (run_dir / "plan.json").write_text(json.dumps({"run_id": "nc-specific"}))

        action_status(rid="nc-specific")
        output = capsys.readouterr().out
        assert "nc-specific" in output
