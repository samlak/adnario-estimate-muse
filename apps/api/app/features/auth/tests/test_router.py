"""The auth routes: the session cookie, the checks on what is sent, and no demo accounts outside the demo."""

from app.core.constants import COOKIE
from app.features.auth.utils import hashed


def test_signing_in_sets_the_session_cookie(api, connection):
    connection.on('sign_in_failures where email', {'n': 0}).on('from people', {'id': 'p1', 'org_id': 'o1', 'password_hash': hashed('correct-horse-1')})
    answer = api(None).post('/api/v1/auth/signin', json={'email': 'ada@example.com', 'password': 'correct-horse-1'})
    assert answer.status_code == 200 and COOKIE in answer.cookies
    assert 'httponly' in answer.headers['set-cookie'].lower()


def test_a_short_password_or_bad_email_is_refused_before_anything_is_written(api, connection):
    client = api(None)
    assert client.post('/api/v1/auth/signup', json={'name': 'A', 'company': 'B', 'email': 'a@example.com', 'password': 'short'}).status_code == 422
    assert client.post('/api/v1/auth/signup', json={'name': 'A', 'company': 'B', 'email': 'not-an-email', 'password': 'correct-horse-1'}).status_code == 422
    assert connection.calls == []


def test_signing_out_ends_the_sessions_and_the_cookie(api, connection):
    answer = api('qs').post('/api/v1/auth/signout')
    assert answer.status_code == 200 and connection.ran('delete from sessions')
    assert 'max-age=0' in answer.headers['set-cookie'].lower() or 'expires' in answer.headers['set-cookie'].lower()


def test_no_demo_accounts_outside_the_demo(api, connection):
    assert api(None).get('/api/v1/auth/demo').json() == [] and connection.calls == []


def test_me_needs_a_session(api):
    assert api(None).get('/api/v1/me').status_code == 401
