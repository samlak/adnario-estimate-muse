"""The takeoff's code side: the AI's mapping checked and given code's confidence, quantities measured, formwork and
blinding derived from concrete, rows rolled up into lines, provisional quantities worked out."""

from app.features.estimate.takeoff import (
    basis_of, check_mapping, concrete_of, derive, issues, measure, provisional_qty, provisional_rebar, reinforce, roll_up,
)
from app.features.estimate.tests.test_shapes import box


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
    assert measure(element | {'material': 'Steel S275'}, {'method': 'weight'}, []) == (15.7, 'volume × 7.85 t/m³')
    assert measure(element | {'material': 'Aluminium'}, {'method': 'weight'}, []) == (5.4, 'volume × 2.7 t/m³')
    # no density for it: not weighed as if it were steel
    assert measure(element | {'material': 'Timber'}, {'method': 'weight'}, [])[0] is None
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
    assert provisional_qty('excavation', [], rows) == 6.0  # 4 m² of footing, 1.5m deep when its level is not known
    assert provisional_qty('backfill', [], rows) == 6.0  # nothing buried in it
    assert provisional_qty('footprint', [], rows) is None  # no membrane measured, so no footprint
    assert provisional_qty('nonsense', [], rows) is None
    ground = rows + [{'ref': 'S1', 'status': 'billed', 'derived': 'dpm', 'qty': 100.0, 'unit': 'm²', 'description': '', 'section': 'Substructure'}]
    # in its unit: hardcore as a 150mm bed in m³, or its area in m²; a lump sum is one; a unit it cannot give is none
    assert provisional_qty('hardcore', [], ground, 'm³') == 15.0 and provisional_qty('hardcore', [], ground, 'm²') == 100.0
    assert provisional_qty('footprint', [], ground, 'item') == 1.0 and provisional_qty('none', [], ground, 'item') == 1.0
    assert provisional_qty('footprint', [], ground, 'm³') is None


def test_a_provisional_item_is_measured_by_what_it_says_when_its_basis_cannot_give_its_unit():
    assert basis_of('Excavation for strip foundations', 'footprint', 'm³') == 'excavation'
    assert basis_of('Hardcore filling under ground slab', 'none', 'm³') == 'hardcore'
    assert basis_of('Disposal of surplus excavated material', 'none', 'm³') == 'surplus'
    assert basis_of('Site clearance', 'footprint', 'm²') == 'footprint'  # the AI's, when it fits
    assert basis_of('Borehole', 'none', 'item') == 'none'


# ── From the faces: formwork where nothing touches, beds under what bears on the ground ──

def solid(ref, cls, lo, hi, type_='RC', **extra):
    return {'ref': ref, 'model': 'M', 'class': cls, 'type': type_, 'name': ref, 'storey': 'L1', 'type_key': f'k{ref}', 'q': {}, 'layers': [],
            'material': 'Concrete', 'shape': box(lo, hi), **extra}


LEVELS = [{'storeys': [{'name': 'Ground', 'elevation': 0.0}, {'name': 'First', 'elevation': 3.0}]}]


def test_a_suspended_slab_on_beams_and_columns_is_formed_where_nothing_touches():
    slab = solid('S', 'IfcSlab', (0, 0, 3), (6, 6, 3.2))
    beam = solid('B', 'IfcBeam', (0, 2.85, 2.6), (6, 3.15, 3))
    column = solid('C', 'IfcColumn', (2.85, 2.85, 0), (3.15, 3.15, 2.6))
    rows = [concrete_row(ref, 'Frame') for ref in 'SBC']
    derived = {row['description']: row['qty'] for row in derive([slab, beam, column], rows, LEVELS)}
    assert derived['Formwork to soffits of suspended slabs'] == 34.2
    assert abs(derived['Formwork to edges of suspended slabs, not exceeding 250mm high'] - 4.8) < 0.05  # measured in 0.3m pieces
    assert derived['Formwork to sides of columns'] == 3.12
    assert round(derived['Formwork to sides and soffits of beams'], 2) == 5.04 + 1.71
    assert all(row['basis'] == 'faces' and row['rate_code'] for row in derive([slab, beam, column], rows, LEVELS))


def test_a_slab_on_planks_or_decking_has_no_soffit_and_precast_is_not_formed():
    slab = solid('S', 'IfcSlab', (0, 0, 3), (6, 6, 3.1), type_='Topping on metal deck')
    beam = solid('B', 'IfcBeam', (0, 0, 2.6), (6, 0.3, 3))
    rows = [concrete_row('S', 'Upper floors'), {**concrete_row('B', 'Frame'), 'description': 'Precast concrete beam 300 x 400'}]
    kinds = {row['derived'] for row in derive([slab, beam], rows, LEVELS)}
    assert kinds == {'formwork_slab_edge'}


def test_a_slab_at_the_lowest_level_is_the_ground_slab_whatever_its_storey_is_called():
    slab = solid('G', 'IfcSlab', (0, 0, -0.15), (10, 10, 0), storey='Zz level')
    derived = {row['derived']: row['qty'] for row in derive([slab], [concrete_row('G')], LEVELS)}
    assert derived['dpm'] == 100.0 and derived['anti_termite'] == 100.0 and 'formwork_soffit' not in derived


def test_concrete_is_known_by_the_models_material_too():
    column = solid('C', 'IfcColumn', (0, 0, 0), (0.3, 0.3, 3), material='Concrete - Cast In Situ')
    row = {**concrete_row('C', 'Frame'), 'description': 'C25/30 column, 300 x 300mm'}
    assert {r['derived'] for r in derive([column], [row], LEVELS)} == {'formwork_columns'}


def test_without_a_shape_formwork_comes_from_dimensions_and_is_medium():
    footing = {'ref': 'F1', 'class': 'IfcFooting', 'type': 'Pad', 'name': 'F1', 'storey': 'Foundation', 'type_key': 'k',
               'q': {'volume': 1.2, 'height': 0.3, 'width': 2.0}}
    rows = derive([footing], [{**concrete_row('F1'), 'confidence': 'High'}])
    assert {row['basis'] for row in rows} == {'dimensions'} and {row['confidence'] for row in rows} == {'Medium'}
    assert footing['derive_basis'] == 'dimensions'


def test_a_bar_is_billed_under_the_concrete_it_sits_in_and_none_means_provisional():
    column = solid('C', 'IfcColumn', (0, 0, 0), (0.3, 0.3, 3))
    slab = solid('S', 'IfcSlab', (-3, -3, 3), (3, 3, 3.2))
    bar = {'ref': 'R', 'class': 'IfcReinforcingBar', 'type': 'T16', 'name': 'R', 'storey': 'L1', 'type_key': None,
           'q': {'volume': 0.001}, 'layers': [], 'material': 'Steel', 'shape': box((0.05, 0.05, 0.1), (0.07, 0.07, 3.3))}
    rows = [concrete_row('C', 'Frame'), concrete_row('S', 'Upper floors')]
    derive([column, slab, bar], rows, LEVELS)  # gives each its kind
    concrete = concrete_of([column, slab, bar], rows)
    bars, lost = reinforce([column, slab, bar], rows, concrete)
    assert not lost and bars[0]['section'] == 'Frame' and bars[0]['unit'] == 't' and bars[0]['qty'] == 0.0078
    assert 'in columns' in bars[0]['description'] and bars[0]['rate_code'] == 'REI-01'
    # the column has bars; the slab has none, so its reinforcement is provisional at 100 kg/m³
    rows[1]['qty'] = 7.2
    provisional = provisional_rebar([column, slab, bar], rows, concrete, bars)
    assert [(item['description'].split(' (')[0], item['qty']) for item in provisional] == [('High yield bar reinforcement to suspended slabs', 0.72)]


def test_what_code_cannot_settle_becomes_a_question():
    types = [{'key': 'k1', 'type': 'Pad 2000 x 2000 x 300mm', 'class': 'IfcFooting', 'model': 'STR', 'gids': ['P'], 'layers': [], 'mapping': {}},
             {'key': 'k2', 'type': 'HSS 100x100x6', 'class': 'IfcBeam', 'model': 'STR', 'gids': ['H'], 'layers': [], 'mapping': {}}]
    pad = solid('P', 'IfcFooting', (0, 0, -1), (1.5, 1.5, -0.7), type_='Pad 2000 x 2000 x 300mm', type_key='k1')
    hollow = solid('H', 'IfcBeam', (0, 0, 3), (5, 0.1, 3.1), type_='HSS 100x100x6', type_key='k2', material='Steel')
    rows = [{'ref': 'P', 'type_key': 'k1', 'status': 'not_measured', 'source': 'no quantity in the model', 'unit': 'm³', 'qty': 0, 'description': 'Pad'},
            {'ref': 'H', 'type_key': 'k2', 'status': 'billed', 'source': 'model', 'unit': 't', 'qty': 0.39, 'description': 'Steel HSS', 'code': 'L003'}]
    asked = issues([pad, hollow], types, rows)
    assert [question['severity'] for question in asked] == ['high', 'high', 'medium']
    text = ' '.join(question['question'] for question in asked)
    assert 'could not be measured' in text and 'modelled solid' in text and 'not the size the type name says' in text
    assert next(q for q in asked if 'modelled solid' in q['question'])['line_codes'] == ['L003']
    assert all(question['source'] == 'code' for question in asked)


def test_a_layer_left_unbilled_is_asked_about():
    entry = {'key': 'k', 'type': 'Floor', 'class': 'IfcSlab', 'model': 'A', 'gids': ['x'],
             'layers': [{'material': 'Screed', 'thickness_mm': 50}, {'material': 'Concrete', 'thickness_mm': 150}, {'material': 'Air Space', 'thickness_mm': 25}],
             'mapping': {'decision': 'bill', 'items': [{'layer': 1}]}}
    asked = issues([], [entry], [])
    assert len(asked) == 1 and '50mm Screed' in asked[0]['question'] and 'Air' not in asked[0]['question']  # air is never billed


def test_a_copy_in_the_other_model_keeps_only_its_finishes():
    layers = [{'material': 'Screed', 'thickness_mm': 50}, {'material': 'Concrete', 'thickness_mm': 150}]
    copy = entry(**{'class': 'IfcSlab', 'layers': layers, 'duplicate_of': 'STR', 'material': 'Screed, Concrete'})
    answer = {'items': [item(description='50mm screed', section='Floor finishes', layer=0),
                        item(description='Concrete in slab', section='Upper floors', unit='m3', method='volume', layer=1)]}
    mapped = check_mapping(copy, answer)
    assert [i['description'] for i in mapped['items']] == ['50mm screed'] and 'billed from STR' in mapped['reason']
    assert check_mapping(copy, {'items': [answer['items'][1]]})['decision'] == 'exclude'


def test_the_same_wall_in_two_models_with_different_ids_is_asked_about():
    types = [{'key': 'ka', 'type': 'Wall 225', 'class': 'IfcWall', 'model': 'ARC', 'gids': ['A'], 'layers': [], 'mapping': {}},
             {'key': 'ks', 'type': 'RC wall', 'class': 'IfcWall', 'model': 'STR', 'gids': ['S'], 'layers': [], 'mapping': {}}]
    arc = solid('A', 'IfcWall', (0, 0, 0), (5, 0.225, 3), type_key='ka') | {'model': 'ARC'}
    struct = solid('S', 'IfcWall', (0, 0, 0), (5, 0.22, 3), type_key='ks') | {'model': 'STR'}
    apart = solid('X', 'IfcWall', (0, 5, 0), (5, 5.2, 3), type_key='ks') | {'model': 'STR'}
    rows = [{'ref': ref, 'type_key': key, 'status': 'billed', 'source': 'model', 'unit': 'm²', 'qty': 15.0, 'description': 'Wall'}
            for ref, key in (('A', 'ka'), ('S', 'ks'), ('X', 'ks'))]
    asked = [question for question in issues([arc, struct, apart], types, rows) if 'two models' in question['question']]
    assert len(asked) == 1 and asked[0]['refs'] == ['A', 'S'] and asked[0]['severity'] == 'high'
