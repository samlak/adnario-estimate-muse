import secrets

import bcrypt

from app.core.access import token_hash


def hashed(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def matches(password: str, stored: str | None) -> bool:
    return bool(stored) and bcrypt.checkpw(password.encode(), stored.encode())


def invite_token() -> tuple[str, str]:
    """A new invitation link's token, and the hash that is all the database keeps."""
    token = secrets.token_urlsafe(24)
    return token, token_hash(token)


def by_firm(rows: list[dict]) -> list[dict]:
    """The demo accounts grouped by firm, in the order given."""
    firms: dict[str, list] = {}
    for row in rows:
        firms.setdefault(row['firm'], []).append({'name': row['name'], 'email': row['email'], 'role': row['role']})
    return [{'firm': firm, 'people': people} for firm, people in firms.items()]
