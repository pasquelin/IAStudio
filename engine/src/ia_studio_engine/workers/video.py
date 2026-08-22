"""The `engine/video` door. What it is lives in `door.py`; what differs is these two words."""

from __future__ import annotations

from ia_studio_engine.adapters.modalities import MODALITIES
from ia_studio_engine.workers.door import serve

DOOR = "engine/video"


def main(argv: list[str] | None = None) -> int:
    return serve(DOOR, MODALITIES["video"], argv)


if __name__ == "__main__":
    raise SystemExit(main())
