def test_notifications_need_a_session(api):
    assert api(None).get('/api/v1/notifications').status_code == 401


def test_a_person_sees_their_notifications(api, connection):
    connection.on('from notifications', [{'id': 'n1', 'title': 'Hi'}])
    assert api('viewer').get('/api/v1/notifications').json() == [{'id': 'n1', 'title': 'Hi'}]
