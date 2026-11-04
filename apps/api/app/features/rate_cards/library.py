"""Adnario Market Rates: copied into a new firm's card, and topped up with library items added since."""

import json
from uuid import UUID

from app.core.config import env
from app.database import connection as db
from app.features.rate_cards.constants import LIBRARY, PRICES_OF


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
