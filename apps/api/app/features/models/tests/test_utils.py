"""An upload is an IFC by name, size and first bytes; the list shows change counts, not the whole diff."""

import pytest
from fastapi import HTTPException

from app.features.models.constants import UPLOAD_LIMIT
from app.features.models.utils import check_upload, listed

IFC = b'ISO-10303-21;\nHEADER;'


def test_a_real_ifc_passes():
    check_upload('Office_ARC.IFC', IFC)
    check_upload('model.ifc', b'  \n' + IFC)  # leading blank lines are fine


@pytest.mark.parametrize(('name', 'data', 'status'), [
    ('drawing.pdf', IFC, 422),
    ('model.ifc', b'%PDF-1.7', 422),
    ('model.ifc', IFC + b'x' * UPLOAD_LIMIT, 413),
    (None, IFC, 422),
])
def test_anything_else_is_refused(name, data, status):
    with pytest.raises(HTTPException) as refused:
        check_upload(name, data)
    assert refused.value.status_code == status


def test_the_list_shows_counts_not_the_diff():
    rows = listed([{'diff': {'added': [1, 2], 'removed': [], 'changed': [3]}}, {'diff': None}])
    assert rows[0] == {'diff': None, 'changes': {'added': 2, 'removed': 0, 'changed': 1}}
    assert rows[1] == {'diff': None}
