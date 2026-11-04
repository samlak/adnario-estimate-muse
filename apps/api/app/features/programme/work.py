"""The BOQ's work put in the programme: each item split by storey, the AI says which activity does each piece, code
checks every answer and works out each activity's quantities and cost."""

import asyncio
from collections import defaultdict

from app.features.programme import ai
from app.features.programme.constants import PARALLEL, PIECES_PER_CALL


# ── The BOQ's work, put in the programme ─────────────────────────────────────────────────────────────────────────
def pieces_of(result: dict) -> list[dict]:
    """Each BOQ item split by storey: what the AI links to activities."""
    storey_of = {row['gid']: row['storey'] for row in result['takeoff']}
    out = []
    for line in result['boq']:
        counts: dict = defaultdict(int)
        for gid in line['gids']:
            counts[storey_of.get(gid) or 'whole building'] += 1
        total = sum(counts.values())
        for storey, count in (counts.items() if total else [('whole building', 1)]):
            out.append({'key': f'W{len(out) + 1:03d}', 'code': line['code'], 'section': line['section'], 'storey': storey, 'description': line['description'],
                        'unit': line['unit'], 'share': count / (total or 1), 'qty': (line['qty'] or 0) * count / (total or 1),
                        'gids': [gid for gid in line['gids'] if (storey_of.get(gid) or 'whole building') == storey]})
    return out


def check_answer(pieces: list[dict], answer: dict | None, tasks: dict) -> tuple[dict, list[str]]:
    found, wrong = {}, []
    for each in (answer or {}).get('pieces') or []:
        ids = [int(x) for x in each.get('activities') or [] if str(x).isdigit()]
        if any(x not in tasks for x in ids):
            wrong.append(each.get('key'))
            continue
        found[each.get('key')] = ids
    return found, wrong


async def assign(programme: dict, result: dict) -> dict:
    activities = programme['activities']
    named = {a['id']: a for a in activities}
    tasks = {a['id']: a for a in activities if not a['summary']}
    listed = [{'id': a['id'], 'name': a['name'], 'under': ' / '.join(named[p]['name'] for p in [a['parent'], named.get(a['parent'], {}).get('parent')] if p in named)}
              for a in tasks.values()]
    pieces = pieces_of(result)
    gate = asyncio.Semaphore(PARALLEL)

    async def one(batch, again=False):
        shown = [{key: piece[key] for key in ('key', 'section', 'storey', 'description')} for piece in batch]
        async with gate:
            try:
                answer = await ai.assign(listed, shown, again)
            except Exception:
                answer = None
        found, wrong = check_answer(batch, answer, tasks)
        if wrong and not again:  # one retry for the pieces it got wrong
            retry = await one([piece for piece in batch if piece['key'] in wrong], True)
            found.update(retry)
        return found

    said = {}
    for found in await asyncio.gather(*(one(pieces[at : at + PIECES_PER_CALL]) for at in range(0, len(pieces), PIECES_PER_CALL))):
        said.update(found)
    lines = {line['code']: line for line in result['boq']}
    missing = []
    for piece in pieces:
        ids = said.get(piece['key']) or []
        if not ids:
            missing.append(piece)
            continue
        rate = lines[piece['code']].get('rate')
        span = sum(tasks[x]['finish'] - tasks[x]['start'] or 1 for x in ids)
        for x in ids:
            weight = (tasks[x]['finish'] - tasks[x]['start'] or 1) / span
            task = tasks[x]
            task['work'].append({'code': piece['code'], 'description': piece['description'], 'qty': round(piece['qty'] * weight, 3), 'unit': piece['unit'], 'shared': len(ids) > 1})
            task['refs'] += piece['gids']
            task['cost'] += (piece['qty'] * weight * rate) if rate is not None else 0
    grouped: dict = defaultdict(int)
    for piece in missing:
        grouped[(piece['section'], piece['storey'], piece['description'])] += len(piece['gids']) or 1
    programme['not_in_programme'] = [{'section': s, 'storey': st, 'operation': op, 'count': c} for (s, st, op), c in grouped.items()]
    programme['unpriced'] = sorted({piece['code'] for piece in pieces if lines[piece['code']].get('rate') is None})
    return programme
