"""Projects (README §6, §7): the list, a project, the people on it, and the live stream of changes for an open
workspace."""

from uuid import UUID

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.core import live
from app.core.access import CurrentActor, find_project
from app.database import connection as db
from app.features.projects import service
from app.features.projects.schemas import Access, Member, NewProject

router = APIRouter()


@router.get('/projects')
def projects(actor: CurrentActor):
    with db.in_org(actor.org_id) as connection:
        return service.projects(connection, actor)


@router.post('/projects')
def create(body: NewProject, actor: CurrentActor):
    actor.need('create_project')
    with db.in_org(actor.org_id) as connection:
        return service.create(connection, actor, body)


@router.get('/projects/{project_id}')
def project(project_id: UUID, actor: CurrentActor):
    with db.in_org(actor.org_id) as connection:
        return service.project(connection, actor, project_id)


@router.patch('/projects/{project_id}')
def update(project_id: UUID, body: NewProject, actor: CurrentActor):
    with db.in_org(actor.org_id) as connection:
        service.update(connection, actor, project_id, body)
    return {'ok': True}


@router.delete('/projects/{project_id}')
def delete(project_id: UUID, actor: CurrentActor):
    actor.need('delete_project')
    with db.in_org(actor.org_id) as connection:
        service.delete(connection, actor, project_id)
    return {'ok': True}


@router.get('/projects/{project_id}/members')
def members(project_id: UUID, actor: CurrentActor):
    with db.in_org(actor.org_id) as connection:
        return service.members(connection, actor, project_id)


@router.post('/projects/{project_id}/members')
def add_member(project_id: UUID, body: Member, actor: CurrentActor):
    actor.need('manage_members')
    with db.in_org(actor.org_id) as connection:
        service.add_member(connection, actor, project_id, body)
    return {'ok': True}


@router.patch('/projects/{project_id}/members/{person_id}')
def set_access(project_id: UUID, person_id: UUID, body: Access, actor: CurrentActor):
    actor.need('manage_members')
    with db.in_org(actor.org_id) as connection:
        service.set_access(connection, actor, project_id, person_id, body.access)
    return {'ok': True}


@router.delete('/projects/{project_id}/members/{person_id}')
def remove_member(project_id: UUID, person_id: UUID, actor: CurrentActor):
    actor.need('manage_members')
    with db.in_org(actor.org_id) as connection:
        service.remove_member(connection, actor, project_id, person_id)
    return {'ok': True}


@router.get('/projects/{project_id}/live')
def follow(project_id: UUID, actor: CurrentActor):
    with db.in_org(actor.org_id) as connection:
        find_project(connection, actor, project_id)
    return StreamingResponse(live.follow(str(project_id)), media_type='text/event-stream', headers={'Cache-Control': 'no-cache'})
