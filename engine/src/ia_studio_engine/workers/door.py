"""
What every door is: one process, one adapter, one modality, one model at a time.

It refuses for what it alone can see — no model loaded, a device that failed, weights that carry
Python — and it never REPLANS: it does not free another door, does not reorder between doors, does
not substitute a model. A refusal travels back with its reason, and the main process makes the plan.
"""

from __future__ import annotations

import socket
import sys
from typing import Any

from ia_studio_engine.adapters.diffusers_adapter import DiffusersAdapter, memory_frame
from ia_studio_engine.adapters.modalities import Modality
from ia_studio_engine.protocol.envelope import encode_event
from ia_studio_engine.workers.base import WorkerLoop, worker_hello

#: What a door announces about how many jobs it takes.
#:
#: `[?]` **Not a measurement.** No diffusion workload has been run concurrently on any class of
#: machine, so this is the conservative reading and it is written as such: the queue serialises,
#: so ONE job at a time is what a door actually does today. § L.8 is the spike that would
#: replace these values — the axes are frozen, the values are not.
OCCUPANCY = {"process": "exclusive-process", "device": "exclusive", "maxConcurrent": 1}


def inline_handlers(door: str, adapter: DiffusersAdapter) -> dict[str, Any]:
    """Answered in the reading turn: no device call, so a running job never delays one."""

    def status(_params: dict[str, Any]) -> dict[str, Any]:
        held = adapter.loaded
        return {
            "door": door,
            "backend": adapter.backend(),
            "device": adapter.device(),
            "loaded": None if held is None else held.model_id,
        }

    return {
        "worker.status": status,
        "memory.info": lambda _params: memory_frame(adapter.device(), adapter.backend(), door),
    }


def queued_handlers(door: str, adapter: DiffusersAdapter, loop: WorkerLoop) -> dict[str, Any]:
    """Everything that touches the device, serialised by the queue — § A.5, exception 1."""

    def load(params: dict[str, Any]) -> dict[str, Any]:
        held = adapter.load(str(params["modelId"]), str(params["folder"]))
        return {
            "door": door,
            "heldBytes": held.bytes_resident,
            "tensorBytes": held.tensor_bytes,
            "device": held.device,
            "backend": adapter.backend(),
            "loadMs": round(held.load_ms, 1),
        }

    def unload(_params: dict[str, Any]) -> dict[str, Any]:
        adapter.unload()
        frame = memory_frame(adapter.device(), adapter.backend(), door)
        held = adapter.held_bytes()
        return {
            **frame,
            "heldBytes": 0 if held is None else held,
            "tensorBytes": frame["tensorBytes"] or 0,
        }

    def generate(params: dict[str, Any]) -> dict[str, Any]:
        job = params.get("jobId")

        def report(done: int, total: int) -> None:
            loop.send(encode_event("job.progress", job=job, ratio=round(done / total, 4)))

        return adapter.generate(
            params,
            str(params["destination"]),
            door,
            on_step=report,
            stopping=loop.queue.cancelled,
        )

    return {"models.load": load, "models.unload": unload, "generate": generate}


def serve(door: str, modality: Modality, argv: list[str] | None = None) -> int:
    """Started by the core with an inherited socket, never on its own."""
    arguments = list(sys.argv[1:] if argv is None else argv)
    if len(arguments) != 1:
        raise SystemExit(f"{door} is started with one inherited fd, got {arguments}")

    adapter = DiffusersAdapter(modality)
    connection = socket.socket(fileno=int(arguments[0]))
    WorkerLoop(
        connection,
        worker_hello(door, adapter.backend(), adapter.device(), OCCUPANCY),
        inline_handlers(door, adapter),
        lambda loop: queued_handlers(door, adapter, loop),
    ).run()
    return 0
