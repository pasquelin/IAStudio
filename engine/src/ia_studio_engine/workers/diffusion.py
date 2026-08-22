"""
The `engine/diffusion` door: one process, one adapter, one model at a time.

It refuses for what it alone can see — no model loaded, a device that failed — and it never
REPLANS: it does not free another door, does not reorder, does not substitute a model. A refusal
travels back with its reason, and the main process is what turns one into a plan.
"""

from __future__ import annotations

import socket
import sys
from typing import Any

from ia_studio_engine.adapters.diffusers_adapter import DiffusersAdapter
from ia_studio_engine.workers.base import run_worker, worker_hello

DOOR = "engine/diffusion"

ADAPTERS = {"diffusers": DiffusersAdapter}


def handlers_for(adapter: DiffusersAdapter) -> dict[str, Any]:
    def load(params: dict[str, Any]) -> dict[str, Any]:
        held = adapter.load(str(params["modelId"]), str(params["folder"]))
        return {
            "bytes": held.bytes_resident,
            "device": held.device,
            "backend": adapter.backend(),
            "loadMs": round(held.load_ms, 1),
        }

    def unload(_params: dict[str, Any]) -> dict[str, Any]:
        adapter.unload()
        return {}

    def status(_params: dict[str, Any]) -> dict[str, Any]:
        held = adapter.loaded
        return {
            "door": DOOR,
            "backend": adapter.backend(),
            "device": adapter.device(),
            "loaded": None if held is None else held.model_id,
            "bytes": None if held is None else held.bytes_resident,
        }

    return {
        "models.load": load,
        "models.unload": unload,
        "worker.status": status,
        "generate": lambda params: adapter.generate(params, str(params["destination"])),
    }


def main(argv: list[str] | None = None) -> int:
    """Started by the core with an inherited socket, never on its own."""
    arguments = list(sys.argv[1:] if argv is None else argv)
    if len(arguments) != 1:
        raise SystemExit("usage: python -m ia_studio_engine.workers.diffusion <inherited-fd>")

    adapter = DiffusersAdapter()
    connection = socket.socket(fileno=int(arguments[0]))
    run_worker(
        connection,
        worker_hello(DOOR, adapter.backend(), adapter.device()),
        handlers_for(adapter),
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
