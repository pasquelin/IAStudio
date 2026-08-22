"""
What the core does with a request it cannot answer itself: hand it to the door that can, and turn
what comes back into the studio's vocabulary.

The core decides NOTHING here. It does not choose a device, does not free another door, does not
substitute a model. A refusal travels back with its reason and the main process makes the plan.
"""

from __future__ import annotations

import json
import threading
from collections.abc import Callable
from typing import Any

from ia_studio_engine import PROTOCOL_VERSION
from ia_studio_engine.core.memory import DoorMemory, MemoryLedger
from ia_studio_engine.core.workers import WorkerProcess
from ia_studio_engine.protocol.envelope import encode_event

DIFFUSION_DOOR = "engine/diffusion"
DIFFUSION_MODULE = "ia_studio_engine.workers.diffusion"

Send = Callable[[str], None]
Spawn = Callable[[Callable[[dict], None], Callable[[], None]], WorkerProcess]


class DoorRouter:
    """One door, started on first ask. A worker that never had to run is one that costs nothing."""

    def __init__(self, send: Send, spawn: Spawn, ledger: MemoryLedger | None = None) -> None:
        self._send = send
        self._spawn = spawn
        self.ledger = ledger if ledger is not None else MemoryLedger()
        self._worker: WorkerProcess | None = None
        self._lock = threading.Lock()
        # Which JOB each run of the worker belongs to, so its answer can be named on the way out.
        # Read by the pump thread and written by the loop, hence the lock rather than a reliance on
        # what CPython happens to make atomic.
        self._runs: dict[int, str] = {}

    def _worker_said(self, frame: dict[str, Any]) -> None:
        # An EVENT belongs to no run and is passed straight through: `job.progress` is the only
        # thing a job says while it runs, and a router that only knew about answers dropped it.
        if "evt" in frame:
            self._send(json.dumps({**frame, "v": PROTOCOL_VERSION}, separators=(",", ":")) + "\n")
            return

        run = frame.get("id")
        with self._lock:
            job = self._runs.pop(run, None) if isinstance(run, int) else None
        if job is None:
            return

        if "err" in frame:
            failure = frame["err"]
            self._send(
                encode_event(
                    "job.failed", job=job, code=failure["code"], message=failure["message"]
                )
            )
            return

        answer = frame.get("ok") or {}
        # Every door answer carries what it holds NOW, so the ledger follows a load, a generation
        # and an unload without a second round trip asking.
        if isinstance(answer, dict) and "heldBytes" in answer:
            self._remember(answer)

        self._send(encode_event("job.completed", job=job, **answer))

    def _remember(self, answer: dict[str, Any]) -> None:
        held = answer.get("heldBytes")
        # A backend that does not answer is left ABSENT rather than recorded at zero: ADR-19 R1
        # turns on the difference between "it holds nothing" and "nobody could say".
        # `device` and `backend` are REQUIRED, not defaulted to "": an answer that omits them —
        # an unload, measured — would otherwise replace a good record with two empty strings, and
        # every later reading would see blanks instead of an absence.
        device = answer.get("device")
        backend = answer.get("backend")
        if not isinstance(held, int) or not isinstance(device, str) or not isinstance(backend, str):
            return

        self.ledger.record(
            DoorMemory(
                door=str(answer.get("door", DIFFUSION_DOOR)),
                held_bytes=held,
                device=device,
                backend=backend,
            )
        )

    def _worker_left(self) -> None:
        """
        A door that died holds every job it was given, and none of them will ever settle.

        This is the second material exception of § A.5: the worker abandons and REPORTS. What it
        does not do is decide to unload another door and try again.
        """
        with self._lock:
            orphans = list(self._runs.values())
            self._runs.clear()
            self._worker = None
        # Its process is gone, so it holds nothing — a measurement, not an assumption.
        self.ledger.forget(DIFFUSION_DOOR)

        for job in orphans:
            self._send(
                encode_event("job.failed", job=job, code="door-gone", message="the door died")
            )

    def _live(self) -> WorkerProcess:
        with self._lock:
            if self._worker is None:
                self._worker = self._spawn(self._worker_said, self._worker_left)
            return self._worker

    def submit(self, op: str, params: dict[str, Any], job: str) -> dict[str, Any]:
        """
        Answers IMMEDIATELY with the job it opened. The result arrives as an event.

        A load reads gigabytes and a generation runs for seconds: an answer that waited for either
        would hold the core's loop, and the studio would have no way to cancel what it started.
        """
        worker = self._live()
        run = worker.next_run()
        with self._lock:
            self._runs[run] = job
        worker.send({"v": PROTOCOL_VERSION, "id": run, "op": op, "params": params})
        return {"jobId": job}

    def cancel(self, job: str) -> dict[str, Any]:
        """
        Asks the door to drop a job, BY JOB — the studio never learns a door's own numbering.

        Answered here and not queued: a cancel that waited behind the job it stops would be
        useless. What it reaches is the door's reading thread, which is why that thread exists.
        """
        with self._lock:
            run = next((one for one, held in self._runs.items() if held == job), None)
            worker = self._worker

        if run is None or worker is None:
            return {"cancelled": False}

        # A run of its OWN, and never the one it stops: reusing that number makes the door answer
        # the cancel under the job's id, which settles the job as completed and drops the
        # `cancelled` error that follows. Measured — it read as a success on the first try.
        worker.send(
            {
                "v": PROTOCOL_VERSION,
                "id": worker.next_run(),
                "op": "engine.cancel",
                "params": {"run": run},
            }
        )
        return {"cancelled": True}

    def close(self) -> None:
        self.ledger.forget(DIFFUSION_DOOR)
        with self._lock:
            if self._worker is not None:
                self._worker.close()
                self._worker = None


def spawn_diffusion(on_frame: Callable[[dict], None], on_gone: Callable[[], None]) -> WorkerProcess:
    return WorkerProcess(DIFFUSION_MODULE, on_frame, on_gone)
