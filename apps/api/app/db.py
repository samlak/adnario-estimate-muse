"""PostgreSQL. Every query runs inside a firm's row-level security (`in_org`); only sign-in, invitations and the seed
run as the server itself (`system`)."""

import json
import uuid
from contextlib import contextmanager
from pathlib import Path

from psycopg import Connection
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb, set_json_dumps
from psycopg_pool import ConnectionPool

from app.config import env

set_json_dumps(lambda value: json.dumps(value, default=str))
pool = ConnectionPool(env.DATABASE_URL, min_size=1, max_size=12, open=False, kwargs={'row_factory': dict_row, 'autocommit': False})

__all__ = ['Connection', 'Jsonb', 'in_org', 'system', 'migrate', 'new_id', 'pool']


def new_id() -> uuid.UUID:
    return uuid.uuid4()


@contextmanager
def _scoped(org: str):
    with pool.connection() as connection:
        connection.execute('set local role adnario_app')
        connection.execute("select set_config('app.org', %s, true)", [org])
        yield connection


def in_org(org_id) -> 'contextmanager[Connection]':
    return _scoped(str(org_id))


def system():
    return _scoped('*')


def migrate() -> None:
    pool.open(wait=True, timeout=60)
    with pool.connection() as connection:  # as the owner: the schema, the policies and the app's role
        connection.execute((Path(__file__).parent / 'schema.sql').read_text())
