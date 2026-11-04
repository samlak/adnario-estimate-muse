"""The estimate's routes (README §7.2–7.6): the project's estimate, its run, Generate BOQ, Link to cost, the QS's edits
with undo and redo, the programme, and the exports. Long work streams (runs.py) and can be followed again."""

import asyncio
import io
import re
import zipfile
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app import db, runs
from app.access import Actor, CurrentActor, check_estimate, find_project, need_edit
from app.config import env
from app.features.estimate import boq as boqs
from app.features.estimate import cost, exports
from app.features.estimate import run as runner
from app.features.estimate.editing import Edit, apply, mutable, restore
from app.features.programme import service as programmes
from app.features.projects import revision_name
from app.features.ratecards import card_of

router = APIRouter()
DOCUMENT_LIMIT = 50 * 1024 * 1024
UNDO_STEPS = 50


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


@router.get('/projects/{project_id}/estimate')
def estimate(project_id: UUID, actor: CurrentActor):
    with db.in_org(actor.org_id) as connection:
        find_project(connection, actor, project_id)
        return as_seen(actor, latest(connection, project_id))


@router.get('/projects/{project_id}/estimates')
def revisions(project_id: UUID, actor: CurrentActor):
    with db.in_org(actor.org_id) as connection:
        find_project(connection, actor, project_id)
        rows = connection.execute('select id, revision, status, updated_at from estimates where project_id = %s order by revision', [project_id]).fetchall()
    return [{**row, 'name': revision_name(row['revision'])} for row in rows]


# ── Project information, before the run ──────────────────────────────────────────────────────────────────────────
class Info(BaseModel):
    text: str = Field('', max_length=200_000)


def editable(connection, actor: Actor, estimate_id) -> tuple[dict, dict]:
    estimate, project = check_estimate(connection, actor, estimate_id, 'edit_estimate')
    need_edit(actor, project)
    return estimate, project


@router.patch('/estimates/{estimate_id}/info')
def set_info(estimate_id: UUID, body: Info, actor: CurrentActor):
    with db.in_org(actor.org_id) as connection:
        estimate, _ = editable(connection, actor, estimate_id)
        info = {**(estimate['info'] or {}), 'text': body.text}
        connection.execute('update estimates set info = %s where id = %s', [db.Jsonb(info), estimate_id])
    return {'ok': True}


def text_of(name: str, data: bytes) -> str:
    if name.lower().endswith('.pdf'):
        import pdfplumber

        with pdfplumber.open(io.BytesIO(data)) as pdf:
            return '\n'.join(page.extract_text() or '' for page in pdf.pages)
    if name.lower().endswith('.docx'):
        xml = zipfile.ZipFile(io.BytesIO(data)).read('word/document.xml').decode()
        return re.sub(r'<[^>]+>', ' ', xml.replace('</w:p>', '\n'))
    return data.decode('utf-8', 'replace')


@router.post('/estimates/{estimate_id}/documents')
async def add_documents(estimate_id: UUID, actor: CurrentActor, files: list[UploadFile] = File(...)):
    if len(files) > 10:
        raise HTTPException(422, 'Up to 10 documents')
    texts = []
    for file in files:
        data = await file.read()
        if len(data) > DOCUMENT_LIMIT:
            raise HTTPException(413, f'{file.filename} is over 50 MB')
        try:
            texts.append(f'── {file.filename} ──\n{text_of(file.filename or "", data)}')
        except Exception:
            raise HTTPException(422, f'{file.filename} could not be read: Word (.docx), text or PDF')
    with db.in_org(actor.org_id) as connection:
        estimate, _ = editable(connection, actor, estimate_id)
        info = estimate['info'] or {}
        info = {**info, 'text': '\n\n'.join(filter(None, [info.get('text', ''), *texts])), 'documents': [*info.get('documents', []), *[f.filename for f in files]]}
        connection.execute('update estimates set info = %s where id = %s', [db.Jsonb(info), estimate_id])
    return {'documents': info['documents']}


# ── Long work ────────────────────────────────────────────────────────────────────────────────────────────────────
def mark_failed(org_id, estimate_id, status: str):
    with db.in_org(org_id) as connection:
        connection.execute('update estimates set status = %s where id = %s', [status, estimate_id])


def start_run(org_id, estimate_id) -> runs.Run:
    async def work():
        try:
            async for event in runner.run(estimate_id, org_id):
                yield event
        except BaseException:
            await asyncio.to_thread(mark_failed, org_id, estimate_id, 'failed')
            raise

    return runs.start(f'run:{estimate_id}', work())


@router.post('/estimates/{estimate_id}/run')
async def run(estimate_id: UUID, actor: CurrentActor):
    def check():
        with db.in_org(actor.org_id) as connection:
            editable(connection, actor, estimate_id)

    await asyncio.to_thread(check)
    return runs.stream(start_run(actor.org_id, estimate_id))


@router.get('/estimates/{estimate_id}/follow/{kind}')
async def follow(estimate_id: UUID, kind: Literal['run', 'boq', 'link', 'programme'], actor: CurrentActor):
    """A page that comes back replays the work from its start and follows it live."""
    def check():
        with db.in_org(actor.org_id) as connection:
            check_estimate(connection, actor, estimate_id, 'see_programme')

    await asyncio.to_thread(check)
    found = runs.find(f'{kind}:{estimate_id}')
    if found is None:
        raise HTTPException(404, 'Nothing running')
    return runs.stream(found)


@router.post('/estimates/{estimate_id}/stop/{kind}', status_code=204)
async def stop(estimate_id: UUID, kind: Literal['run', 'boq', 'link', 'programme'], actor: CurrentActor):
    def check():
        with db.in_org(actor.org_id) as connection:
            editable(connection, actor, estimate_id)

    await asyncio.to_thread(check)
    runs.stop(f'{kind}:{estimate_id}')


@router.post('/projects/{project_id}/revisions')
async def new_revision(project_id: UUID, actor: CurrentActor):
    """Update estimate: a new revision measures the current models again and carries over the QS's work."""
    def make():
        with db.in_org(actor.org_id) as connection:
            project = find_project(connection, actor, project_id, 'edit_estimate')
            need_edit(actor, project)
            before = latest(connection, project_id)
            if before['status'] != 'ready':
                raise HTTPException(409, 'Run the takeoff first')
            return connection.execute(
                'insert into estimates (org_id, project_id, revision, info, programme) values (%s, %s, %s, %s, %s) returning id',
                [actor.org_id, project_id, before['revision'] + 1, db.Jsonb(before['info']), before['programme'] and db.Jsonb(before['programme'])],
            ).fetchone()['id']

    estimate_id = await asyncio.to_thread(make)
    return runs.stream(start_run(actor.org_id, estimate_id))


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


async def generate(org_id, estimate_id):
    yield 'stage', {'name': 'Group', 'state': 'start'}
    found = await asyncio.to_thread(load_result, org_id, estimate_id)
    result = found['result']
    yield 'log', {'text': f'Grouping {len(result["takeoff_lines"])} takeoff lines into BOQ items, bill by bill'}
    grouped = await boqs.group(result['takeoff_lines'])
    kept = [line for line in result.get('boq') or [] if line.get('source') in ('qs', 'provisional')]
    rates = {line['description']: line for line in result.get('boq') or [] if line.get('rate') is not None}
    for line in grouped:  # a re-generated item keeps the rate it had
        if line['description'] in rates:
            before = rates[line['description']]
            line.update(rate=before['rate'], rate_item_id=before.get('rate_item_id'), rate_note=before.get('rate_note'))
    result['boq'] = boqs.ordered(grouped + kept)
    yield 'stage', {'name': 'Group', 'state': 'done', 'items': len(result['boq'])}
    programme = found['programme']
    if programme:
        programme = programmes.reprice(programme, result)
    await asyncio.to_thread(save_result, org_id, estimate_id, result, programme, False)
    yield 'result', {'items': len(result['boq'])}


async def link(org_id, estimate_id):
    yield 'stage', {'name': 'Link', 'state': 'start'}

    def card():
        with db.in_org(org_id) as connection:
            return card_of(connection)

    found = await asyncio.to_thread(load_result, org_id, estimate_id)
    result = found['result']
    if not result.get('boq'):
        raise ValueError('Generate the BOQ first')
    rate_card = await asyncio.to_thread(card)
    yield 'stage', {'name': 'Card', 'state': 'done', 'items': len(rate_card['rows'])}
    todo = [line for line in result['boq'] if line.get('rate_note') != 'typed']
    done = [0]
    task = asyncio.create_task(cost.link(result['boq'], rate_card, lambda n: done.__setitem__(0, done[0] + n)))
    told = -1
    while not task.done():  # the count of lines answered, as the batches come back
        if done[0] != told:
            told = done[0]
            yield 'stage', {'name': 'Pick', 'state': 'start', 'done': told, 'of': len(todo)}
        await asyncio.wait([task], timeout=0.7)
    result['boq'], sources = task.result()
    yield 'stage', {'name': 'Pick', 'state': 'done', 'done': len(todo), 'of': len(todo)}
    result['pricing'] = {**result['pricing'], 'rate_card': {'id': str(rate_card['id']), 'title': rate_card['name']}, 'sources': sources}
    priced = sum(line['rate'] is not None for line in result['boq'])
    yield 'stage', {'name': 'Link', 'state': 'done', 'priced': priced, 'of': len(result['boq'])}
    programme = found['programme'] and programmes.reprice(found['programme'], result)
    await asyncio.to_thread(save_result, org_id, estimate_id, result, programme)
    yield 'result', {'priced': priced, 'of': len(result['boq'])}


async def long_work(estimate_id, actor, kind: str, work) -> runs.Run:
    def check():
        with db.in_org(actor.org_id) as connection:
            editable(connection, actor, estimate_id)

    await asyncio.to_thread(check)
    return runs.start(f'{kind}:{estimate_id}', work(actor.org_id, estimate_id))


@router.post('/estimates/{estimate_id}/boq')
async def generate_boq(estimate_id: UUID, actor: CurrentActor):
    return runs.stream(await long_work(estimate_id, actor, 'boq', generate))


@router.post('/estimates/{estimate_id}/link')
async def link_to_cost(estimate_id: UUID, actor: CurrentActor):
    return runs.stream(await long_work(estimate_id, actor, 'link', link))


@router.post('/estimates/{estimate_id}/programme')
async def programme(estimate_id: UUID, actor: CurrentActor, file: UploadFile = File(...)):
    data = await file.read()
    if len(data) > DOCUMENT_LIMIT:
        raise HTTPException(413, 'The programme is over 50 MB')
    if not data.startswith(b'%PDF'):
        raise HTTPException(422, 'The programme must be a PDF with text')

    def store():
        with db.in_org(actor.org_id) as connection:
            estimate, _ = editable(connection, actor, estimate_id)
            path = env.FILES / str(actor.org_id) / str(estimate['project_id']) / 'programme.pdf'
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
            return path

    path = await asyncio.to_thread(store)

    async def work(org_id, estimate_id):
        yield 'stage', {'name': 'Read', 'state': 'start'}
        found = await asyncio.to_thread(load_result, org_id, estimate_id)
        if not found['result'].get('boq'):
            raise ValueError('Generate the BOQ first: the programme waits for it')
        yield 'stage', {'name': 'Read', 'state': 'done'}
        yield 'stage', {'name': 'Link', 'state': 'start'}
        built = await programmes.build(path, found['result'])
        yield 'stage', {'name': 'Link', 'state': 'done', 'activities': sum(not a['summary'] for a in built['activities'])}
        await asyncio.to_thread(save_result, org_id, estimate_id, found['result'], built)
        yield 'result', {'activities': len(built['activities']), 'days': built['end']}

    return runs.stream(runs.start(f'programme:{estimate_id}', work(actor.org_id, estimate_id)))


# ── The QS's edits: each one step of undo and redo; the run is the floor ─────────────────────────────────────────

@router.post('/estimates/{estimate_id}/edit')
def edit(estimate_id: UUID, body: Edit, actor: CurrentActor):
    with db.in_org(actor.org_id) as connection:
        estimate, _ = editable(connection, actor, estimate_id)
        result = estimate['result']
        if not result:
            raise HTTPException(409, 'Run the takeoff first')
        history = estimate['history'] if isinstance(estimate['history'], dict) else {}
        before = mutable(result)
        apply(result, body)
        history = {'undo': [*history.get('undo', []), before][-UNDO_STEPS:], 'redo': []}
        programme = estimate['programme'] and programmes.reprice(estimate['programme'], result)
        connection.execute('update estimates set result = %s, history = %s, programme = %s, updated_at = now() where id = %s',
                           [db.Jsonb(result), db.Jsonb(history), programme and db.Jsonb(programme), estimate_id])
        return as_seen(actor, {**estimate, 'result': result, 'history': history, 'programme': programme})


@router.post('/estimates/{estimate_id}/history/{way}')
def undo(estimate_id: UUID, way: Literal['undo', 'redo'], actor: CurrentActor):
    with db.in_org(actor.org_id) as connection:
        estimate, _ = editable(connection, actor, estimate_id)
        history = estimate['history'] if isinstance(estimate['history'], dict) else {}
        steps = history.get(way, [])
        if not steps:
            raise HTTPException(409, f'Nothing to {way}')
        result = estimate['result']
        now = mutable(result)
        restore(result, steps[-1])
        other = 'redo' if way == 'undo' else 'undo'
        history = {way: steps[:-1], other: [*history.get(other, []), now]}
        programme = estimate['programme'] and programmes.reprice(estimate['programme'], result)
        connection.execute('update estimates set result = %s, history = %s, programme = %s, updated_at = now() where id = %s',
                           [db.Jsonb(result), db.Jsonb(history), programme and db.Jsonb(programme), estimate_id])
        return as_seen(actor, {**estimate, 'result': result, 'history': history, 'programme': programme})


# ── Exports ──────────────────────────────────────────────────────────────────────────────────────────────────────
@router.get('/estimates/{estimate_id}/export/{what}')
def export(estimate_id: UUID, what: Literal['boq.xlsx', 'boq.pdf', 'cashflow.xlsx'], actor: CurrentActor):
    with db.in_org(actor.org_id) as connection:
        estimate, project = check_estimate(connection, actor, estimate_id, 'see_estimate')
        project = {**project, 'firm': connection.execute('select name from orgs where id = %s', [actor.org_id]).fetchone()['name']}
    result = estimate['result']
    if not result or (what != 'cashflow.xlsx' and not result.get('boq')):
        raise HTTPException(409, 'Generate the BOQ first')
    name = re.sub(r'[^A-Za-z0-9]+', '_', project['name']).strip('_')
    if what == 'boq.xlsx':
        data, kind, file = exports.boq_excel(project, result), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', f'{name}_BOQ.xlsx'
    elif what == 'boq.pdf':
        data, kind, file = exports.boq_pdf(project, result), 'application/pdf', f'{name}_BOQ.pdf'
    else:
        if not estimate['programme']:
            raise HTTPException(409, 'Upload the programme first')
        data, kind, file = exports.cash_flow_excel(project, estimate['programme']), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', f'{name}_Cash_Flow.xlsx'
    return Response(data, media_type=kind, headers={'Content-Disposition': f'attachment; filename="{file}"'})
