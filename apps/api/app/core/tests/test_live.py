"""Live updates: a change told to everyone following that project, and no one else."""

import asyncio

from app.core import live


def test_a_change_reaches_the_projects_followers_only():
    async def go():
        mine, theirs = live.follow('p1'), live.follow('p2')
        assert await anext(mine) == 'event: hello\ndata: {}\n\n'
        await anext(theirs)
        live.tell('p1', {'table': 'models'})
        told = await asyncio.wait_for(anext(mine), 1)
        quiet = asyncio.ensure_future(anext(theirs))
        await asyncio.sleep(0.05)
        assert not quiet.done()
        quiet.cancel()
        await mine.aclose()
        return told
    assert asyncio.run(go()) == 'event: change\ndata: {"table": "models"}\n\n'
