"""The programme's route: the contractor's programme uploaded as a PDF, then read and linked to the BOQ as
long work that streams (core/runs.py)."""

import asyncio
from uuid import UUID

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.core import runs
from app.core.access import CurrentActor
from app.database import connection as db
from app.features.programme import jobs, service
from app.features.programme.constants import PDF_HEADER, UPLOAD_LIMIT
from app.features.programme.schemas import ActivityEdit

router = APIRouter()


@router.post('/estimates/{estimate_id}/programme')
async def programme(estimate_id: UUID, actor: CurrentActor, file: UploadFile = File(...)):
    data = await file.read()
    if len(data) > UPLOAD_LIMIT:
        raise HTTPException(413, 'The programme is over 50 MB')
    if not data.startswith(PDF_HEADER):
        raise HTTPException(422, 'The programme must be a PDF with text')

    def store():
        with db.in_org(actor.org_id) as connection:
            return jobs.store(connection, actor, estimate_id, data)

    path = await asyncio.to_thread(store)
    return runs.stream(runs.start(f'programme:{estimate_id}', jobs.read(path, actor.org_id, estimate_id)))


@router.patch('/estimates/{estimate_id}/programme')
def edit(estimate_id: UUID, body: ActivityEdit, actor: CurrentActor):
    with db.in_org(actor.org_id) as connection:
        return service.edit(connection, actor, estimate_id, body)
