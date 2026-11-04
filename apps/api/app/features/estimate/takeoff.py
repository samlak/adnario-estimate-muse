"""The takeoff's code side (README §7.2): the AI's mapping of each type checked and given code's confidence, each element
measured, formwork, blinding and membranes derived from the faces of the in-situ concrete, reinforcement measured or
made provisional, the rows rolled up into measured lines, code's own review questions, and provisional quantities
worked out. No AI here: everything can be repeated. The measuring rules are RULES in constants.py (BESMM4R, in the
SMM7 tradition)."""

import re
from collections import defaultdict
from statistics import median

import numpy as np

from app.features.estimate.constants import (
    BILL_OF, DERIVED_RATE, GENERIC, HOLLOW, IN_SITU, MATERIALS, METHODS, NOT_IN_SITU, ON_DECK, RULES, SECTIONS,
)
from app.features.estimate.shapes import free, neighbours, one_shape

BARS = ('IfcReinforcingBar', 'IfcReinforcingMesh')


def identity(entry: dict) -> tuple:
    """A type's identity across revisions: its decisions carry over when the architect sends a new version."""
    return (entry['model'], entry['class'], entry.get('family'), entry['type'], str(entry.get('layers')), entry.get('size'))


def concrete_layer(layer: dict) -> bool:
    return any(word in layer['material'].lower() for word in MATERIALS['concrete'])


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
        if section not in SECTIONS:
            problems.append(f'section {section!r} is not one of ours')
            continue
        if method not in METHODS or METHODS[method] != unit:
            problems.append(f'{method} is not measured in {unit}')
            continue
        layer = item.get('layer')
        if layer is not None and not (isinstance(layer, int) and 0 <= layer < len(layers)):
            layer = None
        items.append({'description': str(item.get('description') or '').strip()[:300], 'section': section, 'unit': unit, 'method': method, 'layer': layer})
    if not items:
        return {'decision': 'unmapped', 'held': False, 'reason': '; '.join(problems) or 'no BOQ item given', 'items': [], 'confidence': 'Low'}
    if entry.get('duplicate_of'):
        # the copy in the other model keeps only what the governing model does not bill: the screed and finishes over a
        # structural slab, not its concrete
        items = [item for item in items if item['layer'] is not None and not concrete_layer(layers[item['layer']])]
        if not items:
            return {'decision': 'exclude', 'held': False, 'reason': f'billed from {entry["duplicate_of"]}', 'items': [], 'confidence': 'High'}
    confidence, why = 'High', []
    if answer.get('guessing'):
        confidence, why = 'Low', ['the AI said it was guessing']
    sections = {item['section'] for item in items}
    if entry['class'] == 'IfcDoor' and sections != {'Doors'} or entry['class'] == 'IfcWindow' and sections != {'Windows'}:
        confidence, why = 'Low', [f'an {entry["class"]} billed in {", ".join(sorted(sections))}']
    if GENERIC.match(entry['type'] or ''):
        confidence, why = 'Low', [f'the type name "{entry["type"]}" says nothing']
    material = f'{entry.get("material") or ""} {" ".join(layer["material"] for layer in layers)}'.lower()
    if confidence == 'High' and material.strip():
        for item in items:
            said = item['description'].lower()
            for name, words in MATERIALS.items():
                if name in said and not any(word in material for word in words) and not any(w in said for w in ('to be confirmed', 'lining', 'framing')):
                    confidence, why = 'Medium', [f'the description says {name}; the model says {material.strip()[:60]}']
    if confidence == 'High' and entry.get('sources', {}).get('none') == entry['count'] and any(item['method'] not in ('count', 'item') for item in items):
        confidence, why = 'Medium', ['no quantities in the model: measured from the geometry']
    if entry.get('duplicate_of'):
        why.append(f'the rest is billed from {entry["duplicate_of"]}')
    return {'decision': 'bill', 'held': confidence == 'Low', 'reason': '; '.join(why), 'items': items, 'confidence': confidence, 'guessing': bool(answer.get('guessing'))}


def density(element: dict, description: str) -> float | None:
    text = f'{element.get("material") or ""} {description}'.lower()
    return next((value for word, value in RULES['densities'].items() if word in text), None)


def measure(element: dict, item: dict, layers: list[dict]) -> tuple[float | None, str]:
    """One element's quantity for one BOQ item, and where it came from: the model's figures first, its shape after."""
    q = element['q']
    method = item['method']
    if method in ('count', 'item'):
        return 1.0, 'count'
    wanted = 'volume' if method in ('weight', 'volume') else method
    if 'shape' not in element and element.get('ifc') is not None and not q.get(wanted):
        element['shape'] = one_shape(element['ifc'])  # read now: the model does not state what this item needs
    shape = element.get('shape')
    found = shape.quantities() if shape else {}
    if method == 'weight':
        rho = density(element, item.get("description", ""))
        if not rho:
            return None, f'no density for {element.get("material") or "an unknown material"}'
        volume, source = (q['volume'], 'model') if q.get('volume') else (found.get('volume'), 'geometry')
        return (round(volume * rho, 4), f'volume × {rho:g} t/m³' + (' (from the shape)' if source == 'geometry' else '')) if volume else (None, 'no volume')
    value = q.get(method)
    source = element['source']
    if item.get('layer') is not None and item['layer'] < len(layers):
        thickness = layers[item['layer']]['thickness_mm'] / 1000
        area = q.get('area') or found.get('area')
        if method == 'volume' and area:
            return round(area * thickness, 4), f'layer: area × {thickness * 1000:.0f}mm' + ('' if q.get('area') else ' (area from the shape)')
        value = q.get('area') if method == 'area' else value
    if value is None and found.get(method):
        value, source = found[method], 'geometry'
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


# ── Derived: formwork, beds and reinforcement from the in-situ concrete ──

def in_situ(row: dict, element: dict) -> bool:
    """Concrete cast in place: by the description or the model's material, never precast, planks or blinding."""
    if row['unit'] != 'm³' or row['status'] != 'billed' or NOT_IN_SITU.search(row['description']):
        return False
    material = (element.get('material') or '').lower()
    if re.search(r'precast|pre-cast|hollow', material):
        return False
    text = f'{row["description"]} {material}'.lower()
    return any(word in text for word in IN_SITU)


def ground_level(summaries: list[dict] | None) -> float | None:
    levels = [storey['elevation'] for summary in summaries or [] for storey in summary['storeys'] if storey.get('elevation') is not None]
    return min(levels) if levels else None


def kind_of(element: dict, ground: float | None, lowest_storey: str | None) -> str | None:
    """What the concrete is, for its formwork and its bars: foundations, ground slab, suspended slabs, beams, columns,
    walls or stairs (None for piles, which get neither)."""
    cls, name = element['class'], f'{element["type"]} {element["name"] or ""}'.lower()
    if cls.startswith('IfcPile'):
        return None
    if cls.startswith('IfcFooting'):
        return 'foundations'
    if cls.startswith(('IfcStair', 'IfcRamp')) or 'stair' in name or 'landing' in name:
        return 'stairs'
    if cls.startswith('IfcColumn'):
        return 'columns'
    if cls.startswith(('IfcBeam', 'IfcMember')):
        return 'beams'
    if cls.startswith('IfcWall'):
        return 'walls'
    if cls.startswith(('IfcSlab', 'IfcRoof')):
        shape = element.get('shape')
        if re.search(r'grade|ground|on fill|\bsog\b', name):
            return 'ground slab'
        if shape is not None and ground is not None:
            return 'ground slab' if shape.lo[2] <= ground + RULES['ground_within'] else 'suspended slabs'
        return 'ground slab' if lowest_storey and element['storey'] == lowest_storey else 'suspended slabs'
    return None


def band(height: float) -> str:
    return next((words for limit, words in RULES['edge_bands'] if height <= limit + 0.005), 'over 1m high')


def derive(elements: list[dict], rows: list[dict], summaries: list[dict] | None = None) -> list[dict]:
    """Formwork, blinding, damp-proof membrane and anti-termite treatment from each in-situ concrete element's faces:
    what touches other concrete or steel gets no formwork. Without a shape, from its dimensions (marked for review)."""
    by_ref = {element['ref']: element for element in elements}
    concrete: dict[str, dict] = {}
    for row in rows:
        element = by_ref.get(row['ref'])
        if element and row['ref'] not in concrete and in_situ(row, element):
            concrete[row['ref']] = row
    # what concrete is formed against: every concrete or steel element billed by volume or weight, precast too
    solid = {row['ref'] for row in rows if row['status'] == 'billed' and row['unit'] in ('m³', 't') and by_ref.get(row['ref'], {}).get('shape')
             and by_ref[row['ref']]['class'] not in BARS}
    shapes = {ref: by_ref[ref]['shape'] for ref in solid}
    near = neighbours(shapes)
    ground = ground_level(summaries)
    storeys = sorted({s['name']: s['elevation'] for summary in summaries or [] for s in summary['storeys'] if s.get('elevation') is not None}.items(), key=lambda kv: kv[1])
    lowest = storeys[0][0] if storeys else None
    out = []

    def add(element, row, key, description, qty, basis, unit='m²'):
        if qty and qty > 0.0005:
            out.append({'ref': element['ref'], 'gid': element['ref'], 'storey': element['storey'], 'type_key': element['type_key'], 'section': row['section'],
                        'description': description, 'unit': unit, 'qty': round(qty, 4), 'status': 'billed', 'source': 'derived', 'derived': key,
                        'basis': basis, 'rate_code': DERIVED_RATE.get(key),
                        'confidence': 'Medium' if basis == 'dimensions' and row.get('confidence', 'High') == 'High' else row.get('confidence', 'High')})

    for ref, row in concrete.items():
        element = by_ref[ref]
        kind = kind_of(element, ground, lowest)
        element['kind'] = kind
        if kind is None:
            continue
        shape = element.get('shape')
        name = f'{element["type"]} {element["name"] or ""} {row["description"]} {" ".join(layer["material"] for layer in element.get("layers") or [])}'
        substructure = row['section'] == 'Substructure'
        if shape is not None:
            faces = free(shape, [shapes[other] for other in near.get(ref, [])])
            sides, soffit, under = faces[0], faces[-1], shape.area(-1)
            height = float(shape.size[2])
            basis = 'faces'
        else:
            sides, soffit, under, height = fallback_faces(element, kind)
            basis = 'dimensions'
            element['derive_basis'] = 'dimensions' if sides or soffit or under else 'none'
        if kind == 'foundations':
            add(element, row, 'formwork_foundations', f'Formwork to sides of foundations, {band(height)}', sides, basis)
            add(element, row, 'blinding', f'Plain in-situ concrete (1:3:6) blinding {RULES["blinding_mm"]}mm thick under foundations', under, basis)
            add(element, row, 'anti_termite', 'Anti-termite treatment to soil under foundations and ground floor slab', under, basis)
        elif kind == 'ground slab':
            add(element, row, 'formwork_slab_edge', f'Formwork to edges of ground floor slab, {band(height)}', sides, basis)
            add(element, row, 'dpm', '1000 gauge polythene damp-proof membrane under ground floor slab', under, basis)
            add(element, row, 'anti_termite', 'Anti-termite treatment to soil under foundations and ground floor slab', under, basis)
        elif kind == 'suspended slabs':
            add(element, row, 'formwork_slab_edge', f'Formwork to edges of suspended slabs, {band(height)}', sides, basis)
            if not ON_DECK.search(name):
                small = sum(area for area in element.get('openings') or [] if area <= RULES['soffit_void'])
                add(element, row, 'formwork_soffit', 'Formwork to soffits of suspended slabs', soffit + small, basis)
        elif kind == 'columns':
            round_ = re.search(r'round|circular|diameter|ø|dia\b', name.lower())
            add(element, row, 'formwork_columns', 'Formwork to sides of circular columns' if round_ else 'Formwork to sides of columns', sides, basis)
        elif kind == 'beams':
            add(element, row, 'formwork_beams', 'Formwork to sides and soffits of beams', sides + soffit, basis)
        elif kind == 'walls':
            add(element, row, 'formwork_walls', 'Formwork to faces of foundation walls' if substructure else 'Formwork to faces of walls', sides, basis)
        elif kind == 'stairs':
            add(element, row, 'formwork_stairs', 'Formwork to soffits and sides of staircases', soffit + sides, basis)
    return out


def fallback_faces(element: dict, kind: str) -> tuple[float, float, float, float]:
    """(sides, soffit, underside, height) from the element's dimensions when its shape could not be read: gross, with
    nothing deducted for what it touches."""
    q = element['q']
    thickness = q.get('thickness') or q.get('height') or 0
    if kind == 'foundations':
        footprint = q['volume'] / thickness if q.get('volume') and thickness else 0
        width = q.get('width')
        length = q.get('length') or (footprint / width if footprint and width else None)
        perimeter = 2 * (length + (width or 0)) if length else (4 * footprint ** 0.5 if footprint else 0)
        return perimeter * thickness, 0, footprint, thickness
    if kind in ('ground slab', 'suspended slabs'):
        return (q.get('perimeter') or 0) * thickness, q.get('area') or 0, q.get('area') or 0, thickness
    if kind == 'columns':
        return q.get('surface') or 0, 0, 0, q.get('height') or q.get('length') or 0
    if kind == 'beams':
        top = (q.get('width') or 0) * (q.get('length') or 0)
        surface = q.get('surface') or 0
        return max(0, surface - 2 * top), top, top, q.get('height') or 0
    if kind == 'walls':
        return 2 * (q.get('area') or 0), 0, 0, q.get('height') or 0
    return q.get('area') or 0, 0, 0, 0  # stairs


def bar_weight(element: dict) -> tuple[float | None, float | None]:
    """A bar's (or a group of bars') weight in t and its diameter in mm: Qto weight, else length × π d²/4 × 7.85."""
    entity, q = element.get('ifc'), element['q']
    import ifcopenshell.util.element as E

    psets = E.get_psets(entity) if entity is not None else {}
    kind = E.get_type(entity) if entity is not None else None
    scale = element.get('scale', 1.0)
    diameter = getattr(entity, 'NominalDiameter', None) or getattr(kind, 'NominalDiameter', None)
    length = getattr(entity, 'BarLength', None) or getattr(kind, 'BarLength', None)
    weight = next((values.get('Weight') for values in psets.values() if values.get('Weight')), None)
    count = next((values.get('Count') for values in psets.values() if isinstance(values.get('Count'), int)), None) or 1
    d = float(diameter) * scale if diameter else None
    if weight:
        return float(weight) / 1000, d * 1000 if d else None
    if d and length:
        return count * float(length) * scale * 3.1416 * d * d / 4 * 7.85, d * 1000
    volume = q.get('volume') or (element['shape'].volume if element.get('shape') else None)
    return (volume * 7.85 if volume else None), (d * 1000 if d else None)


def reinforce(elements: list[dict], rows: list[dict], concrete_rows: dict[str, dict]) -> tuple[list[dict], list[dict]]:
    """Modelled bars measured and billed under the concrete they sit in (by where the bar's middle is); bars with no
    host returned for the review. Rows like derived ones; unhosted bars as a list of elements."""
    by_ref = {element['ref']: element for element in elements}
    hosts = [(by_ref[ref], row) for ref, row in concrete_rows.items() if by_ref[ref].get('shape') is not None]
    out, lost = [], []
    for bar in (element for element in elements if element['class'] in BARS):
        weight, diameter = bar_weight(bar)
        shape = bar.get('shape')
        middle = (shape.lo + shape.hi) / 2 if shape is not None else None
        inside = [(host, row) for host, row in hosts if middle is not None and np.all(host['shape'].lo - 0.01 <= middle) and np.all(middle <= host['shape'].hi + 0.01)]
        if not inside or not weight:
            lost.append(bar)
            continue
        host, row = min(inside, key=lambda pair: pair[0]['shape'].volume)  # the most particular: a column's starter bar is the column's
        mesh = bar['class'] == 'IfcReinforcingMesh'
        what = f'{diameter:.0f}mm diameter ' if diameter and not mesh else ''
        description = f'Welded fabric mesh reinforcement in {host.get("kind") or "concrete"}' if mesh else f'High yield bar reinforcement, {what}in {host.get("kind") or "concrete"}'
        qty = (bar['q'].get('area') or (shape.area(1) if shape is not None else 0)) if mesh else weight
        out.append({'ref': bar['ref'], 'gid': bar['ref'], 'storey': host['storey'], 'type_key': host['type_key'], 'section': row['section'],
                    'description': description, 'unit': 'm²' if mesh else 't', 'qty': round(qty, 4), 'status': 'billed', 'source': 'derived',
                    'derived': 'mesh' if mesh else 'rebar', 'basis': 'bars', 'kind': host.get('kind'), 'rate_code': DERIVED_RATE['mesh' if mesh else 'rebar'],
                    'confidence': row.get('confidence', 'High')})
    return out, lost


def provisional_rebar(elements: list[dict], rows: list[dict], concrete_rows: dict[str, dict], billed_bars: list[dict]) -> list[dict]:
    """When the model has no bars for a kind of concrete: its reinforcement by the kg/m³ of RULES, as provisional."""
    by_ref = {element['ref']: element for element in elements}
    barred = {row.get('kind') for row in billed_bars}
    volume: dict[str, float] = defaultdict(float)
    section: dict[str, dict] = defaultdict(lambda: defaultdict(float))
    for ref, row in concrete_rows.items():
        kind = by_ref[ref].get('kind')
        if kind and kind not in barred:
            volume[kind] += row['qty']
            section[kind][row['section']] += row['qty']
    out = []
    for kind, m3 in volume.items():
        rate = RULES['rebar_kg_m3'].get(kind)
        if not rate or m3 <= 0:
            continue
        where = max(section[kind].items(), key=lambda kv: kv[1])[0]
        out.append({'description': f'High yield bar reinforcement to {kind} (provisional; bar schedule to be confirmed)', 'section': where, 'bill': BILL_OF[where],
                    'unit': 't', 'basis': 'reinforcement', 'qty': round(m3 * rate / 1000, 2), 'rate_code': DERIVED_RATE['rebar'],
                    'reason': f'No bars in the model: {rate} kg/m³ of the {m3:,.1f} m³ of in-situ concrete in {kind}'})
    return out


def concrete_of(elements: list[dict], rows: list[dict]) -> dict[str, dict]:
    """{ref: its in-situ concrete row} (the first, when a build-up has more than one)."""
    by_ref = {element['ref']: element for element in elements}
    out: dict[str, dict] = {}
    for row in rows:
        if row['ref'] in by_ref and row['ref'] not in out and in_situ(row, by_ref[row['ref']]):
            out[row['ref']] = row
    return out


def roll_up(rows: list[dict]) -> list[dict]:
    """The takeoff rows rolled up into measured lines, in Nigerian element order."""
    groups: dict[tuple, list[dict]] = defaultdict(list)
    for row in rows:
        if row['status'] == 'billed':
            groups[(row['section'], row['description'], row['unit'])].append(row)
    order = {section: at for at, section in enumerate(SECTIONS)}
    lines = []
    for number, ((section, description, unit), members) in enumerate(sorted(groups.items(), key=lambda item: (order.get(item[0][0], 99), item[0][1])), start=1):
        confidences = [member.get('confidence', 'High') for member in members]
        confidence = 'Low' if 'Low' in confidences else 'Medium' if 'Medium' in confidences else 'High'
        refs = sorted({member['ref'] for member in members})
        code = f'L{number:03d}'
        for member in members:
            member['code'] = code
        rate_codes = {member.get('rate_code') for member in members}
        lines.append({
            'code': code, 'section': section, 'bill': BILL_OF[section], 'description': description, 'unit': unit,
            'qty': round(sum(member['qty'] for member in members), 3), 'count': len(refs), 'gids': refs, 'confidence': confidence,
            'derived': members[0].get('derived'), 'type_keys': sorted({member['type_key'] for member in members if member['type_key']}),
            'rate_code': rate_codes.pop() if len(rate_codes) == 1 else None,
        })
    return lines


# ── Code's own review: what it could not settle, as questions for the QS ──

SIZE = re.compile(r'(\d{2,5}(?:\.\d+)?)\s*[x×]\s*(\d{2,5}(?:\.\d+)?)\s*[x×]\s*(\d{2,5}(?:\.\d+)?)|(\d{2,5})\s*[x×]\s*(\d{2,5})\s*mm', re.I)


def stated_size(name: str) -> list[float] | None:
    """The size a type name states, in m, largest first: '2000 x 2000 x 300mm' or '600 × 600 × 900'."""
    found = SIZE.search(name or '')
    if not found:
        return None
    return sorted((float(part) / 1000 for part in found.groups() if part), reverse=True)


def issues(elements: list[dict], types: list[dict], rows: list[dict], lost_bars: list[dict] = ()) -> list[dict]:
    """Every problem code found, each a question: {severity, question, refs, line_codes, source: 'code'}."""
    by_type = {entry['key']: entry for entry in types}
    by_ref = {element['ref']: element for element in elements}
    code_of: dict[str, set] = defaultdict(set)
    for row in rows:
        if row.get('code'):
            code_of[row['ref']].add(row['code'])
    out = []

    def ask(severity, question, refs):
        refs = sorted(set(refs))
        out.append({'severity': severity, 'question': question[:600], 'refs': refs[:400],
                    'line_codes': sorted({code for ref in refs for code in code_of.get(ref, ())}), 'source': 'code'})

    def named(key):
        entry = by_type.get(key) or {}
        return f'{entry.get("type") or "?"} ({(entry.get("class") or "").removeprefix("Ifc")}, {entry.get("model") or "?"})'

    grouped = defaultdict(list)
    for row in rows:
        if row['status'] == 'not_measured':
            grouped[('none', row['type_key'], row['source'])].append(row['ref'])
        elif row['source'] == 'geometry' and row['status'] == 'billed':
            grouped[('geometry', row['type_key'], row['unit'])].append(row['ref'])
    for (kind, key, why), refs in grouped.items():
        if kind == 'none':
            severity = 'high'
            ask(severity, f'{len(set(refs))} of {named(key)} could not be measured ({why}): they are not in the BOQ. Measure them by hand or fix the model.', refs)
        else:  # a volume from the shape is the one most likely wrong (a stair modelled as a solid wedge)
            ask('medium' if why == 'm³' else 'low', f'{len(set(refs))} of {named(key)} have no quantities in the model and were measured from their 3D shape '
                f'({why}): check one against the drawings.', refs)

    for entry in types:
        mapping = entry.get('mapping') or {}
        layers = entry.get('layers') or []
        used = {item.get('layer') for item in mapping.get('items') or []}
        if mapping.get('decision') == 'bill' and layers and used - {None}:
            missing = [layer for at, layer in enumerate(layers) if at not in used]
            if missing:
                ask('medium', f'{named(entry["key"])} is billed layer by layer, but its {", ".join(f"{l["thickness_mm"]}mm {l["material"]}" for l in missing)} '
                    f'{"is" if len(missing) == 1 else "are"} not billed: should {"it" if len(missing) == 1 else "they"} be?', entry['gids'])

    for element in elements:
        if element.get('derive_basis') == 'none':
            ask('medium', f'{named(element["type_key"])}: in-situ concrete with no readable shape and too few dimensions: it has no formwork in the BOQ.', [element['ref']])
    dims = defaultdict(list)
    for element in elements:
        if element.get('derive_basis') == 'dimensions':
            dims[element['type_key']].append(element['ref'])
    for key, refs in dims.items():
        ask('medium', f'The formwork to {len(refs)} of {named(key)} comes from their dimensions (their shape could not be read), with nothing deducted where they touch other concrete.', refs)

    # a type fixes its section: a pad, a column, a beam of one type weighs the same per metre; walls and finishes do not
    by_type_rows = defaultdict(list)
    for row in rows:
        element = by_ref.get(row['ref'])
        if (row['status'] == 'billed' and row['source'] != 'derived' and row['qty'] and row['unit'] in ('m³', 't') and element
                and element['class'].startswith(('IfcFooting', 'IfcPile', 'IfcColumn', 'IfcBeam', 'IfcMember'))):
            by_type_rows[(row['type_key'], row['unit'])].append((row['ref'], row['qty'] / (element['q'].get('length') or 1)))
    for (key, unit), members in by_type_rows.items():
        if len(members) >= 4:
            middle = median(value for _, value in members)
            odd = [ref for ref, value in members if middle and (value > 3 * middle or value < middle / 3)]
            if odd:
                ask('medium', f'{len(odd)} of the {len(members)} {named(key)} are far from the rest in {unit} per metre: check they are modelled right.', odd)

    size_off = defaultdict(list)
    for element in elements:
        stated, shape = stated_size(element['type']), element.get('shape')
        if stated and shape is not None and element['class'].startswith(('IfcFooting', 'IfcColumn', 'IfcBeam', 'IfcSlab', 'IfcPile')):
            actual = sorted(shape.size, reverse=True)[:len(stated)]
            if any(abs(a - s) > 0.15 * s for a, s in zip(actual, stated)):
                size_off[element['type_key']].append(element['ref'])
    for key, refs in size_off.items():
        ask('medium', f'{len(refs)} of {named(key)} are not the size the type name says: measured as modelled, check which is right.', refs)

    solid_hollow = defaultdict(list)
    for row in rows:
        element = by_ref.get(row['ref'])
        if row['unit'] == 't' and element and HOLLOW.search(f'{element["type"]} {row["description"]}') and element.get('shape') is not None:
            q, shape = element['q'], element['shape']
            length = q.get('length') or float(max(shape.size))
            box = float(np.prod(sorted(shape.size)[:2]))
            section = q.get('section') or (shape.volume / length if length else None)
            if box and section and section / box > 0.8:
                solid_hollow[row['type_key']].append(row['ref'])
    for key, refs in solid_hollow.items():
        ask('high', f'{named(key)} is a hollow section but is modelled solid, so its weight is far too high: weigh it from the section table.', refs)

    if lost_bars:
        ask('medium', f'{len(lost_bars)} reinforcing bars sit in no in-situ concrete element (or have no weight): they are not in the BOQ.', [bar['ref'] for bar in lost_bars])

    fixed = [element['ref'] for element in elements if element.get('fixed')]
    if fixed:
        ask('low', f'{len(fixed)} elements stated their volume 1000 times too big (a Revit export fault); code divided it by 1000.', fixed)

    out.extend(duplicates(elements, rows, named))
    order = {'high': 0, 'medium': 1, 'low': 2}
    return sorted(out, key=lambda question: order[question['severity']])


def duplicates(elements: list[dict], rows: list[dict], named) -> list[dict]:
    """The same thing modelled in two models with different ids: same kind of element, their boxes mostly the same."""
    billed = {row['ref'] for row in rows if row['status'] == 'billed' and row['source'] != 'derived'}
    shaped = {e['ref']: e for e in elements if e['ref'] in billed and e.get('shape') is not None and e['class'] not in BARS}
    if len({e['model'] for e in shaped.values()}) < 2:
        return []
    near = neighbours({ref: e['shape'] for ref, e in shaped.items()})
    pairs = defaultdict(set)
    for ref, others in near.items():
        a = shaped[ref]
        for other in others:
            b = shaped[other]
            if a['model'] >= b['model'] or a['class'][:7] != b['class'][:7]:
                continue
            lo, hi = np.maximum(a['shape'].lo, b['shape'].lo), np.minimum(a['shape'].hi, b['shape'].hi)
            overlap = float(np.prod(np.clip(hi - lo, 0, None)))
            smaller = min(float(np.prod(a['shape'].size)), float(np.prod(b['shape'].size)))
            if smaller and overlap / smaller > 0.8:
                pairs[(a['type_key'], b['type_key'])].update((ref, other))
    return [{'severity': 'high', 'question': f'{named(a)} and {named(b)} occupy the same space in two models: is it modelled twice? Both are billed now.',
             'refs': sorted(refs)[:400], 'line_codes': [], 'source': 'code'} for (a, b), refs in pairs.items()]


# ── Provisional quantities ──

UNITS_OF = {'footprint': ('m²',), 'hardcore': ('m³', 'm²'), 'excavation': ('m³',), 'backfill': ('m³',), 'surplus': ('m³',),
            'lintels': ('m',), 'dpc': ('m',), 'plaster': ('m²',), 'wall_finish': ('m²',), 'floor_finish': ('m²',), 'perimeter_fence': ('m',)}


def provisional_qty(basis: str, elements: list[dict], rows: list[dict], unit: str = '', summaries: list[dict] | None = None) -> float | None:
    """A provisional item's quantity in its unit, worked out by code from what it is based on (the AI never gives one).
    A lump sum (item, nr) is 1; a unit the basis cannot give is None."""
    if unit in ('item', 'nr') and basis != 'none':
        return 1.0
    if basis not in UNITS_OF or (unit and unit not in UNITS_OF[basis]):
        return None
    billed = [row for row in rows if row['status'] == 'billed']
    by_ref = {element['ref']: element for element in elements}
    ground = sum(row['qty'] for row in billed if row.get('derived') == 'dpm')
    level = ground_level(summaries)
    dig = 0.0
    for row in billed:
        if row.get('derived') != 'blinding':
            continue
        shape = by_ref.get(row['ref'], {}).get('shape')
        if shape is not None and level is not None:  # from the ground down to the blinding's underside
            dig += row['qty'] * max(0.0, level - float(shape.lo[2]) + RULES['blinding_mm'] / 1000)
        else:
            dig += row['qty'] * 1.5  # ponytail: 1.5m deep when the footing's level is not known
    buried = sum(row['qty'] for row in billed if row['unit'] == 'm³' and by_ref.get(row['ref'], {}).get('kind') == 'foundations')
    excavation = dig + ground * RULES['reduced_level_m']
    walls = [element for element in elements if element['class'].startswith('IfcWall')]
    masonry = [w for w in walls if re.search(r'block|brick|cmu|masonry|concrete', f'{w["type"]} {w["material"]}', re.I)]
    openings = [element for element in elements if element['class'] in ('IfcDoor', 'IfcWindow')]
    low = sorted({element['storey'] for element in walls if element['storey']})
    values = {
        'footprint': ground or None,
        'hardcore': (ground * RULES['hardcore_m'] if unit == 'm³' else ground) or None,
        'excavation': excavation or None,
        'backfill': max(0.0, dig - buried) or None,
        'surplus': (excavation - max(0.0, dig - buried)) or None,
        'lintels': sum((element['q'].get('width') or 0) + 0.3 for element in openings) or None,
        'dpc': sum(w['q'].get('length') or 0 for w in masonry if low and w['storey'] == low[0]) or None,
        'plaster': 2 * sum(w['q'].get('area') or 0 for w in masonry) or None,
        'wall_finish': 2 * sum(w['q'].get('area') or 0 for w in masonry) or None,
        'floor_finish': sum(by_ref[row['ref']]['q'].get('area') or 0 for row in billed if by_ref.get(row['ref'], {}).get('class') == 'IfcSlab' and row['unit'] == 'm³') or None,
        'perimeter_fence': (4 * ground ** 0.5 + 40) if ground else None,
    }
    value = values.get(basis)
    return round(value, 2) if value else None
