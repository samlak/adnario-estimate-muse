"""Organisation (README §6, Admin): the team, invitations as links, roles, and the firm's details. A firm always
keeps at least one Admin."""

from fastapi import APIRouter

from app.core.access import CurrentActor
from app.database import connection as db
from app.features.orgs import service
from app.features.orgs.schemas import Change, Details, Invite

router = APIRouter()


@router.get('/team')
def team(actor: CurrentActor):
    with db.in_org(actor.org_id) as connection:
        return service.team(connection)


@router.post('/team/invite')
def invite(body: Invite, actor: CurrentActor):
    actor.need('manage_org')
    with db.in_org(actor.org_id) as connection:
        return service.invite(connection, actor, body)


@router.post('/team/{person_id}/link')
def new_link(person_id: str, actor: CurrentActor):
    actor.need('manage_org')
    with db.in_org(actor.org_id) as connection:
        return service.new_link(connection, person_id)


@router.patch('/team/{person_id}')
def change_role(person_id: str, body: Change, actor: CurrentActor):
    actor.need('manage_org')
    with db.in_org(actor.org_id) as connection:
        service.change_role(connection, person_id, body.role)
    return {'ok': True}


@router.delete('/team/{person_id}')
def remove(person_id: str, actor: CurrentActor):
    actor.need('manage_org')
    with db.in_org(actor.org_id) as connection:
        service.remove(connection, actor, person_id)
    return {'ok': True}


@router.get('/org')
def details(actor: CurrentActor):
    with db.in_org(actor.org_id) as connection:
        return service.details(connection, actor)


@router.patch('/org')
def save_details(body: Details, actor: CurrentActor):
    actor.need('manage_org')
    with db.in_org(actor.org_id) as connection:
        service.save_details(connection, actor, body)
    return {'ok': True}
