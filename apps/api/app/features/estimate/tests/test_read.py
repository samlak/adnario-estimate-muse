"""Reading IFC: the mm-authored Ikeja sample comes out in metres, and a pad's perimeter is never shorter than a
circle's."""

import ifcopenshell
import pytest

from app.config import env
from app.features.estimate.read import read_models

IKEJA = env.SAMPLES / 'ikeja-office' / 'Ikeja_Office.ifc'


@pytest.mark.skipif(not IKEJA.exists(), reason='the Ikeja sample is not here')
def test_the_mm_sample_reads_in_metres():
    found, _ = read_models([{'id': 'x', 'name': IKEJA.name}], lambda model: ifcopenshell.open(IKEJA))
    mullions = [e['q']['length'] for e in found if e['class'] == 'IfcMember' and e['q'].get('length')]
    assert mullions and max(mullions) < 10
    pad = next(e['q'] for e in found if e['type'].startswith('Pad 1'))
    assert pad['perimeter'] > 100 and pad['height'] == 0.3
