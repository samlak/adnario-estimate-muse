"""Rate cards (README §6, §10): every firm starts from Adnario Market Rates, copied from overview/rate-card. Rows are
prices (material, labour, plant) or work items with a build-up; a rate is Σ(quantity × price) plus the additions, to
the naira, and stays blank when a price is missing. Change a price and every rate built on it changes."""

import json
from datetime import date
from typing import Literal
from uuid import UUID

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app import db
from app.access import CurrentActor, NotFound
from app.config import env

router = APIRouter()
LIBRARY = 'Adnario Market Rates'
PRICES_OF = date(2026, 11, 2)


def copy_library(connection, org_id) -> UUID:
    prices = json.loads((env.RATE_CARD / 'prices.json').read_text())
    rates = json.loads((env.RATE_CARD / 'rates.json').read_text())
    card = connection.execute(
        'insert into rate_cards (org_id, name, prices_of) values (%s, %s, %s) returning id', [org_id, LIBRARY, PRICES_OF]
    ).fetchone()['id']
    with connection.cursor() as cursor:
        cursor.executemany(
            'insert into rate_rows (org_id, card_id, position, kind, name, unit, price, as_of, note) values (%s, %s, %s, %s, %s, %s, %s, %s, %s)',
            [[org_id, card, at, p['kind'], p['name'], p['unit'], p['price'], p.get('as_of'), p.get('note') or ''] for at, p in enumerate(prices)],
        )
        cursor.executemany(
            "insert into rate_rows (org_id, card_id, position, kind, code, section, name, unit, lines, additions) values (%s, %s, %s, 'RATE', %s, %s, %s, %s, %s, %s)",
            [[org_id, card, at, r['code'], r['section'], r['description'], r['unit'], db.Jsonb(r['lines']), db.Jsonb(r['additions'])] for at, r in enumerate(rates)],
        )
    return card


def top_up(connection) -> int:
    """Library work items added since a firm's card was copied (by code), appended to every Adnario Market Rates card."""
    rates = json.loads((env.RATE_CARD / 'rates.json').read_text())
    added = 0
    for card in connection.execute('select id, org_id from rate_cards where name = %s', [LIBRARY]).fetchall():
        have = {row['code'] for row in connection.execute("select code from rate_rows where card_id = %s and kind = 'RATE'", [card['id']])}
        last = connection.execute('select coalesce(max(position), 0) as at from rate_rows where card_id = %s', [card['id']]).fetchone()['at']
        new = [r for r in rates if r['code'] not in have]
        for at, r in enumerate(new, last + 1):
            connection.execute(
                "insert into rate_rows (org_id, card_id, position, kind, code, section, name, unit, lines, additions) values (%s, %s, %s, 'RATE', %s, %s, %s, %s, %s, %s)",
                [card['org_id'], card['id'], at, r['code'], r['section'], r['description'], r['unit'], db.Jsonb(r['lines']), db.Jsonb(r['additions'])],
            )
        added += len(new)
    return added


def rate_of(item: dict, prices: dict[str, float], items: dict[str, dict] | None = None, seen: tuple = ()) -> float | None:
    """A work item's rate from its build-up; a typed rate when it has no build-up; blank when a price is missing.
    A WORK line is a quantity of another item (by code) at that item's rate, which already has its own additions."""
    if not item.get('lines'):
        return None if item.get('price') is None else float(item['price'])
    sums = {'MATERIAL': 0.0, 'LABOUR': 0.0, 'PLANT': 0.0}
    work = 0.0
    for line in item['lines']:
        if line['kind'] == 'WORK':
            other = (items or {}).get(line.get('rate') or '')
            sub = None if other is None or other.get('code') in seen else rate_of(other, prices, items, (*seen, item.get('code')))
            if sub is None:
                return None
            work += float(line['qty']) * sub
            continue
        price = prices.get(line['price']) if line.get('price') else line.get('own_price')
        if price is None:
            return None  # nothing is guessed
        sums[line['kind']] += float(line['qty']) * float(price)
    additions = item.get('additions') or {}
    total = sums['MATERIAL'] * (1 + additions.get('material', 0) / 100) + sums['LABOUR'] * (1 + additions.get('labour', 0) / 100) + sums['PLANT']
    return float(round(total * (1 + additions.get('risk', 0) / 100) + work))


def output_of(item: dict, units: dict[str, str]) -> dict | None:
    """Labour lines in days give an item its output per gang-day: 0.125 gang-days a m³ is 8 m³/day."""
    for line in item.get('lines') or []:
        if line['kind'] == 'LABOUR' and line.get('price') and line.get('qty') and units.get(line['price']) in ('day', 'gang-day'):
            return {'per_day': round(1 / float(line['qty']), 2), 'gang': f'1 {line["price"].lower()}'}
    return None


def card_of(connection, card_id=None) -> dict:
    """The firm's card (its first, if none is named) with every row, and each work item's rate worked out."""
    card = connection.execute(
        'select * from rate_cards where (%s::uuid is null or id = %s) order by created_at limit 1', [card_id, card_id]
    ).fetchone()
    if card is None:
        raise NotFound('No rate card')
    rows = connection.execute('select * from rate_rows where card_id = %s order by kind = %s desc, position', [card['id'], 'RATE']).fetchall()
    prices = {row['name']: float(row['price']) for row in rows if row['kind'] != 'RATE' and row['price'] is not None}
    units = {row['name']: row['unit'] for row in rows if row['kind'] != 'RATE'}
    items = {row['code']: row for row in rows if row['kind'] == 'RATE' and row.get('code')}
    for row in rows:
        row['price'] = None if row['price'] is None else float(row['price'])
        if row['kind'] == 'RATE':
            row['rate'] = rate_of(row, prices, items)
            row['output'] = output_of(row, units)
            row['build_up'] = [
                {**line, 'unit': line.get('unit') or units.get(line.get('price', ''), '') or (items.get(line.get('rate') or '') or {}).get('unit', ''),
                 'unit_price': prices.get(line['price']) if line.get('price') else rate_of(items[line['rate']], prices, items) if line.get('rate') in items else line.get('own_price')}
                for line in row['lines'] or []
            ]
    return {**card, 'rows': rows}


@router.get('/ratecards')
def ratecard(actor: CurrentActor):
    actor.need('see_rates')
    with db.in_org(actor.org_id) as connection:
        return card_of(connection)


class Rename(BaseModel):
    name: str = Field(min_length=1, max_length=160)


@router.patch('/ratecards/{card_id}')
def rename(card_id: UUID, body: Rename, actor: CurrentActor):
    actor.need('edit_rates')
    with db.in_org(actor.org_id) as connection:
        connection.execute('update rate_cards set name = %s where id = %s', [body.name.strip(), card_id])
    return {'ok': True}


class Row(BaseModel):
    kind: Literal['MATERIAL', 'LABOUR', 'PLANT', 'RATE']
    name: str = Field(min_length=1, max_length=400)
    unit: str = ''
    price: float | None = Field(None, ge=0)
    code: str | None = None
    section: str | None = None
    lines: list[dict] | None = None
    additions: dict | None = None


class RowChange(BaseModel):
    name: str | None = None
    unit: str | None = None
    price: float | None = Field(None, ge=0)
    lines: list[dict] | None = None
    additions: dict | None = None


@router.post('/ratecards/{card_id}/rows')
def add_row(card_id: UUID, body: Row, actor: CurrentActor):
    actor.need('edit_rates')
    with db.in_org(actor.org_id) as connection:
        return connection.execute(
            'insert into rate_rows (org_id, card_id, position, kind, code, section, name, unit, price, lines, additions, as_of)'
            ' values (%s, %s, (select coalesce(max(position), 0) + 1 from rate_rows where card_id = %s), %s, %s, %s, %s, %s, %s, %s, %s, current_date) returning id',
            [actor.org_id, card_id, card_id, body.kind, body.code, body.section, body.name, body.unit, body.price,
             body.lines and db.Jsonb(body.lines), body.additions and db.Jsonb(body.additions)],
        ).fetchone()


@router.patch('/raterows/{row_id}')
def change_row(row_id: UUID, body: RowChange, actor: CurrentActor):
    actor.need('edit_rates')
    changes = body.model_dump(exclude_unset=True)
    if not changes:
        return {'ok': True}
    sets = ', '.join(f'{key} = %s' for key in changes)
    values = [db.Jsonb(value) if key in ('lines', 'additions') and value is not None else value for key, value in changes.items()]
    with db.in_org(actor.org_id) as connection:
        if not connection.execute(f'update rate_rows set {sets}, as_of = current_date where id = %s returning id', [*values, row_id]).fetchone():
            raise NotFound()
    return {'ok': True}


@router.delete('/raterows/{row_id}')
def delete_row(row_id: UUID, actor: CurrentActor):
    """BOQs already priced keep their rates: a rate is copied into the BOQ when it is linked."""
    actor.need('edit_rates')
    with db.in_org(actor.org_id) as connection:
        connection.execute('delete from rate_rows where id = %s', [row_id])
    return {'ok': True}
