"""Projects, the people on them, comments with mentions and attachments, notifications, and the live stream of
changes for an open workspace (README §6, §7)."""

import re
import shutil
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field

from app import db, live
from app.access import CurrentActor, Forbidden, NotFound, find_project
from app.config import env

router = APIRouter()
UPLOAD_LIMIT = 50 * 1024 * 1024


class NewProject(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    client: str = ''
    location: str = ''
    description: str = ''


class Member(BaseModel):
    person_id: UUID
    access: Literal['edit', 'view'] = 'edit'


class Access(BaseModel):
    access: Literal['edit', 'view']


def revision_name(revision: int) -> str:
    return 'Takeoff 1' if revision == 0 else f'Rev {chr(64 + revision)}'


def project_rows(connection, actor) -> list[dict]:
    mine = '' if actor.can('all_projects') else 'where exists (select 1 from members m where m.project_id = p.id and m.person_id = %(me)s)'
    return connection.execute(
        f"""select p.id, p.name, p.client, p.location, p.description, p.updated_at,
              (select count(*) from models x where x.project_id = p.id and x.state = 'current') as models,
              (select count(*) from members m where m.project_id = p.id) as people,
              e.revision, e.status,
              coalesce(jsonb_array_length(e.result -> 'questions'), 0) as questions
            from projects p
            left join lateral (select * from estimates e where e.project_id = p.id order by revision desc limit 1) e on true
            {mine} order by p.updated_at desc""",
        {'me': actor.person_id},
    ).fetchall()


@router.get('/projects')
def projects(actor: CurrentActor):
    with db.in_org(actor.org_id) as connection:
        rows = project_rows(connection, actor)
    for row in rows:
        row['takeoff'] = revision_name(row['revision']) if row['revision'] is not None else None
    return rows


@router.post('/projects')
def create(body: NewProject, actor: CurrentActor):
    actor.need('create_project')
    with db.in_org(actor.org_id) as connection:
        project = connection.execute(
            'insert into projects (org_id, name, client, location, description, created_by) values (%s, %s, %s, %s, %s, %s) returning *',
            [actor.org_id, body.name.strip(), body.client.strip(), body.location.strip(), body.description.strip(), actor.person_id],
        ).fetchone()
        connection.execute("insert into members (org_id, project_id, person_id, access) values (%s, %s, %s, 'edit')", [actor.org_id, project['id'], actor.person_id])
    return project


@router.get('/projects/{project_id}')
def project(project_id: UUID, actor: CurrentActor):
    with db.in_org(actor.org_id) as connection:
        found = find_project(connection, actor, project_id)
        estimate = connection.execute(
            'select id, revision, status, updated_at from estimates where project_id = %s order by revision desc limit 1', [project_id]
        ).fetchone()
    return {**found, 'estimate': estimate, 'editor': actor.can('edit_estimate') and found['access'] == 'edit'}


@router.patch('/projects/{project_id}')
def update(project_id: UUID, body: NewProject, actor: CurrentActor):
    with db.in_org(actor.org_id) as connection:
        found = find_project(connection, actor, project_id)
        if found['access'] != 'edit':
            raise Forbidden()
        connection.execute(
            'update projects set name = %s, client = %s, location = %s, description = %s, updated_at = now() where id = %s',
            [body.name, body.client, body.location, body.description, project_id],
        )
    return {'ok': True}


@router.delete('/projects/{project_id}')
def delete(project_id: UUID, actor: CurrentActor):
    actor.need('delete_project')
    with db.in_org(actor.org_id) as connection:
        find_project(connection, actor, project_id)
        connection.execute('delete from projects where id = %s', [project_id])
    shutil.rmtree(env.FILES / str(actor.org_id) / str(project_id), ignore_errors=True)
    return {'ok': True}


# ── People on the project ────────────────────────────────────────────────────────────────────────────────────────
@router.get('/projects/{project_id}/members')
def members(project_id: UUID, actor: CurrentActor):
    with db.in_org(actor.org_id) as connection:
        find_project(connection, actor, project_id)
        return connection.execute(
            'select p.id, p.name, p.role, m.access from members m join people p on p.id = m.person_id where m.project_id = %s order by p.name',
            [project_id],
        ).fetchall()


@router.post('/projects/{project_id}/members')
def add_member(project_id: UUID, body: Member, actor: CurrentActor):
    actor.need('manage_members')
    with db.in_org(actor.org_id) as connection:
        project = find_project(connection, actor, project_id)
        connection.execute(
            'insert into members (org_id, project_id, person_id, access) values (%s, %s, %s, %s) on conflict (project_id, person_id) do update set access = excluded.access',
            [actor.org_id, project_id, body.person_id, body.access],
        )
        notify(connection, actor.org_id, [body.person_id], project_id, f'{actor.name} added you to {project["name"]}', '')
    return {'ok': True}


@router.patch('/projects/{project_id}/members/{person_id}')
def set_access(project_id: UUID, person_id: UUID, body: Access, actor: CurrentActor):
    actor.need('manage_members')
    with db.in_org(actor.org_id) as connection:
        find_project(connection, actor, project_id)
        connection.execute('update members set access = %s where project_id = %s and person_id = %s', [body.access, project_id, person_id])
    return {'ok': True}


@router.delete('/projects/{project_id}/members/{person_id}')
def remove_member(project_id: UUID, person_id: UUID, actor: CurrentActor):
    actor.need('manage_members')
    with db.in_org(actor.org_id) as connection:
        find_project(connection, actor, project_id)
        connection.execute('delete from members where project_id = %s and person_id = %s', [project_id, person_id])
    return {'ok': True}


# ── Comments ─────────────────────────────────────────────────────────────────────────────────────────────────────
def notify(connection, org_id, people, project_id, title: str, text: str) -> None:
    for person in people:
        connection.execute(
            'insert into notifications (org_id, person_id, project_id, title, text) values (%s, %s, %s, %s, %s)',
            [org_id, person, project_id, title, text],
        )


@router.get('/projects/{project_id}/comments')
def comments(project_id: UUID, actor: CurrentActor):
    with db.in_org(actor.org_id) as connection:
        find_project(connection, actor, project_id)
        # a Contributor cannot see the BOQ, so not the comments on its lines either
        hidden = '' if actor.can('see_estimate') else "and c.on_kind not in ('boq', 'question')"
        return connection.execute(
            f'select c.id, c.on_kind, c.on_ref, c.on_label, c.text, c.file, c.created_at, p.id as person_id, p.name'
            f' from comments c join people p on p.id = c.person_id where c.project_id = %s {hidden} order by c.created_at',
            [project_id],
        ).fetchall()


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
    if on_kind not in ('project', 'model', 'element', 'boq', 'question'):
        raise HTTPException(422, 'Unknown comment target')
    stored = None
    if file and file.filename:
        data = await file.read()
        if len(data) > UPLOAD_LIMIT:
            raise HTTPException(413, 'Attachments are up to 50 MB')
        folder = env.FILES / str(actor.org_id) / str(project_id) / 'attachments'
        folder.mkdir(parents=True, exist_ok=True)
        name = f'{db.new_id()}-{re.sub(r"[^\w.\- ]", "_", file.filename)}'
        (folder / name).write_bytes(data)
        stored = {'name': file.filename, 'size': len(data), 'path': name}
    with db.in_org(actor.org_id) as connection:
        project = find_project(connection, actor, project_id)
        row = connection.execute(
            'insert into comments (org_id, project_id, person_id, on_kind, on_ref, on_label, text, file) values (%s, %s, %s, %s, %s, %s, %s, %s) returning id',
            [actor.org_id, project_id, actor.person_id, on_kind, on_ref, on_label[:200], text, stored and db.Jsonb(stored)],
        ).fetchone()
        # mentioning someone notifies them; someone in the firm who is not on the project is added to it
        people = connection.execute('select id, name, role from people where invite_token is null and id <> %s', [actor.person_id]).fetchall()
        named = [person for person in people if f'@{person["name"]}' in text]
        for person in named:
            connection.execute(
                "insert into members (org_id, project_id, person_id, access) values (%s, %s, %s, 'view') on conflict do nothing",
                [actor.org_id, project_id, person['id']],
            )
        notify(connection, actor.org_id, [person['id'] for person in named], project_id, f'{actor.name} mentioned you in {project["name"]}', text)
        connection.execute('update projects set updated_at = now() where id = %s', [project_id])
    return row


@router.delete('/comments/{comment_id}')
def delete_comment(comment_id: UUID, actor: CurrentActor):
    with db.in_org(actor.org_id) as connection:
        found = connection.execute('delete from comments where id = %s and person_id = %s returning id', [comment_id, actor.person_id]).fetchone()
    if not found:
        raise NotFound()
    return {'ok': True}


@router.get('/comments/{comment_id}/file')
def attachment(comment_id: UUID, actor: CurrentActor):
    with db.in_org(actor.org_id) as connection:
        found = connection.execute('select project_id, file from comments where id = %s', [comment_id]).fetchone()
        if not found or not found['file']:
            raise NotFound()
        find_project(connection, actor, found['project_id'])
    path = env.FILES / str(actor.org_id) / str(found['project_id']) / 'attachments' / found['file']['path']
    return FileResponse(path, filename=found['file']['name'], content_disposition_type='inline')


# ── Notifications ────────────────────────────────────────────────────────────────────────────────────────────────
@router.get('/notifications')
def notifications(actor: CurrentActor):
    with db.in_org(actor.org_id) as connection:
        return connection.execute(
            'select id, project_id, title, text, read, created_at from notifications where person_id = %s order by created_at desc limit 100',
            [actor.person_id],
        ).fetchall()


@router.post('/notifications/{notice_id}/read')
def read(notice_id: UUID, actor: CurrentActor):
    with db.in_org(actor.org_id) as connection:
        connection.execute('update notifications set read = true where id = %s and person_id = %s', [notice_id, actor.person_id])
    return {'ok': True}


@router.post('/notifications/read')
def read_all(actor: CurrentActor):
    with db.in_org(actor.org_id) as connection:
        connection.execute('update notifications set read = true where person_id = %s', [actor.person_id])
    return {'ok': True}


# ── Live ─────────────────────────────────────────────────────────────────────────────────────────────────────────
@router.get('/projects/{project_id}/live')
def follow(project_id: UUID, actor: CurrentActor):
    with db.in_org(actor.org_id) as connection:
        find_project(connection, actor, project_id)
    return StreamingResponse(live.follow(str(project_id)), media_type='text/event-stream', headers={'Cache-Control': 'no-cache'})
