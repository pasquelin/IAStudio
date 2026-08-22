"""
The `engine/diffusion` door: one process, one adapter, one model at a time.

It refuses for what it alone can see — no model loaded, a device that failed, weights that carry
Python — and it never REPLANS: it does not free another door, does not reorder between doors, does
not substitute a model. A refusal travels back with its reason, and the main process makes the plan.
"""

from __future__ import annotations

import socket
import sys
from collections.abc import Callable
from typing import Any

from ia_studio_engine.adapters.diffusers_adapter import DiffusersAdapter, memory_frame
from ia_studio_engine.protocol.envelope import encode_event
from ia_studio_engine.workers.base import WorkerLoop, worker_hello

DOOR = "engine/diffusion"


def inline_handlers(adapter: DiffusersAdapter) -> dict[str, Any]:
    """Answered in the reading turn: no device call, so a running job never delays one."""

    def status(_params: dict[str, Any]) -> dict[str, Any]:
        held = adapter.loaded
        return {
            "door": DOOR,
            "backend": adapter.backend(),
            "device": adapter.device(),
            "loaded": None if held is None else held.model_id,
        }

    return {
        "worker.status": status,
        "memory.info": lambda _params: memory_frame(adapter.device(), adapter.backend(), DOOR),
    }


def queued_handlers(adapter: DiffusersAdapter) -> Callable[[WorkerLoop], dict[str, Any]]:
    """Everything that touches the device, serialised by the queue — § A.5, exception 1."""

    def build(loop: WorkerLoop) -> dict[str, Any]:
        return _device_handlers(adapter, loop)

    return build


def _device_handlers(adapter: DiffusersAdapter, loop: WorkerLoop) -> dict[str, Any]:
    def load(params: dict[str, Any]) -> dict[str, Any]:
        held = adapter.load(str(params["modelId"]), str(params["folder"]))
        return {
            "door": DOOR,
            "heldBytes": held.bytes_resident,
            "tensorBytes": held.tensor_bytes,
            "device": held.device,
            "backend": adapter.backend(),
            "loadMs": round(held.load_ms, 1),
        }

    def unload(_params: dict[str, Any]) -> dict[str, Any]:
        adapter.unload()
        return {"door": DOOR, "heldBytes": adapter.held_bytes(), "tensorBytes": 0}

    def generate(params: dict[str, Any]) -> dict[str, Any]:
        job = params.get("jobId")

        def report(done: int, total: int) -> None:
            loop.send(encode_event("job.progress", job=job, ratio=round(done / total, 4)))

        return adapter.generate(
            params,
            str(params["destination"]),
            DOOR,
            on_step=report,
            stopping=loop.queue.cancelled,
        )

    return {"models.load": load, "models.unload": unload, "generate": generate}


def main(argv: list[str] | None = None) -> int:
    """Started by the core with an inherited socket, never on its own."""
    arguments = list(sys.argv[1:] if argv is None else argv)
    if len(arguments) != 1:
        raise SystemExit("usage: python -m ia_studio_engine.workers.diffusion <inherited-fd>")

    adapter = DiffusersAdapter()
    connection = socket.socket(fileno=int(arguments[0]))
    WorkerLoop(
        connection,
        worker_hello(DOOR, adapter.backend(), adapter.device()),
        inline_handlers(adapter),
        queued_handlers(adapter),
    ).run()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
