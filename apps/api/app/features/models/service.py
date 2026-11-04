from uuid import UUID

from fastapi import HTTPException

from app.core.access import Actor, find_project
from app.core.errors import NotFound
from app.database import connection as db
from app.database.connection import Connection
from app.features.models.files import ifc_path, open_ifc
from app.features.models.schemas import Decision, Nudge
from app.features.models.utils import listed, properties
from app.features.models.versions import diff
from app.features.notifications.service import notify


def models(connection: Connection, actor: Actor, project_id: UUID) -> list[dict]:
    find_project(connection, actor, project_id)
    return listed(connection.execute(
        "select id, name, version, state, size, status, note, seconds, stats, diff, nudge, created_at from models"
        " where project_id = %s and state <> 'deleted' order by name, version",
        [project_id],
    ).fetchall())


def add_model(connection: Connection, org_id, project_id, name: str, data: bytes, person_id) -> dict:
    """The next version of the model by that name: current if it is the first, else proposed with its diff."""
    current = connection.execute(
        "select * from models where project_id = %s and name = %s and state = 'current'", [project_id, name]
    ).fetchone()
    version = (connection.execute('select coalesce(max(version), 0) as v from models where project_id = %s and name = %s', [project_id, name]).fetchone()['v']) + 1
    model = connection.execute(
        'insert into models (org_id, project_id, name, version, state, size, uploaded_by) values (%s, %s, %s, %s, %s, %s, %s) returning *',
        [org_id, project_id, name, version, 'proposed' if current else 'current', len(data), person_id],
    ).fetchone()
    ifc_path(model).write_bytes(data)
    if current:
        connection.execute('update models set diff = %s where id = %s', [db.Jsonb(diff(current, model)), model['id']])
    connection.execute('update projects set updated_at = now() where id = %s', [project_id])
    return model


def upload(connection: Connection, actor: Actor, project_id: UUID, name: str, data: bytes) -> dict:
    find_project(connection, actor, project_id, 'upload')
    return add_model(connection, actor.org_id, project_id, name, data, actor.person_id)


def find_model(connection: Connection, actor: Actor, model_id) -> dict:
    model = connection.execute('select * from models where id = %s', [model_id]).fetchone()
    if model is None:
        raise NotFound('Unknown model')
    find_project(connection, actor, model['project_id'])
    return model


def xkt(model: dict):
    path = ifc_path(model).with_suffix('.xkt')
    if not path.exists():
        raise NotFound('Not converted yet')
    return path


def element(model: dict, gid: str) -> dict:
    """The clicked element's IFC properties."""
    try:
        found = open_ifc(model).by_guid(gid)
    except RuntimeError:
        raise NotFound('No such element')
    return properties(found, model)


def nudge(connection: Connection, model_id: UUID, body: Nudge) -> None:
    connection.execute('update models set nudge = %s where id = %s', [db.Jsonb(body.model_dump()), model_id])


def delete(connection: Connection, model_id: UUID) -> None:
    """Gone from the viewer; versions an estimate measured keep their file."""
    connection.execute("update models set state = 'deleted' where id = %s", [model_id])


def decide(connection: Connection, actor: Actor, model_id: UUID, body: Decision) -> None:
    """A proposed version accepted (it becomes the one everyone uses) or rejected with a reason the uploader sees."""
    model = find_model(connection, actor, model_id)
    if model['state'] != 'proposed':
        raise HTTPException(409, 'Only a proposed version is accepted or rejected')
    if body.accept:
        connection.execute("update models set state = 'superseded' where project_id = %s and name = %s and state = 'current'", [model['project_id'], model['name']])
        connection.execute("update models set state = 'current' where id = %s", [model_id])
    else:
        connection.execute("update models set state = 'rejected', note = %s where id = %s", [body.reason or 'Rejected', model_id])
    if model['uploaded_by'] and model['uploaded_by'] != actor.person_id:
        verdict = 'accepted' if body.accept else f'rejected: {body.reason}'
        notify(connection, actor.org_id, [model['uploaded_by']], model['project_id'], f'{model["name"]} v{model["version"]} {verdict}', '')
