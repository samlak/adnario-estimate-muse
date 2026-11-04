"""The sidekick's helpers: long lists cut with a count of what was left out, work done by a day, and every tool
described to the model as a closed JSON schema."""

from app.features.sidekick.constants import MAX_ROWS
from app.features.sidekick.tools import TOOLS, capped, done, type_label


def test_long_lists_are_cut_and_say_how_many_more():
    assert capped([1, 2]) == {'rows': [1, 2]}
    cut = capped(list(range(MAX_ROWS + 3)), 'items')
    assert len(cut['items']) == MAX_ROWS and cut['more'] == 3


def test_work_done_spreads_each_cost_over_its_days():
    activities = [{'start': 0, 'finish': 4, 'cost': 400}, {'start': 2, 'finish': 2, 'cost': 50}]
    assert done(activities, 0) == 100
    assert done(activities, 1) == 200  # the milestone is not reached yet
    assert done(activities, 3) == 450
    assert done(activities, 99) == 450


def test_type_label():
    assert type_label({'family': 'Basic Wall', 'type': '225'}) == 'Basic Wall: 225'
    assert type_label({'family': None, 'type': '225'}) == '225'


def test_every_tool_is_a_closed_schema():
    assert TOOLS
    for name, tool in TOOLS.items():
        function = tool['schema']['function']
        assert function['name'] == name and function['description']
        assert function['parameters']['additionalProperties'] is False
        assert isinstance(tool['money'], bool)
