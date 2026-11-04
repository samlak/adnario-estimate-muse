"""Editing the programme: a duration typed or a link changed, then the programme scheduled forward from its links
(an activity never earlier than the programme had it), its float and cash flow worked out again."""

import pytest
from fastapi import HTTPException

from app.features.programme.schedule import timed, waits_on
from app.features.programme.schemas import ActivityEdit, Link
from app.features.programme.service import edited
from app.testing.fakes import estimate_fixture

RESULT = estimate_fixture()['result']  # a real priced BOQ, for the cash flow


def programme():
    """A summary over three tasks: Dig (days 0-2), then Pour (2-4) after it finishes, and Fence (5-6), which waits
    for Dig to start but was programmed later."""
    task = lambda id, start, finish, **more: {'id': id, 'code': str(id), 'name': f'T{id}', 'summary': False, 'level': 1, 'parent': 1,
                                             'start': start, 'finish': finish, 'planned': start, 'milestone': False, 'cost': 0.0, 'work': [], 'refs': [], **more}
    return {
        'start': '2026-12-01', 'days': ['2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04', '2026-12-05', '2026-12-07', '2026-12-08'],
        'activities': [
            {'id': 1, 'code': '1', 'name': 'SITE', 'summary': True, 'level': 0, 'parent': None, 'start': 0, 'finish': 6, 'cost': 0.0, 'work': [], 'refs': []},
            task(2, 0, 2, work=[{'code': RESULT['boq'][0]['code'], 'qty': 3}]), task(3, 2, 4), task(4, 5, 6),
        ],
        'links': [{'before': 2, 'after': 3, 'kind': 'FS', 'lag': 0}, {'before': 2, 'after': 4, 'kind': 'SS', 'lag': 1}],
    }


def spans(plan):
    return {a['id']: (a['start'], a['finish']) for a in plan['activities']}


def test_an_unedited_programme_stays_as_it_was():
    assert spans(timed(programme())) == spans(programme())


def test_a_longer_activity_pushes_what_waits_for_it_to_finish_and_the_calendar_runs_on():
    after = edited(programme(), RESULT, ActivityEdit(id=2, days=6))
    assert spans(after) == {1: (0, 8), 2: (0, 6), 3: (6, 8), 4: (5, 6)}  # Fence waits for Dig to start: it stays
    assert after['days'][-1] == '2026-12-09' and after['end'] == 8
    assert next(a for a in after['activities'] if a['id'] == 2)['programmed'] == 2
    assert after['cash_flow']  # worked out again


def test_a_shorter_activity_never_brings_work_earlier_than_programmed():
    assert spans(edited(programme(), RESULT, ActivityEdit(id=2, days=1)))[3] == (2, 4)


def test_a_link_added_with_a_lag_and_removed():
    added = edited(programme(), RESULT, ActivityEdit(id=4, add_link=Link(before=3, kind='FS', lag=1)))
    assert spans(added)[4] == (5, 6) and {'before': 3, 'after': 4, 'kind': 'FS', 'lag': 1} in added['links']
    pushed = edited(added, RESULT, ActivityEdit(id=3, days=4))
    assert spans(pushed)[4] == (7, 8)
    removed = edited(pushed, RESULT, ActivityEdit(id=4, remove_link=3))
    assert not any(link['before'] == 3 and link['after'] == 4 for link in removed['links'])


def test_a_loop_a_summary_or_itself_is_refused():
    assert waits_on(programme(), 2, 3)
    for link in (Link(before=3), Link(before=1), Link(before=2)):
        with pytest.raises(HTTPException):
            edited(programme(), RESULT, ActivityEdit(id=2, add_link=link))


def test_renamed():
    assert next(a for a in edited(programme(), RESULT, ActivityEdit(id=3, name=' Pour slab '))['activities'] if a['id'] == 3)['name'] == 'Pour slab'
