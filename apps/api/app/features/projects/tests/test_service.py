"""Projects: only those you are on (an Admin sees all), the maker on a new one, view access cannot change it, and
adding someone tells them."""

import pytest

from app.core.errors import Forbidden, NotFound
from app.features.projects import service
from app.features.projects.schemas import Member, NewProject
from app.testing.fakes import actor


def test_a_qs_sees_only_projects_they_are_on_an_admin_sees_all(connection):
    connection.on('from projects p', [{'id': 'p', 'revision': 1}, {'id': 'q', 'revision': None}])
    rows = service.projects(connection, actor('qs'))
    assert [row['takeoff'] for row in rows] == ['Rev A', None]
    service.projects(connection, actor('admin'))
    mine, every = [sql for sql, _ in connection.calls]
    assert 'exists (select 1 from members' in mine and 'exists' not in every


def test_the_maker_is_on_a_new_project_to_edit(connection):
    connection.on('insert into projects', {'id': 'proj', 'name': 'Lekki'})
    service.create(connection, actor(), NewProject(name='  Lekki  '))
    assert connection.ran('insert into projects')[0][1] == 'Lekki'
    assert connection.ran("insert into members")[0][1] == 'proj'


def test_someone_not_on_the_project_does_not_find_it(connection):
    connection.on('from projects p left join members', {'id': 'proj', 'access': None})
    with pytest.raises(NotFound):
        service.project(connection, actor('qs'), 'proj')
    assert service.project(connection, actor('admin'), 'proj')['access'] == 'edit'


def test_view_access_cannot_change_the_project(connection):
    connection.on('from projects p left join members', {'id': 'proj', 'access': 'view'})
    with pytest.raises(Forbidden):
        service.update(connection, actor('qs'), 'proj', NewProject(name='X'))


def test_someone_added_is_told(connection):
    connection.on('from projects p left join members', {'id': 'proj', 'name': 'Lekki', 'access': 'edit'})
    service.add_member(connection, actor(), 'proj', Member(person_id='00000000-0000-0000-0000-000000000002'))
    assert connection.ran('insert into notifications')[0][3] == 'Tunde Bello added you to Lekki'
