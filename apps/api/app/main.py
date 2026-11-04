"""The API: every route under /api/v1, the database migrated and the demo seeded at start, live updates listened
for, and in production the built web app served from the same port."""

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI, Request
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse

from app.core import live
from app.core.config import env
from app.database import connection as db
from app.database.seed import service as seed
from app.features.auth.router import router as auth
from app.features.comments.router import router as comments
from app.features.estimate.router import router as estimate
from app.features.models.router import router as models
from app.features.notifications.router import router as notifications
from app.features.orgs.router import router as orgs
from app.features.programme.router import router as programme
from app.features.projects.router import router as projects
from app.features.rate_cards.router import router as rate_cards
from app.features.sidekick.router import router as sidekick

logging.basicConfig(level=logging.INFO)
log = logging.getLogger('adnario')
background: set[asyncio.Task] = set()


@asynccontextmanager
async def lifespan(_: FastAPI):
    await asyncio.to_thread(db.migrate)
    work = await asyncio.to_thread(seed.seed) if env.DEMO else []
    for job in (live.listen(), seed.finish(work)):
        task = asyncio.create_task(job)
        background.add(task)
        task.add_done_callback(background.discard)
    yield
    for task in list(background):
        task.cancel()
    db.pool.close()


app = FastAPI(title='Adnario Estimate', lifespan=lifespan)
app.add_middleware(GZipMiddleware, minimum_size=2000)
api = APIRouter(prefix='/api/v1')
for feature in (auth, orgs, projects, comments, notifications, models, rate_cards, estimate, programme, sidekick):
    api.include_router(feature)


@api.get('/health')
def health():
    return {'ok': True}


@api.post('/client-errors', status_code=204)
async def client_error(request: Request):
    """The browser's errors, logged here so they are seen."""
    log.warning('client error: %s', (await request.body())[:4000].decode('utf-8', 'replace'))


app.include_router(api)


@app.exception_handler(ValueError)
async def value_error(_: Request, error: ValueError):
    return JSONResponse({'detail': str(error)}, status_code=422)


@app.get('/{path:path}', include_in_schema=False)
def web(path: str):
    """The built web app (production); every page route falls back to index.html."""
    if path.startswith('api/'):
        return JSONResponse({'detail': 'Not found'}, status_code=404)
    found = (env.WEB_DIST / path).resolve()
    if path and found.is_file() and env.WEB_DIST.resolve() in found.parents:
        return FileResponse(found)
    index = env.WEB_DIST / 'index.html'
    if index.exists():
        return FileResponse(index, headers={'Cache-Control': 'no-cache'})
    return JSONResponse({'detail': 'The web app is not built: run it with npm run dev (port 3000)'}, status_code=404)
