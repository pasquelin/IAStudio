"""
The core's routing, with a stand-in worker.

**Blind spot, written rather than hidden**: nothing here imports torch, and the gate must never
have to — `pnpm engine:check` would then download 682 MB to run. What a real backend does is
proven by the spike of § L.4 and by the end-to-end run, not by this file.
"""

import json
from typing import Any

import pytest

from ia_studio_engine.core.router import DoorRouter


class StandInWorker:
    def __init__(self) -> None:
        self.sent: list[dict[str, Any]] = []
        self._next = 1

    def next_run(self) -> int:
        run = self._next
        self._next += 1
        return run

    def send(self, request: dict[str, Any]) -> None:
        self.sent.append(request)

    def close(self) -> None:
        self.closed = True


def harness() -> tuple[DoorRouter, list[dict], list[StandInWorker]]:
    written: list[dict] = []
    workers: list[StandInWorker] = []
    answered: list[Any] = []
    left: list[Any] = []

    def spawn(on_frame, on_gone):
        worker = StandInWorker()
        workers.append(worker)
        answered.append(on_frame)
        left.append(on_gone)
        return worker

    router = DoorRouter(lambda line: written.append(json.loads(line)), spawn)
    router.said = lambda frame: answered[0](frame)  # type: ignore[attr-defined]
    router.door_died = lambda: left[0]()  # type: ignore[attr-defined]
    return router, written, workers


def test_answers_with_the_job_it_opened_rather_than_waiting_for_the_result() -> None:
    router, written, workers = harness()

    answer = router.submit("models.load", {"folder": "/weights"}, job="local_a1")

    assert answer == {"jobId": "local_a1"}
    assert written == []
    assert workers[0].sent[0]["op"] == "models.load"


def test_the_door_is_started_once_however_many_jobs_arrive() -> None:
    router, _written, workers = harness()

    router.submit("models.load", {}, job="local_a1")
    router.submit("generate", {}, job="local_a2")

    assert len(workers) == 1


def test_what_the_worker_settles_reaches_the_studio_as_its_job() -> None:
    router, written, workers = harness()
    router.submit("generate", {}, job="local_a1")
    run = workers[0].sent[0]["id"]

    router.said({"v": 1, "id": run, "ok": {"path": "/tmp/out.png", "device": "mps"}})

    assert written == [
        {"v": 1, "evt": "job.completed", "job": "local_a1", "path": "/tmp/out.png", "device": "mps"}
    ]


def test_a_refusal_reaches_the_studio_with_its_reason() -> None:
    router, written, workers = harness()
    router.submit("models.load", {}, job="local_a1")
    run = workers[0].sent[0]["id"]

    router.said({"v": 1, "id": run, "err": {"code": "memory", "message": "no room"}})

    assert written[0]["evt"] == "job.failed"
    assert (written[0]["code"], written[0]["message"]) == ("memory", "no room")


def test_a_second_answer_for_one_run_is_dropped_rather_than_pushed_twice() -> None:
    router, written, workers = harness()
    router.submit("generate", {}, job="local_a1")
    run = workers[0].sent[0]["id"]

    router.said({"v": 1, "id": run, "ok": {}})
    router.said({"v": 1, "id": run, "ok": {}})

    assert len(written) == 1


def test_closing_the_router_closes_the_door_it_started() -> None:
    router, _written, workers = harness()
    router.submit("generate", {}, job="local_a1")

    router.close()

    assert workers[0].closed is True


def test_a_door_never_asked_for_is_a_process_that_never_ran() -> None:
    router, _written, workers = harness()

    router.close()

    assert workers == []


@pytest.mark.parametrize("job", [None, "", 42])
def test_a_routed_op_without_its_job_is_refused(job: object) -> None:
    from ia_studio_engine.core.supervisor import routed_handlers

    router, _written, _workers = harness()
    handler = routed_handlers(router)["generate"]

    with pytest.raises(ValueError):
        handler({} if job is None else {"jobId": job})


def test_a_door_that_dies_fails_every_job_it_was_holding() -> None:
    """Otherwise the studio waits for ever on a process that is not there — § A.5, exception 2."""
    router, written, _workers = harness()
    router.submit("generate", {}, job="local_a1")
    router.submit("generate", {}, job="local_a2")

    router.door_died()

    assert [frame["job"] for frame in written] == ["local_a1", "local_a2"]
    assert {frame["code"] for frame in written} == {"door-gone"}


def test_a_door_that_left_is_started_again_by_the_next_job() -> None:
    router, _written, workers = harness()
    router.submit("generate", {}, job="local_a1")
    router.door_died()

    router.submit("generate", {}, job="local_a2")

    assert len(workers) == 2
