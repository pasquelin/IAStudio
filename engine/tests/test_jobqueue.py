import threading

from ia_studio_engine.core.jobqueue import Job, JobQueue


def job(job_id: int) -> Job:
    return Job(id=job_id, op="generate")


def drained(queue: JobQueue) -> list[int]:
    handed: list[int] = []
    thread = threading.Thread(target=lambda: [handed.append(one.id) for one in queue.drain()])
    thread.start()
    queue.close()
    thread.join(timeout=5)
    return handed


def test_hands_jobs_out_in_the_order_they_arrived() -> None:
    queue = JobQueue()
    for job_id in [1, 2, 3]:
        queue.submit(job(job_id))

    assert drained(queue) == [1, 2, 3]


def test_a_job_cancelled_before_it_ran_is_never_handed_out() -> None:
    """A cancel that lands while a job waits costs nothing: it never reaches the device."""
    queue = JobQueue()
    for job_id in [1, 2]:
        queue.submit(job(job_id))

    assert queue.cancel(1) is True
    assert drained(queue) == [2]


def test_cancelling_what_it_never_held_is_a_fact_rather_than_a_failure() -> None:
    assert JobQueue().cancel(404) is False


def test_a_running_job_is_flagged_rather_than_killed() -> None:
    """A device call does not interrupt: the job's own loop is what makes a cancel real."""
    queue = JobQueue()
    queue.submit(job(1))
    seen: list[bool] = []

    def work() -> None:
        for _one in queue.drain():
            seen.append(queue.cancelled())
            queue.cancel(1)
            seen.append(queue.cancelled())
            return

    thread = threading.Thread(target=work)
    thread.start()
    thread.join(timeout=5)

    assert seen == [False, True]


def test_the_flag_does_not_survive_the_job_it_stopped() -> None:
    """Otherwise the next job on that door is cancelled before it ever starts."""
    queue = JobQueue()
    queue.submit(job(1))
    queue.submit(job(2))
    flags: list[bool] = []

    def work() -> None:
        for one in queue.drain():
            flags.append(queue.cancelled())
            if one.id == 1:
                queue.cancel(1)

    thread = threading.Thread(target=work)
    thread.start()
    queue.close()
    thread.join(timeout=5)

    assert flags == [False, False]
