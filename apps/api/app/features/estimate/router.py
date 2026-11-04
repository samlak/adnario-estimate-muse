"""The estimate's routes (README §7.2–7.6): the project's estimate, its run, Generate BOQ, Link to cost, the QS's edits
with undo and redo, and the exports. Long work streams (core/runs.py) and can be followed again."""

import asyncio
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import Response

from app.core import runs
from app.core.access import CurrentActor, check_estimate
from app.database import connection as db
from app.features.estimate import jobs, service
from app.features.estimate.constants import DOCUMENT_LIMIT, MAX_DOCUMENTS
from app.features.estimate.schemas import Edit, Info
from app.features.estimate.utils import text_of

router = APIRouter()
Kind = Literal['run', 'boq', 'link', 'programme']


@router.get('/projects/{project_id}/estimate')
def estimate(project_id: UUID, actor: CurrentActor):
    with db.in_org(actor.org_id) as connection:
        return service.estimate(connection, actor, project_id)


@router.get('/projects/{project_id}/estimates')
def revisions(project_id: UUID, actor: CurrentActor):
    with db.in_org(actor.org_id) as connection:
        return service.revisions(connection, actor, project_id)


@router.patch('/estimates/{estimate_id}/info')
def set_info(estimate_id: UUID, body: Info, actor: CurrentActor):
    with db.in_org(actor.org_id) as connection:
        service.set_info(connection, actor, estimate_id, body.text)
    return {'ok': True}


@router.post('/estimates/{estimate_id}/documents')
async def add_documents(estimate_id: UUID, actor: CurrentActor, files: list[UploadFile] = File(...)):
    if len(files) > MAX_DOCUMENTS:
        raise HTTPException(422, f'Up to {MAX_DOCUMENTS} documents')
    texts = []
    for file in files:
        data = await file.read()
        if len(data) > DOCUMENT_LIMIT:
            raise HTTPException(413, f'{file.filename} is over 50 MB')
        try:
            texts.append(f'── {file.filename} ──\n{text_of(file.filename or "", data)}')
        except Exception:
            raise HTTPException(422, f'{file.filename} could not be read: Word (.docx), text or PDF')
    with db.in_org(actor.org_id) as connection:
        return {'documents': service.add_documents(connection, actor, estimate_id, texts, [f.filename for f in files])}


@router.post('/estimates/{estimate_id}/run')
async def run(estimate_id: UUID, actor: CurrentActor):
    def check():
        with db.in_org(actor.org_id) as connection:
            service.editable(connection, actor, estimate_id)

    await asyncio.to_thread(check)
    return runs.stream(jobs.start_run(actor.org_id, estimate_id))


@router.get('/estimates/{estimate_id}/follow/{kind}')
async def follow(estimate_id: UUID, kind: Kind, actor: CurrentActor):
    """A page that comes back replays the work from its start and follows it live."""
    def check():
        with db.in_org(actor.org_id) as connection:
            check_estimate(connection, actor, estimate_id, 'see_programme')

    await asyncio.to_thread(check)
    found = runs.find(f'{kind}:{estimate_id}')
    if found is None:
        raise HTTPException(404, 'Nothing running')
    return runs.stream(found)


@router.post('/estimates/{estimate_id}/stop/{kind}', status_code=204)
async def stop(estimate_id: UUID, kind: Kind, actor: CurrentActor):
    def check():
        with db.in_org(actor.org_id) as connection:
            service.editable(connection, actor, estimate_id)

    await asyncio.to_thread(check)
    runs.stop(f'{kind}:{estimate_id}')


@router.post('/projects/{project_id}/revisions')
async def new_revision(project_id: UUID, actor: CurrentActor):
    """Update estimate: a new revision measures the current models again and carries over the QS's work."""
    def make():
        with db.in_org(actor.org_id) as connection:
            return service.new_revision(connection, actor, project_id)

    estimate_id = await asyncio.to_thread(make)
    return runs.stream(jobs.start_run(actor.org_id, estimate_id))


@router.post('/estimates/{estimate_id}/boq')
async def generate_boq(estimate_id: UUID, actor: CurrentActor):
    return runs.stream(await jobs.long_work(estimate_id, actor, 'boq', jobs.generate))


@router.post('/estimates/{estimate_id}/link')
async def link_to_cost(estimate_id: UUID, actor: CurrentActor):
    return runs.stream(await jobs.long_work(estimate_id, actor, 'link', jobs.link))


@router.post('/estimates/{estimate_id}/edit')
def edit(estimate_id: UUID, body: Edit, actor: CurrentActor):
    with db.in_org(actor.org_id) as connection:
        return service.edit(connection, actor, estimate_id, body)


@router.post('/estimates/{estimate_id}/history/{way}')
def undo(estimate_id: UUID, way: Literal['undo', 'redo'], actor: CurrentActor):
    with db.in_org(actor.org_id) as connection:
        return service.undo(connection, actor, estimate_id, way)


@router.get('/estimates/{estimate_id}/export/{what}')
def export(estimate_id: UUID, what: Literal['boq.xlsx', 'boq.pdf', 'cashflow.xlsx'], actor: CurrentActor):
    with db.in_org(actor.org_id) as connection:
        data, kind, file = service.export(connection, actor, estimate_id, what)
    return Response(data, media_type=kind, headers={'Content-Disposition': f'attachment; filename="{file}"'})
