"""Who may do what: each role's permissions, a project only for who is on it, editing only with edit access."""

import pytest

from app.core.access import actor_of, can_edit, check_estimate, current, find_project, need_edit
from app.core.errors import Forbidden, NotFound
from app.testing.fakes import actor


def test_roles():
    assert actor('admin').can('manage_org') and not actor('qs').can('manage_org')
    assert actor('qs').can('edit_rates') and not actor('viewer').can('edit_estimate')
    assert not actor('contributor').can('see_estimate') and actor('contributor').can('upload')
    with pytest.raises(Forbidden):
        actor('viewer').need('create_project')


def test_no_session_no_one():
    assert actor_of(None) is None
    with pytest.raises(Exception) as refused:
        current(None)
    assert refused.value.status_code == 401


def test_a_project_for_who_is_on_it(connection):
    connection.on('from projects p left join members', {'id': 'p', 'access': None})
    with pytest.raises(NotFound):
        find_project(connection, actor('qs'), 'p')
    assert find_project(connection, actor('admin'), 'p')['access'] == 'edit'  # an Admin is on every project
    with pytest.raises(Forbidden):
        find_project(connection, actor('contributor'), 'p', 'see_estimate')


def test_editing_needs_the_role_and_edit_access():
    assert can_edit(actor('qs'), {'access': 'edit'})
    assert not can_edit(actor('qs'), {'access': 'view'})
    assert not can_edit(actor('viewer'), {'access': 'edit'})
    with pytest.raises(Forbidden):
        need_edit(actor('qs'), {'access': 'view'})


def test_an_unknown_estimate(connection):
    with pytest.raises(NotFound):
        check_estimate(connection, actor(), 'e1')
