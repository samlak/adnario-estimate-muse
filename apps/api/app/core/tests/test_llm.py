"""The model's answers: JSON found inside fences or prose, and an earlier chat replayed with its look-ups."""

import pytest
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

from app.core.llm import _json_of, history, messages


def test_json_is_found_however_it_is_wrapped():
    assert _json_of('{"a": 1}') == {'a': 1}
    assert _json_of('```json\n{"a": 1}\n```') == {'a': 1}
    assert _json_of('Here you go: [1, 2] — done') == [1, 2]


def test_no_json_raises():
    with pytest.raises(ValueError):
        _json_of('no json at all')


def test_messages_leave_out_an_empty_system_prompt():
    assert messages(None, 'hi') == [('user', 'hi')]
    assert messages('be brief', 'hi') == [('system', 'be brief'), ('user', 'hi')]


def test_history_replays_answered_look_ups_only():
    said = history([
        {'role': 'user', 'text': 'How much concrete?'},
        {'role': 'assistant', 'text': '12 m³', 'steps': [
            {'tool': 'boq', 'args': {'q': 'concrete'}, 'result': '12'},
            {'tool': 'boq', 'args': {}, 'result': None},  # never answered: left out
        ]},
    ])
    assert [type(m) for m in said] == [HumanMessage, AIMessage, ToolMessage, AIMessage]
    assert said[1].tool_calls[0]['name'] == 'boq' and said[2].tool_call_id == said[1].tool_calls[0]['id']
    assert said[3].content == '12 m³'
