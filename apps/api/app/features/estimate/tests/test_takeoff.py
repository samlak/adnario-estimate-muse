"""The takeoff's code side: the AI's mapping checked and given code's confidence, quantities measured, formwork and
blinding derived from concrete, rows rolled up into lines, provisional quantities worked out."""

from app.features.estimate.takeoff import check_mapping, derive, measure, provisional_qty, roll_up


def entry(**extra):
    return {'model': 'm', 'class': 'IfcWall', 'type': 'Block wall 225', 'family': 'Basic Wall', 'material': 'Sandcrete block',
            'layers': [], 'count': 4, 'sources': {}, **extra}


def item(**extra):
    return {'description': '225mm sandcrete blockwork', 'section': 'Walls', 'unit': 'm2', 'method': 'area', **extra}


def test_no_answer_is_unmapped_and_low():
    assert check_mapping(entry(), None) | {'reason': ''} == {'decision': 'unmapped', 'held': False, 'reason': '', 'items': [], 'confidence': 'Low'}


def test_an_exclusion_is_trusted():
    assert check_mapping(entry(), {'decision': 'exclude', 'reason': 'void'})['decision'] == 'exclude'


def test_a_good_answer_is_billed_high_with_our_units():
    mapped = check_mapping(entry(), {'decision': 'bill', 'items': [item()]})
    assert (mapped['decision'], mapped['confidence'], mapped['held']) == ('bill', 'High', False)
    assert mapped['items'][0]['unit'] == 'm²'


def test_foreign_sections_and_wrong_units_are_refused():
    mapped = check_mapping(entry(), {'items': [item(section='Landscaping'), item(method='volume')]})
    assert mapped['decision'] == 'unmapped' and 'not one of ours' in mapped['reason'] and 'not measured in' in mapped['reason']


def test_a_door_billed_outside_doors_is_held():
    mapped = check_mapping(entry(**{'class': 'IfcDoor'}), {'items': [item()]})
    assert mapped['confidence'] == 'Low' and mapped['held']


def test_a_generic_type_name_or_a_guess_is_low():
    assert check_mapping(entry(type='Type 1'), {'items': [item()]})['confidence'] == 'Low'
    assert check_mapping(entry(), {'items': [item()], 'guessing': True})['confidence'] == 'Low'


def test_a_description_that_contradicts_the_material_is_medium():
    mapped = check_mapping(entry(), {'items': [item(description='Steel cladding panels')]})
    assert mapped['confidence'] == 'Medium' and 'steel' in mapped['reason']


def test_a_duplicate_type_is_billed_from_the_first():
    assert check_mapping(entry(duplicate_of='Wall A'), {'items': [item()]})['reason'] == 'billed from Wall A'


def test_measuring():
    element = {'q': {'area': 10.0, 'volume': 2.0}, 'source': 'quantities'}
    assert measure(element, {'method': 'count'}, []) == (1.0, 'count')
    assert measure(element, {'method': 'weight'}, []) == (15.7, 'volume × 7.85 t/m³')
    assert measure(element, {'method': 'area'}, []) == (10.0, 'quantities')
    # a layer of a wall: its area times the layer's thickness
    assert measure(element, {'method': 'volume', 'layer': 0}, [{'thickness_mm': 25}]) == (0.25, 'layer: area × 25mm')
    assert measure({'q': {}, 'source': 'quantities'}, {'method': 'length'}, []) == (None, 'no quantity in the model')


def concrete_row(ref, section='Substructure'):
    return {'ref': ref, 'unit': 'm³', 'description': 'Reinforced concrete', 'status': 'billed', 'section': section}


def test_a_footing_gets_formwork_blinding_and_anti_termite():
    footing = {'ref': 'F1', 'class': 'IfcFooting', 'type': 'Pad', 'name': 'F1', 'storey': 'Foundation', 'type_key': 'k',
               'q': {'volume': 1.2, 'height': 0.3, 'width': 2.0}}
    derived = {row['derived']: row['qty'] for row in derive([footing], [concrete_row('F1')])}
    # footprint 1.2 / 0.3 = 4 m², 2 x 2 → perimeter 8 m × 0.3 m
    assert derived == {'formwork_foundations': 2.4, 'blinding': 4.0, 'anti_termite': 4.0}


def test_a_ground_slab_gets_a_membrane_not_a_soffit():
    slab = {'ref': 'S1', 'class': 'IfcSlab', 'type': 'Ground slab', 'name': 'S1', 'storey': '00', 'type_key': 'k',
            'q': {'area': 50.0, 'perimeter': 30.0, 'thickness': 0.15}}
    derived = {row['derived'] for row in derive([slab], [concrete_row('S1')])}
    assert derived == {'formwork_slab_edge', 'dpm', 'anti_termite'}


def test_rows_roll_up_into_lines_in_element_order():
    rows = [
        {'ref': 'a', 'section': 'Walls', 'description': 'Blockwork', 'unit': 'm²', 'qty': 2.0, 'status': 'billed', 'type_key': 'w', 'confidence': 'High'},
        {'ref': 'b', 'section': 'Walls', 'description': 'Blockwork', 'unit': 'm²', 'qty': 3.0, 'status': 'billed', 'type_key': 'w', 'confidence': 'Medium'},
        {'ref': 'c', 'section': 'Substructure', 'description': 'Concrete', 'unit': 'm³', 'qty': 1.0, 'status': 'billed', 'type_key': 'f'},
        {'ref': 'd', 'section': 'Walls', 'description': 'Blockwork', 'unit': 'm²', 'qty': 99.0, 'status': 'excluded', 'type_key': 'w'},
    ]
    first, second = roll_up(rows)
    assert (first['code'], first['section'], first['bill']) == ('L001', 'Substructure', 'B')
    assert (second['qty'], second['count'], second['confidence']) == (5.0, 2, 'Medium')
    assert rows[0]['code'] == 'L002'


def test_provisional_quantities_come_from_what_was_measured():
    rows = [{'ref': 'F1', 'status': 'billed', 'derived': 'blinding', 'qty': 4.0, 'unit': 'm²', 'description': '', 'section': 'Substructure'}]
    assert provisional_qty('excavation', [], rows) == 6.0
    assert provisional_qty('backfill', [], rows) == 2.0
    assert provisional_qty('footprint', [], rows) is None  # no membrane measured, so no footprint
    assert provisional_qty('nonsense', [], rows) is None
