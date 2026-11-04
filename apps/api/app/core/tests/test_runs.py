"""Long work: every event kept and replayed to whoever follows, one run per key, stopping, and a failure told."""

import asyncio

from app.core import runs


async def steps(*events, wait=0.0):
    for event in events:
        await asyncio.sleep(wait)
        yield event


def follow(run):
    async def collect():
        return [event async for event in run.follow()]
    return collect()


def test_a_run_is_replayed_from_the_start_to_a_late_follower():
    async def go():
        run = runs.start('test:replay', steps(('log', {'n': 1}), ('result', {'n': 2})))
        await run.task
        return await follow(run)
    assert asyncio.run(go()) == [('log', {'n': 1}), ('result', {'n': 2})]


def test_one_run_per_key():
    async def go():
        first = runs.start('test:once', steps(('log', {}), wait=0.05))
        second = runs.start('test:once', steps(('other', {})))
        await first.task
        return first is second
    assert asyncio.run(go())


def test_a_failure_is_told_and_a_stop_is_kept():
    async def failing():
        yield 'log', {}
        raise ValueError('Generate the BOQ first')

    async def go():
        failed = runs.start('test:fail', failing())
        slow = runs.start('test:stop', steps(('log', {}), ('log', {}), wait=1))
        await failed.task
        runs.stop('test:stop')
        await asyncio.gather(slow.task, return_exceptions=True)
        return await follow(failed), await follow(slow)
    failed, stopped = asyncio.run(go())
    assert failed[-1] == ('error', {'message': 'Generate the BOQ first'})
    assert stopped[-1] == ('stopped', {})


def test_server_sent_event_text():
    assert runs.sse('log', {'n': 1}) == 'event: log\ndata: {"n": 1}\n\n'
