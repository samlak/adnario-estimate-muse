"""The programme built from the real Ikoyi Duplex PDF with the AI faked, repriced after the QS changes rates, and its
cash flow exported."""

import asyncio

import pytest

from app.core.config import env
from app.features.programme import service, work
from app.features.programme.excel import cash_flow_excel
from app.testing.fakes import estimate_fixture

PDF = env.SAMPLES / 'ikoyi-duplex' / 'Ikoyi_Duplex_Programme.pdf'
FIXTURE = estimate_fixture()


@pytest.mark.skipif(not PDF.exists(), reason='the Ikoyi Duplex programme is not here')
def test_a_programme_is_read_scheduled_linked_and_given_its_cash_flow(monkeypatch):
    first = {}

    async def assign(listed, shown, again=False):
        first.setdefault('id', listed[0]['id'])
        return {'pieces': [{'key': piece['key'], 'activities': [first['id']]} for piece in shown]}

    monkeypatch.setattr(work.ai, 'assign', assign)
    built = asyncio.run(service.build(PDF, FIXTURE['result']))
    assert built['title'] and built['end'] > 0 and built['cash_flow']
    worked = next(a for a in built['activities'] if a['id'] == first['id'])
    assert worked['cost'] > 0 and worked['work']
    assert round(built['cash_flow'][-1]['cumulative']) > 0


def test_repricing_follows_the_new_rates():
    programme = {**FIXTURE['programme'], 'activities': [dict(a) for a in FIXTURE['programme']['activities']]}
    result = {**FIXTURE['result'], 'boq': [{**line, 'rate': (line['rate'] or 0) * 2} for line in FIXTURE['result']['boq']]}
    before = sum(a['cost'] or 0 for a in FIXTURE['programme']['activities'])
    after = sum(a['cost'] for a in service.reprice(programme, result)['activities'])
    assert round(after) == round(before * 2)


def test_the_cash_flow_exports_as_excel():
    data = cash_flow_excel({'name': 'Ikoyi Duplex', 'client': 'Private', 'location': 'Ikoyi', 'firm': 'Demo'}, FIXTURE['programme'])
    assert data[:2] == b'PK'
