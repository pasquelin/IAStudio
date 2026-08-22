"""
What the core does with a request it cannot answer itself: hand it to the door that can, and turn
what comes back into the studio's vocabulary.

The core decides NOTHING here. It does not choose a device, does not choose a door, does not free
another one, does not substitute a model. The door travels ON the request, because the main
process is the only side that knows which model was picked for which employment.
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

#: Every door there is, and the module that IS one. A door is a PROCESS, which is what a release
#: plan can kill: an 80 GB video model has no business in the process holding an image.
#:
#: The pairing with a modality lives in `localRuntimes.ts` — one table, on the side that decides.
DOOR_MODULES: dict[str, str] = {
    DIFFUSION_DOOR: "ia_studio_engine.workers.diffusion",
    "engine/video": "ia_studio_engine.workers.video",
    "engine/audio": "ia_studio_engine.workers.audio",
    "engine/3d": "ia_studio_engine.workers.mesh",
}

Send = Callable[[str], None]
Spawn = Callable[[str, Callable[[dict], None], Callable[[], None]], WorkerProcess]


class DoorRouter:
    """Doors, started on first ask. A worker that never had to run is one that costs nothing."""

    def __init__(self, send: Send, spawn: Spawn, ledger: MemoryLedger | None = None) -> None:
        self._send = send
        self._spawn = spawn
        self.ledger = ledger if ledger is not None else MemoryLedger()
        self._workers: dict[str, WorkerProcess] = {}
        self._lock = threading.Lock()
        # Which JOB each run belongs to, keyed by the door that numbers it: two doors number their
        # runs from 1 apiece, so the run alone names two jobs and settles the wrong one.
        # Read by a pump thread and written by the loop, hence the lock rather than a reliance on
        # what CPython happens to make atomic.
        self._runs: dict[tuple[str, int], str] = {}

    def _worker_said(self, door: str, frame: dict[str, Any]) -> None:
        # An EVENT belongs to no run and is passed straight through: `job.progress` is the only
        # thing a job says while it runs, and a router that only knew about answers dropped it.
        if "evt" in frame:
            self._send(json.dumps({**frame, "v": PROTOCOL_VERSION}, separators=(",", ":")) + "\n")
            return

        run = frame.get("id")
        with self._lock:
            job = self._runs.pop((door, run), None) if isinstance(run, int) else None
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
            self._remember(door, answer)

        self._send(encode_event("job.completed", job=job, **answer))

    def _remember(self, door: str, answer: dict[str, Any]) -> None:
        held = answer.get("heldBytes")
        # ADR-19 R1: no answer is absence, not zero. Zero after unload is measured absence,
        # so the door is forgotten. `device`/`backend` are required when bytes remain —
        # an unload omitting them would replace a good record with empty strings.
        device = answer.get("device")
        backend = answer.get("backend")
        if not isinstance(held, int):
            return

        door = str(answer.get("door", DIFFUSION_DOOR))
        if held == 0:
            self.ledger.forget(door)
            return
        if not isinstance(device, str) or not isinstance(backend, str):
            return

        self.ledger.record(
            DoorMemory(
                door=door,
                held_bytes=held,
                device=device,
                backend=backend,
            )
        )

    def _worker_left(self, door: str) -> None:
        """
        A door that died holds every job it was given, and none of them will ever settle.

        This is the second material exception of § A.5: the worker abandons and REPORTS. What it
        does not do is decide to unload another door and try again.
        """
        with self._lock:
            orphans = [self._runs.pop(key) for key in list(self._runs) if key[0] == door]
            self._workers.pop(door, None)
        # Its process is gone, so it holds nothing — a measurement, not an assumption.
        self.ledger.forget(door)

        for job in orphans:
            self._send(
                encode_event("job.failed", job=job, code="door-gone", message="the door died")
            )

    def _live(self, door: str) -> WorkerProcess:
        with self._lock:
            worker = self._workers.get(door)
        if worker is not None:
            return worker

        # OUTSIDE the lock: spawning forks and execs an interpreter, and the pump of every door
        # already alive takes this same lock to settle its runs — opening one door would freeze
        # the answers of the other three.
        opened = self._spawn(
            door,
            lambda frame: self._worker_said(door, frame),
            lambda: self._worker_left(door),
        )
        with self._lock:
            self._workers[door] = opened
        # Registered BEFORE it can answer: a door that dies at import would otherwise report
        # itself gone while there was nothing yet to forget, and be recorded dead a moment later.
        opened.start()
        return opened

    def submit(self, op: str, params: dict[str, Any], job: str) -> dict[str, Any]:
        """
        Answers IMMEDIATELY with the job it opened. The result arrives as an event.

        A load reads gigabytes and a generation runs for seconds: an answer that waited for either
        would hold the core's loop, and the studio would have no way to cancel what it started.
        """
        door = str(params.get("door", DIFFUSION_DOOR))
        # Refused rather than started: spawning `-m` on a module that does not exist forks a
        # process that dies at import, and the job would fail as `door-gone` — which sends whoever
        # reads the journal looking for a crash instead of a misspelt door.
        if door not in DOOR_MODULES:
            raise ValueError(f"no such door: {door}")

        worker = self._live(door)
        run = worker.next_run()
        with self._lock:
            self._runs[(door, run)] = job
        worker.send({"v": PROTOCOL_VERSION, "id": run, "op": op, "params": params})
        return {"jobId": job}

    def cancel(self, job: str) -> dict[str, Any]:
        """
        Asks the door to drop a job, BY JOB — the studio never learns a door's own numbering.

        Answered here and not queued: a cancel that waited behind the job it stops would be
        useless. What it reaches is the door's reading thread, which is why that thread exists.
        """
        with self._lock:
            key = next((one for one, held in self._runs.items() if held == job), None)
            worker = self._workers.get(key[0]) if key is not None else None

        if key is None or worker is None:
            return {"cancelled": False}

        # A run of its OWN, and never the one it stops: reusing that number makes the door answer
        # the cancel under the job's id, which settles the job as completed and drops the
        # `cancelled` error that follows. Measured — it read as a success on the first try.
        worker.send(
            {
                "v": PROTOCOL_VERSION,
                "id": worker.next_run(),
                "op": "engine.cancel",
                "params": {"run": key[1]},
            }
        )
        return {"cancelled": True}

    def close(self) -> None:
        with self._lock:
            workers = list(self._workers.items())
            self._workers.clear()

        # Asked to leave first, waited on second, and the split is what keeps the waits
        # OVERLAPPING: a worker mid-inference does not read its socket, so `wait` may burn its
        # whole timeout — four in a row is four times that, paid on the way out of the studio.
        for door, worker in workers:
            self.ledger.forget(door)
            worker.begin_close()

        for _door, worker in workers:
            worker.wait_closed()


def spawn_door(
    door: str, on_frame: Callable[[dict], None], on_gone: Callable[[], None]
) -> WorkerProcess:
    return WorkerProcess(DOOR_MODULES[door], on_frame, on_gone)
