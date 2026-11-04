"""The programme (README §8): the contractor's programme of works is read from its PDF by code, put on the Nigerian
working calendar, and checked with the critical path method (float and the critical path from its own links). The AI
says which activity does each piece of the BOQ's work (an item on a storey); code checks every answer, then works out
each activity's cost and the cash flow by month."""

import asyncio

from app.features.estimate.boq import totals
from app.features.programme.cash_flow import cash_flow
from app.features.programme.schedule import schedule
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


def shown(actor, programme: dict | None) -> dict | None:
    """The programme as this person may see it: no money for who may not see the estimate."""
    if programme is None or actor.can('see_estimate'):
        return programme
    hidden = {**programme, 'cash_flow': [], 'unpriced': []}
    hidden['activities'] = [{**a, 'cost': None, 'work': [{**w, 'qty': None} for w in a.get('work') or []]} for a in programme['activities']]
    return hidden
