"""The BOQ's work in the programme: items split by storey, the AI's answer checked, and each activity's cost."""

import asyncio

from app.features.programme import work


def test_items_are_split_by_storey():
    result = {'takeoff': [{'gid': 'a', 'storey': 'Ground'}, {'gid': 'b', 'storey': 'First'}, {'gid': 'c', 'storey': 'First'}],
              'boq': [{'code': 'G1', 'section': 'Walls', 'description': 'Blockwork', 'unit': 'm²', 'qty': 30.0, 'gids': ['a', 'b', 'c']}]}
    pieces = work.pieces_of(result)
    assert [(p['storey'], p['qty']) for p in pieces] == [('Ground', 10.0), ('First', 20.0)]


def test_an_answer_naming_an_unknown_activity_is_refused():
    found, wrong = work.check_answer([], {'pieces': [{'key': 'W1', 'activities': [5]}, {'key': 'W2', 'activities': [99]}]}, {5: {}})
    assert found == {'W1': [5]} and wrong == ['W2']


def test_each_activity_gets_its_share_of_the_cost(monkeypatch):
    async def assign(listed, shown, again=False):
        return {'pieces': [{'key': piece['key'], 'activities': [2, 3]} for piece in shown]}

    monkeypatch.setattr(work.ai, 'assign', assign)
    programme = {'activities': [
        {'id': 1, 'name': 'WALLS', 'summary': True, 'parent': None},
        {'id': 2, 'name': 'Zone A', 'summary': False, 'parent': 1, 'start': 0, 'finish': 1, 'work': [], 'refs': [], 'cost': 0.0},
        {'id': 3, 'name': 'Zone B', 'summary': False, 'parent': 1, 'start': 1, 'finish': 4, 'work': [], 'refs': [], 'cost': 0.0},
    ]}
    result = {'takeoff': [], 'boq': [{'code': 'G1', 'section': 'Walls', 'description': 'Blockwork', 'unit': 'm²', 'qty': 40.0, 'gids': [], 'rate': 100}]}
    done = asyncio.run(work.assign(programme, result))
    tasks = {a['id']: a for a in done['activities']}
    assert (tasks[2]['cost'], tasks[3]['cost']) == (1000.0, 3000.0)  # split by days: 1 and 3
    assert done['not_in_programme'] == [] and done['unpriced'] == []
