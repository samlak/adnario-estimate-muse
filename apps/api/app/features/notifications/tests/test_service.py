"""Notifications: one row per person told, and only a person's own marked read."""

from app.features.notifications import service
from app.testing.fakes import PERSON, actor


def test_each_person_is_told(connection):
    service.notify(connection, 'o1', ['p1', 'p2'], 'proj', 'Title', 'Text')
    assert [params[1] for params in connection.ran('insert into notifications')] == ['p1', 'p2']


def test_only_your_own_are_read(connection):
    service.read(connection, actor(), 'n1')
    service.read_all(connection, actor())
    assert connection.ran('where id = %s and person_id') == [['n1', PERSON]]
    assert connection.ran('where person_id = %s') [-1] == [PERSON]
