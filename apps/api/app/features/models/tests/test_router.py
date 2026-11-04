MODEL = '/api/v1/models/00000000-0000-0000-0000-000000000009'


def test_only_a_qs_or_admin_decides_a_version(api, connection):
    assert api('contributor').post(f'{MODEL}/decision', json={'accept': True}).status_code == 403
    assert connection.calls == []


def test_a_viewer_cannot_upload(api):
    files = [('files', ('m.ifc', b'ISO-10303-21;', 'application/octet-stream'))]
    assert api('viewer').post('/api/v1/projects/00000000-0000-0000-0000-000000000009/models', files=files).status_code == 403


def test_a_file_that_is_not_ifc_is_refused(api, connection):
    files = [('files', ('plan.pdf', b'%PDF-1.7', 'application/pdf'))]
    answer = api('contributor').post('/api/v1/projects/00000000-0000-0000-0000-000000000009/models', files=files)
    assert answer.status_code == 422 and 'not an IFC' in answer.json()['detail'] and connection.calls == []


def test_a_contributor_uploads_an_ifc_and_it_is_converted_after(api, connection, monkeypatch):
    from app.features.models import router

    converted = []
    monkeypatch.setattr(router, 'convert', lambda org, model: converted.append(model))
    monkeypatch.setattr(router.service, 'upload', lambda c, a, p, name, data: {'id': 'm1', 'name': name, 'version': 1, 'state': 'current'})
    files = [('files', ('Office.ifc', b'ISO-10303-21;\n', 'application/octet-stream'))]
    answer = api('contributor').post('/api/v1/projects/00000000-0000-0000-0000-000000000009/models', files=files)
    assert answer.json() == [{'id': 'm1', 'name': 'Office.ifc', 'version': 1, 'state': 'current'}] and converted == ['m1']
