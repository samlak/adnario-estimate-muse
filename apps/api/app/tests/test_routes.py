"""The API end to end on a real database (no AI): signing up and in, the sign-in limit, projects, invitations, and the
server refusing what a role does not allow."""

from app.features.auth import FAILURES, hashed, matches
from app.features.projects import revision_name

PASSWORD = 'correct-horse-1'


def test_passwords_are_hashed_and_checked():
    stored = hashed(PASSWORD)
    assert stored != PASSWORD and matches(PASSWORD, stored)
    assert not matches('wrong-password', stored) and not matches(PASSWORD, None)


def test_revision_names():
    assert [revision_name(n) for n in (0, 1, 2)] == ['Takeoff 1', 'Rev A', 'Rev B']


def test_sign_up_makes_a_firm_with_its_admin_and_a_rate_card(client, email, sign_up):
    sign_up(email, company='Obi & Partners')
    me = client.get('/api/v1/me').json()
    assert me['person']['email'] == email and me['person']['role'] == 'admin' and me['firm']['name'] == 'Obi & Partners'
    assert 'manage_org' in me['can']
    assert client.get('/api/v1/ratecards').json()['rows']  # Adnario Market Rates copied in


def test_an_email_signs_up_once(client, email, sign_up):
    sign_up(email)
    again = client.post('/api/v1/auth/signup', json={'name': 'A', 'company': 'B', 'email': email, 'password': PASSWORD})
    assert again.status_code == 409


def test_signing_in_and_out(client, email, sign_up):
    sign_up(email)
    client.post('/api/v1/auth/signout')
    assert client.get('/api/v1/me').status_code == 401
    assert client.post('/api/v1/auth/signin', json={'email': email.upper(), 'password': PASSWORD}).status_code == 200
    assert client.get('/api/v1/me').status_code == 200


def test_failed_sign_ins_are_limited(client, email, sign_up):
    sign_up(email)
    client.post('/api/v1/auth/signout')
    for _ in range(FAILURES):
        assert client.post('/api/v1/auth/signin', json={'email': email, 'password': 'wrong-password'}).status_code == 401
    assert client.post('/api/v1/auth/signin', json={'email': email, 'password': PASSWORD}).status_code == 429


def test_projects_are_made_and_listed(client, email, sign_up):
    sign_up(email)
    made = client.post('/api/v1/projects', json={'name': '  Lekki Office ', 'client': 'Acme'}).json()
    assert made['name'] == 'Lekki Office'
    assert [p['name'] for p in client.get('/api/v1/projects').json()] == ['Lekki Office']
    assert client.get(f'/api/v1/projects/{made["id"]}').json()['editor'] is True


def test_one_firm_never_sees_anothers_project(client, email, sign_up):
    sign_up(email)
    theirs = client.post('/api/v1/projects', json={'name': 'Secret'}).json()
    sign_up('other-' + email)
    assert client.get('/api/v1/projects').json() == []
    assert client.get(f'/api/v1/projects/{theirs["id"]}').status_code == 404


def test_an_invited_viewer_joins_and_is_kept_to_their_role(client, email, sign_up):
    sign_up(email)
    link = client.post('/api/v1/team/invite', json={'email': 'viewer-' + email, 'role': 'viewer'}).json()['link']
    token = link.rsplit('/', 1)[1]
    assert client.get(f'/api/v1/invites/{token}').json()['role'] == 'viewer'
    assert client.post(f'/api/v1/invites/{token}', json={'name': 'Vi Ewer', 'password': PASSWORD}).status_code == 200
    assert client.get('/api/v1/me').json()['person']['role'] == 'viewer'
    assert client.post('/api/v1/projects', json={'name': 'Nope'}).status_code == 403
    assert client.post('/api/v1/team/invite', json={'email': 'x-' + email, 'role': 'admin'}).status_code == 403
    assert client.get(f'/api/v1/invites/{token}').status_code == 404  # a link works once
