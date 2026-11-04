def test_a_comment_on_an_unknown_target_is_refused(api, connection):
    answer = api('qs').post('/api/v1/projects/00000000-0000-0000-0000-000000000009/comments', data={'text': 'Hi', 'on_kind': 'invoice'})
    assert answer.status_code == 422 and connection.calls == []


def test_every_role_may_comment_but_text_is_needed(api):
    assert api('viewer').post('/api/v1/projects/00000000-0000-0000-0000-000000000009/comments', data={'text': ''}).status_code == 422
