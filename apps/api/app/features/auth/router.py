"""Signing in: sign up makes a firm and its Admin, with Adnario Market Rates; a session is a random token in
a cookie, only its hash stored; failed sign-ins are limited; invitations are links (there is no email)."""

from fastapi import APIRouter, Response

from app.core.access import CurrentActor
from app.core.config import env
from app.core.constants import COOKIE, SESSION_DAYS
from app.database import connection as db
from app.features.auth import service
from app.features.auth.schemas import Join, Rename, SignIn, SignUp

router = APIRouter()


def set_cookie(response: Response, token: str) -> None:
    response.set_cookie(COOKIE, token, max_age=SESSION_DAYS * 86400, httponly=True, samesite='lax', path='/')


@router.get('/auth/demo')
def demo_accounts():
    """The demo accounts, by firm, for the sign-in page; never in production."""
    if not env.DEMO:
        return []
    with db.system() as connection:
        return service.demo_accounts(connection)


@router.post('/auth/signin')
def sign_in(body: SignIn, response: Response):
    with db.system() as connection:
        set_cookie(response, service.sign_in(connection, body))
    return {'ok': True}


@router.post('/auth/signup')
def sign_up(body: SignUp, response: Response):
    with db.system() as connection:
        set_cookie(response, service.sign_up(connection, body))
    return {'ok': True}


@router.post('/auth/signout')
def sign_out(response: Response, actor: CurrentActor):
    with db.system() as connection:
        service.sign_out(connection, actor)
    response.delete_cookie(COOKIE, path='/')
    return {'ok': True}


@router.get('/me')
def me(actor: CurrentActor):
    with db.in_org(actor.org_id) as connection:
        return service.me(connection, actor)


@router.patch('/me')
def rename_me(body: Rename, actor: CurrentActor):
    with db.in_org(actor.org_id) as connection:
        service.rename(connection, actor, body.name)
    return {'ok': True}


@router.get('/invites/{token}')
def invitation(token: str):
    with db.system() as connection:
        return service.invitation(connection, token)


@router.post('/invites/{token}')
def accept(token: str, body: Join, response: Response):
    with db.system() as connection:
        set_cookie(response, service.accept(connection, token, body))
    return {'ok': True}
