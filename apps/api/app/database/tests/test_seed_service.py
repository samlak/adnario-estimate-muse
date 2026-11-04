"""The demo seed: run once into an empty database; after that it only tops up the rate cards."""

from contextlib import contextmanager
from pathlib import Path

from app.database.seed import service
from app.database.seed.constants import FINISHED, PEOPLE, PROJECTS
from app.testing.fakes import FakeConnection


def run_seed(monkeypatch, connection):
    @contextmanager
    def system():
        yield connection

    monkeypatch.setattr(service.db, 'system', system)
    monkeypatch.setattr(Path, 'read_bytes', lambda self: b'ISO-10303-21;')  # the models are downloaded, not needed here
    monkeypatch.setattr(service, 'add_model', lambda c, org, project, name, data, person: {'id': f'model-{name}'})
    return service.seed()


def test_a_database_with_data_is_only_topped_up(monkeypatch):
    connection = FakeConnection().on('select 1 from orgs', {'?column?': 1}).on('from rate_cards where name', [])
    assert run_seed(monkeypatch, connection) == []
    assert not connection.ran('insert into orgs')


def test_an_empty_database_gets_the_demo(monkeypatch):
    connection = FakeConnection().on('returning id', {'id': 'x'}).on('from rate_rows', [])
    monkeypatch.setattr(service, 'copy_library', lambda c, org: 'card')
    monkeypatch.setattr(service, 'placed', lambda result, models, card, rows: result)
    work = run_seed(monkeypatch, connection)
    assert len(work) == len(PROJECTS)
    finished = connection.ran("values (%s, %s, 'ready', %s, %s)")
    assert len(finished) == len(FINISHED)  # the rest are left to run, with no AI at seed time
    emails = {params[2] for params in connection.ran('insert into people (org_id, name, email, role, password_hash) values (%s, %s, %s, %s, %s)')}
    assert emails == {email for _, email, _ in PEOPLE}
    assert connection.ran("'Northbridge Cost Consultants'")  # the second firm, which never sees the first's data
