"""Link to cost (README §7.4): the AI picks, for each BOQ item, the rate card item that is the same work; code checks
the unit and copies the rate in. A rate the QS typed is never touched; nothing is guessed (no match, no rate)."""

import asyncio
import re

from app.features.estimate import ai
from app.features.estimate.constants import COUNTED, LINK_BATCH, PARALLEL


def same_unit(a: str, b: str) -> bool:
    plain = lambda unit: {'m2': 'm²', 'm3': 'm³', 'no': 'nr', 'tonne': 't'}.get((unit or '').lower(), (unit or '').lower())
    a, b = plain(a), plain(b)
    return a == b or (a in COUNTED and b in COUNTED)


def size(text: str) -> tuple[float, float | None] | None:
    """Width and height in metres from '819 x 759mm', or the width alone from '1000mm wide'."""
    if found := re.search(r'(\d{3,5})\s*[x×]\s*(\d{3,5})\s*mm', text or ''):
        return int(found[1]) / 1000, int(found[2]) / 1000
    if found := re.search(r'(\d{3,5})\s*mm\s+wide', text or ''):
        return int(found[1]) / 1000, None
    return None


def scale(line: dict, item: dict) -> float | None:
    """How many of the item's units one counted, sized line is: its area (per m² item), its width (per m item), or its
    area over the item's own size (sized counted item). 1 when the units already agree; None when it can't be said."""
    plain = lambda unit: {'m2': 'm²', 'no': 'nr'}.get((unit or '').lower(), (unit or '').lower())
    if same_unit(line['unit'], item['unit']):
        mine, theirs = size(line['description']), size(item['name'])
        if plain(line['unit']) in COUNTED and mine and theirs and mine[1] and theirs[1]:
            return round(mine[0] * mine[1] / (theirs[0] * theirs[1]), 4)
        return 1
    mine = size(line['description']) if plain(line['unit']) in COUNTED else None
    if not mine:
        return None
    if plain(item['unit']) == 'm²' and mine[1]:
        return round(mine[0] * mine[1], 4)
    if plain(item['unit']) == 'm':
        return mine[0]
    return None


def check_link(line: dict, item: dict | None) -> str | None:
    if item is None:
        return 'no rate card item is the same work'
    if scale(line, item) is None:
        return f'{item["code"]} is priced per {item["unit"]}, the item is measured in {line["unit"]}'
    if item.get('rate') is None:
        return f'{item["code"]} has a price missing in its build-up'
    return None


async def link(boq: list[dict], card: dict, progress=None) -> tuple[list[dict], dict]:
    """The BOQ with rates from the card, and where each came from. progress(n) is told as each batch of n lines is answered."""
    items = {row['code']: row for row in card['rows'] if row['kind'] == 'RATE' and row.get('code')}
    shown_items = [{'code': row['code'], 'section': row['section'], 'description': row['name'], 'unit': row['unit']} for row in items.values()]
    todo = [line for line in boq if line.get('rate_note') != 'typed']
    # formwork, beds and bars know their card item already (DERIVED_RATE): no AI for them
    fixed = {line['code']: {'line': line['code'], 'item': line['rate_code'], 'why': 'Derived by code: priced from its standard item.'}
             for line in todo if line.get('rate_code') in items}
    asked = [line for line in todo if line['code'] not in fixed]

    async def one(batch):
        shown = [{'line': line['code'], 'section': line['section'], 'description': line['description'], 'unit': line['unit']} for line in batch]
        try:
            answer = await ai.link(shown_items, shown)
            return {each.get('line'): each for each in answer.get('links') or []}
        except Exception:
            return {}

    gate = asyncio.Semaphore(PARALLEL)

    async def guarded(batch):
        async with gate:
            return await one(batch)

    said = dict(fixed)
    for task in asyncio.as_completed([guarded(asked[at : at + LINK_BATCH]) for at in range(0, len(asked), LINK_BATCH)]):
        found = await task
        said.update(found)
        if progress:
            progress(len(found))
    sources = {}
    for line in todo:
        answer = said.get(line['code']) or {}
        item = items.get(answer.get('item') or '')
        problem = check_link(line, item)
        if problem:
            line.update(rate=None, rate_item_id=None, rate_note=problem)
            continue
        by = scale(line, item)
        why = answer.get('why') or ''
        if by != 1:
            why = f'{why} Scaled ×{by:g} from {item["code"]} ({item["unit"]}) by size.'.strip()
        line.update(rate=round(item['rate'] * by, 2), rate_item_id=str(item['id']), rate_note=why)
        sources[str(item['id'])] = {'card': card['name'], 'code': item['code'], 'description': item['name']}
    return boq, sources
