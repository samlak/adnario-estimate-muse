"""The programme: the contractor's programme of works is read from its PDF by code, put on the Nigerian
working calendar, and checked with the critical path method (float and the critical path from its own links). The AI
says which activity does each piece of the BOQ's work (an item on a storey); code checks every answer, then works out
each activity's cost and the cash flow by month."""

import asyncio
import copy

from fastapi import HTTPException

from app.core.errors import NotFound
from app.database import connection as db
from app.features.estimate.boq import totals
from app.features.programme.cash_flow import cash_flow
from app.features.programme.schedule import schedule, timed, waits_on
from app.features.programme.schemas import ActivityEdit
from app.features.programme.uploaded import read_pdf
from app.features.programme.work import assign


async def build(path, result: dict) -> dict:
    title, rows = await asyncio.to_thread(read_pdf, path)
    programme = schedule(rows)
    programme['title'] = title
    programme = await assign(programme, result)
    summary = totals(result['boq'], result['pricing'])
    programme['cash_flow'] = cash_flow(programme, result['pricing'], summary['prelims'])
    return programme


def reprice(programme: dict, result: dict) -> dict:
    """After the QS changes rates: the same links, new costs and cash flow."""
    lines = {line['code']: line for line in result['boq']}
    for activity in programme['activities']:
        activity['cost'] = sum(work['qty'] * (lines.get(work['code'], {}).get('rate') or 0) for work in activity.get('work') or [])
    programme['unpriced'] = sorted({w['code'] for a in programme['activities'] for w in a.get('work') or [] if lines.get(w['code'], {}).get('rate') is None})
    programme['cash_flow'] = cash_flow(programme, result['pricing'], totals(result['boq'], result['pricing'])['prelims'])
    return programme


def edited(programme: dict, result: dict, change: ActivityEdit) -> dict:
    """The programme after one change to one activity, scheduled again from its links, its cash flow worked out again."""
    programme = copy.deepcopy(programme)
    activity = next((a for a in programme['activities'] if a['id'] == change.id and not a['summary']), None)
    if activity is None:
        raise NotFound('No such activity')
    if change.name:
        activity['name'] = change.name.strip()
    if change.days is not None:
        activity.setdefault('programmed', activity['finish'] - activity['start'])  # as the programme had it
        activity['finish'] = activity['start'] + change.days
        activity['milestone'] = change.days == 0
    if change.remove_link is not None:
        programme['links'] = [link for link in programme['links'] if not (link['after'] == change.id and link['before'] == change.remove_link)]
    if change.add_link:
        before = change.add_link.before
        if not any(a['id'] == before and not a['summary'] for a in programme['activities']) or before == change.id:
            raise HTTPException(422, 'It can only wait for another activity')
        if any(link['after'] == change.id and link['before'] == before for link in programme['links']):
            raise HTTPException(422, 'It already waits for that activity')
        if waits_on(programme, change.id, before):
            raise HTTPException(422, 'That activity already waits for this one: the link would go round in a loop')
        programme['links'].append({'before': before, 'after': change.id, 'kind': change.add_link.kind, 'lag': change.add_link.lag})
    return reprice(timed(programme), result)


def edit(connection, actor, estimate_id, change: ActivityEdit) -> dict | None:
    from app.features.estimate.service import editable  # the estimate's access rules

    estimate, _ = editable(connection, actor, estimate_id)
    if not estimate['programme'] or not estimate['result']:
        raise NotFound('No programme')
    programme = edited(estimate['programme'], estimate['result'], change)
    connection.execute('update estimates set programme = %s, updated_at = now() where id = %s', [db.Jsonb(programme), estimate_id])
    return shown(actor, programme)


def shown(actor, programme: dict | None) -> dict | None:
    """The programme as this person may see it: no money for who may not see the estimate."""
    if programme is None or actor.can('see_estimate'):
        return programme
    hidden = {**programme, 'cash_flow': [], 'unpriced': []}
    hidden['activities'] = [{**a, 'cost': None, 'work': [{**w, 'qty': None} for w in a.get('work') or []]} for a in programme['activities']]
    return hidden
