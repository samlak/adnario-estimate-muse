def test_a_question_cannot_be_empty(api, connection):
    answer = api('qs').post('/api/v1/estimates/e1/sidekick', json={'question': ''})
    assert answer.status_code == 422 and connection.calls == []


def test_chats_need_a_session(api):
    assert api(None).get('/api/v1/sidekick/chats/00000000-0000-0000-0000-000000000009').status_code == 401


def test_an_answer_streams_its_steps_and_is_saved_with_them(api, connection, monkeypatch):
    from app.features.sidekick import router

    saved = []

    async def answer(tools, project, history):
        yield 'token', {'text': 'Let me check the BOQ. '}
        yield 'tool', {'id': 't1', 'name': 'boq_totals', 'args': {}}
        yield 'result', {'id': 't1', 'text': '{"total": 1000}'}
        yield 'token', {'text': 'The total is ₦1,000.'}

    async def title(question, text):
        return 'BOQ total'

    connection.on('from estimates e join projects', {'id': 'p1', 'name': 'Lekki'})
    monkeypatch.setattr(router, 'check_estimate', lambda *a: None)
    monkeypatch.setattr(router.service, 'tools_for', lambda *a: None)
    monkeypatch.setattr(router.service, 'save', lambda c, a, chat, project, messages: saved.append(messages))
    monkeypatch.setattr(router.service, 'rename', lambda *a: None)
    monkeypatch.setattr(router.ai, 'answer', answer)
    monkeypatch.setattr(router.ai, 'title', title)
    text = api('qs').post('/api/v1/estimates/e1/sidekick', json={'question': 'What is the total?'}).text
    assert 'event: chat' in text and 'event: tool' in text and 'event: title\ndata: {"title": "BOQ total"}' in text
    final = saved[-1][-1]
    assert final['text'] == 'The total is ₦1,000.'
    assert final['steps'][0] == {'note': 'Let me check the BOQ.'}  # what it said before the look-up is its plan
    assert final['steps'][1]['result'] == '{"total": 1000}'
