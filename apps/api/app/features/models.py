"""Building models (README §7.1): an IFC upload is converted to XKT on the converter for the viewer and kept for the
estimate run. A new export of a model already there becomes its next version: the server works out, element by
element by GlobalId, what was added, removed or changed, and a QS or Admin accepts or rejects it."""

import asyncio
import functools
import hashlib
import json
import re
from pathlib import Path
from uuid import UUID

import httpx
from fastapi import APIRouter, BackgroundTasks, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from app import db
from app.access import CurrentActor, Forbidden, NotFound, find_project
from app.config import env
from app.features.projects import notify

router = APIRouter()
LIMIT = 200 * 1024 * 1024


def folder(org_id, project_id) -> Path:
    path = env.FILES / str(org_id) / str(project_id) / 'models'
    path.mkdir(parents=True, exist_ok=True)
    return path


def ifc_path(model: dict) -> Path:
    return folder(model['org_id'], model['project_id']) / f'{model["id"]}.ifc'


@functools.lru_cache(maxsize=8)
def _open(path: str, stamp: float):
    import ifcopenshell

    return ifcopenshell.open(path)


def open_ifc(model: dict):
    path = ifc_path(model)
    return _open(str(path), path.stat().st_mtime)


def convert(org_id, model_id) -> None:
    """IFC → XKT on the converter (a background task): the viewer loads XKT; IFC in the browser crashes xeokit."""
    with db.in_org(org_id) as connection:
        model = connection.execute('select * from models where id = %s', [model_id]).fetchone()
    path = ifc_path(model)
    try:
        response = httpx.post(f'{env.CONVERTER_URL}/convert', content=path.read_bytes(), timeout=900)
        if response.status_code != 200:
            raise RuntimeError(response.text[:300] or f'converter answered {response.status_code}')
        path.with_suffix('.xkt').write_bytes(response.content)
        stats = element_stats(model)
        status, note, seconds = 'ready', None, float(response.headers.get('X-Seconds', 0))
    except Exception as error:  # the converter not running, or a file it cannot read
        status, note, seconds, stats = 'failed', f'Could not convert: {error}', None, {}
    with db.in_org(org_id) as connection:
        connection.execute(
            'update models set status = %s, note = %s, seconds = %s, stats = %s where id = %s',
            [status, note, seconds, db.Jsonb(stats), model_id],
        )


def element_stats(model: dict) -> dict:
    ifc = open_ifc(model)
    glass = 0
    for element in ifc.by_type('IfcWindow') + ifc.by_type('IfcPlate'):
        glass += 1
    return {'elements': len(ifc.by_type('IfcElement')), 'glass': glass, 'schema': ifc.schema}


def fingerprints(model: dict) -> dict[str, dict]:
    """Each element by GlobalId: what a new version is compared on (type, quantity, position, material, properties)."""
    import ifcopenshell.util.element as E
    import ifcopenshell.util.placement as P

    out = {}
    for element in open_ifc(model).by_type('IfcElement'):
        if element.is_a('IfcOpeningElement'):
            continue
        kind = E.get_type(element)
        psets = E.get_psets(element)
        dims = psets.get('PSet_Revit_Dimensions', {})
        try:
            where = [round(float(v), 2) for v in P.get_local_placement(element.ObjectPlacement)[:3, 3]] if element.ObjectPlacement else None
        except Exception:
            where = None
        out[element.GlobalId] = {
            'name': element.Name,
            'type': (kind.Name if kind else None) or (element.Name or '').split(':')[0],
            'quantity': {key: round(float(value), 3) for key, value in dims.items() if isinstance(value, (int, float))},
            'position': where,
            'material': sorted(m.Name for m in (E.get_materials(element) or []) if getattr(m, 'Name', None)),
            'properties': hashlib.md5(json.dumps(psets, sort_keys=True, default=str).encode()).hexdigest(),
            'class': element.is_a(),
        }
    return out


def diff(old: dict, new: dict) -> dict:
    before, after = fingerprints(old), fingerprints(new)
    changed = []
    for gid in before.keys() & after.keys():
        what = [field for field in ('type', 'quantity', 'position', 'material', 'properties') if before[gid][field] != after[gid][field]]
        if what:
            changed.append({'gid': gid, 'name': after[gid]['name'], 'class': after[gid]['class'], 'changed': what})
    pick = lambda found, gids: [{'gid': gid, 'name': found[gid]['name'], 'class': found[gid]['class']} for gid in sorted(gids)]
    return {'added': pick(after, after.keys() - before.keys()), 'removed': pick(before, before.keys() - after.keys()), 'changed': changed}


def model_rows(connection, project_id) -> list[dict]:
    return connection.execute(
        "select id, name, version, state, size, status, note, seconds, stats, diff, nudge, created_at from models"
        " where project_id = %s and state <> 'deleted' order by name, version",
        [project_id],
    ).fetchall()


@router.get('/projects/{project_id}/models')
def models(project_id: UUID, actor: CurrentActor):
    with db.in_org(actor.org_id) as connection:
        find_project(connection, actor, project_id)
        rows = model_rows(connection, project_id)
    for row in rows:
        if row['diff']:  # the list shows the counts; the full diff is one request away
            row['changes'] = {key: len(value) for key, value in row['diff'].items()}
            row['diff'] = None
    return rows


def add_model(connection, org_id, project_id, name: str, data: bytes, person_id) -> dict:
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


@router.post('/projects/{project_id}/models')
async def upload(project_id: UUID, background: BackgroundTasks, actor: CurrentActor, files: list[UploadFile] = File(...)):
    actor.need('upload')
    made = []
    for file in files:
        if not re.search(r'\.ifc$', file.filename or '', re.I):
            raise HTTPException(422, f'{file.filename} is not an IFC file')
        data = await file.read()
        if len(data) > LIMIT:
            raise HTTPException(413, f'{file.filename} is over 200 MB')
        if not data.lstrip()[:20].startswith(b'ISO-10303-21'):
            raise HTTPException(422, f'{file.filename} is not a readable IFC (STEP) file')

        def store():
            with db.in_org(actor.org_id) as connection:
                find_project(connection, actor, project_id, 'upload')
                return add_model(connection, actor.org_id, project_id, file.filename, data, actor.person_id)

        model = await asyncio.to_thread(store)
        background.add_task(convert, actor.org_id, model['id'])
        made.append({'id': model['id'], 'name': model['name'], 'version': model['version'], 'state': model['state']})
    return made


def find_model(connection, actor, model_id) -> dict:
    model = connection.execute('select * from models where id = %s', [model_id]).fetchone()
    if model is None:
        raise NotFound('Unknown model')
    find_project(connection, actor, model['project_id'])
    return model


@router.get('/models/{model_id}/xkt')
def xkt(model_id: UUID, actor: CurrentActor):
    with db.in_org(actor.org_id) as connection:
        model = find_model(connection, actor, model_id)
    path = ifc_path(model).with_suffix('.xkt')
    if not path.exists():
        raise NotFound('Not converted yet')
    return FileResponse(path, media_type='application/octet-stream', headers={'Cache-Control': 'private, max-age=86400'})


@router.get('/models/{model_id}/diff')
def model_diff(model_id: UUID, actor: CurrentActor):
    with db.in_org(actor.org_id) as connection:
        return find_model(connection, actor, model_id)['diff'] or {}


@router.get('/models/{model_id}/elements/{gid}')
def element(model_id: UUID, gid: str, actor: CurrentActor):
    """The clicked element's IFC properties."""
    import ifcopenshell.util.element as E

    with db.in_org(actor.org_id) as connection:
        model = find_model(connection, actor, model_id)
    ifc = open_ifc(model)
    try:
        found = ifc.by_guid(gid)
    except RuntimeError:
        raise NotFound('No such element')
    kind = E.get_type(found)
    storey = E.get_container(found)
    return {
        'gid': gid, 'class': found.is_a(), 'name': found.Name, 'type': kind.Name if kind else None,
        'storey': storey.Name if storey else None, 'model': model['name'],
        'material': [m.Name for m in (E.get_materials(found) or []) if getattr(m, 'Name', None)],
        'psets': E.get_psets(found),
    }


class Nudge(BaseModel):
    x: float = 0
    z: float = 0
    rotate: float = 0


@router.patch('/models/{model_id}/nudge')
def nudge(model_id: UUID, body: Nudge, actor: CurrentActor):
    actor.need('upload')
    with db.in_org(actor.org_id) as connection:
        find_model(connection, actor, model_id)
        connection.execute('update models set nudge = %s where id = %s', [db.Jsonb(body.model_dump()), model_id])
    return {'ok': True}


@router.delete('/models/{model_id}')
def delete(model_id: UUID, actor: CurrentActor):
    """Gone from the viewer; versions an estimate measured keep their file."""
    actor.need('upload')
    with db.in_org(actor.org_id) as connection:
        find_model(connection, actor, model_id)
        connection.execute("update models set state = 'deleted' where id = %s", [model_id])
    return {'ok': True}


class Decision(BaseModel):
    accept: bool
    reason: str = Field('', max_length=1000)


@router.post('/models/{model_id}/decision')
def decide(model_id: UUID, body: Decision, actor: CurrentActor):
    """A QS or Admin accepts a proposed version (it becomes the one everyone uses) or rejects it with a reason the
    uploader sees."""
    if not actor.can('accept_versions'):
        raise Forbidden()
    with db.in_org(actor.org_id) as connection:
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
    return {'ok': True}
