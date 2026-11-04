"""The demo data: every person has a role the app knows, and every project's files are in overview/samples."""

import pytest

from app.core.config import env
from app.core.constants import PERMISSIONS
from app.database.seed.constants import PEOPLE, PROJECTS


def test_every_demo_person_has_a_known_role():
    assert {role for _, _, role in PEOPLE} == set(PERMISSIONS)


@pytest.mark.skipif(not env.SAMPLES.exists(), reason='the samples are not here')
def test_every_demo_projects_files_are_there():
    for _, _, _, _, folder, models, programme in PROJECTS:
        for name in [*models, programme]:
            assert (env.SAMPLES / folder / name).exists(), name
