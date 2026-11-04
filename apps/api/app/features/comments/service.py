from uuid import UUID

from fastapi import HTTPException

from app.core.access import Actor, find_project
from app.core.config import env
from app.core.errors import NotFound
from app.database import connection as db
from app.database.connection import Connection
from app.features.comments.constants import ATTACHMENT_LIMIT, LABEL_LENGTH, MONEY_TARGETS
from app.features.comments.utils import mentioned, safe_name
from app.features.notifications.service import notify


def folder(org_id, project_id):
    return env.DATA / str(org_id) / str(project_id) / 'attachments'


def comments(connection: Connection, actor: Actor, project_id: UUID) -> list[dict]:
    find_project(connection, actor, project_id)
    # a Contributor cannot see the BOQ, so not the comments on its lines either
    hidden = '' if actor.can('see_estimate') else f'and c.on_kind not in {MONEY_TARGETS}'
    return connection.execute(
        f'select c.id, c.on_kind, c.on_ref, c.on_label, c.text, c.file, c.created_at, p.id as person_id, p.name'
        f' from comments c join people p on p.id = c.person_id where c.project_id = %s {hidden} order by c.created_at',
        [project_id],
    ).fetchall()


def store(actor: Actor, project_id: UUID, filename: str, data: bytes) -> dict:
    """An attachment kept on disk beside the project's files."""
    if len(data) > ATTACHMENT_LIMIT:
        raise HTTPException(413, 'Attachments are up to 50 MB')
    where = folder(actor.org_id, project_id)
    where.mkdir(parents=True, exist_ok=True)
    name = f'{db.new_id()}-{safe_name(filename)}'
    (where / name).write_bytes(data)
    return {'name': filename, 'size': len(data), 'path': name}


def add(connection: Connection, actor: Actor, project_id: UUID, text: str, on: tuple[str, str | None, str], stored: dict | None) -> dict:
    """The comment; mentioning someone notifies them, and someone in the firm not on the project is added to it."""
    on_kind, on_ref, on_label = on
    project = find_project(connection, actor, project_id)
    row = connection.execute(
        'insert into comments (org_id, project_id, person_id, on_kind, on_ref, on_label, text, file) values (%s, %s, %s, %s, %s, %s, %s, %s) returning id',
        [actor.org_id, project_id, actor.person_id, on_kind, on_ref, on_label[:LABEL_LENGTH], text, stored and db.Jsonb(stored)],
    ).fetchone()
    people = connection.execute('select id, name, role from people where invite_token is null and id <> %s', [actor.person_id]).fetchall()
    named = mentioned(people, text)
    for person in named:
        connection.execute(
            "insert into members (org_id, project_id, person_id, access) values (%s, %s, %s, 'view') on conflict do nothing",
            [actor.org_id, project_id, person['id']],
        )
    notify(connection, actor.org_id, [person['id'] for person in named], project_id, f'{actor.name} mentioned you in {project["name"]}', text)
    connection.execute('update projects set updated_at = now() where id = %s', [project_id])
    return row


def delete(connection: Connection, actor: Actor, comment_id: UUID) -> None:
    if not connection.execute('delete from comments where id = %s and person_id = %s returning id', [comment_id, actor.person_id]).fetchone():
        raise NotFound()


def attachment(connection: Connection, actor: Actor, comment_id: UUID) -> tuple:
    """The attachment's path on disk and its name."""
    found = connection.execute('select project_id, file from comments where id = %s', [comment_id]).fetchone()
    if not found or not found['file']:
        raise NotFound()
    find_project(connection, actor, found['project_id'])
    return folder(actor.org_id, found['project_id']) / found['file']['path'], found['file']['name']
