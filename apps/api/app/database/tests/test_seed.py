"""The demo data: every person has a role the app knows, and every saved estimate still fits the app: its models are
the project's own and its rates are in the shipped library."""

import json

import pytest

from app.core.config import env
from app.core.constants import PERMISSIONS
from app.database.seed.constants import FINISHED, PEOPLE, PROJECTS
from app.database.seed.estimates import placed, portable


def test_every_demo_person_has_a_known_role():
    assert {role for _, _, role in PEOPLE} == set(PERMISSIONS)


@pytest.mark.parametrize('folder', sorted(FINISHED))
def test_a_saved_estimate_fits_its_project_and_the_library(folder):
    saved = json.loads((env.SAMPLES / folder / 'estimate.json').read_text())
    files = next(files for *_, each, files in PROJECTS if each == folder)
    codes = {rate['code'] for rate in json.loads((env.RATE_CARD / 'rates.json').read_text())}
    result = placed(saved['result'], {name: f'model-{name}' for name in files}, 'card', {code: f'row-{code}' for code in codes})
    assert {model['name'] for model in result['models']} == set(files)
    assert all(line['rate_item_id'] is None or line['rate_item_id'].startswith('row-') for line in result['boq'])
    assert saved['programme']['activities']
    assert portable(result) == saved['result']  # and back again


def test_the_downloaded_models_are_checked():
    sums = (env.SAMPLES / 'SHA256SUMS').read_text()
    for *_, folder, files in PROJECTS:
        for name in files:
            assert f'{folder}/{name}' in sums
