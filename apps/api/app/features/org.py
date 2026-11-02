"""Organisation (README §6, Admin): the team, invitations as links, roles, and the firm's details. A firm always
keeps at least one Admin."""

from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr, Field

from app import db
from app.access import CurrentActor, NotFound
from app.features.auth import invite_token

router = APIRouter()
Role = Literal['admin', 'qs', 'contributor', 'viewer']


class Invite(BaseModel):
    email: EmailStr
    role: Role


class Change(BaseModel):
    role: Role


class Details(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    currency: str = Field(min_length=3, max_length=3)


@router.get('/team')
def team(actor: CurrentActor):
    with db.in_org(actor.org_id) as connection:
        return connection.execute(
            'select id, name, email, role, seen_at, invite_token is not null as invited, created_at from people'
            ' order by (invite_token is not null) desc, name'
        ).fetchall()


@router.post('/team/invite')
def invite(body: Invite, actor: CurrentActor):
    actor.need('manage_org')
    token, stored = invite_token()
    with db.in_org(actor.org_id) as connection:
        if connection.execute('select 1 from people where lower(email) = %s', [body.email.lower()]).fetchone():
            raise HTTPException(409, 'That email already has an account or an invitation.')
        connection.execute(
            'insert into people (org_id, name, email, role, invite_token, invited_by) values (%s, %s, %s, %s, %s, %s)',
            [actor.org_id, body.email.split('@')[0], body.email.lower(), body.role, stored, actor.person_id],
        )
    return {'link': f'/invite/{token}'}


@router.post('/team/{person_id}/link')
def new_link(person_id: str, actor: CurrentActor):
    """A fresh link for someone still invited (only the hash is kept, so the old one cannot be shown again)."""
    actor.need('manage_org')
    token, stored = invite_token()
    with db.in_org(actor.org_id) as connection:
        if not connection.execute('update people set invite_token = %s where id = %s and invite_token is not null returning id', [stored, person_id]).fetchone():
            raise NotFound('No invitation for that person')
    return {'link': f'/invite/{token}'}


def _admins(connection) -> int:
    return connection.execute("select count(*) as n from people where role = 'admin' and invite_token is null").fetchone()['n']


@router.patch('/team/{person_id}')
def change_role(person_id: str, body: Change, actor: CurrentActor):
    actor.need('manage_org')
    with db.in_org(actor.org_id) as connection:
        person = connection.execute('select * from people where id = %s', [person_id]).fetchone()
        if person is None:
            raise NotFound()
        if person['role'] == 'admin' and body.role != 'admin' and _admins(connection) <= 1:
            raise HTTPException(409, 'A firm keeps at least one Admin.')
        connection.execute('update people set role = %s where id = %s', [body.role, person_id])
    return {'ok': True}


@router.delete('/team/{person_id}')
def remove(person_id: str, actor: CurrentActor):
    actor.need('manage_org')
    if str(person_id) == str(actor.person_id):
        raise HTTPException(409, 'You cannot remove yourself.')
    with db.in_org(actor.org_id) as connection:
        person = connection.execute('select * from people where id = %s', [person_id]).fetchone()
        if person is None:
            raise NotFound()
        if person['role'] == 'admin' and person['invite_token'] is None and _admins(connection) <= 1:
            raise HTTPException(409, 'A firm keeps at least one Admin.')
        connection.execute('delete from people where id = %s', [person_id])
    return {'ok': True}


@router.get('/org')
def details(actor: CurrentActor):
    with db.in_org(actor.org_id) as connection:
        return connection.execute('select id, name, currency from orgs where id = %s', [actor.org_id]).fetchone()


@router.patch('/org')
def save_details(body: Details, actor: CurrentActor):
    actor.need('manage_org')
    with db.in_org(actor.org_id) as connection:
        connection.execute('update orgs set name = %s, currency = %s where id = %s', [body.name.strip(), body.currency.upper(), actor.org_id])
    return {'ok': True}
