import pytest

from app.core.errors import NotFound
from app.features.sidekick import service
from app.testing.fakes import actor


def test_no_tools_before_the_takeoff(connection):
    with pytest.raises(NotFound):
        service.tools_for(connection, actor(), 'e1')


def test_the_tools_see_what_the_person_may(connection):
    connection.on('select result, programme from estimates', {'result': {'boq': None, 'types': [], 'takeoff': []}, 'programme': None})
    assert service.tools_for(connection, actor('contributor'), 'e1').money is False
    assert service.tools_for(connection, actor('qs'), 'e1').money is True
