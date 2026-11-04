import pytest


@pytest.mark.parametrize('role', ['contributor', 'viewer'])
def test_only_a_qs_or_admin_sees_the_rate_card(api, connection, role):
    assert api(role).get('/api/v1/ratecards').status_code == 403 and connection.calls == []


def test_a_negative_price_is_refused(api):
    assert api('qs').patch('/api/v1/raterows/00000000-0000-0000-0000-000000000009', json={'price': -5}).status_code == 422


def test_a_qs_adds_a_price(api, connection):
    connection.on('insert into rate_rows', {'id': 'r9'})
    body = {'kind': 'MATERIAL', 'name': 'Granite (t)', 'unit': 't', 'price': 42000}
    assert api('qs').post('/api/v1/ratecards/00000000-0000-0000-0000-000000000009/rows', json=body).json() == {'id': 'r9'}
