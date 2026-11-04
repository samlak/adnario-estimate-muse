"""The sidekick's look-ups, on a real finished estimate (the demo's Ikoyi Duplex): every tool answers, money is kept
from who may not see it, and the numbers are the app's own."""

import json

import pytest

from app.features.estimate.boq import totals
from app.features.sidekick.constants import MAX_ROWS
from app.features.sidekick.definitions import TOOLS
from app.features.sidekick.service import shown
from app.features.sidekick.tools import Tools, capped, done, type_label
from app.testing.fakes import actor, estimate_fixture

FIXTURE = estimate_fixture()


def tools(role='qs'):
    return Tools(FIXTURE['result'], shown(actor(role), FIXTURE['programme']), actor(role).can('see_estimate'))


def ask(t, name, **args):
    return json.loads(t.run(name, args))


@pytest.mark.parametrize('name', sorted(TOOLS))
def test_every_tool_answers_without_arguments(name):
    t = tools()
    needs = {'element_details': {'ref': FIXTURE['result']['takeoff'][0]['ref']}, 'boq_line': {'ref': 'B1A'},
             'activity': {'code': next(a['code'] for a in FIXTURE['programme']['activities'] if not a['summary'])}}
    answer = ask(t, name, **needs.get(name, {}))
    assert 'error' not in answer, answer


def test_the_totals_are_the_apps_own():
    answer = ask(tools(), 'boq_totals')
    expected = totals(FIXTURE['result']['boq'], FIXTURE['result']['pricing'])
    assert round(answer['total']) == round(expected['total'])


def test_a_boq_item_by_its_ref():
    answer = ask(tools(), 'boq_line', ref='B1A')
    assert answer['description'] == FIXTURE['result']['boq'][0]['description']


def test_money_is_kept_from_a_contributor():
    t = tools('contributor')
    assert 'may not see' in ask(t, 'boq_totals')['error']
    assert 'percentages' not in ask(t, 'project_info')
    assert all(a.get('cost') is None for a in t.activities.values())


def test_a_wrong_tool_or_argument_is_told_back():
    t = tools()
    assert ask(t, 'delete_everything') == {'error': 'No tool delete_everything'}
    assert 'error' in ask(t, 'boq_lines', colour='red')


def test_long_lists_are_cut_and_say_how_many_more():
    assert capped([1, 2]) == {'rows': [1, 2]}
    cut = capped(list(range(MAX_ROWS + 3)), 'items')
    assert len(cut['items']) == MAX_ROWS and cut['more'] == 3


def test_work_done_spreads_each_cost_over_its_days():
    activities = [{'start': 0, 'finish': 4, 'cost': 400}, {'start': 2, 'finish': 2, 'cost': 50}]
    assert [done(activities, day) for day in (0, 1, 3, 99)] == [100, 200, 450, 450]


def test_type_label():
    assert type_label({'family': 'Basic Wall', 'type': '225'}) == 'Basic Wall: 225'
    assert type_label({'family': None, 'type': '225'}) == '225'


def test_every_tool_is_a_closed_schema():
    for name, tool in TOOLS.items():
        function = tool['schema']['function']
        assert function['name'] == name and function['description']
        assert function['parameters']['additionalProperties'] is False
