# SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

"""
Test configuration for nemoclaw-blueprint tests.

Some test modules depend on Python packages (orchestrator, migrations) that
are part of the NVIDIA upstream environment but are not included in this fork.
Those tests are skipped automatically when the modules are unavailable.
"""

import sys
from pathlib import Path

# Ensure nemoclaw-blueprint/ is on sys.path so module discovery works
_root = Path(__file__).parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))


def pytest_ignore_collect(collection_path, config):
    """Skip test files whose required upstream modules are missing in this fork."""
    _module_guards = {
        "test_runner.py": "orchestrator",
        "test_snapshot.py": "migrations",
    }
    guard = _module_guards.get(collection_path.name)
    if guard is None:
        return None
    try:
        __import__(guard)
        return None  # Module found — collect normally
    except ImportError:
        return True  # Skip this file
