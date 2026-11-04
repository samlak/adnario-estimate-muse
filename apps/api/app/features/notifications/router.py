"""Notifications (README §6): a mention, being added to a project, a model version accepted or rejected."""

from uuid import UUID

from fastapi import APIRouter

from app.core.access import CurrentActor
from app.database import connection as db
from app.features.notifications import service

router = APIRouter()


@router.get('/notifications')
def notifications(actor: CurrentActor):
    with db.in_org(actor.org_id) as connection:
        return service.notifications(connection, actor)


@router.post('/notifications/{notice_id}/read')
def read(notice_id: UUID, actor: CurrentActor):
    with db.in_org(actor.org_id) as connection:
        service.read(connection, actor, notice_id)
    return {'ok': True}


@router.post('/notifications/read')
def read_all(actor: CurrentActor):
    with db.in_org(actor.org_id) as connection:
        service.read_all(connection, actor)
    return {'ok': True}
