"""A new version compared element by element by GlobalId."""

from app.features.models import versions


def element(name, **changes):
    return {'name': name, 'class': 'IfcWall', 'type': 'W1', 'quantity': {}, 'position': [0, 0, 0], 'material': [], 'properties': 'h', **changes}


def test_added_removed_and_changed_by_global_id(monkeypatch):
    old = {'a': element('A'), 'b': element('B'), 'c': element('C')}
    new = {'a': element('A'), 'b': element('B', position=[1, 0, 0], material=['Brick']), 'd': element('D')}
    monkeypatch.setattr(versions, 'fingerprints', lambda model: old if model == 'old' else new)
    found = versions.diff('old', 'new')
    assert [e['gid'] for e in found['added']] == ['d']
    assert [e['gid'] for e in found['removed']] == ['c']
    assert found['changed'] == [{'gid': 'b', 'name': 'B', 'class': 'IfcWall', 'changed': ['position', 'material']}]
