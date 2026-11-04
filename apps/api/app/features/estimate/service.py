"""The estimate in the database: the project's latest, what each person may see of it, project information and
documents, a new revision, the QS's edits with undo and redo, and the exports."""

from uuid import UUID

from fastapi import HTTPException

from app.core import runs
from app.core.access import Actor, check_estimate, find_project, need_edit
from app.database import connection as db
from app.database.connection import Connection
from app.features.estimate import boq as boqs
from app.features.estimate.constants import UNDO_STEPS
from app.features.estimate.editing import apply, mutable, restore
from app.features.estimate.excel import boq_excel
from app.features.estimate.pdf import boq_pdf
from app.features.estimate.schemas import Edit
from app.features.estimate.utils import file_name, revision_name
from app.features.programme import service as programmes
from app.features.programme.excel import cash_flow_excel

XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'


# ── Reading ──────────────────────────────────────────────────────────────────────────────────────────────────────
def latest(connection, project_id) -> dict:
    found = connection.execute('select * from estimates where project_id = %s order by revision desc limit 1', [project_id]).fetchone()
    if found is None:
        project = connection.execute('select org_id from projects where id = %s', [project_id]).fetchone()
        found = connection.execute('insert into estimates (org_id, project_id) values (%s, %s) returning *', [project['org_id'], project_id]).fetchone()
    return found


def as_seen(actor: Actor, estimate: dict) -> dict:
    """What this person may see: no money for a Contributor, no rate card behind the rates for a Viewer."""
    result = estimate['result']
    history = estimate['history'] if isinstance(estimate['history'], dict) else {}
    out = {
        'id': estimate['id'], 'project_id': estimate['project_id'], 'revision': estimate['revision'], 'name': revision_name(estimate['revision']),
        'status': estimate['status'], 'info': estimate['info'], 'updated_at': estimate['updated_at'],
        'undo': len(history.get('undo', [])), 'redo': len(history.get('redo', [])),
        'running': [key.split(':')[0] for key, run in runs.runs.items() if key.endswith(str(estimate['id'])) and not run.done],
        'programme': programmes.shown(actor, estimate['programme']), 'result': None,
    }
    if result:
        result = dict(result)
        result['refs'] = boqs.display_refs(result.get('boq') or [])
        result['totals'] = boqs.totals(result.get('boq') or [], result['pricing'])
        if not actor.can('see_estimate'):
            result['boq'] = [{**line, 'rate': None, 'qty': None} for line in result.get('boq') or []]
            result['takeoff_lines'] = [{**line, 'qty': None} for line in result['takeoff_lines']]
            result['totals'] = None
            result['pricing'] = {}
        elif not actor.can('see_rates'):
            result['pricing'] = {**result['pricing'], 'sources': {}}
        out['result'] = result
    return out


def editable(connection, actor: Actor, estimate_id) -> tuple[dict, dict]:
    estimate, project = check_estimate(connection, actor, estimate_id, 'edit_estimate')
    need_edit(actor, project)
    return estimate, project


def estimate(connection: Connection, actor: Actor, project_id: UUID) -> dict:
    find_project(connection, actor, project_id)
    return as_seen(actor, latest(connection, project_id))


def revisions(connection: Connection, actor: Actor, project_id: UUID) -> list[dict]:
    find_project(connection, actor, project_id)
    rows = connection.execute('select id, revision, status, updated_at from estimates where project_id = %s order by revision', [project_id]).fetchall()
    return [{**row, 'name': revision_name(row['revision'])} for row in rows]


def set_info(connection: Connection, actor: Actor, estimate_id: UUID, text: str) -> None:
    estimate, _ = editable(connection, actor, estimate_id)
    info = {**(estimate['info'] or {}), 'text': text}
    connection.execute('update estimates set info = %s where id = %s', [db.Jsonb(info), estimate_id])


def add_documents(connection: Connection, actor: Actor, estimate_id: UUID, texts: list[str], names: list[str]) -> list[str]:
    """The documents' text added to the project information; the names of every document so far."""
    estimate, _ = editable(connection, actor, estimate_id)
    info = estimate['info'] or {}
    info = {**info, 'text': '\n\n'.join(filter(None, [info.get('text', ''), *texts])), 'documents': [*info.get('documents', []), *names]}
    connection.execute('update estimates set info = %s where id = %s', [db.Jsonb(info), estimate_id])
    return info['documents']


def new_revision(connection: Connection, actor: Actor, project_id: UUID) -> UUID:
    """Update estimate: a new revision, carrying over the project information and the programme."""
    project = find_project(connection, actor, project_id, 'edit_estimate')
    need_edit(actor, project)
    before = latest(connection, project_id)
    if before['status'] != 'ready':
        raise HTTPException(409, 'Run the takeoff first')
    return connection.execute(
        'insert into estimates (org_id, project_id, revision, info, programme) values (%s, %s, %s, %s, %s) returning id',
        [actor.org_id, project_id, before['revision'] + 1, db.Jsonb(before['info']), before['programme'] and db.Jsonb(before['programme'])],
    ).fetchone()['id']


def load_result(org_id, estimate_id) -> dict:
    with db.in_org(org_id) as connection:
        found = connection.execute('select result, programme from estimates where id = %s', [estimate_id]).fetchone()
    if not found or not found['result']:
        raise HTTPException(409, 'Run the takeoff first')
    return found


def save_result(org_id, estimate_id, result: dict, programme: dict | None = None, keep_history=True) -> None:
    with db.in_org(org_id) as connection:
        if programme is not None:
            connection.execute('update estimates set result = %s, programme = %s, updated_at = now() where id = %s', [db.Jsonb(result), db.Jsonb(programme), estimate_id])
        else:
            connection.execute('update estimates set result = %s, updated_at = now() where id = %s', [db.Jsonb(result), estimate_id])
        if not keep_history:
            connection.execute("update estimates set history = '{}' where id = %s", [estimate_id])


# ── Long work ────────────────────────────────────────────────────────────────────────────────────────────────────
def mark_failed(org_id, estimate_id, status: str):
    with db.in_org(org_id) as connection:
        connection.execute('update estimates set status = %s where id = %s', [status, estimate_id])


def _save_edit(connection: Connection, actor: Actor, estimate: dict, result: dict, history: dict) -> dict:
    """The result after an edit, its history and the programme re-priced, saved; the estimate as this person sees it."""
    programme = estimate['programme'] and programmes.reprice(estimate['programme'], result)
    connection.execute('update estimates set result = %s, history = %s, programme = %s, updated_at = now() where id = %s',
                       [db.Jsonb(result), db.Jsonb(history), programme and db.Jsonb(programme), estimate['id']])
    return as_seen(actor, {**estimate, 'result': result, 'history': history, 'programme': programme})


def edit(connection: Connection, actor: Actor, estimate_id: UUID, body: Edit) -> dict:
    """One edit by the QS, a step of undo; it clears redo."""
    estimate, _ = editable(connection, actor, estimate_id)
    result = estimate['result']
    if not result:
        raise HTTPException(409, 'Run the takeoff first')
    history = estimate['history'] if isinstance(estimate['history'], dict) else {}
    before = mutable(result)
    apply(result, body)
    history = {'undo': [*history.get('undo', []), before][-UNDO_STEPS:], 'redo': []}
    return _save_edit(connection, actor, estimate, result, history)


def undo(connection: Connection, actor: Actor, estimate_id: UUID, way: str) -> dict:
    """One step back (undo) or forward again (redo)."""
    estimate, _ = editable(connection, actor, estimate_id)
    history = estimate['history'] if isinstance(estimate['history'], dict) else {}
    steps = history.get(way, [])
    if not steps:
        raise HTTPException(409, f'Nothing to {way}')
    result = estimate['result']
    now = mutable(result)
    restore(result, steps[-1])
    other = 'redo' if way == 'undo' else 'undo'
    return _save_edit(connection, actor, estimate, result, {way: steps[:-1], other: [*history.get(other, []), now]})


def export(connection: Connection, actor: Actor, estimate_id: UUID, what: str) -> tuple[bytes, str, str]:
    """The file's bytes, media type and name."""
    estimate, project = check_estimate(connection, actor, estimate_id, 'see_estimate')
    project = {**project, 'firm': connection.execute('select name from orgs where id = %s', [actor.org_id]).fetchone()['name']}
    result = estimate['result']
    if not result or (what != 'cashflow.xlsx' and not result.get('boq')):
        raise HTTPException(409, 'Generate the BOQ first')
    name = file_name(project['name'])
    if what == 'boq.xlsx':
        return boq_excel(project, result), XLSX, f'{name}_BOQ.xlsx'
    if what == 'boq.pdf':
        return boq_pdf(project, result), 'application/pdf', f'{name}_BOQ.pdf'
    if not estimate['programme']:
        raise HTTPException(409, 'Upload the programme first')
    return cash_flow_excel(project, estimate['programme']), XLSX, f'{name}_Cash_Flow.xlsx'
