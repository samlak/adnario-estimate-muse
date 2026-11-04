ESTIMATE = '/api/v1/estimates/00000000-0000-0000-0000-000000000009'


def test_the_programme_must_be_a_pdf(api, connection):
    files = {'file': ('programme.xlsx', b'PK\x03\x04', 'application/octet-stream')}
    answer = api('qs').post(f'{ESTIMATE}/programme', files=files)
    assert answer.status_code == 422 and connection.calls == []
