"""The team: invitations, roles, removing someone, and the firm's details."""

import pytest
from fastapi import HTTPException

from app.core.errors import NotFound
from app.features.orgs import service
from app.features.orgs.schemas import Details, Invite
from app.testing.fakes import PERSON, actor


def test_an_invitation_is_a_link_and_a_waiting_person(connection):
    answer = service.invite(connection, actor('admin'), Invite(email='Bisi@Example.com', role='qs'))
    assert answer['link'].startswith('/invite/')
    _, name, email, role, stored, _ = connection.ran('insert into people')[0]
    assert (name, email, role) == ('Bisi', 'bisi@example.com', 'qs')
    assert stored not in answer['link']  # only the hash is kept


def test_an_email_already_there_is_not_invited_again(connection):
    connection.on('select 1 from people', {'?column?': 1})
    with pytest.raises(HTTPException) as refused:
        service.invite(connection, actor('admin'), Invite(email='a@example.com', role='qs'))
    assert refused.value.status_code == 409


def test_a_new_link_only_for_someone_still_invited(connection):
    with pytest.raises(NotFound):
        service.new_link(connection, 'p2')
    connection.on('update people set invite_token', {'id': 'p2'})
    assert service.new_link(connection, 'p2')['link'].startswith('/invite/')


def test_the_last_admin_keeps_their_role(connection):
    connection.on('select * from people', {'role': 'admin', 'invite_token': None}).on("role = 'admin'", {'n': 1})
    with pytest.raises(HTTPException) as refused:
        service.change_role(connection, 'p2', 'qs')
    assert refused.value.status_code == 409 and not connection.ran('update people set role')


def test_a_role_changes(connection):
    connection.on('select * from people', {'role': 'qs', 'invite_token': None}).on("role = 'admin'", {'n': 1})
    service.change_role(connection, 'p2', 'viewer')
    assert connection.ran('update people set role') == [['viewer', 'p2']]


def test_nobody_removes_themselves_or_someone_unknown(connection):
    with pytest.raises(HTTPException) as refused:
        service.remove(connection, actor('admin'), str(PERSON))
    assert refused.value.status_code == 409
    with pytest.raises(NotFound):
        service.remove(connection, actor('admin'), 'p2')


def test_the_firms_currency_is_kept_in_capitals(connection):
    service.save_details(connection, actor('admin'), Details(name=' Demo ', currency='ngn'))
    assert connection.ran('update orgs')[0][:2] == ['Demo', 'NGN']
