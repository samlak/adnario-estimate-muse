"""Reading an uploaded programme waits for the BOQ, then builds and saves it."""

import asyncio

import pytest

from app.features.programme import jobs


def collect(work):
    async def go():
        return [event async for event in work]
    return asyncio.run(go())


def test_the_programme_waits_for_the_boq(monkeypatch):
    monkeypatch.setattr(jobs, 'load_result', lambda *a: {'result': {'boq': []}})
    with pytest.raises(ValueError, match='Generate the BOQ first'):
        collect(jobs.read('p.pdf', 'org', 'e1'))


def test_the_programme_is_built_and_saved(monkeypatch):
    saved = {}

    async def build(path, result):
        return {'activities': [{'summary': False}, {'summary': True}], 'end': 120}

    monkeypatch.setattr(jobs, 'load_result', lambda *a: {'result': {'boq': [1]}})
    monkeypatch.setattr(jobs, 'build', build)
    monkeypatch.setattr(jobs, 'save_result', lambda org, estimate, result, built: saved.update(built=built))
    events = collect(jobs.read('p.pdf', 'org', 'e1'))
    assert events[-1] == ('result', {'activities': 2, 'days': 120}) and saved['built']['end'] == 120
