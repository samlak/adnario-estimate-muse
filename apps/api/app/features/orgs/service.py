from fastapi import HTTPException

from app.core.access import Actor
from app.core.errors import NotFound
from app.database.connection import Connection
from app.features.auth.utils import invite_token
from app.features.orgs.schemas import Details, Invite
from app.features.orgs.utils import leaves_no_admin, link


def team(connection: Connection) -> list[dict]:
    return connection.execute(
        'select id, name, email, role, seen_at, invite_token is not null as invited, created_at from people'
        ' order by (invite_token is not null) desc, name'
    ).fetchall()


def invite(connection: Connection, actor: Actor, body: Invite) -> dict:
    if connection.execute('select 1 from people where lower(email) = %s', [body.email.lower()]).fetchone():
        raise HTTPException(409, 'That email already has an account or an invitation.')
    token, stored = invite_token()
    connection.execute(
        'insert into people (org_id, name, email, role, invite_token, invited_by) values (%s, %s, %s, %s, %s, %s)',
        [actor.org_id, body.email.split('@')[0], body.email.lower(), body.role, stored, actor.person_id],
    )
    return link(token)


def new_link(connection: Connection, person_id: str) -> dict:
    """A fresh link for someone still invited (only the hash is kept, so the old one cannot be shown again)."""
    token, stored = invite_token()
    if not connection.execute(
        'update people set invite_token = %s where id = %s and invite_token is not null returning id', [stored, person_id]
    ).fetchone():
        raise NotFound('No invitation for that person')
    return link(token)


def _person(connection: Connection, person_id: str) -> dict:
    person = connection.execute('select * from people where id = %s', [person_id]).fetchone()
    if person is None:
        raise NotFound()
    return person


def _admins(connection: Connection) -> int:
    return connection.execute("select count(*) as n from people where role = 'admin' and invite_token is null").fetchone()['n']


def change_role(connection: Connection, person_id: str, role: str) -> None:
    person = _person(connection, person_id)
    if leaves_no_admin(person, role, _admins(connection)):
        raise HTTPException(409, 'A firm keeps at least one Admin.')
    connection.execute('update people set role = %s where id = %s', [role, person_id])


def remove(connection: Connection, actor: Actor, person_id: str) -> None:
    if str(person_id) == str(actor.person_id):
        raise HTTPException(409, 'You cannot remove yourself.')
    person = _person(connection, person_id)
    if leaves_no_admin(person, None, _admins(connection)):
        raise HTTPException(409, 'A firm keeps at least one Admin.')
    connection.execute('delete from people where id = %s', [person_id])


def details(connection: Connection, actor: Actor) -> dict:
    return connection.execute('select id, name, currency from orgs where id = %s', [actor.org_id]).fetchone()


def save_details(connection: Connection, actor: Actor, body: Details) -> None:
    connection.execute('update orgs set name = %s, currency = %s where id = %s', [body.name.strip(), body.currency.upper(), actor.org_id])
