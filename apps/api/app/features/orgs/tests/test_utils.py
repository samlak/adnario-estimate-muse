"""A firm always keeps an Admin; invitation links point at the web app's page."""

from app.features.orgs.utils import leaves_no_admin, link

ADMIN = {'role': 'admin', 'invite_token': None}


def test_the_last_admin_cannot_go():
    assert leaves_no_admin(ADMIN, 'qs', admins=1)
    assert leaves_no_admin(ADMIN, None, admins=1)  # removed


def test_another_admin_or_staying_admin_is_fine():
    assert not leaves_no_admin(ADMIN, 'qs', admins=2)
    assert not leaves_no_admin(ADMIN, 'admin', admins=1)
    assert not leaves_no_admin({'role': 'qs', 'invite_token': None}, 'viewer', admins=1)
    assert not leaves_no_admin({'role': 'admin', 'invite_token': 'x'}, None, admins=1)  # an invited admin never counted


def test_invitation_link():
    assert link('abc') == {'link': '/invite/abc'}
