"""The takeoff's code side (README §7.2): the AI's mapping of each type checked and given code's confidence, each element
measured, formwork, blinding and membranes derived from the concrete, the rows rolled up into measured lines, and
provisional quantities worked out. No AI here: everything can be repeated."""

import re
from collections import defaultdict

from app.features.estimate import prompts
from app.features.estimate.read import GENERIC, STEEL_DENSITY, geometry_quantities

MATERIALS = {
    'concrete': ('concrete', 'cement', 'cast'), 'steel': ('steel', 'metal', 'iron'), 'timber': ('timber', 'wood', 'plywood'),
    'block': ('block', 'masonry', 'cmu', 'sandcrete'), 'brick': ('brick',), 'glass': ('glass', 'glazing'),
    'aluminium': ('aluminium', 'aluminum'), 'plasterboard': ('plasterboard', 'gypsum', 'drywall'),
}


def identity(entry: dict) -> tuple:
    """A type's identity across revisions: its decisions carry over when the architect sends a new version."""
    return (entry['model'], entry['class'], entry.get('family'), entry['type'], str(entry.get('layers')), entry.get('size'))


def check_mapping(entry: dict, answer: dict | None) -> dict:
    """The AI's answer for a type, checked: sections, units and methods must be ours; confidence is code's."""
    if not answer:
        return {'decision': 'unmapped', 'held': False, 'reason': 'the AI could not say what BOQ item it is', 'items': [], 'confidence': 'Low'}
    if answer.get('decision') == 'exclude':
        return {'decision': 'exclude', 'held': False, 'reason': answer.get('reason') or 'not a BOQ item', 'items': [], 'confidence': 'High'}
    items, problems = [], []
    layers = entry.get('layers') or []
    for item in answer.get('items') or []:
        unit = {'m2': 'm²', 'm3': 'm³', 'no': 'nr', 'nr.': 'nr', 'tonne': 't', 'tonnes': 't'}.get(str(item.get('unit')).lower(), item.get('unit'))
        method = item.get('method')
        section = item.get('section')
        if section not in prompts.SECTIONS:
            problems.append(f'section {section!r} is not one of ours')
            continue
        if method not in prompts.METHODS or prompts.METHODS[method] != unit:
            problems.append(f'{method} is not measured in {unit}')
            continue
        layer = item.get('layer')
        if layer is not None and not (isinstance(layer, int) and 0 <= layer < len(layers)):
            layer = None
        items.append({'description': str(item.get('description') or '').strip()[:300], 'section': section, 'unit': unit, 'method': method, 'layer': layer})
    if not items:
        return {'decision': 'unmapped', 'held': False, 'reason': '; '.join(problems) or 'no BOQ item given', 'items': [], 'confidence': 'Low'}
    confidence, why = 'High', []
    if answer.get('guessing'):
        confidence, why = 'Low', ['the AI said it was guessing']
    sections = {item['section'] for item in items}
    if entry['class'] == 'IfcDoor' and sections != {'Doors'} or entry['class'] == 'IfcWindow' and sections != {'Windows'}:
        confidence, why = 'Low', [f'an {entry["class"]} billed in {", ".join(sorted(sections))}']
    if GENERIC.match(entry['type'] or ''):
        confidence, why = 'Low', [f'the type name "{entry["type"]}" says nothing']
    if entry.get('duplicate_of'):
        return {'decision': 'exclude', 'held': False, 'reason': f'billed from {entry["duplicate_of"]}', 'items': [], 'confidence': 'High'}
    material = f'{entry.get("material") or ""} {" ".join(layer["material"] for layer in layers)}'.lower()
    if confidence == 'High' and material.strip():
        for item in items:
            said = item['description'].lower()
            for name, words in MATERIALS.items():
                if name in said and not any(word in material for word in words) and not any(w in said for w in ('to be confirmed', 'lining', 'framing')):
                    confidence, why = 'Medium', [f'the description says {name}; the model says {material.strip()[:60]}']
    if confidence == 'High' and entry.get('sources', {}).get('none') == entry['count'] and any(item['method'] not in ('count', 'item') for item in items):
        confidence, why = 'Medium', ['no quantities in the model: measured from the geometry']
    return {'decision': 'bill', 'held': confidence == 'Low', 'reason': '; '.join(why), 'items': items, 'confidence': confidence, 'guessing': bool(answer.get('guessing'))}


def measure(element: dict, item: dict, layers: list[dict]) -> tuple[float | None, str]:
    q = element['q']
    method = item['method']
    if method in ('count', 'item'):
        return 1.0, 'count'
    if method == 'weight':
        volume = q.get('volume')
        return (round(volume * STEEL_DENSITY, 4), 'volume × 7.85 t/m³') if volume else (None, 'no volume')
    value = q.get({'length': 'length', 'area': 'area', 'volume': 'volume'}[method])
    source = element['source']
    if item.get('layer') is not None and item['layer'] < len(layers):
        thickness = layers[item['layer']]['thickness_mm'] / 1000
        if method == 'volume' and q.get('area'):
            return round(q['area'] * thickness, 4), f'layer: area × {thickness * 1000:.0f}mm'
        value = q.get('area') if method == 'area' else value
    if value is None:
        found = element.setdefault('geometry', geometry_quantities(element['ifc'])) if element.get('ifc') else {}
        value = found.get({'length': 'length', 'area': 'area', 'volume': 'volume'}[method])
        source = 'geometry'
    return (round(value, 4), source) if value else (None, 'no quantity in the model')


def card_of(entry: dict, rows: list[dict]) -> dict:
    """One mapped type as the live feed shows it: what it is billed as, how much, and its elements."""
    mapping = entry['mapping']
    mine = [row for row in rows if row['type_key'] == entry['key']]
    qty: dict[str, float] = defaultdict(float)
    for row in mine:
        qty[row['unit']] += row['qty'] or 0
    decision = 'Excluded' if mapping['decision'] == 'exclude' else 'Not mapped' if mapping['decision'] == 'unmapped' else mapping['confidence']
    return {
        'key': entry['key'], 'title': (mapping['items'][0]['description'] if mapping.get('items') else f'{entry["type"]}: {mapping.get("reason") or "left out"}')[:160],
        'detail': ' · '.join(str(part) for part in (entry['class'].removeprefix('Ifc'), entry['type'], f'×{entry["count"]}', (mapping.get('items') or [{}])[0].get('section'), entry['model']) if part),
        'qty': ' + '.join(f'{value:,.2f} {unit}' for unit, value in qty.items() if value), 'confidence': decision, 'gids': entry['gids'][:400],
    }


def derive(elements: list[dict], rows: list[dict]) -> list[dict]:
    """Formwork, blinding, damp-proof membrane and anti-termite treatment, from the in-situ concrete code measured.
    ponytail: contact areas between touching elements are not deducted yet (a ground slab's edge on its foundation
    wall still gets edge formwork); add the geometric check when it matters."""
    concrete = {row['ref'] for row in rows if row['unit'] == 'm³' and 'concrete' in row['description'].lower() and row['status'] == 'billed'}
    section_of = {row['ref']: row['section'] for row in rows if row['ref'] in concrete}
    by_ref = {element['ref']: element for element in elements}
    out = []

    def add(element, section, key, description, qty, unit='m²'):
        if qty and qty > 0.0005:
            out.append({'ref': element['ref'], 'gid': element['ref'], 'storey': element['storey'], 'type_key': element['type_key'], 'section': section, 'description': description,
                        'unit': unit, 'qty': round(qty, 4), 'status': 'billed', 'source': 'derived', 'derived': key})

    slabs = [by_ref[ref] for ref in concrete if by_ref[ref]['class'] == 'IfcSlab']
    elevations = sorted({element['storey'] for element in slabs if element['storey']})
    for ref in concrete:
        element = by_ref[ref]
        q, cls, name = element['q'], element['class'], f'{element["type"]} {element["name"]}'.lower()
        section = section_of[ref]
        thickness = q.get('thickness') or q.get('height')
        if cls == 'IfcFooting':
            footprint = q['volume'] / thickness if q.get('volume') and thickness else None
            width = q.get('width')
            length = q.get('length') or (footprint / width if footprint and width else None)
            perimeter = 2 * (length + (width or 0)) if length else (4 * footprint ** 0.5 if footprint else None)
            if perimeter and thickness:
                add(element, section, 'formwork_foundations', 'Formwork to sides of foundations', perimeter * thickness)
            add(element, section, 'blinding', 'Plain in-situ concrete (1:3:6) blinding 50mm thick under foundations', footprint)
            add(element, section, 'anti_termite', 'Anti-termite treatment to soil under foundations and ground floor slab', footprint)
        elif cls == 'IfcSlab':
            ground = 'grade' in name or 'ground' in name or (elevations and element['storey'] == elevations[0] and section == 'Substructure')
            if q.get('perimeter') and thickness:
                add(element, section, 'formwork_slab_edge', 'Formwork to edges of ground floor slab' if ground else 'Formwork to edges of suspended slabs', q['perimeter'] * thickness)
            if ground:
                add(element, section, 'dpm', '1000 gauge polythene damp-proof membrane under ground floor slab', q.get('area'))
                add(element, section, 'anti_termite', 'Anti-termite treatment to soil under foundations and ground floor slab', q.get('area'))
            elif 'deck' not in name:
                add(element, section, 'formwork_soffit', 'Formwork to soffits of suspended slabs', q.get('area'))
        elif cls.startswith('IfcWall') and q.get('area'):
            add(element, section, 'formwork_walls', 'Formwork to faces of foundation walls' if section == 'Substructure' else 'Formwork to faces of walls', 2 * q['area'])
        elif cls in ('IfcColumn', 'IfcBeam', 'IfcMember') and q.get('area'):
            add(element, section, 'formwork_frame', 'Formwork to sides and soffits of beams' if cls == 'IfcBeam' else 'Formwork to sides of columns', q['area'])
        elif cls in ('IfcStair', 'IfcStairFlight', 'IfcSlab') and q.get('area'):
            add(element, section, 'formwork_stairs', 'Formwork to soffits and sides of staircases', q['area'])
    return out


def roll_up(rows: list[dict]) -> list[dict]:
    """The takeoff rows rolled up into measured lines, in Nigerian element order."""
    groups: dict[tuple, list[dict]] = defaultdict(list)
    for row in rows:
        if row['status'] == 'billed':
            groups[(row['section'], row['description'], row['unit'])].append(row)
    order = {section: at for at, section in enumerate(prompts.SECTIONS)}
    lines = []
    for number, ((section, description, unit), members) in enumerate(sorted(groups.items(), key=lambda item: (order.get(item[0][0], 99), item[0][1])), start=1):
        confidences = [member.get('confidence', 'High') for member in members]
        confidence = 'Low' if 'Low' in confidences else 'Medium' if 'Medium' in confidences else 'High'
        refs = sorted({member['ref'] for member in members})
        code = f'L{number:03d}'
        for member in members:
            member['code'] = code
        lines.append({
            'code': code, 'section': section, 'bill': prompts.BILL_OF[section], 'description': description, 'unit': unit,
            'qty': round(sum(member['qty'] for member in members), 3), 'count': len(refs), 'gids': refs, 'confidence': confidence,
            'derived': members[0].get('derived'), 'type_keys': sorted({member['type_key'] for member in members}),
        })
    return lines


def provisional_qty(basis: str, elements: list[dict], rows: list[dict]) -> float | None:
    """A provisional item's quantity, worked out by code from what it is based on (the AI never gives one)."""
    billed = [row for row in rows if row['status'] == 'billed']
    by_ref = {element['ref']: element for element in elements}
    ground = sum(row['qty'] for row in billed if row.get('derived') == 'dpm')
    footings = sum(row['qty'] for row in billed if row.get('derived') == 'blinding')
    excavation = footings * 1.5
    walls = [element for element in elements if element['class'].startswith('IfcWall')]
    masonry = [w for w in walls if re.search(r'block|brick|cmu|masonry|concrete', f'{w["type"]} {w["material"]}', re.I)]
    openings = [element for element in elements if element['class'] in ('IfcDoor', 'IfcWindow')]
    low = sorted({element['storey'] for element in walls if element['storey']})
    values = {
        'footprint': ground or None,
        'hardcore': ground or None,
        'excavation': excavation or None,
        'backfill': excavation / 3 or None,
        'surplus': excavation * 2 / 3 or None,
        'reinforcement': sum(row['qty'] for row in billed if row['unit'] == 'm³' and 'concrete' in row['description'].lower() and row['section'] == 'Substructure') * 0.1 or None,
        'lintels': sum((element['q'].get('width') or 0) + 0.3 for element in openings) or None,
        'dpc': sum(w['q'].get('length') or 0 for w in masonry if low and w['storey'] == low[0]) or None,
        'plaster': 2 * sum(w['q'].get('area') or 0 for w in masonry) or None,
        'wall_finish': 2 * sum(w['q'].get('area') or 0 for w in masonry) or None,
        'floor_finish': sum(by_ref[row['ref']]['q'].get('area') or 0 for row in billed if by_ref.get(row['ref'], {}).get('class') == 'IfcSlab' and row['unit'] == 'm³') or None,
        'perimeter_fence': (4 * ground ** 0.5 + 40) if ground else None,
    }
    value = values.get(basis)
    return round(value, 2) if value else None
