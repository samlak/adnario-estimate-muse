from fastapi import HTTPException

from app.core.access import Actor, new_session, token_hash
from app.core.constants import PERMISSIONS
from app.core.errors import NotFound
from app.database.connection import Connection
from app.features.auth.constants import DEMO_DOMAIN, FAILURE_WINDOW, FAILURES
from app.features.auth.schemas import Join, SignIn, SignUp
from app.features.auth.utils import by_firm, hashed, matches
from app.features.rate_cards.library import copy_library


def demo_accounts(connection: Connection) -> list[dict]:
    rows = connection.execute(
        'select o.name as firm, p.name, p.email, p.role from people p join orgs o on o.id = p.org_id'
        ' where p.email like %s and p.invite_token is null order by o.created_at, p.created_at',
        [f'%{DEMO_DOMAIN}'],
    ).fetchall()
    return by_firm(rows)


def sign_in(connection: Connection, body: SignIn) -> str:
    """A new session's token; a wrong password is counted, and too many in a row lock the email for a while."""
    email = body.email.strip().lower()
    failed = connection.execute(
        f"select count(*) as n from sign_in_failures where email = %s and at > now() - interval '{FAILURE_WINDOW}'", [email]
    ).fetchone()['n']
    if failed >= FAILURES:
        raise HTTPException(429, 'Too many failed sign-ins. Wait ten minutes and try again.')
    person = connection.execute('select * from people where lower(email) = %s and invite_token is null', [email]).fetchone()
    if person is None or not matches(body.password, person['password_hash']):
        connection.execute('insert into sign_in_failures (email) values (%s)', [email])
        connection.commit()
        raise HTTPException(401, 'That email and password do not match.')
    connection.execute('delete from sign_in_failures where email = %s', [email])
    return new_session(connection, person)


def sign_up(connection: Connection, body: SignUp) -> str:
    """A new firm with its Admin, starting with Adnario Market Rates; a session token for them."""
    if connection.execute('select 1 from people where lower(email) = %s', [body.email.lower()]).fetchone():
        raise HTTPException(409, 'That email already has an account.')
    org = connection.execute('insert into orgs (name) values (%s) returning id', [body.company.strip()]).fetchone()['id']
    person = connection.execute(
        "insert into people (org_id, name, email, role, password_hash) values (%s, %s, %s, 'admin', %s) returning *",
        [org, body.name.strip(), body.email.lower(), hashed(body.password)],
    ).fetchone()
    copy_library(connection, org)
    return new_session(connection, person)


def sign_out(connection: Connection, actor: Actor) -> None:
    connection.execute('delete from sessions where person_id = %s', [actor.person_id])


def me(connection: Connection, actor: Actor) -> dict:
    person = connection.execute('select id, name, email, role from people where id = %s', [actor.person_id]).fetchone()
    firm = connection.execute('select id, name, currency from orgs where id = %s', [actor.org_id]).fetchone()
    return {'person': person, 'firm': firm, 'can': sorted(PERMISSIONS[actor.role])}


def rename(connection: Connection, actor: Actor, name: str) -> None:
    connection.execute('update people set name = %s where id = %s', [name.strip(), actor.person_id])


def invitation(connection: Connection, token: str) -> dict:
    found = connection.execute(
        'select p.email, p.role, o.name as firm, b.name as invited_by from people p join orgs o on o.id = p.org_id'
        ' left join people b on b.id = p.invited_by where p.invite_token = %s',
        [token_hash(token)],
    ).fetchone()
    if found is None:
        raise NotFound('This invitation is no longer valid.')
    return found


def accept(connection: Connection, token: str, body: Join) -> str:
    """The invited person sets their name and password; the link stops working; a session token for them."""
    person = connection.execute(
        'update people set name = %s, password_hash = %s, invite_token = null where invite_token = %s returning *',
        [body.name.strip(), hashed(body.password), token_hash(token)],
    ).fetchone()
    if person is None:
        raise NotFound('This invitation is no longer valid.')
    return new_session(connection, person)
