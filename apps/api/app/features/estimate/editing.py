"""The QS's edits to an estimate's result (README §7.5): a rate typed, a percentage, a line added, changed or removed,
a provisional item taken in, a type billed or left out. Each edit is one step of undo and redo; the run is the
floor."""

import copy

from fastapi import HTTPException

from app.features.estimate import boq as boqs
from app.features.estimate.constants import BILL_OF, SECTIONS, UNITS
from app.features.estimate.schemas import Edit
from app.features.estimate.takeoff import roll_up


def mutable(result: dict) -> dict:
    return copy.deepcopy({'boq': result.get('boq', []), 'pricing': result['pricing'], 'types': {t['key']: t['mapping'] for t in result['types']}})


def restore(result: dict, state: dict) -> None:
    result['boq'], result['pricing'] = state['boq'], state['pricing']
    for entry in result['types']:
        if entry['key'] in state['types'] and entry['mapping'] != state['types'][entry['key']]:
            entry['mapping'] = state['types'][entry['key']]
            restatus(result, entry)


def restatus(result: dict, entry: dict) -> None:
    mapping = entry['mapping']
    status = 'billed' if mapping['decision'] == 'bill' and not mapping.get('held') else 'held' if mapping.get('held') else mapping['decision']
    if status == 'billed' and not any(row['type_key'] == entry['key'] for row in result['takeoff']):
        # a type that was left out, now billed: one row per element, counted
        for item in mapping.get('items') or []:
            for ref in entry['gids']:
                result['takeoff'].append({'ref': ref, 'gid': ref, 'storey': None, 'type_key': entry['key'], 'section': item['section'], 'description': item['description'],
                                          'unit': item['unit'], 'qty': 1 if item['unit'] == 'nr' else 0, 'source': 'counted by the QS', 'status': 'billed', 'confidence': mapping.get('confidence', 'Medium')})
    for row in result['takeoff']:
        if row['type_key'] == entry['key'] and row.get('source') != 'derived' and row['status'] != 'not_measured':
            row['status'] = status
    result['takeoff_lines'] = roll_up(result['takeoff'])


def apply(result: dict, edit: Edit) -> None:
    lines = {line['code']: line for line in result.get('boq') or []}
    if edit.op == 'rate':
        line = lines.get(edit.code or '')
        if not line:
            raise HTTPException(404, 'No such BOQ item')
        line.update(rate=edit.rate, rate_item_id=None, rate_note='typed' if edit.rate is not None else None)
    elif edit.op == 'percent':
        result['pricing'] = {**result['pricing'], edit.name: edit.value}
    elif edit.op == 'add_provisional':
        item = next((p for p in result['provisional'] if p['code'] == edit.code), None)
        if not item or edit.code in lines:
            raise HTTPException(409, 'Not a provisional item, or already in the BOQ')
        result['boq'] = boqs.ordered([*result.get('boq', []), boqs.provisional_line({**item, 'qty': edit.qty if edit.qty is not None else item.get('qty')}, len(lines))])
    elif edit.op == 'add_line':
        if edit.section not in SECTIONS or not edit.description or edit.unit not in UNITS:
            raise HTTPException(422, 'A line needs one of our sections, a description and a unit')
        number = 1 + max([int(c[1:]) for c in lines if c.startswith('Q') and c[1:].isdigit()] or [0])
        result['boq'] = boqs.ordered([*result.get('boq', []), {
            'code': f'Q{number:03d}', 'bill': BILL_OF[edit.section], 'section': edit.section, 'description': edit.description,
            'unit': edit.unit, 'qty': edit.qty or 0, 'count': 0, 'gids': [], 'lines': [], 'confidence': 'High', 'rate': edit.rate,
            'rate_item_id': None, 'rate_note': 'typed' if edit.rate is not None else None, 'source': 'qs', 'position': 1000 + number}])
    elif edit.op == 'line':
        line = lines.get(edit.code or '')
        if not line:
            raise HTTPException(404, 'No such BOQ item')
        if edit.description:
            line['description'] = edit.description
        if edit.qty is not None:
            if line['source'] == 'group':  # a measured quantity overridden: the measured one is kept beside it
                line.setdefault('measured_qty', line['qty'])
                if abs(edit.qty - line['measured_qty']) < 1e-9:
                    line.pop('measured_qty')
            line['qty'] = edit.qty
    elif edit.op == 'remove_line':
        if edit.code not in lines:
            raise HTTPException(404, 'No such BOQ item')
        result['boq'] = [line for line in result['boq'] if line['code'] != edit.code]
    elif edit.op == 'type':
        entry = next((t for t in result['types'] if t['key'] == edit.code), None)
        if not entry:
            raise HTTPException(404, 'No such type')
        items = entry['mapping'].get('items') or []
        if edit.decision == 'bill' and not items:  # a type left out (furniture, fittings): counted, by number
            name = (entry['type'] or entry['family'] or entry['class'].removeprefix('Ifc')).replace('M_', '')
            items = [{'description': f'{name}: supply and fix', 'section': 'Fittings and furnishings', 'unit': 'nr', 'method': 'count', 'layer': None}]
        entry['mapping'] = {**entry['mapping'], 'items': items, 'decision': edit.decision, 'held': False, 'reason': f'{edit.decision} by the QS'}
        restatus(result, entry)
