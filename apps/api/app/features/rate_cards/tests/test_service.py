"""The rate card: each work item's rate worked out from the card's own prices, and rows changed or refused."""

import pytest

from app.core.errors import NotFound
from app.features.rate_cards import service
from app.features.rate_cards.schemas import RowChange

ROWS = [
    {'id': 'r1', 'kind': 'MATERIAL', 'name': 'Block', 'unit': 'nr', 'price': 900, 'code': None, 'lines': None},
    {'id': 'r2', 'kind': 'LABOUR', 'name': 'Mason', 'unit': 'day', 'price': 18000, 'code': None, 'lines': None},
    {'id': 'r3', 'kind': 'RATE', 'name': 'Blockwork', 'unit': 'm²', 'price': None, 'code': 'W1', 'additions': {},
     'lines': [{'kind': 'MATERIAL', 'price': 'Block', 'qty': 10}, {'kind': 'LABOUR', 'price': 'Mason', 'qty': 0.1}]},
]


def test_the_card_works_out_every_rate(connection):
    connection.on('from rate_cards', {'id': 'c1', 'name': 'Adnario Market Rates'}).on('from rate_rows', [dict(row) for row in ROWS])
    card = service.card_of(connection)
    item = next(row for row in card['rows'] if row['kind'] == 'RATE')
    assert item['rate'] == 10 * 900 + 0.1 * 18000
    assert item['output'] == {'per_day': 10.0, 'gang': '1 mason'}
    assert [(line['unit'], line['unit_price']) for line in item['build_up']] == [('nr', 900), ('day', 18000)]


def test_no_card_is_not_found(connection):
    with pytest.raises(NotFound):
        service.card_of(connection)


def test_a_change_with_nothing_in_it_writes_nothing(connection):
    service.change_row(connection, 'r1', RowChange())
    assert connection.calls == []


def test_a_change_to_an_unknown_row_is_not_found(connection):
    with pytest.raises(NotFound):
        service.change_row(connection, 'r1', RowChange(price=950))
    connection.on('update rate_rows', {'id': 'r1'})
    service.change_row(connection, 'r1', RowChange(price=950))
    assert 'price = %s' in connection.calls[-1][0]
