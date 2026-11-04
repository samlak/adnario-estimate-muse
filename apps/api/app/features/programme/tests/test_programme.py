"""The programme: the Nigerian working calendar, rows read from the PDF's text, the critical path, the cash flow by
month, and no money shown to who may not see the estimate."""

from datetime import date

import pytest

from app.access import Actor
from app.config import env
from app.features.programme.service import cash_flow, easter, parse_rows, read_pdf, schedule, shown, working_days

LEKKI = env.SAMPLES / 'lekki-office' / 'Lekki_Office_Block_Programme.pdf'

TEXT = """PROGRAMME OF WORKS: TEST Page 1
1 SITE WORKS 4 days 01 Dec 2026 04 Dec 2026
2 Clear site 2 days 01 Dec 2026 02 Dec 2026
3 Set out 2 days 03 Dec 2026 04 Dec 2026 2
4 Fence 1 day 01 Dec 2026 01 Dec 2026
5 Handover 0 days 04 Dec 2026 04 Dec 2026 3
"""


def test_easter_and_public_holidays():
    assert easter(2027) == date(2027, 3, 28)
    assert easter(2026) == date(2026, 4, 5)


def test_working_days_skip_sundays_and_holidays():
    days = working_days(date(2026, 12, 24), date(2026, 12, 31))
    # 25th and 26th are holidays, the 27th is a Sunday
    assert days == [date(2026, 12, d) for d in (24, 28, 29, 30, 31)]


def test_rows_are_read_with_their_links_and_levels():
    rows = parse_rows(TEXT)
    assert [row['id'] for row in rows] == [1, 2, 3, 4, 5]
    assert rows[0]['summary'] and not rows[1]['summary']
    assert rows[2]['before'] == [(2, 'FS', 0)] and rows[1]['parent'] == 1 and rows[1]['level'] == 1


def test_a_pdf_with_no_rows_is_refused():
    with pytest.raises(ValueError, match='No activities'):
        parse_rows('nothing here')


def test_the_chain_is_critical_and_the_loose_task_floats():
    plan = schedule(parse_rows(TEXT))
    tasks = {a['id']: a for a in plan['activities']}
    assert tasks[2]['critical'] and tasks[3]['critical'] and tasks[5]['critical']
    assert not tasks[4]['critical'] and tasks[4]['float'] > 0
    assert tasks[1]['critical']  # a summary is critical when anything under it is


def test_cash_flow_spreads_cost_and_stacks_the_percentages():
    programme = {'days': ['2026-12-30', '2026-12-31', '2027-01-04', '2027-01-05'], 'activities': [
        {'id': 1, 'summary': False, 'start': 0, 'finish': 4, 'cost': 400.0},
    ]}
    december, january = cash_flow(programme, {'contingency': 10, 'vat': 0}, prelims_total=40.0)
    assert (december['work'], december['prelims'], december['total']) == (200.0, 20.0, 242.0)
    assert january['cumulative'] == 484.0


def test_money_is_hidden_from_who_may_not_see_the_estimate():
    programme = {'cash_flow': [{'total': 1}], 'unpriced': ['X'], 'activities': [{'id': 1, 'cost': 5.0, 'work': [{'code': 'X', 'qty': 2}]}]}
    engineer = Actor(person_id=None, org_id=None, name='E', role='contributor')
    hidden = shown(engineer, programme)
    assert hidden['cash_flow'] == [] and hidden['activities'][0]['cost'] is None and hidden['activities'][0]['work'][0]['qty'] is None
    assert shown(Actor(None, None, 'Q', 'qs'), programme) is programme


@pytest.mark.skipif(not LEKKI.exists(), reason='the Lekki sample is not here')
def test_the_lekki_programme():
    title, rows = read_pdf(LEKKI)
    plan = schedule(rows)
    assert title == 'LEKKI OFFICE BLOCK' and len(rows) == 189 and plan['end'] == 239
    levels = {row['id']: row['level'] for row in rows}
    assert (levels[1], levels[31], levels[32], levels[33], levels[75], levels[80]) == (0, 1, 2, 3, 1, 2)
    tasks = {a['id']: a for a in plan['activities']}
    assert tasks[189]['critical'] and tasks[188]['critical']
