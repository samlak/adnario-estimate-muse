"""The estimate's long work end to end, with the AI and the database faked: the run on the real Ikoyi Duplex model,
Generate BOQ and Link to cost. What is checked is code's part: every answer checked, measured and added up."""

import asyncio
from contextlib import contextmanager

import ifcopenshell
import pytest

from app.core.config import env
from app.features.estimate import ai, cost, jobs, run
from app.testing.fakes import FakeConnection, estimate_fixture

DUPLEX = env.SAMPLES / 'ikoyi-duplex' / 'Ifc2x3_Duplex_Architecture.ifc'
SECTION = {'IfcWall': ('Walls', 'area'), 'IfcWallStandardCase': ('Walls', 'area'), 'IfcSlab': ('Upper floors', 'volume'),
           'IfcDoor': ('Doors', 'count'), 'IfcWindow': ('Windows', 'count')}
UNIT = {'area': 'm²', 'volume': 'm³', 'count': 'nr'}


def collect(work):
    async def go():
        return [event async for event in work]
    return asyncio.run(go())


async def fake_map(user):
    """Walls, slabs, doors and windows billed by their class; everything else left out."""
    import ast
    types = ast.literal_eval(user.split('Types:\n', 1)[1])
    answer = []
    for entry in types:
        if entry['class'] in SECTION:
            section, method = SECTION[entry['class']]
            item = {'description': f'{entry["type"]} ({entry["class"]})', 'section': section, 'unit': UNIT[method], 'method': method}
            answer.append({'key': entry['key'], 'decision': 'bill', 'items': [item]})
        else:
            answer.append({'key': entry['key'], 'decision': 'exclude', 'reason': 'not measured here'})
    return {'types': answer}


async def fake_review(user):
    return {'brief': 'A duplex.', 'facts': {'city': 'Lagos'}, 'summary': 'Fine.',
            'questions': [{'severity': 'high', 'question': 'Roof build-up?', 'lines': ['L001', 'L999']}, {'severity': 'odd', 'question': 'Finishes?'}],
            'provisional': [{'description': 'Site clearance', 'section': 'Nowhere', 'unit': 'm2', 'basis': 'footprint', 'reason': 'not modelled'}]}


async def fake_text(_):
    return 'A two-storey house.'


@pytest.mark.skipif(not DUPLEX.exists(), reason='the Ikoyi Duplex sample is not here')
def test_the_run_measures_the_model_and_checks_every_answer(monkeypatch):
    connection = FakeConnection()
    connection.on('select * from estimates', {'id': 'e1', 'project_id': 'proj', 'revision': 0, 'info': {'text': 'Spec'}})
    connection.on('select * from projects', {'name': 'Ikoyi Duplex', 'client': 'Private', 'location': 'Ikoyi', 'description': ''})
    connection.on('select * from models', [{'id': 'm1', 'name': DUPLEX.name, 'version': 1}])

    @contextmanager
    def in_org(_):
        yield connection

    monkeypatch.setattr(run.db, 'in_org', in_org)
    monkeypatch.setattr(run, 'open_ifc', lambda model: ifcopenshell.open(DUPLEX))
    monkeypatch.setattr(ai, 'summarise', fake_text)
    monkeypatch.setattr(ai, 'see', fake_text)
    monkeypatch.setattr(ai, 'map_types', fake_map)
    monkeypatch.setattr(ai, 'review', fake_review)

    events = collect(run.run('e1', 'org'))
    names = [data['name'] for event, data in events if event == 'stage' and data['state'] == 'done']
    assert names == ['Context', 'Read', 'Catalogue', 'Understand', 'Map', 'Derive', 'BOQ', 'Brief', 'Review']
    assert events[-1][0] == 'result'

    result = connection.ran("set status = 'ready'")[0][0].obj
    sections = {line['section'] for line in result['takeoff_lines']}
    assert {'Walls', 'Doors', 'Windows'} <= sections
    walls = sum(line['qty'] for line in result['takeoff_lines'] if line['section'] == 'Walls')
    assert walls > 100  # m² of wall in a two-storey house
    assert all(line['code'].startswith('L') for line in result['takeoff_lines'])
    # the review's answers checked: an unknown line dropped, an odd severity made medium, a foreign section made ours
    assert result['questions'][0]['line_codes'] == ['L001'] and result['questions'][1]['severity'] == 'medium'
    assert (result['provisional'][0]['section'], result['provisional'][0]['unit']) == ('External works', 'm²')
    assert result['city'] == 'Lagos'


def test_a_run_without_models_stops(monkeypatch):
    connection = FakeConnection().on('select * from estimates', {'id': 'e1', 'project_id': 'p', 'revision': 0, 'info': None})

    @contextmanager
    def in_org(_):
        yield connection

    monkeypatch.setattr(run.db, 'in_org', in_org)
    with pytest.raises(ValueError, match='Upload the building models first'):
        collect(run.run('e1', 'org'))


def fixture_result():
    result = estimate_fixture()['result']
    return {**result, 'boq': [dict(line) for line in result['boq']]}


def test_generate_boq_keeps_typed_rates_and_qs_lines(monkeypatch):
    result = fixture_result()
    result['boq'].append({'code': 'Q001', 'bill': 'B', 'section': 'Doors', 'description': 'Door stops', 'unit': 'nr', 'qty': 4, 'rate': 900,
                          'source': 'qs', 'position': 1001, 'gids': [], 'lines': [], 'count': 0, 'confidence': 'High'})
    typed = result['boq'][0]
    saved = {}

    async def fake_group(shown):
        return {'items': []}  # the AI groups nothing: every line becomes its own item

    monkeypatch.setattr(ai, 'group', fake_group)
    monkeypatch.setattr(jobs, 'load_result', lambda *_: {'result': result, 'programme': None})
    monkeypatch.setattr(jobs, 'save_result', lambda org, estimate, result, programme, keep: saved.update(result=result, keep=keep))
    events = collect(jobs.generate('org', 'e1'))
    assert events[-1][0] == 'result' and saved['keep'] is False  # a new BOQ starts the undo history again
    boq = saved['result']['boq']
    assert len(boq) == len(result['takeoff_lines']) + 1
    assert any(line['code'] == 'Q001' for line in boq)
    assert {line['rate'] for line in boq if line['description'] == typed['description']} == {typed['rate']}  # a regenerated item keeps its rate


def test_link_to_cost_prices_from_the_card_and_never_guesses(monkeypatch):
    result = fixture_result()
    for line in result['boq']:
        line.update(rate=None, rate_note=None, rate_item_id=None)
    first = result['boq'][0]
    card = {'id': 'c1', 'name': 'Adnario Market Rates', 'rows': [
        {'id': 'r1', 'kind': 'RATE', 'code': 'DPM-01', 'section': 'Substructure', 'name': 'Polythene membrane', 'unit': first['unit'], 'rate': 600},
        {'id': 'r2', 'kind': 'RATE', 'code': 'BLK-01', 'section': 'Walls', 'name': 'Blockwork', 'unit': 'm²', 'rate': None},
    ]}
    saved = {}

    async def fake_link(items, lines):
        return {'links': [{'line': 'G001', 'item': 'DPM-01', 'why': 'same membrane'}, {'line': 'G002', 'item': 'BLK-01'}, {'line': 'G003', 'item': 'NOPE'}]}

    monkeypatch.setattr(ai, 'link', fake_link)
    monkeypatch.setattr(jobs, 'load_result', lambda *_: {'result': result, 'programme': None})
    monkeypatch.setattr(jobs, 'card_of', lambda connection: card)
    monkeypatch.setattr(jobs.db, 'in_org', lambda _: contextmanager(lambda: (yield None))())
    monkeypatch.setattr(jobs, 'save_result', lambda org, estimate, result, programme=None: saved.update(result=result))
    events = collect(jobs.link('org', 'e1'))
    assert events[-1] == ('result', {'priced': 1, 'of': len(result['boq'])})
    boq = {line['code']: line for line in saved['result']['boq']}
    assert boq['G001']['rate'] == 600 and boq['G001']['rate_item_id'] == 'r1'
    assert all(line['rate'] is None for code, line in boq.items() if code != 'G001')  # a missing price or unknown item: no rate
    assert saved['result']['pricing']['rate_card']['title'] == 'Adnario Market Rates'


def test_a_rate_the_qs_typed_is_never_relinked():
    boq = [{'code': 'G001', 'unit': 'm²', 'description': 'X', 'rate': 1234, 'rate_note': 'typed'}]
    linked, _ = asyncio.run(cost.link(boq, {'rows': []}))
    assert linked[0]['rate'] == 1234
