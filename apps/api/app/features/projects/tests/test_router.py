import pytest

PROJECT = '/api/v1/projects/00000000-0000-0000-0000-000000000009'


def test_a_viewer_cannot_make_or_delete_a_project(api, connection):
    client = api('viewer')
    assert client.post('/api/v1/projects', json={'name': 'Nope'}).status_code == 403
    assert client.delete(PROJECT).status_code == 403
    assert connection.calls == []


@pytest.mark.parametrize('role', ['contributor', 'viewer'])
def test_only_a_qs_or_admin_manages_who_is_on_a_project(api, role):
    body = {'person_id': '00000000-0000-0000-0000-000000000002', 'access': 'view'}
    assert api(role).post(f'{PROJECT}/members', json=body).status_code == 403


def test_a_project_needs_a_name(api):
    assert api('qs').post('/api/v1/projects', json={'name': ''}).status_code == 422


def test_the_list_and_a_new_project(api, connection):
    connection.on('from projects p\n', [{'id': 'p1', 'name': 'Lekki', 'revision': 0}]).on('insert into projects', {'id': 'p2', 'name': 'Ikeja'})
    client = api('qs')
    assert client.get('/api/v1/projects').json()[0]['takeoff'] == 'Takeoff 1'
    assert client.post('/api/v1/projects', json={'name': 'Ikeja'}).json() == {'id': 'p2', 'name': 'Ikeja'}
