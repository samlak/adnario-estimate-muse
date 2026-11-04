"""Signing in, up and through an invitation: the sign-in limit, a wrong password counted, one account per email, and
an invitation link that works once."""

import pytest
from fastapi import HTTPException

from app.core.errors import NotFound
from app.features.auth import service
from app.features.auth.constants import FAILURES
from app.features.auth.schemas import Join, SignIn, SignUp
from app.features.auth.utils import hashed
from app.testing.fakes import actor

PERSON = {'id': 'p1', 'org_id': 'o1', 'password_hash': hashed('correct-horse-1')}


def test_signing_in_gives_a_session_and_clears_the_failures(connection):
    connection.on('sign_in_failures where email', {'n': 0}).on('from people where lower(email)', PERSON)
    token = service.sign_in(connection, SignIn(email=' Ada@Example.com ', password='correct-horse-1'))
    assert token and connection.ran('insert into sessions')
    assert connection.ran('delete from sign_in_failures') == [['ada@example.com']]


def test_a_wrong_password_is_counted_and_kept(connection):
    connection.on('sign_in_failures where email', {'n': 0}).on('from people where lower(email)', PERSON)
    with pytest.raises(HTTPException) as refused:
        service.sign_in(connection, SignIn(email='ada@example.com', password='wrong-password'))
    assert refused.value.status_code == 401
    assert connection.ran('insert into sign_in_failures') and connection.committed  # kept though the request fails


def test_an_unknown_email_is_the_same_answer_as_a_wrong_password(connection):
    connection.on('sign_in_failures where email', {'n': 0})
    with pytest.raises(HTTPException) as refused:
        service.sign_in(connection, SignIn(email='nobody@example.com', password='x'))
    assert refused.value.status_code == 401


def test_too_many_failures_lock_the_email(connection):
    connection.on('sign_in_failures where email', {'n': FAILURES}).on('from people where lower(email)', PERSON)
    with pytest.raises(HTTPException) as refused:
        service.sign_in(connection, SignIn(email='ada@example.com', password='correct-horse-1'))
    assert refused.value.status_code == 429


def test_signing_up_makes_a_firm_its_admin_and_its_rate_card(connection):
    connection.on('insert into orgs', {'id': 'o1'}).on('insert into people', PERSON).on('insert into rate_cards', {'id': 'c1'})
    token = service.sign_up(connection, SignUp(name='Ada', company=' Obi & Partners ', email='Ada@Example.com', password='correct-horse-1'))
    assert token
    assert connection.ran('insert into orgs') == [['Obi & Partners']]
    name, email = connection.ran('insert into people')[0][1:3]
    assert (name, email) == ('Ada', 'ada@example.com')
    assert connection.ran('insert into rate_cards')  # Adnario Market Rates copied in


def test_an_email_signs_up_once(connection):
    connection.on('select 1 from people', {'?column?': 1})
    with pytest.raises(HTTPException) as refused:
        service.sign_up(connection, SignUp(name='A', company='B', email='a@example.com', password='correct-horse-1'))
    assert refused.value.status_code == 409


def test_me_lists_what_the_role_may_do(connection):
    connection.on('from people', {'id': 'p1', 'name': 'Ngozi'}).on('from orgs', {'id': 'o1', 'name': 'Demo'})
    me = service.me(connection, actor('viewer'))
    assert me['person']['name'] == 'Ngozi' and me['firm']['name'] == 'Demo'
    assert 'see_estimate' in me['can'] and 'edit_estimate' not in me['can']


def test_an_invitation_link_that_is_used_or_unknown_is_refused(connection):
    with pytest.raises(NotFound):
        service.invitation(connection, 'used-token')
    with pytest.raises(NotFound):
        service.accept(connection, 'used-token', Join(name='Bisi', password='correct-horse-1'))


def test_accepting_an_invitation_sets_the_password_and_signs_in(connection):
    connection.on('update people set name', PERSON)
    assert service.accept(connection, 'token', Join(name=' Bisi ', password='correct-horse-1'))
    assert connection.ran('update people set name')[0][0] == 'Bisi'
