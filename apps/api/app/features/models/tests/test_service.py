"""Model versions: the first is current, the next proposed with its diff; only a proposed version is decided, and the
uploader is told."""

import pytest
from fastapi import HTTPException

from app.features.models import service
from app.features.models.schemas import Decision
from app.testing.fakes import PERSON, actor

PROJECT = {'id': 'proj', 'access': 'edit'}


def model(**extra):
    return {'id': 'm2', 'org_id': 'o', 'project_id': 'proj', 'name': 'Office_ARC.ifc', 'version': 2, 'state': 'proposed', 'uploaded_by': 'p9', **extra}


def test_the_first_upload_is_current_the_next_proposed_with_its_diff(connection, monkeypatch, tmp_path):
    monkeypatch.setattr(service, 'ifc_path', lambda m: tmp_path / f'{m["id"]}.ifc')
    monkeypatch.setattr(service, 'diff', lambda old, new: {'added': [], 'removed': [], 'changed': []})
    connection.on('coalesce(max(version)', {'v': 0}).on('insert into models', lambda params: {'id': 'm1', 'state': params[4], 'version': params[3]})
    first = service.add_model(connection, 'o', 'proj', 'Office_ARC.ifc', b'ISO', PERSON)
    assert (first['state'], first['version']) == ('current', 1) and not connection.ran('set diff')
    connection.rules.insert(0, ("state = 'current'", {'id': 'm1'}))
    connection.rules.insert(0, ('coalesce(max(version)', {'v': 1}))
    second = service.add_model(connection, 'o', 'proj', 'Office_ARC.ifc', b'ISO', PERSON)
    assert (second['state'], second['version']) == ('proposed', 2) and connection.ran('set diff')


def test_only_a_proposed_version_is_decided(connection):
    connection.on('from models where id', model(state='current')).on('from projects p left join members', PROJECT)
    with pytest.raises(HTTPException) as refused:
        service.decide(connection, actor(), 'm2', Decision(accept=True))
    assert refused.value.status_code == 409


def test_accepting_supersedes_the_current_and_tells_the_uploader(connection):
    connection.on('from models where id', model()).on('from projects p left join members', PROJECT)
    service.decide(connection, actor(), 'm2', Decision(accept=True))
    assert connection.ran("state = 'superseded'") and connection.ran("set state = 'current'")
    assert connection.ran('insert into notifications')[0][3] == 'Office_ARC.ifc v2 accepted'


def test_rejecting_keeps_the_reason(connection):
    connection.on('from models where id', model()).on('from projects p left join members', PROJECT)
    service.decide(connection, actor(), 'm2', Decision(accept=False, reason='Wrong storey heights'))
    assert connection.ran("state = 'rejected'") == [['Wrong storey heights', 'm2']]
    assert connection.ran('insert into notifications')[0][3] == 'Office_ARC.ifc v2 rejected: Wrong storey heights'
