"""Who is asking, and what their role lets them do (README §4). The web app hides what a person cannot do, but the
server alone decides: every route checks here."""

import hashlib
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Annotated
from uuid import UUID

from fastapi import Cookie, Depends, HTTPException

from app import db

COOKIE = 'adnario_session'
SESSION_DAYS = 30

PERMISSIONS = {
    'admin': {'see_estimate', 'edit_estimate', 'see_rates', 'edit_rates', 'see_programme', 'upload', 'comment',
              'create_project', 'manage_org', 'delete_project', 'all_projects', 'accept_versions', 'manage_members'},
    'qs': {'see_estimate', 'edit_estimate', 'see_rates', 'edit_rates', 'see_programme', 'upload', 'comment',
           'create_project', 'accept_versions', 'manage_members'},
    'contributor': {'see_programme', 'upload', 'comment', 'create_project'},
    'viewer': {'see_estimate', 'see_programme', 'comment'},
}


class NotFound(HTTPException):
    def __init__(self, what: str = 'Not found'):
        super().__init__(404, what)


class Forbidden(HTTPException):
    def __init__(self, what: str = 'Your role does not allow that'):
        super().__init__(403, what)


@dataclass(frozen=True)
class Actor:
    person_id: UUID
    org_id: UUID
    name: str
    role: str

    def can(self, permission: str) -> bool:
        return permission in PERMISSIONS[self.role]

    def need(self, permission: str) -> None:
        if not self.can(permission):
            raise Forbidden()


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def new_session(connection, person: dict) -> str:
    token = secrets.token_urlsafe(32)
    connection.execute(
        'insert into sessions (token_hash, org_id, person_id, expires_at) values (%s, %s, %s, %s)',
        [token_hash(token), person['org_id'], person['id'], datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)],
    )
    return token


def actor_of(token: str | None) -> Actor | None:
    if not token:
        return None
    with db.system() as connection:
        found = connection.execute(
            'select p.id, p.org_id, p.name, p.role from sessions s join people p on p.id = s.person_id'
            ' where s.token_hash = %s and s.expires_at > now()',
            [token_hash(token)],
        ).fetchone()
        if found:
            connection.execute("update people set seen_at = now() where id = %s and (seen_at is null or seen_at < now() - interval '1 minute')", [found['id']])
    return found and Actor(found['id'], found['org_id'], found['name'], found['role'])


def current(adnario_session: Annotated[str | None, Cookie()] = None) -> Actor:
    actor = actor_of(adnario_session)
    if actor is None:
        raise HTTPException(401, 'Sign in first')
    return actor


CurrentActor = Annotated[Actor, Depends(current)]


def find_project(connection, actor: Actor, project_id, permission: str = 'see_programme') -> dict:
    """The project, if this person is on it (an Admin is on every project of the firm)."""
    actor.need(permission)
    project = connection.execute(
        'select p.*, m.access from projects p left join members m on m.project_id = p.id and m.person_id = %s'
        ' where p.id = %s',
        [actor.person_id, project_id],
    ).fetchone()
    if project is None or (project['access'] is None and not actor.can('all_projects')):
        raise NotFound('Unknown project')
    project['access'] = project['access'] or 'edit'
    return project


def can_edit(actor: Actor, project: dict) -> bool:
    return actor.can('edit_estimate') and project['access'] == 'edit'


def need_edit(actor: Actor, project: dict) -> None:
    if not can_edit(actor, project):
        raise Forbidden('You can view this project, not change it')


def check_estimate(connection, actor: Actor, estimate_id, permission: str = 'see_estimate') -> tuple[dict, dict]:
    estimate = connection.execute('select * from estimates where id = %s', [estimate_id]).fetchone()
    if estimate is None:
        raise NotFound('Unknown estimate')
    return estimate, find_project(connection, actor, estimate['project_id'], permission)
