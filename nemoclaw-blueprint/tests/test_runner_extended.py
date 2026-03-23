#!/usr/bin/env python3
# SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

"""Extended tests for blueprint runner — covers action_apply, action_rollback, and main."""

import json
import os
import sys
from pathlib import Path
from unittest import mock

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from orchestrator.runner import action_apply, action_rollback, main

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
                    "credential_default": "",
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


class TestActionApply:
    """Tests for action_apply function."""

    @mock.patch("orchestrator.runner.run_cmd")
    def test_creates_sandbox_and_saves_state(self, mock_run, tmp_home, capsys):
        """Successful apply: creates sandbox, configures provider, saves run state."""
        mock_run.return_value = mock.Mock(returncode=0, stderr="")

        action_apply("default", SAMPLE_BLUEPRINT)

        # Should have called run_cmd at least 3 times: create, provider, inference
        assert mock_run.call_count >= 3

        # Verify sandbox create call
        create_call = mock_run.call_args_list[0]
        assert "sandbox" in create_call[0][0]
        assert "create" in create_call[0][0]

        # Verify state was saved
        state_dirs = list((tmp_home / ".nemoclaw" / "state" / "runs").iterdir())
        assert len(state_dirs) == 1
        plan_file = state_dirs[0] / "plan.json"
        assert plan_file.exists()
        plan = json.loads(plan_file.read_text())
        assert plan["profile"] == "default"
        assert plan["sandbox_name"] == "test-sandbox"

    @mock.patch("orchestrator.runner.run_cmd")
    def test_reuses_existing_sandbox(self, mock_run, tmp_home, capsys):
        """Reuses sandbox when it already exists."""
        mock_run.return_value = mock.Mock(returncode=1, stderr="already exists")

        action_apply("default", SAMPLE_BLUEPRINT)

        output = capsys.readouterr().out
        assert "already exists" in output or "reusing" in output.lower()

    @mock.patch("orchestrator.runner.run_cmd")
    def test_exits_on_sandbox_creation_failure(self, mock_run, tmp_home):
        """Exits when sandbox creation fails with unexpected error."""
        mock_run.return_value = mock.Mock(returncode=1, stderr="disk full")

        with pytest.raises(SystemExit):
            action_apply("default", SAMPLE_BLUEPRINT)

    @mock.patch("orchestrator.runner.run_cmd")
    def test_overrides_endpoint_url(self, mock_run, tmp_home):
        """Endpoint URL override is passed to provider config."""
        mock_run.return_value = mock.Mock(returncode=0, stderr="")

        action_apply("default", SAMPLE_BLUEPRINT, endpoint_url="https://custom.api/v1")

        # Check provider create call includes custom endpoint
        provider_call_args = mock_run.call_args_list[1][0][0]
        found_endpoint = any("custom.api" in str(arg) for arg in provider_call_args)
        assert found_endpoint

    @mock.patch("orchestrator.runner.run_cmd")
    def test_progress_reporting(self, mock_run, tmp_home, capsys):
        """Progress messages are emitted during apply."""
        mock_run.return_value = mock.Mock(returncode=0, stderr="")

        action_apply("default", SAMPLE_BLUEPRINT)

        output = capsys.readouterr().out
        assert "PROGRESS:" in output


class TestActionRollback:
    """Tests for action_rollback function."""

    @mock.patch("orchestrator.runner.run_cmd")
    def test_exits_when_run_not_found(self, mock_run, tmp_home):
        """Exits with error when run ID doesn't exist."""
        with pytest.raises(SystemExit):
            action_rollback("nonexistent-run")

    @mock.patch("orchestrator.runner.run_cmd")
    def test_successful_rollback(self, mock_run, tmp_home, capsys):
        """Successfully rolls back: stops sandbox, removes it, marks rolled back."""
        mock_run.return_value = mock.Mock(returncode=0, stderr="")

        # Create a run state
        run_dir = tmp_home / ".nemoclaw" / "state" / "runs" / "run-123"
        run_dir.mkdir(parents=True)
        (run_dir / "plan.json").write_text(
            json.dumps({"sandbox_name": "test-sandbox", "profile": "default"})
        )

        action_rollback("run-123")

        # Verify sandbox stop and remove were called
        assert mock_run.call_count >= 2
        stop_call = mock_run.call_args_list[0][0][0]
        assert "stop" in stop_call
        remove_call = mock_run.call_args_list[1][0][0]
        assert "remove" in remove_call

        # Verify rolled_back marker was written
        assert (run_dir / "rolled_back").exists()

        output = capsys.readouterr().out
        assert "Rollback complete" in output


class TestMain:
    """Tests for main CLI entry point."""

    @mock.patch("orchestrator.runner.action_plan")
    @mock.patch("orchestrator.runner.load_blueprint")
    def test_dispatches_plan_action(self, mock_load, mock_plan, tmp_home):
        """main() dispatches to action_plan for 'plan' action."""
        mock_load.return_value = SAMPLE_BLUEPRINT

        with mock.patch("sys.argv", ["runner.py", "plan", "--profile", "default"]):
            main()

        mock_plan.assert_called_once()
        call_args = mock_plan.call_args
        assert call_args[0][0] == "default"

    @mock.patch("orchestrator.runner.action_apply")
    @mock.patch("orchestrator.runner.load_blueprint")
    def test_dispatches_apply_action(self, mock_load, mock_apply, tmp_home):
        """main() dispatches to action_apply for 'apply' action."""
        mock_load.return_value = SAMPLE_BLUEPRINT

        with mock.patch("sys.argv", ["runner.py", "apply", "--profile", "ncp"]):
            main()

        mock_apply.assert_called_once()
        assert mock_apply.call_args[0][0] == "ncp"

    @mock.patch("orchestrator.runner.action_rollback")
    @mock.patch("orchestrator.runner.load_blueprint")
    def test_dispatches_rollback_with_run_id(self, mock_load, mock_rollback, tmp_home):
        """main() dispatches to action_rollback with --run-id."""
        mock_load.return_value = SAMPLE_BLUEPRINT

        with mock.patch("sys.argv", ["runner.py", "rollback", "--run-id", "run-abc"]):
            main()

        mock_rollback.assert_called_once_with("run-abc")
