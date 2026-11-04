"""The BOQ: B1A refs, the summary arithmetic (prelims on work, contingency on that, VAT on that), and the AI's grouping
checked so every measured line lands in exactly one item."""

from app.features.estimate.boq import check_groups, display_refs, letter, totals


def line(code, section='Substructure', unit='m³', qty=1.0, confidence='High'):
    return {'code': code, 'section': section, 'description': f'Line {code}', 'unit': unit, 'qty': qty, 'count': 1,
            'gids': [code], 'confidence': confidence}


def test_item_letters_skip_i_and_o():
    assert [letter(at) for at in (0, 7, 8, 13)] == ['A', 'H', 'J', 'P']
    assert letter(24) == 'AA'


def test_refs_are_bill_element_item_as_the_lekki_sample():
    boq = [{'code': f'X{n}', 'bill': 'B', 'section': 'Substructure', 'position': n, 'qty': 1, 'rate': 100} for n in range(10)]
    boq += [{'code': 'Y', 'bill': 'B', 'section': 'Ceiling finishes', 'position': 0, 'qty': 2, 'rate': None}]
    refs = display_refs(boq)
    assert refs['X0'] == 'B1A' and refs['X7'] == 'B1H' and refs['X8'] == 'B1J'
    assert refs['Y'] == 'B2A'  # the second section present, not the eleventh in the list


def test_totals_stack_prelims_contingency_and_vat():
    boq = [{'code': f'X{n}', 'bill': 'B', 'section': 'Substructure', 'position': n, 'qty': 1, 'rate': 100} for n in range(10)]
    boq += [{'code': 'Y', 'bill': 'B', 'section': 'Ceiling finishes', 'position': 0, 'qty': 2, 'rate': None}]
    result = totals(boq, {'prelims': 5, 'contingency': 5, 'vat': 7.5})
    assert result['measured'] == 1000
    assert round(result['total'], 2) == round(1000 * 1.05 * 1.05 * 1.075, 2)
    assert (result['priced'], result['unpriced']) == (10, 1)
    assert result['bills']['B']['sections'] == {'Substructure': 1000, 'Ceiling finishes': 0}


def test_grouping_adds_up_and_takes_the_worst_confidence():
    lines = [line('L1', qty=2), line('L2', qty=3, confidence='Medium')]
    [item] = check_groups(lines, {'items': [{'lines': ['L1', 'L2'], 'section': 'Substructure', 'description': 'Concrete'}]})
    assert (item['qty'], item['lines'], item['confidence'], item['description']) == (5, ['L1', 'L2'], 'Medium', 'Concrete')


def test_grouping_refuses_reuse_mixed_units_and_unknown_lines():
    lines = [line('L1'), line('L2', unit='m²'), line('L3')]
    answer = {'items': [
        {'lines': ['L1', 'L2'], 'description': 'mixes m³ and m²'},
        {'lines': ['L3', 'NOPE'], 'description': 'unknown line ignored'},
        {'lines': ['L3'], 'description': 'L3 again'},
    ]}
    boq = check_groups(lines, answer)
    used = sorted(code for item in boq for code in item['lines'])
    assert used == ['L1', 'L2', 'L3']  # each line exactly once; the left-out ones become items as measured
    assert next(item for item in boq if item['lines'] == ['L3'])['description'] == 'unknown line ignored'


def test_grouping_keeps_the_lines_section_when_the_ai_names_a_foreign_one():
    [item] = check_groups([line('L1', section='Frame')], {'items': [{'lines': ['L1'], 'section': 'Landscaping'}]})
    assert item['section'] == 'Frame' and item['description'] == 'Line L1'


def test_no_answer_bills_every_line_as_measured():
    assert [item['lines'] for item in check_groups([line('L1'), line('L2')], None)] == [['L1'], ['L2']]
