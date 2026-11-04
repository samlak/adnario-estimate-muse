"""Live updates (README §3): the database sends a notice when a model, estimate, comment or member changes, and every
open browser on that project is told to re-read, over Server-Sent Events."""

import asyncio
import json
from collections import defaultdict

import psycopg

from app.core.config import env

listeners: dict[str, set[asyncio.Queue]] = defaultdict(set)


async def listen() -> None:
    """One connection LISTENs for the whole server; reconnects if the database goes away."""
    while True:
        try:
            async with await psycopg.AsyncConnection.connect(env.DATABASE_URL, autocommit=True) as connection:
                await connection.execute('listen changes')
                async for notice in connection.notifies():
                    change = json.loads(notice.payload)
                    for queue in list(listeners.get(str(change.get('project')), ())):
                        queue.put_nowait(change)
        except asyncio.CancelledError:
            return
        except Exception:
            await asyncio.sleep(2)


def tell(project_id: str, change: dict) -> None:
    """A change the database does not see (a run's progress ended): told to the project's browsers directly."""
    for queue in list(listeners.get(str(project_id), ())):
        queue.put_nowait(change)


async def follow(project_id: str):
    queue: asyncio.Queue = asyncio.Queue()
    listeners[str(project_id)].add(queue)
    try:
        yield 'event: hello\ndata: {}\n\n'
        while True:
            try:
                change = await asyncio.wait_for(queue.get(), timeout=25)
                yield f'event: change\ndata: {json.dumps(change)}\n\n'
            except TimeoutError:
                yield ': keep-alive\n\n'
    finally:
        listeners[str(project_id)].discard(queue)
