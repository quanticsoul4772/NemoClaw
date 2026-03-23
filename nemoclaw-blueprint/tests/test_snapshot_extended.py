#!/usr/bin/env python3
# SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

"""Extended tests for snapshot module — covers restore_into_sandbox."""

import os
import sys
from pathlib import Path
from unittest import mock

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from migrations.snapshot import restore_into_sandbox


@pytest.fixture
def tmp_home(tmp_path):
    """Provide isolated HOME + patched module-level paths."""
    with (
        mock.patch.dict(os.environ, {"HOME": str(tmp_path)}),
        mock.patch("migrations.snapshot.HOME", tmp_path),
        mock.patch("migrations.snapshot.OPENCLAW_DIR", tmp_path / ".openclaw"),
        mock.patch("migrations.snapshot.NEMOCLAW_DIR", tmp_path / ".nemoclaw"),
        mock.patch("migrations.snapshot.SNAPSHOTS_DIR", tmp_path / ".nemoclaw" / "snapshots"),
    ):
        yield tmp_path


class TestRestoreIntoSandbox:
    """Tests for restore_into_sandbox function."""

    def test_returns_false_when_openclaw_dir_missing(self, tmp_home):
        """Returns False when snapshot doesn't contain openclaw directory."""
        snapshot_dir = tmp_home / "snapshot"
        snapshot_dir.mkdir()
        # No 'openclaw' subdirectory
        result = restore_into_sandbox(snapshot_dir, "my-sandbox")
        assert result is False

    @mock.patch("migrations.snapshot.subprocess.run")
    def test_returns_true_on_successful_copy(self, mock_run, tmp_home):
        """Returns True when openshell sandbox cp succeeds."""
        snapshot_dir = tmp_home / "snapshot"
        openclaw_dir = snapshot_dir / "openclaw"
        openclaw_dir.mkdir(parents=True)
        (openclaw_dir / "config.json").write_text("{}")

        mock_run.return_value = mock.Mock(returncode=0)

        result = restore_into_sandbox(snapshot_dir, "my-sandbox")
        assert result is True
        mock_run.assert_called_once()

    @mock.patch("migrations.snapshot.subprocess.run")
    def test_returns_false_on_subprocess_failure(self, mock_run, tmp_home):
        """Returns False when openshell sandbox cp fails."""
        snapshot_dir = tmp_home / "snapshot"
        openclaw_dir = snapshot_dir / "openclaw"
        openclaw_dir.mkdir(parents=True)

        mock_run.return_value = mock.Mock(returncode=1)

        result = restore_into_sandbox(snapshot_dir, "my-sandbox")
        assert result is False

    @mock.patch("migrations.snapshot.subprocess.run")
    def test_passes_correct_command_arguments(self, mock_run, tmp_home):
        """Verifies the correct openshell sandbox cp command is constructed."""
        snapshot_dir = tmp_home / "snapshot"
        openclaw_dir = snapshot_dir / "openclaw"
        openclaw_dir.mkdir(parents=True)

        mock_run.return_value = mock.Mock(returncode=0)

        restore_into_sandbox(snapshot_dir, "test-sandbox")

        call_args = mock_run.call_args[0][0]
        assert call_args[0] == "openshell"
        assert call_args[1] == "sandbox"
        assert call_args[2] == "cp"
        assert str(openclaw_dir) in call_args[3]
        assert "test-sandbox:/sandbox/.openclaw" in call_args[4]
