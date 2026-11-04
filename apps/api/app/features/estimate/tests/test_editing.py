"""The QS's edits: a typed rate, a percentage, lines added, changed and removed, a type billed by hand, and undo putting
it all back."""

import pytest
from fastapi import HTTPException

from app.features.estimate.editing import Edit, apply, mutable, restore


def result():
    return {
        'pricing': {'prelims': 5, 'contingency': 5, 'vat': 7.5},
        'boq': [{'code': 'G001', 'bill': 'B', 'section': 'Walls', 'description': 'Blockwork', 'unit': 'm²', 'qty': 10.0,
                 'rate': 5000, 'rate_item_id': 'r1', 'rate_note': None, 'source': 'group', 'position': 0}],
        'provisional': [{'code': 'P01', 'description': 'Excavation', 'section': 'Substructure', 'bill': 'B', 'unit': 'm³', 'qty': 6.0}],
        'types': [{'key': 'chair', 'type': 'Chair', 'family': None, 'class': 'IfcFurniture', 'gids': ['c1', 'c2'],
                   'mapping': {'decision': 'exclude', 'held': False, 'reason': 'furniture', 'items': [], 'confidence': 'High'}}],
        'takeoff': [],
    }


def test_a_typed_rate_unlinks_the_card():
    estimate = result()
    apply(estimate, Edit(op='rate', code='G001', rate=6000))
    line = estimate['boq'][0]
    assert (line['rate'], line['rate_item_id'], line['rate_note']) == (6000, None, 'typed')


def test_a_percentage():
    estimate = result()
    apply(estimate, Edit(op='percent', name='vat', value=10))
    assert estimate['pricing']['vat'] == 10


def test_a_measured_quantity_overridden_keeps_the_measured_one():
    estimate = result()
    apply(estimate, Edit(op='line', code='G001', qty=12))
    assert (estimate['boq'][0]['qty'], estimate['boq'][0]['measured_qty']) == (12, 10.0)
    apply(estimate, Edit(op='line', code='G001', qty=10))  # back to as measured: nothing to show beside it
    assert 'measured_qty' not in estimate['boq'][0]


def test_lines_added_numbered_and_removed():
    estimate = result()
    apply(estimate, Edit(op='add_line', section='Doors', description='Door stops', unit='nr', qty=4))
    apply(estimate, Edit(op='add_line', section='Doors', description='Door closers', unit='nr', qty=2))
    assert [line['code'] for line in estimate['boq']] == ['G001', 'Q001', 'Q002']
    apply(estimate, Edit(op='remove_line', code='Q001'))
    assert [line['code'] for line in estimate['boq']] == ['G001', 'Q002']


def test_a_line_needs_our_section_and_unit():
    with pytest.raises(HTTPException) as refused:
        apply(result(), Edit(op='add_line', section='Landscaping', description='Trees', unit='nr'))
    assert refused.value.status_code == 422


def test_a_provisional_item_comes_in_once():
    estimate = result()
    apply(estimate, Edit(op='add_provisional', code='P01'))
    assert any(line['code'] == 'P01' for line in estimate['boq'])
    with pytest.raises(HTTPException):
        apply(estimate, Edit(op='add_provisional', code='P01'))


def test_a_type_billed_by_hand_is_counted():
    estimate = result()
    apply(estimate, Edit(op='type', code='chair', decision='bill'))
    assert [row['qty'] for row in estimate['takeoff']] == [1, 1]
    [line] = estimate['takeoff_lines']
    assert (line['description'], line['qty'], line['section']) == ('Chair: supply and fix', 2, 'Fittings and furnishings')


def test_undo_puts_it_all_back():
    estimate = result()
    before = mutable(estimate)
    apply(estimate, Edit(op='rate', code='G001', rate=1))
    apply(estimate, Edit(op='percent', name='vat', value=0))
    apply(estimate, Edit(op='type', code='chair', decision='bill'))
    restore(estimate, before)
    assert estimate['boq'][0]['rate'] == 5000 and estimate['pricing']['vat'] == 7.5
    assert estimate['types'][0]['mapping']['decision'] == 'exclude'
    assert all(row['status'] == 'exclude' for row in estimate['takeoff'])


def test_unknown_codes_are_refused():
    for edit in (Edit(op='rate', code='NOPE', rate=1), Edit(op='line', code='NOPE'), Edit(op='remove_line', code='NOPE'), Edit(op='type', code='NOPE')):
        with pytest.raises(HTTPException) as refused:
            apply(result(), edit)
        assert refused.value.status_code == 404
