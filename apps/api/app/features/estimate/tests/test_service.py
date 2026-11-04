"""The estimate as each role sees it, project documents, a new revision, edits with undo and redo, and exports."""

import pytest
from fastapi import HTTPException

from app.features.estimate import service
from app.features.estimate.schemas import Edit
from app.testing.fakes import actor

RESULT = {
    'pricing': {'prelims': 5, 'contingency': 5, 'vat': 7.5, 'sources': {'G001': 'CON-01'}},
    'boq': [{'code': 'G001', 'bill': 'B', 'section': 'Walls', 'description': 'Blockwork', 'unit': 'm²', 'qty': 10.0, 'rate': 5000,
             'rate_item_id': None, 'rate_note': None, 'source': 'group', 'position': 0}],
    'takeoff_lines': [{'code': 'L001', 'qty': 10.0}], 'types': [], 'takeoff': [],
}


def estimate(**extra):
    return {'id': 'e1', 'project_id': 'proj', 'revision': 0, 'status': 'ready', 'info': {}, 'updated_at': None,
            'history': {}, 'programme': None, 'result': {**RESULT, 'boq': [dict(line) for line in RESULT['boq']]}, **extra}


def test_a_qs_sees_the_money_and_where_the_rates_came_from():
    seen = service.as_seen(actor('qs'), estimate())
    assert seen['name'] == 'Takeoff 1' and seen['result']['boq'][0]['rate'] == 5000
    assert seen['result']['totals']['measured'] == 50000 and seen['result']['refs'] == {'G001': 'B1A'}
    assert seen['result']['pricing']['sources'] == {'G001': 'CON-01'}


def test_a_contributor_sees_no_money_or_quantities():
    seen = service.as_seen(actor('contributor'), estimate())['result']
    assert seen['boq'][0]['rate'] is None and seen['boq'][0]['qty'] is None
    assert seen['takeoff_lines'][0]['qty'] is None and seen['totals'] is None and seen['pricing'] == {}


def test_a_viewer_sees_the_money_but_not_the_rate_card_behind_it():
    seen = service.as_seen(actor('viewer'), estimate())['result']
    assert seen['boq'][0]['rate'] == 5000 and seen['pricing']['sources'] == {}


def test_documents_are_added_to_the_project_information(connection):
    connection.on('from estimates where id', estimate(info={'text': 'Brief', 'documents': ['a.pdf']})).on('from projects p left join members', {'id': 'proj', 'access': 'edit'})
    names = service.add_documents(connection, actor(), 'e1', ['── b.docx ──\nSpec'], ['b.docx'])
    assert names == ['a.pdf', 'b.docx']
    assert connection.ran('update estimates set info')[0][0].obj['text'] == 'Brief\n\n── b.docx ──\nSpec'


def test_a_new_revision_needs_a_finished_takeoff(connection):
    connection.on('from projects p left join members', {'id': 'proj', 'access': 'edit'}).on('from estimates where project_id', estimate(status='running'))
    with pytest.raises(HTTPException) as refused:
        service.new_revision(connection, actor(), 'proj')
    assert refused.value.status_code == 409


def test_view_access_cannot_edit(connection):
    connection.on('from estimates where id', estimate()).on('from projects p left join members', {'id': 'proj', 'access': 'view'})
    with pytest.raises(HTTPException) as refused:
        service.edit(connection, actor(), 'e1', Edit(op='percent', name='vat', value=10))
    assert refused.value.status_code == 403


def test_an_edit_is_a_step_of_undo_and_clears_redo(connection):
    connection.on('from estimates where id', estimate(history={'undo': [], 'redo': ['x']})).on('from projects p left join members', {'id': 'proj', 'access': 'edit'})
    seen = service.edit(connection, actor(), 'e1', Edit(op='percent', name='vat', value=10))
    assert (seen['undo'], seen['redo']) == (1, 0) and seen['result']['pricing']['vat'] == 10


def test_nothing_to_undo(connection):
    connection.on('from estimates where id', estimate()).on('from projects p left join members', {'id': 'proj', 'access': 'edit'})
    with pytest.raises(HTTPException) as refused:
        service.undo(connection, actor(), 'e1', 'undo')
    assert refused.value.status_code == 409


def test_exports_wait_for_the_boq_and_the_programme(connection):
    connection.on('from estimates where id', estimate(result={**RESULT, 'boq': []})).on('from projects p left join members', {'id': 'proj', 'name': 'Lekki', 'access': 'edit'}).on('from orgs', {'name': 'Demo'})
    with pytest.raises(HTTPException) as refused:
        service.export(connection, actor(), 'e1', 'boq.xlsx')
    assert refused.value.detail == 'Generate the BOQ first'
    connection.rules.insert(0, ('from estimates where id', estimate()))
    with pytest.raises(HTTPException) as refused:
        service.export(connection, actor(), 'e1', 'cashflow.xlsx')
    assert refused.value.detail == 'Upload the programme first'


def test_the_boq_exports_as_excel_and_pdf(connection):
    connection.on('from estimates where id', estimate()).on('from projects p left join members', {'id': 'proj', 'name': 'Lekki Office', 'client': 'C', 'location': 'L', 'access': 'edit'}).on('from orgs', {'name': 'Demo'})
    data, kind, name = service.export(connection, actor(), 'e1', 'boq.xlsx')
    assert data[:2] == b'PK' and name == 'Lekki_Office_BOQ.xlsx' and 'spreadsheet' in kind
    data, kind, name = service.export(connection, actor(), 'e1', 'boq.pdf')
    assert data[:4] == b'%PDF' and kind == 'application/pdf'
