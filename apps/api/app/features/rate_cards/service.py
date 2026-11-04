from uuid import UUID

from app.core.access import Actor
from app.core.errors import NotFound
from app.database import connection as db
from app.database.connection import Connection
from app.features.rate_cards.buildup import output_of, rate_of
from app.features.rate_cards.constants import JSON_FIELDS
from app.features.rate_cards.schemas import Row, RowChange


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


def rename(connection: Connection, card_id: UUID, name: str) -> None:
    connection.execute('update rate_cards set name = %s where id = %s', [name.strip(), card_id])


def add_row(connection: Connection, actor: Actor, card_id: UUID, body: Row) -> dict:
    return connection.execute(
        'insert into rate_rows (org_id, card_id, position, kind, code, section, name, unit, price, lines, additions, as_of)'
        ' values (%s, %s, (select coalesce(max(position), 0) + 1 from rate_rows where card_id = %s), %s, %s, %s, %s, %s, %s, %s, %s, current_date) returning id',
        [actor.org_id, card_id, card_id, body.kind, body.code, body.section, body.name, body.unit, body.price,
         None if body.lines is None else db.Jsonb(body.lines), None if body.additions is None else db.Jsonb(body.additions)],
    ).fetchone()


def change_row(connection: Connection, row_id: UUID, body: RowChange) -> None:
    """A row changed in place; a renamed price, or a work item given a new code, is followed by every build-up on it."""
    changes = body.model_dump(exclude_unset=True)
    if not changes:
        return
    before = _row(connection, row_id)
    sets = ', '.join(f'{key} = %s' for key in changes)
    values = [db.Jsonb(value) if key in JSON_FIELDS and value is not None else value for key, value in changes.items()]
    connection.execute(f'update rate_rows set {sets}, as_of = current_date where id = %s', [*values, row_id])
    if before['kind'] != 'RATE' and changes.get('name') not in (None, before['name']):
        _follow(connection, before['card_id'], 'price', before['name'], changes['name'])
    if before['kind'] == 'RATE' and before['code'] and 'code' in changes and changes['code'] != before['code']:
        _follow(connection, before['card_id'], 'rate', before['code'], changes['code'])
        _removed(connection, before['card_id'], before['code'])


def delete_row(connection: Connection, row_id: UUID) -> None:
    """The row goes from the firm's card (the library is not touched, and a library item deleted is not added back);
    a rate built up from it is worked out again without it. BOQs already priced keep their rates: a rate is copied
    into the BOQ when it is linked."""
    before = _row(connection, row_id)
    connection.execute('delete from rate_rows where id = %s', [row_id])
    if before['kind'] == 'RATE':
        if before['code']:
            _follow(connection, before['card_id'], 'rate', before['code'], None)
            _removed(connection, before['card_id'], before['code'])
    else:
        _follow(connection, before['card_id'], 'price', before['name'], None)


def _row(connection: Connection, row_id: UUID) -> dict:
    row = connection.execute('select card_id, kind, code, name from rate_rows where id = %s', [row_id]).fetchone()
    if row is None:
        raise NotFound()
    return row


def _follow(connection: Connection, card_id, key: str, old: str, new: str | None) -> None:
    """Every build-up line on the card that names `old` (a price by name, or a work item by code) names `new`, or
    goes when it is None."""
    for row in connection.execute(
        "select id, lines from rate_rows where card_id = %s and kind = 'RATE' and lines @> %s", [card_id, db.Jsonb([{key: old}])]
    ).fetchall():
        lines = [line if line.get(key) != old else {**line, key: new} for line in row['lines'] if new is not None or line.get(key) != old]
        connection.execute('update rate_rows set lines = %s where id = %s', [db.Jsonb(lines), row['id']])


def _removed(connection: Connection, card_id, code: str) -> None:
    connection.execute('update rate_cards set removed = array_append(removed, %s) where id = %s and not %s = any(removed)', [code, card_id, code])
