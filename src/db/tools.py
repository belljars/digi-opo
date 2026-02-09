"""Minimal Python utility for future data import tasks."""

from pathlib import Path


def main() -> None:
    project_root = Path(__file__).resolve().parents[2]
    print(f"digi-opo project root: {project_root}")


if __name__ == "__main__":
    main()
