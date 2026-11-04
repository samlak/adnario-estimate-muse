"""IFC → XKT on the converter: the XKT kept and the model ready, or the model failed with why."""

from contextlib import contextmanager

import httpx

from app.features.models import convert
from app.testing.fakes import FakeConnection


def setup(monkeypatch, tmp_path, answer):
    connection = FakeConnection().on('select * from models', {'id': 'm1', 'org_id': 'o', 'project_id': 'p'})
    (tmp_path / 'm1.ifc').write_bytes(b'ISO-10303-21;')

    @contextmanager
    def in_org(_):
        yield connection

    monkeypatch.setattr(convert.db, 'in_org', in_org)
    monkeypatch.setattr(convert, 'ifc_path', lambda model: tmp_path / 'm1.ifc')
    monkeypatch.setattr(convert, 'element_stats', lambda model: {'elements': 3})
    monkeypatch.setattr(convert.httpx, 'post', answer)
    return connection


def test_a_converted_model_is_ready(monkeypatch, tmp_path):
    connection = setup(monkeypatch, tmp_path, lambda *a, **k: httpx.Response(200, content=b'XKT', headers={'X-Seconds': '2.5'}))
    convert.convert('o', 'm1')
    assert (tmp_path / 'm1.xkt').read_bytes() == b'XKT'
    status, note, seconds, stats, _ = connection.ran('update models set status')[0]
    assert (status, note, seconds, stats.obj) == ('ready', None, 2.5, {'elements': 3})


def test_a_converter_that_is_down_fails_the_model_with_why(monkeypatch, tmp_path):
    def down(*_a, **_k):
        raise httpx.ConnectError('refused')

    connection = setup(monkeypatch, tmp_path, down)
    convert.convert('o', 'm1')
    status, note = connection.ran('update models set status')[0][:2]
    assert status == 'failed' and note.startswith('Could not convert: refused')
