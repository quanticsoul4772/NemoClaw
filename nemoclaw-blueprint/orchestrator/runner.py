"""Blueprint orchestration runner.

Main entry point for executing NemoClaw blueprints against OpenShell.
Handles the full lifecycle: resolve, verify, plan, apply.
"""
from __future__ import annotations

import logging
import sys
from pathlib import Path

logger = logging.getLogger(__name__)


def run_blueprint(blueprint_path: str | Path, *, dry_run: bool = False) -> int:
    """Execute a blueprint against the current OpenShell environment.

    Args:
        blueprint_path: Path to the blueprint.yaml file.
        dry_run: If True, print the plan without applying it.

    Returns:
        Exit code (0 for success, non-zero for failure).
    """
    blueprint_path = Path(blueprint_path)
    if not blueprint_path.exists():
        logger.error("Blueprint not found: %s", blueprint_path)
        return 1

    logger.info("Running blueprint: %s (dry_run=%s)", blueprint_path, dry_run)
    # TODO: Implement full lifecycle: resolve, verify, plan, apply
    return 0


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="NemoClaw blueprint runner")
    parser.add_argument("blueprint", help="Path to blueprint.yaml")
    parser.add_argument("--dry-run", action="store_true", help="Print plan without applying")
    args = parser.parse_args()

    sys.exit(run_blueprint(args.blueprint, dry_run=args.dry_run))
