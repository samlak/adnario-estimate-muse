"""Fixtures for the route tests. They run against a database of their own, adnario_test, on the same Postgres as
development (npm run dev starts it), so the dev data is never touched; without Postgres they are skipped."""

import os
import uuid

import psycopg
import pytest

BASE = os.environ.get('DATABASE_URL', 'postgresql://adnario:adnario@localhost:55622/adnario')
os.environ['DATABASE_URL'] = BASE.rsplit('/', 1)[0] + '/adnario_test'  # before app.config reads it
os.environ['DEMO'] = '0'


def _make_test_database() -> bool:
    try:
        with psycopg.connect(BASE, connect_timeout=2, autocommit=True) as connection:
            if not connection.execute("select 1 from pg_database where datname = 'adnario_test'").fetchone():
                connection.execute('create database adnario_test')
        return True
    except psycopg.OperationalError:
        return False


@pytest.fixture(scope='session')
def database():
    if not _make_test_database():
        pytest.skip('Postgres is not running (npm run dev starts it)')
    from app import db

    db.migrate()
    yield
    db.pool.close()


@pytest.fixture
def client(database):
    """A browser for the API: it keeps the session cookie between requests."""
    from fastapi.testclient import TestClient

    from app.main import app

    return TestClient(app)  # not as a context manager: the app's startup (migrate, seed, live updates) is not run


@pytest.fixture
def email():
    return f'test-{uuid.uuid4().hex[:10]}@example.com'


@pytest.fixture
def sign_up(client):
    """Makes a new firm with its Admin and signs the client in as them."""

    def make(email, company='Test Firm'):
        answer = client.post('/api/v1/auth/signup', json={'name': 'Ada Obi', 'company': company, 'email': email, 'password': 'correct-horse-1'})
        assert answer.status_code == 200, answer.text
        return answer

    return make
