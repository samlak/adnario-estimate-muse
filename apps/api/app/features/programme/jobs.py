"""The programme's long work: the uploaded PDF kept with the project, then read, scheduled and linked to the BOQ."""

import asyncio

from app.core.access import Actor
from app.core.config import env
from app.database.connection import Connection
from app.features.estimate.service import editable, load_result, save_result
from app.features.programme.service import build


def store(connection: Connection, actor: Actor, estimate_id, data: bytes):
    """The PDF, kept beside the project's files; its path."""
    estimate, _ = editable(connection, actor, estimate_id)
    path = env.DATA / str(actor.org_id) / str(estimate['project_id']) / 'programme.pdf'
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return path


async def read(path, org_id, estimate_id):
    yield 'stage', {'name': 'Read', 'state': 'start'}
    found = await asyncio.to_thread(load_result, org_id, estimate_id)
    if not found['result'].get('boq'):
        raise ValueError('Generate the BOQ first: the programme waits for it')
    yield 'stage', {'name': 'Read', 'state': 'done'}
    yield 'stage', {'name': 'Link', 'state': 'start'}
    built = await build(path, found['result'])
    yield 'stage', {'name': 'Link', 'state': 'done', 'activities': sum(not a['summary'] for a in built['activities'])}
    await asyncio.to_thread(save_result, org_id, estimate_id, found['result'], built)
    yield 'result', {'activities': len(built['activities']), 'days': built['end']}
