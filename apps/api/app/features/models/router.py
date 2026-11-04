"""Building models: an IFC upload is converted to XKT on the converter for the viewer and kept for the
estimate run. A new export of a model already there becomes its next version: the server works out, element by
element by GlobalId, what was added, removed or changed, and a QS or Admin accepts or rejects it."""


import asyncio
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, File, UploadFile
from fastapi.responses import FileResponse

from app.core.access import CurrentActor
from app.core.errors import Forbidden
from app.database import connection as db
from app.features.models import service
from app.features.models.convert import convert
from app.features.models.schemas import Decision, Nudge
from app.features.models.utils import check_upload

router = APIRouter()


@router.get('/projects/{project_id}/models')
def models(project_id: UUID, actor: CurrentActor):
    with db.in_org(actor.org_id) as connection:
        return service.models(connection, actor, project_id)


@router.post('/projects/{project_id}/models')
async def upload(project_id: UUID, background: BackgroundTasks, actor: CurrentActor, files: list[UploadFile] = File(...)):
    actor.need('upload')
    made = []
    for file in files:
        data = await file.read()
        check_upload(file.filename, data)

        def store():
            with db.in_org(actor.org_id) as connection:
                return service.upload(connection, actor, project_id, file.filename, data)

        model = await asyncio.to_thread(store)
        background.add_task(convert, actor.org_id, model['id'])
        made.append({'id': model['id'], 'name': model['name'], 'version': model['version'], 'state': model['state']})
    return made


@router.get('/models/{model_id}/xkt')
def xkt(model_id: UUID, actor: CurrentActor):
    with db.in_org(actor.org_id) as connection:
        model = service.find_model(connection, actor, model_id)
    return FileResponse(service.xkt(model), media_type='application/octet-stream', headers={'Cache-Control': 'private, max-age=86400'})


@router.get('/models/{model_id}/diff')
def model_diff(model_id: UUID, actor: CurrentActor):
    with db.in_org(actor.org_id) as connection:
        return service.find_model(connection, actor, model_id)['diff'] or {}


@router.get('/models/{model_id}/elements/{gid}')
def element(model_id: UUID, gid: str, actor: CurrentActor):
    with db.in_org(actor.org_id) as connection:
        model = service.find_model(connection, actor, model_id)
    return service.element(model, gid)


@router.patch('/models/{model_id}/nudge')
def nudge(model_id: UUID, body: Nudge, actor: CurrentActor):
    actor.need('upload')
    with db.in_org(actor.org_id) as connection:
        service.find_model(connection, actor, model_id)
        service.nudge(connection, model_id, body)
    return {'ok': True}


@router.delete('/models/{model_id}')
def delete(model_id: UUID, actor: CurrentActor):
    actor.need('upload')
    with db.in_org(actor.org_id) as connection:
        service.find_model(connection, actor, model_id)
        service.delete(connection, model_id)
    return {'ok': True}


@router.post('/models/{model_id}/decision')
def decide(model_id: UUID, body: Decision, actor: CurrentActor):
    if not actor.can('accept_versions'):
        raise Forbidden()
    with db.in_org(actor.org_id) as connection:
        service.decide(connection, actor, model_id, body)
    return {'ok': True}
