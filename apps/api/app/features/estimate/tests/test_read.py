"""Reading IFC: the mm-authored Ikeja sample comes out in metres, and a pad's perimeter is never shorter than a
circle's."""

import ifcopenshell
import pytest

from app.core.config import env
from app.features.estimate.read import read_models

IKEJA = env.SAMPLES / 'ikeja-office' / 'Ikeja_Office.ifc'


@pytest.mark.skipif(not IKEJA.exists(), reason='the Ikeja sample is not here')
def test_the_mm_sample_reads_in_metres():
    found, _ = read_models([{'id': 'x', 'name': IKEJA.name}], lambda model: ifcopenshell.open(IKEJA))
    mullions = [e['q']['length'] for e in found if e['class'] == 'IfcMember' and e['q'].get('length')]
    assert mullions and max(mullions) < 10
    pad = next(e['q'] for e in found if e['type'].startswith('Pad 1'))
    assert pad['perimeter'] > 100 and pad['height'] == 0.3


LEKKI = env.SAMPLES / 'lekki-office'


@pytest.mark.skipif(not (LEKKI / 'Office_STR.ifc').exists(), reason='the Lekki sample is not here')
def test_pads_that_state_only_their_type_size_are_measured_and_the_structure_is_known():
    models = [{'id': 'a', 'name': 'Office_ARC.ifc'}, {'id': 's', 'name': 'Office_STR.ifc'}]
    found, summaries = read_models(models, lambda model: ifcopenshell.open(LEKKI / model['name']))
    pads = [e for e in found if e['class'] == 'IfcFooting' and e['type'].startswith('2000 x 2000')]
    assert len(pads) == 40 and {round(e['q']['volume'], 3) for e in pads} == {1.2}  # 2 x 2 x 0.3, from the type
    assert {e['source'] for e in pads} == {'Revit type dimensions'}
    assert [(s['model'], s['structural']) for s in summaries] == [('Office_ARC.ifc', False), ('Office_STR.ifc', True)]
    # every solid has its shape, in metres, and the small openings a wall's net area lost are back
    assert all(e.get('shape') is not None for e in pads) and max(float(pads[0]['shape'].size.max()), 0) < 3
    back = [e for e in found if e.get('added_back')]
    assert back and all(0 < e['added_back'] <= 0.5 * len(e['openings']) for e in back)
