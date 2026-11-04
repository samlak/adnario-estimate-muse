"""Signing in (README §5): sign up makes a firm and its Admin, with Adnario Market Rates; a session is a random token in
a cookie, only its hash stored; failed sign-ins are limited; invitations are links (there is no email)."""

import secrets

import bcrypt
from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel, EmailStr, Field

from app.database import connection as db
from app.core.access import CurrentActor, new_session, token_hash
from app.core.constants import COOKIE, PERMISSIONS, SESSION_DAYS
from app.core.errors import NotFound
from app.core.config import env

router = APIRouter()
FAILURES = 5  # in ten minutes, per email


class SignIn(BaseModel):
    email: str
    password: str


class SignUp(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    company: str = Field(min_length=1, max_length=160)
    email: EmailStr
    password: str = Field(min_length=10, max_length=200)


class Join(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=10, max_length=200)


def hashed(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def matches(password: str, stored: str | None) -> bool:
    return bool(stored) and bcrypt.checkpw(password.encode(), stored.encode())


def _cookie(response: Response, token: str) -> None:
    response.set_cookie(COOKIE, token, max_age=SESSION_DAYS * 86400, httponly=True, samesite='lax', path='/')


@router.get('/auth/demo')
def demo_accounts():
    """The demo accounts, by firm, for the sign-in page; never in production."""
    if not env.DEMO:
        return []
    with db.system() as connection:
        rows = connection.execute(
            "select o.name as firm, p.name, p.email, p.role from people p join orgs o on o.id = p.org_id"
            " where p.email like '%%.adnario.app' and p.invite_token is null order by o.created_at, p.created_at"
        ).fetchall()
    firms: dict[str, list] = {}
    for row in rows:
        firms.setdefault(row['firm'], []).append({'name': row['name'], 'email': row['email'], 'role': row['role']})
    return [{'firm': firm, 'people': people} for firm, people in firms.items()]


@router.post('/auth/signin')
def sign_in(body: SignIn, response: Response):
    email = body.email.strip().lower()
    with db.system() as connection:
        failed = connection.execute(
            "select count(*) as n from sign_in_failures where email = %s and at > now() - interval '10 minutes'", [email]
        ).fetchone()['n']
        if failed >= FAILURES:
            raise HTTPException(429, 'Too many failed sign-ins. Wait ten minutes and try again.')
        person = connection.execute('select * from people where lower(email) = %s and invite_token is null', [email]).fetchone()
        if person is None or not matches(body.password, person['password_hash']):
            connection.execute('insert into sign_in_failures (email) values (%s)', [email])
            connection.commit()
            raise HTTPException(401, 'That email and password do not match.')
        connection.execute('delete from sign_in_failures where email = %s', [email])
        _cookie(response, new_session(connection, person))
    return {'ok': True}


@router.post('/auth/signup')
def sign_up(body: SignUp, response: Response):
    from app.features.ratecards import copy_library

    with db.system() as connection:
        if connection.execute('select 1 from people where lower(email) = %s', [body.email.lower()]).fetchone():
            raise HTTPException(409, 'That email already has an account.')
        org = connection.execute('insert into orgs (name) values (%s) returning id', [body.company.strip()]).fetchone()['id']
        person = connection.execute(
            "insert into people (org_id, name, email, role, password_hash) values (%s, %s, %s, 'admin', %s) returning *",
            [org, body.name.strip(), body.email.lower(), hashed(body.password)],
        ).fetchone()
        copy_library(connection, org)  # the firm starts with Adnario Market Rates
        _cookie(response, new_session(connection, person))
    return {'ok': True}


@router.post('/auth/signout')
def sign_out(response: Response, actor: CurrentActor):
    with db.system() as connection:
        connection.execute('delete from sessions where person_id = %s', [actor.person_id])
    response.delete_cookie(COOKIE, path='/')
    return {'ok': True}


@router.get('/me')
def me(actor: CurrentActor):
    with db.in_org(actor.org_id) as connection:
        person = connection.execute('select id, name, email, role from people where id = %s', [actor.person_id]).fetchone()
        firm = connection.execute('select id, name, currency from orgs where id = %s', [actor.org_id]).fetchone()
    return {'person': person, 'firm': firm, 'can': sorted(PERMISSIONS[actor.role])}


class Rename(BaseModel):
    name: str = Field(min_length=1, max_length=120)


@router.patch('/me')
def rename_me(body: Rename, actor: CurrentActor):
    with db.in_org(actor.org_id) as connection:
        connection.execute('update people set name = %s where id = %s', [body.name.strip(), actor.person_id])
    return {'ok': True}


@router.get('/invites/{token}')
def invitation(token: str):
    with db.system() as connection:
        found = connection.execute(
            'select p.email, p.role, o.name as firm, b.name as invited_by from people p join orgs o on o.id = p.org_id'
            ' left join people b on b.id = p.invited_by where p.invite_token = %s',
            [token_hash(token)],
        ).fetchone()
    if found is None:
        raise NotFound('This invitation is no longer valid.')
    return found


@router.post('/invites/{token}')
def accept(token: str, body: Join, response: Response):
    with db.system() as connection:
        person = connection.execute(
            'update people set name = %s, password_hash = %s, invite_token = null where invite_token = %s returning *',
            [body.name.strip(), hashed(body.password), token_hash(token)],
        ).fetchone()
        if person is None:
            raise NotFound('This invitation is no longer valid.')
        _cookie(response, new_session(connection, person))
    return {'ok': True}


def invite_token() -> tuple[str, str]:
    token = secrets.token_urlsafe(24)
    return token, token_hash(token)
