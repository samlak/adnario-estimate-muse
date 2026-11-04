"""Long work (an estimate run, linking rates, reading a programme, an answer from Adnario AI) runs as a server task.
It keeps every event it sends, so a page that reloads or comes back is replayed everything from the start and then
follows live; leaving the page does not stop the work. Finished runs are kept 10 minutes."""

import asyncio
import json
import time
from collections.abc import AsyncIterator

from fastapi.responses import StreamingResponse

from app.core.constants import RUN_KEPT_SECONDS as KEEP


class Run:
    def __init__(self, key: str, work: AsyncIterator[tuple[str, dict]]):
        self.key = key
        self.events: list[tuple[str, dict]] = []
        self.done = False
        self.ended_at: float | None = None
        self.changed = asyncio.Event()
        self.task = asyncio.create_task(self._drive(work))

    async def _drive(self, work: AsyncIterator[tuple[str, dict]]) -> None:
        try:
            async for event in work:
                self._add(event)
        except asyncio.CancelledError:
            self._add(('stopped', {}))
        except Exception as error:  # the run fails; the page is told why
            import traceback

            traceback.print_exc()
            self._add(('error', {'message': str(error) or error.__class__.__name__}))
        finally:
            self.done = True
            self.ended_at = time.monotonic()
            self.changed.set()

    def _add(self, event: tuple[str, dict]) -> None:
        self.events.append(event)
        self.changed.set()

    async def follow(self) -> AsyncIterator[tuple[str, dict]]:
        seen = 0
        while True:
            while seen < len(self.events):
                yield self.events[seen]
                seen += 1
            if self.done:
                return
            self.changed.clear()
            if seen < len(self.events):
                continue
            await self.changed.wait()


runs: dict[str, Run] = {}


def _forget_old() -> None:
    now = time.monotonic()
    for key, run in list(runs.items()):
        if run.done and run.ended_at and now - run.ended_at > KEEP:
            runs.pop(key, None)


def start(key: str, work: AsyncIterator[tuple[str, dict]]) -> Run:
    _forget_old()
    running = runs.get(key)
    if running and not running.done:
        return running  # one run per key: a second start follows the first
    runs[key] = Run(key, work)
    return runs[key]


def find(key: str) -> Run | None:
    return runs.get(key)


def stop(key: str) -> None:
    run = runs.get(key)
    if run and not run.done:
        run.task.cancel()


def sse(event: str, data: dict) -> str:
    return f'event: {event}\ndata: {json.dumps(data, default=str)}\n\n'


def stream(run: Run) -> StreamingResponse:
    async def body():
        async for event, data in run.follow():
            yield sse(event, data)

    return StreamingResponse(body(), media_type='text/event-stream', headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'})
