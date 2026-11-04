"""Only an Admin manages the team and the firm."""

import pytest


@pytest.mark.parametrize('role', ['qs', 'contributor', 'viewer'])
def test_only_an_admin_manages_the_team(api, connection, role):
    client = api(role)
    assert client.post('/api/v1/team/invite', json={'email': 'a@example.com', 'role': 'qs'}).status_code == 403
    assert client.patch('/api/v1/team/p2', json={'role': 'admin'}).status_code == 403
    assert client.delete('/api/v1/team/p2').status_code == 403
    assert client.patch('/api/v1/org', json={'name': 'X', 'currency': 'NGN'}).status_code == 403
    assert connection.calls == []


def test_anyone_sees_the_team(api, connection):
    connection.on('from people', [{'id': 'p1', 'name': 'Ada'}])
    assert api('viewer').get('/api/v1/team').json() == [{'id': 'p1', 'name': 'Ada'}]


def test_an_unknown_role_is_refused(api):
    assert api('admin').post('/api/v1/team/invite', json={'email': 'a@example.com', 'role': 'owner'}).status_code == 422


def test_an_admin_invites(api, connection):
    answer = api('admin').post('/api/v1/team/invite', json={'email': 'bisi@example.com', 'role': 'qs'})
    assert answer.status_code == 200 and answer.json()['link'].startswith('/invite/')
