"""
The engine's TECHNICAL queue: what a worker holds and in which order, and what a cancel drops.

Named `jobqueue` and never `scheduler`, and it is the only MECHANICAL hold on the invariant that
the main process decides while the engine measures and executes — a file named "scheduler" ends up
becoming one, and two schedulers contradict each other on the one resource that matters.

Not wired yet: phase 1 answers `hardware.info` and holds no job. It is here, and tested, because
the name is the invariant.
"""

from __future__ import annotations

from collections import deque
from collections.abc import Iterator
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class Job:
    id: int
    op: str
    params: dict[str, Any]


class JobQueue:
    """First in, first out. It orders what one worker holds; it arbitrates between nothing."""

    def __init__(self) -> None:
        self._waiting: deque[Job] = deque()

    def __len__(self) -> int:
        return len(self._waiting)

    def submit(self, job: Job) -> None:
        self._waiting.append(job)

    def cancel(self, job_id: int) -> bool:
        """`False` for one it never held, or one already handed out — a fact, not a failure."""
        for job in self._waiting:
            if job.id == job_id:
                self._waiting.remove(job)
                return True
        return False

    def drain(self) -> Iterator[Job]:
        """Hands out what is waiting, in order. A job cancelled mid-drain is never handed out."""
        while self._waiting:
            yield self._waiting.popleft()
