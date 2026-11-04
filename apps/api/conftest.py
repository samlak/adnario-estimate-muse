"""Unit test fixtures: no database and no AI. A route test calls the real app as someone with a given role, and every
query the app makes is answered by a fake connection the test scripts."""

import os
from contextlib import contextmanager

import pytest

os.environ['DEMO'] = '0'

from app.testing.fakes import FakeConnection, actor  # noqa: E402


@pytest.fixture
def connection():
    return FakeConnection()


@pytest.fixture
def api(connection, monkeypatch):
    """api('viewer') is a client acting as a Viewer; api(None) is someone not signed in."""
    from fastapi.testclient import TestClient

    from app.core.access import current
    from app.database import connection as db
    from app.main import app

    @contextmanager
    def fake(*_):
        yield connection

    monkeypatch.setattr(db, 'in_org', fake)
    monkeypatch.setattr(db, 'system', fake)

    def as_role(role: str | None = 'qs'):
        app.dependency_overrides.pop(current, None)
        if role:
            app.dependency_overrides[current] = lambda: actor(role)
        return TestClient(app)  # not as a context manager: the app's startup (database, seed) is not run

    yield as_role
    app.dependency_overrides.clear()
