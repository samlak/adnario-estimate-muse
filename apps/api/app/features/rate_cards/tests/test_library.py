"""Adnario Market Rates: copied whole into a new firm's card, and topped up with items added to the library since."""

import json

from app.core.config import env
from app.features.rate_cards.library import copy_library, top_up

PRICES = json.loads((env.RATE_CARD / 'prices.json').read_text())
RATES = json.loads((env.RATE_CARD / 'rates.json').read_text())


def test_a_new_firm_gets_every_price_and_item(connection):
    connection.on('insert into rate_cards', {'id': 'c1'})
    assert copy_library(connection, 'o1') == 'c1'
    prices, rates = [rows for sql, rows in connection.calls if 'executemany' not in sql and isinstance(rows, list) and rows and isinstance(rows[0], list)]
    assert len(prices) == len(PRICES) and len(rates) == len(RATES)


def test_only_new_library_items_are_added(connection):
    have = [{'code': rate['code']} for rate in RATES[:-2]]
    connection.on('from rate_cards where name', [{'id': 'c1', 'org_id': 'o1'}]).on("select code from rate_rows", have).on('max(position)', {'at': 500})
    assert top_up(connection) == 2
    assert [params[3] for params in connection.ran('insert into rate_rows')] == [rate['code'] for rate in RATES[-2:]]


def test_an_item_the_firm_deleted_is_not_added_back(connection):
    have = [{'code': rate['code']} for rate in RATES[:-2]]
    connection.on('from rate_cards where name', [{'id': 'c1', 'org_id': 'o1', 'removed': [RATES[-1]['code']]}]).on('select code from rate_rows', have).on('max(position)', {'at': 500})
    assert top_up(connection) == 1
