"""Passwords hashed and checked, invitation tokens kept only as their hash, demo accounts grouped by firm."""

from app.core.access import token_hash
from app.features.auth.utils import by_firm, hashed, invite_token, matches


def test_a_password_is_hashed_and_checked():
    stored = hashed('correct-horse-1')
    assert stored != 'correct-horse-1' and matches('correct-horse-1', stored)
    assert not matches('wrong-password', stored)
    assert not matches('correct-horse-1', None)  # an invited person has no password yet


def test_an_invitation_keeps_only_the_hash():
    token, stored = invite_token()
    assert stored == token_hash(token) and stored != token
    assert invite_token()[0] != token


def test_demo_accounts_are_grouped_by_firm_in_order():
    rows = [
        {'firm': 'Demo', 'name': 'Ada', 'email': 'a@x', 'role': 'admin'},
        {'firm': 'North', 'name': 'Kemi', 'email': 'k@x', 'role': 'admin'},
        {'firm': 'Demo', 'name': 'Tunde', 'email': 't@x', 'role': 'qs'},
    ]
    assert [(f['firm'], [p['name'] for p in f['people']]) for f in by_firm(rows)] == [('Demo', ['Ada', 'Tunde']), ('North', ['Kemi'])]
