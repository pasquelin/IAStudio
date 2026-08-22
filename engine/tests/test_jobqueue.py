from ia_studio_engine.core.jobqueue import Job, JobQueue


def job(job_id: int) -> Job:
    return Job(id=job_id, op="generate", params={})


def test_hands_jobs_out_in_the_order_they_arrived() -> None:
    queue = JobQueue()
    for job_id in [1, 2, 3]:
        queue.submit(job(job_id))

    assert [handed.id for handed in queue.drain()] == [1, 2, 3]


def test_a_cancelled_job_is_never_handed_out() -> None:
    queue = JobQueue()
    for job_id in [1, 2]:
        queue.submit(job(job_id))

    assert queue.cancel(1) is True
    assert [handed.id for handed in queue.drain()] == [2]


def test_cancelling_what_it_never_held_is_a_fact_rather_than_a_failure() -> None:
    assert JobQueue().cancel(404) is False
