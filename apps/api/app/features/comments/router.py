"""Comments (README §6): on the project, a model, an element or a BOQ line, with @mentions and an attachment."""

from uuid import UUID

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from app.core.access import CurrentActor
from app.database import connection as db
from app.features.comments import service
from app.features.comments.constants import TARGETS

router = APIRouter()


@router.get('/projects/{project_id}/comments')
def comments(project_id: UUID, actor: CurrentActor):
    with db.in_org(actor.org_id) as connection:
        return service.comments(connection, actor, project_id)


@router.post('/projects/{project_id}/comments')
async def comment(
    project_id: UUID,
    actor: CurrentActor,
    text: str = Form(min_length=1, max_length=8000),
    on_kind: str = Form('project'),
    on_ref: str | None = Form(None),
    on_label: str = Form('An estimate'),
    file: UploadFile | None = File(None),
):
    actor.need('comment')
    if on_kind not in TARGETS:
        raise HTTPException(422, 'Unknown comment target')
    stored = service.store(actor, project_id, file.filename, await file.read()) if file and file.filename else None
    with db.in_org(actor.org_id) as connection:
        return service.add(connection, actor, project_id, text, (on_kind, on_ref, on_label), stored)


@router.delete('/comments/{comment_id}')
def delete_comment(comment_id: UUID, actor: CurrentActor):
    with db.in_org(actor.org_id) as connection:
        service.delete(connection, actor, comment_id)
    return {'ok': True}


@router.get('/comments/{comment_id}/file')
def attachment(comment_id: UUID, actor: CurrentActor):
    with db.in_org(actor.org_id) as connection:
        path, name = service.attachment(connection, actor, comment_id)
    return FileResponse(path, filename=name, content_disposition_type='inline')
