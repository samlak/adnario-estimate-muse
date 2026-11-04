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
    connection.on('from rate_rows where id', {'card_id': 'c1', 'kind': 'MATERIAL', 'code': None, 'name': 'Block'})
    service.change_row(connection, 'r1', RowChange(price=950))
    assert connection.ran('update rate_rows set price')


def built_on(connection, row, lines):
    """A card with one row about to change, and one work item built up from these lines."""
    return (connection.on('from rate_rows where id', row)
            .on("kind = 'RATE' and lines @>", [{'id': 'w1', 'lines': lines}]))


LINES = [{'kind': 'MATERIAL', 'price': 'Block', 'qty': 10}, {'kind': 'WORK', 'rate': 'W2', 'qty': 1}]


def test_a_renamed_price_is_followed_by_every_build_up_on_it(connection):
    built_on(connection, {'card_id': 'c1', 'kind': 'MATERIAL', 'code': None, 'name': 'Block'}, LINES)
    service.change_row(connection, 'r1', RowChange(name='Sandcrete block'))
    (lines, _), = connection.ran('update rate_rows set lines')
    assert lines.obj == [{**LINES[0], 'price': 'Sandcrete block'}, LINES[1]]


def test_a_deleted_price_goes_from_the_build_ups(connection):
    built_on(connection, {'card_id': 'c1', 'kind': 'MATERIAL', 'code': None, 'name': 'Block'}, LINES)
    service.delete_row(connection, 'r1')
    assert connection.ran('delete from rate_rows') == [['r1']]
    (lines, _), = connection.ran('update rate_rows set lines')
    assert lines.obj == [LINES[1]]


def test_a_deleted_or_recoded_library_item_is_not_added_back(connection):
    built_on(connection, {'card_id': 'c1', 'kind': 'RATE', 'code': 'W2', 'name': 'Plaster'}, LINES)
    service.delete_row(connection, 'r2')
    assert connection.ran('array_append(removed') == [['W2', 'c1', 'W2']]
    (lines, _), = connection.ran('update rate_rows set lines')
    assert lines.obj == [LINES[0]]  # the work item built on it is worked out without it

    connection.calls.clear()
    service.change_row(connection, 'r2', RowChange(code='W9'))
    assert connection.ran('array_append(removed')
    (lines, _), = connection.ran('update rate_rows set lines')
    assert lines.obj[1]['rate'] == 'W9'


def test_a_new_item_with_no_build_up_keeps_an_empty_list(connection):
    from app.features.rate_cards.schemas import Row
    from app.testing.fakes import actor
    service.add_row(connection, actor(), 'c1', Row(kind='RATE', name='Own item', code='OWN-01', lines=[], additions={}))
    params, = connection.ran('insert into rate_rows')
    assert params[-2].obj == [] and params[-1].obj == {}  # stored as JSON, not a Postgres array
