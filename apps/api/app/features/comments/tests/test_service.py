"""Comments: money comments hidden from Contributors, an @mention notifies and adds the person, attachments limited."""

import pytest
from fastapi import HTTPException

from app.core.errors import NotFound
from app.features.comments import service
from app.features.comments.constants import ATTACHMENT_LIMIT
from app.testing.fakes import actor

PROJECT = {'id': 'proj', 'name': 'Lekki Office Block', 'access': 'edit'}


def on_project(connection):
    return connection.on('from projects p left join members', PROJECT)


def test_a_contributor_does_not_see_comments_on_boq_lines(connection):
    on_project(connection)
    service.comments(connection, actor('contributor'), 'proj')
    service.comments(connection, actor('qs'), 'proj')
    contributor, qs = [sql for sql, _ in connection.calls if 'from comments' in sql]
    assert "not in ('boq', 'question')" in contributor and 'not in' not in qs


def test_a_mention_notifies_and_adds_to_the_project(connection):
    on_project(connection).on('insert into comments', {'id': 'c1'}).on('from people where invite_token', [{'id': 'p2', 'name': 'Chidi Eze'}, {'id': 'p3', 'name': 'Ngozi'}])
    row = service.add(connection, actor(), 'proj', '@Chidi Eze please confirm', ('project', None, 'An estimate'), None)
    assert row == {'id': 'c1'}
    assert [params[2] for params in connection.ran('insert into members')] == ['p2']
    assert connection.ran('insert into notifications')[0][1] == 'p2'


def test_an_attachment_over_the_limit_is_refused(tmp_path, monkeypatch):
    monkeypatch.setattr(service, 'folder', lambda *_: tmp_path)
    with pytest.raises(HTTPException) as refused:
        service.store(actor(), 'proj', 'big.pdf', b'x' * (ATTACHMENT_LIMIT + 1))
    assert refused.value.status_code == 413
    kept = service.store(actor(), 'proj', 'note (1).txt', b'hello')
    assert kept['name'] == 'note (1).txt' and kept['size'] == 5 and (tmp_path / kept['path']).read_bytes() == b'hello'


def test_only_your_own_comment_is_deleted(connection):
    with pytest.raises(NotFound):
        service.delete(connection, actor(), 'c1')
