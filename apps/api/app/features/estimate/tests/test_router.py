ESTIMATE = '/api/v1/estimates/00000000-0000-0000-0000-000000000009'


def test_more_than_ten_documents_are_refused(api, connection):
    files = [('files', (f'{n}.txt', b'x', 'text/plain')) for n in range(11)]
    assert api('qs').post(f'{ESTIMATE}/documents', files=files).status_code == 422 and connection.calls == []


def test_an_unknown_export_or_kind_of_work_is_refused(api):
    client = api('qs')
    assert client.get(f'{ESTIMATE}/export/boq.docx').status_code == 422
    assert client.get(f'{ESTIMATE}/follow/painting').status_code == 422


def test_an_edit_outside_the_limits_is_refused(api):
    assert api('qs').post(f'{ESTIMATE}/edit', json={'op': 'percent', 'name': 'vat', 'value': 150}).status_code == 422
    assert api('qs').post(f'{ESTIMATE}/edit', json={'op': 'rate', 'code': 'G001', 'rate': -1}).status_code == 422


def test_a_contributor_cannot_edit(api, connection):
    connection.on('from estimates where id', {'id': 'e1', 'project_id': 'p'})
    assert api('contributor').post(f'{ESTIMATE}/edit', json={'op': 'percent', 'name': 'vat', 'value': 5}).status_code == 403


def test_nothing_running_to_follow(api, connection, monkeypatch):
    from app.features.estimate import router

    monkeypatch.setattr(router, 'check_estimate', lambda *a: None)
    assert api('viewer').get(f'{ESTIMATE}/follow/run').status_code == 404


def test_a_run_streams_its_events(api, monkeypatch):
    from app.core import runs
    from app.features.estimate import router

    async def work():
        yield 'stage', {'name': 'Read', 'state': 'start'}
        yield 'result', {'lines': 3}

    monkeypatch.setattr(router.service, 'editable', lambda *a: None)
    monkeypatch.setattr(router.jobs, 'start_run', lambda org, estimate: runs.start(f'run:{estimate}', work()))
    text = api('qs').post(f'{ESTIMATE}/run').text
    assert 'event: stage' in text and 'event: result\ndata: {"lines": 3}' in text


def test_an_export_downloads_with_its_name(api, monkeypatch):
    from app.features.estimate import router

    monkeypatch.setattr(router.service, 'export', lambda c, a, e, what: (b'PK', 'application/zip', 'Lekki_BOQ.xlsx'))
    answer = api('viewer').get(f'{ESTIMATE}/export/boq.xlsx')
    assert answer.content == b'PK' and answer.headers['content-disposition'] == 'attachment; filename="Lekki_BOQ.xlsx"'
