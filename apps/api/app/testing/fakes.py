"""Stand-ins for unit tests, so nothing needs a database: a connection that answers each query from rules, and the
people a test acts as."""

import uuid

from app.core.access import Actor

ORG = uuid.UUID('00000000-0000-0000-0000-00000000000a')
PERSON = uuid.UUID('00000000-0000-0000-0000-000000000001')


def actor(role: str = 'qs', person_id=PERSON) -> Actor:
    return Actor(person_id=person_id, org_id=ORG, name='Tunde Bello', role=role)


class Result:
    def __init__(self, rows):
        self.rows = rows if isinstance(rows, list) else ([] if rows is None else [rows])

    def fetchone(self):
        return self.rows[0] if self.rows else None

    def fetchall(self):
        return self.rows

    def __iter__(self):
        return iter(self.rows)


class Cursor:
    def __init__(self, connection):
        self.connection = connection

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def executemany(self, sql, rows):
        self.connection.calls.append((sql, rows))


class FakeConnection:
    """Each query is answered by the first rule whose text is in its SQL (rows, one row, or a function of the params);
    a query no rule matches answers nothing. Every query is kept, to check what was written."""

    def __init__(self):
        self.rules: list[tuple[str, object]] = []
        self.calls: list[tuple[str, object]] = []
        self.committed = False

    def on(self, text: str, rows) -> 'FakeConnection':
        self.rules.append((text, rows))
        return self

    def execute(self, sql, params=None):
        self.calls.append((sql, params))
        for text, rows in self.rules:
            if text in sql:
                return Result(rows(params) if callable(rows) else rows)
        return Result([])

    def cursor(self):
        return Cursor(self)

    def commit(self):
        self.committed = True

    def ran(self, text: str) -> list:
        """The params of every query whose SQL has this text."""
        return [params for sql, params in self.calls if text in sql]


def estimate_fixture() -> dict:
    """A real finished estimate (the demo's Ikoyi Duplex: result and programme), for tests that need realistic data."""
    import json
    from pathlib import Path

    return json.loads((Path(__file__).parent / 'data' / 'ikoyi_duplex.json').read_text())
