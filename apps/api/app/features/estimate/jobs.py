"""The estimate's long work, each a stream of events run as a server task (core/runs.py): the run, Generate BOQ and
Link to cost."""

import asyncio

from app.core import runs
from app.database import connection as db
from app.features.estimate import boq as boqs
from app.features.estimate import cost
from app.features.estimate import run as runner
from app.features.estimate.service import editable, load_result, mark_failed, save_result
from app.features.programme import service as programmes
from app.features.rate_cards.service import card_of


def start_run(org_id, estimate_id) -> runs.Run:
    async def work():
        try:
            async for event in runner.run(estimate_id, org_id):
                yield event
        except BaseException:
            await asyncio.to_thread(mark_failed, org_id, estimate_id, 'failed')
            raise

    return runs.start(f'run:{estimate_id}', work())


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
