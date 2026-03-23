#!/usr/bin/env python3
# SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

"""Tests for the snapshot/restore migration module."""

import json
import sys
from pathlib import Path
from unittest import mock

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from migrations.snapshot import (
    create_snapshot,
    cutover_host,
    list_snapshots,
    rollback_from_snapshot,
)


@pytest.fixture
def tmp_home(tmp_path):
    """Provide isolated HOME + patched module-level paths."""
    openclaw_dir = tmp_path / ".openclaw"
    nemoclaw_dir = tmp_path / ".nemoclaw"
    snapshots_dir = nemoclaw_dir / "snapshots"

    with (
        mock.patch("migrations.snapshot.HOME", tmp_path),
        mock.patch("migrations.snapshot.OPENCLAW_DIR", openclaw_dir),
        mock.patch("migrations.snapshot.NEMOCLAW_DIR", nemoclaw_dir),
        mock.patch("migrations.snapshot.SNAPSHOTS_DIR", snapshots_dir),
    ):
        yield tmp_path, openclaw_dir, nemoclaw_dir, snapshots_dir


class TestCreateSnapshot:
    def test_returns_none_when_no_openclaw_dir(self, tmp_home):
        _, _openclaw_dir, _, _ = tmp_home
        # .openclaw doesn't exist
        assert create_snapshot() is None

    def test_creates_snapshot_with_manifest(self, tmp_home):
        _, openclaw_dir, _, _snapshots_dir = tmp_home

        # Set up a fake .openclaw directory
        openclaw_dir.mkdir(parents=True)
        (openclaw_dir / "openclaw.json").write_text('{"test": true}')
        (openclaw_dir / "agents").mkdir()
        (openclaw_dir / "agents" / "main.json").write_text("{}")

        snapshot_dir = create_snapshot()

        assert snapshot_dir is not None
        assert snapshot_dir.exists()

        # Check manifest
        manifest_file = snapshot_dir / "snapshot.json"
        assert manifest_file.exists()
        manifest = json.loads(manifest_file.read_text())
        assert manifest["file_count"] == 2
        assert "openclaw.json" in manifest["contents"]

    def test_snapshot_copies_files(self, tmp_home):
        _, openclaw_dir, _, _ = tmp_home

        openclaw_dir.mkdir(parents=True)
        (openclaw_dir / "openclaw.json").write_text('{"key": "value"}')

        snapshot_dir = create_snapshot()

        copied = snapshot_dir / "openclaw" / "openclaw.json"
        assert copied.exists()
        assert json.loads(copied.read_text()) == {"key": "value"}


class TestCutoverHost:
    def test_cutover_archives_openclaw_dir(self, tmp_home):
        tmp_path, openclaw_dir, _, _ = tmp_home

        openclaw_dir.mkdir(parents=True)
        (openclaw_dir / "openclaw.json").write_text("{}")

        result = cutover_host(Path("unused"))

        assert result is True
        assert not openclaw_dir.exists()
        # Should have created an archive
        archives = list(tmp_path.glob(".openclaw.pre-nemoclaw.*"))
        assert len(archives) == 1

    def test_cutover_returns_true_when_no_openclaw(self, tmp_home):
        # .openclaw doesn't exist — nothing to archive
        result = cutover_host(Path("unused"))
        assert result is True


class TestRollbackFromSnapshot:
    def test_rollback_restores_files(self, tmp_home):
        _, openclaw_dir, _, _ = tmp_home

        # Create a fake snapshot
        snapshot_dir = Path(str(tmp_home[0])) / "test-snapshot"
        snapshot_src = snapshot_dir / "openclaw"
        snapshot_src.mkdir(parents=True)
        (snapshot_src / "openclaw.json").write_text('{"restored": true}')

        result = rollback_from_snapshot(snapshot_dir)

        assert result is True
        assert openclaw_dir.exists()
        data = json.loads((openclaw_dir / "openclaw.json").read_text())
        assert data["restored"] is True

    def test_rollback_returns_false_when_no_snapshot_data(self, tmp_home):
        snapshot_dir = Path(str(tmp_home[0])) / "empty-snapshot"
        snapshot_dir.mkdir(parents=True)
        # No "openclaw" subdirectory
        result = rollback_from_snapshot(snapshot_dir)
        assert result is False

    def test_rollback_archives_existing_config(self, tmp_home):
        tmp_path, openclaw_dir, _, _ = tmp_home

        # Existing .openclaw config
        openclaw_dir.mkdir(parents=True)
        (openclaw_dir / "openclaw.json").write_text('{"old": true}')

        # Snapshot to restore from
        snapshot_dir = tmp_path / "restore-snap"
        snapshot_src = snapshot_dir / "openclaw"
        snapshot_src.mkdir(parents=True)
        (snapshot_src / "openclaw.json").write_text('{"new": true}')

        result = rollback_from_snapshot(snapshot_dir)

        assert result is True
        # Original should be archived
        archives = list(tmp_path.glob(".openclaw.nemoclaw-archived.*"))
        assert len(archives) == 1
        # New config should be in place
        data = json.loads((openclaw_dir / "openclaw.json").read_text())
        assert data["new"] is True


class TestListSnapshots:
    def test_empty_when_no_snapshots_dir(self, tmp_home):
        assert list_snapshots() == []

    def test_lists_snapshots_with_manifests(self, tmp_home):
        _, _, _, snapshots_dir = tmp_home

        # Create two fake snapshots
        for ts in ["20260101T120000Z", "20260102T120000Z"]:
            snap_dir = snapshots_dir / ts
            snap_dir.mkdir(parents=True)
            manifest = {
                "timestamp": ts,
                "source": "/home/user/.openclaw",
                "file_count": 1,
                "contents": ["openclaw.json"],
            }
            (snap_dir / "snapshot.json").write_text(json.dumps(manifest))

        result = list_snapshots()
        assert len(result) == 2
        # Should be sorted newest first
        assert result[0]["timestamp"] == "20260102T120000Z"
        assert result[1]["timestamp"] == "20260101T120000Z"

    def test_skips_dirs_without_manifest(self, tmp_home):
        _, _, _, snapshots_dir = tmp_home

        # One with manifest, one without
        good = snapshots_dir / "20260101T120000Z"
        good.mkdir(parents=True)
        (good / "snapshot.json").write_text(json.dumps({"timestamp": "20260101T120000Z"}))

        bad = snapshots_dir / "20260102T120000Z"
        bad.mkdir(parents=True)
        # No snapshot.json

        result = list_snapshots()
        assert len(result) == 1
