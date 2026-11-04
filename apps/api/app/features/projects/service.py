import shutil
from uuid import UUID

from app.core.access import Actor, find_project
from app.core.config import env
from app.core.errors import Forbidden
from app.database.connection import Connection
from app.features.estimate.utils import revision_name
from app.features.notifications.service import notify
from app.features.projects.schemas import Member, NewProject


def projects(connection: Connection, actor: Actor) -> list[dict]:
    """The projects this person is on (an Admin: every one), newest change first, with their latest takeoff."""
    mine = '' if actor.can('all_projects') else 'where exists (select 1 from members m where m.project_id = p.id and m.person_id = %(me)s)'
    rows = connection.execute(
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
    for row in rows:
        row['takeoff'] = revision_name(row['revision']) if row['revision'] is not None else None
    return rows


def create(connection: Connection, actor: Actor, body: NewProject) -> dict:
    """The project, with its maker on it to edit."""
    project = connection.execute(
        'insert into projects (org_id, name, client, location, description, created_by) values (%s, %s, %s, %s, %s, %s) returning *',
        [actor.org_id, body.name.strip(), body.client.strip(), body.location.strip(), body.description.strip(), actor.person_id],
    ).fetchone()
    connection.execute("insert into members (org_id, project_id, person_id, access) values (%s, %s, %s, 'edit')", [actor.org_id, project['id'], actor.person_id])
    return project


def project(connection: Connection, actor: Actor, project_id: UUID) -> dict:
    found = find_project(connection, actor, project_id)
    estimate = connection.execute(
        'select id, revision, status, updated_at from estimates where project_id = %s order by revision desc limit 1', [project_id]
    ).fetchone()
    return {**found, 'estimate': estimate, 'editor': actor.can('edit_estimate') and found['access'] == 'edit'}


def update(connection: Connection, actor: Actor, project_id: UUID, body: NewProject) -> None:
    if find_project(connection, actor, project_id)['access'] != 'edit':
        raise Forbidden()
    connection.execute(
        'update projects set name = %s, client = %s, location = %s, description = %s, updated_at = now() where id = %s',
        [body.name, body.client, body.location, body.description, project_id],
    )


def delete(connection: Connection, actor: Actor, project_id: UUID) -> None:
    """The project, its rows and its files."""
    find_project(connection, actor, project_id)
    connection.execute('delete from projects where id = %s', [project_id])
    shutil.rmtree(env.FILES / str(actor.org_id) / str(project_id), ignore_errors=True)


def members(connection: Connection, actor: Actor, project_id: UUID) -> list[dict]:
    find_project(connection, actor, project_id)
    return connection.execute(
        'select p.id, p.name, p.role, m.access from members m join people p on p.id = m.person_id where m.project_id = %s order by p.name',
        [project_id],
    ).fetchall()


def add_member(connection: Connection, actor: Actor, project_id: UUID, body: Member) -> None:
    """Added (or their access changed if already on it), and told."""
    project = find_project(connection, actor, project_id)
    connection.execute(
        'insert into members (org_id, project_id, person_id, access) values (%s, %s, %s, %s) on conflict (project_id, person_id) do update set access = excluded.access',
        [actor.org_id, project_id, body.person_id, body.access],
    )
    notify(connection, actor.org_id, [body.person_id], project_id, f'{actor.name} added you to {project["name"]}', '')


def set_access(connection: Connection, actor: Actor, project_id: UUID, person_id: UUID, access: str) -> None:
    find_project(connection, actor, project_id)
    connection.execute('update members set access = %s where project_id = %s and person_id = %s', [access, project_id, person_id])


def remove_member(connection: Connection, actor: Actor, project_id: UUID, person_id: UUID) -> None:
    find_project(connection, actor, project_id)
    connection.execute('delete from members where project_id = %s and person_id = %s', [project_id, person_id])
