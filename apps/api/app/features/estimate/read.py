"""Read and Catalogue: code reads every element of every model (class, type, storey, materials, layers,
quantities), and groups them into types (same model, class, type name, build-up and size). That compact catalogue is
what the AI reads, never the IFC file.

Measuring takes each quantity from the cheapest reliable source: the standard IFC quantity sets (with guards for the
Revit exporter's bugs), Revit's own dimensions, then the geometry. Doors and windows get their size from the element,
never from a name."""

import re
from collections import Counter, defaultdict

import ifcopenshell.util.element as E
import ifcopenshell.util.unit as U

from app.features.estimate.constants import LINEAR, RULES, SHAPED, SKIP, STRUCTURAL
from app.features.estimate.shapes import read_shapes


def number(value):
    return float(value) if isinstance(value, (int, float)) and not isinstance(value, bool) else None


def split_name(name: str | None) -> tuple[str | None, str]:
    """Revit's "Family:Type:12345" into its family and type."""
    parts = [part for part in (name or '').split(':') if part]
    if parts and parts[-1].isdigit():
        parts = parts[:-1]
    if len(parts) >= 2:
        return parts[0], ':'.join(parts[1:])
    return None, parts[0] if parts else 'Unnamed'


def layers_of(element, scale: float = 1.0) -> list[dict]:
    material = E.get_material(element)
    layer_set = getattr(material, 'ForLayerSet', None) or (material if material and material.is_a('IfcMaterialLayerSet') else None)
    if not layer_set:
        return []
    return [
        {'material': layer.Material.Name if layer.Material else 'Unknown', 'thickness_mm': round(float(layer.LayerThickness) * scale * 1000)}
        for layer in layer_set.MaterialLayers
        if layer.LayerThickness
    ]


def storey_of(element) -> str | None:
    container = E.get_container(element)
    if container is None and element.Decomposes:  # a roof slab, a stair flight: its whole's storey
        container = E.get_container(element.Decomposes[0].RelatingObject)
    return container.Name if container else None


def quantities(element, scale: float = 1.0) -> tuple[dict, str]:
    """Length, area, volume (and width, height, thickness, perimeter) with where they came from. scale is the file's
    length unit in metres (0.001 for a model authored in mm): every length is in it, areas and volumes are not."""
    psets = E.get_psets(element)
    qto = {key: number(value) for name, values in psets.items() if name.startswith('Qto_') for key, value in values.items() if number(value)}
    revit = {key: number(value) for key, value in psets.get('PSet_Revit_Dimensions', {}).items() if number(value)}
    revit_type = {}
    for name in ('PSet_Revit_Type_Dimensions', 'PSet_Revit_Type_Construction'):
        revit_type.update({key: number(value) for key, value in psets.get(name, {}).items() if number(value)})
    out: dict = {}
    source = 'none'
    if qto:
        source = 'quantity set'
        out['length'] = qto.get('Length') or qto.get('NetLength') or qto.get('GrossLength')
        out['area'] = qto.get('NetSideArea') or qto.get('GrossSideArea') or qto.get('NetArea') or qto.get('GrossArea') or qto.get('NetFootprintArea') or qto.get('GrossFootprintArea')
        if element.is_a('IfcSlab') and qto.get('NetArea') and qto.get('GrossArea') and qto['NetArea'] > 1.8 * qto['GrossArea']:
            out['area'] = qto['GrossArea']  # the slab's "net area" is its whole surface
        out['volume'] = qto.get('NetVolume') or qto.get('GrossVolume')
        out['width'] = qto.get('Width')
        out['height'] = qto.get('Height') or qto.get('Depth')
        out['perimeter'] = qto.get('Perimeter')
        out['surface'] = qto.get('OuterSurfaceArea') or qto.get('GrossSurfaceArea') or qto.get('NetSurfaceArea')
        out['section'] = qto.get('CrossSectionArea')
        out['net'] = bool(qto.get('NetSideArea')) and out['area'] == qto.get('NetSideArea')
    if revit:
        source = 'quantity set' if qto else 'Revit dimensions'
        for key, mine in (('length', 'Length'), ('area', 'Area'), ('volume', 'Volume'), ('width', 'Width'), ('perimeter', 'Perimeter'), ('thickness', 'Thickness')):
            out[key] = out.get(key) or revit.get(mine)
        out['net'] = out.get('net') or (not qto and bool(revit.get('Area')) and element.is_a('IfcWall'))  # Revit's wall area is net
        out['length'] = out.get('length') or number(psets.get('PSet_Revit_Structural', {}).get('Cut Length'))
    out['width'] = out.get('width') or revit_type.get('Width')
    out['length'] = out.get('length') or (revit_type.get('Length') if element.is_a('IfcFooting') else None)
    out['height'] = out.get('height') or revit_type.get('Height') or number(psets.get('PSet_Revit_Constraints', {}).get('Unconnected Height'))
    out['thickness'] = out.get('thickness') or revit_type.get('Foundation Thickness') or revit_type.get('Thickness') or revit_type.get('Default Thickness')
    for attribute, key in (('OverallWidth', 'width'), ('OverallHeight', 'height')):  # a door or window: its own size
        if number(getattr(element, attribute, None)):
            out[key] = number(getattr(element, attribute))
    raw_perimeter = out.get('perimeter')
    for key in LINEAR:
        if out.get(key):
            out[key] *= scale
    # Revit writes some perimeters in metres in a mm model: none can be shorter than a circle's of the same area
    if raw_perimeter and out.get('area') and out['perimeter'] < 2 * (3.1416 * out['area']) ** 0.5:
        out['perimeter'] = raw_perimeter
    if element.is_a('IfcFooting') and not out.get('volume') and all(out.get(key) for key in ('length', 'width', 'thickness')):
        out['volume'] = out['length'] * out['width'] * out['thickness']  # a pad that states only its type's size
        source = 'Revit type dimensions'
    if element.is_a('IfcDoor') or element.is_a('IfcWindow'):
        if out.get('width') and out['width'] > 20:  # mm
            out['width'] /= 1000
        if out.get('height') and out['height'] > 20:
            out['height'] /= 1000
    return {key: value for key, value in out.items() if value}, source


def openings_of(element, shapes: dict) -> list[float]:
    """The area (m²) of each opening cut in the element: its two larger sizes, from the opening's own shape."""
    areas = []
    for rel in getattr(element, 'HasOpenings', None) or []:
        shape = shapes.get(rel.RelatedOpeningElement.id())
        if shape:
            a, b, _ = sorted(shape.size, reverse=True)
            areas.append(float(a * b))
    return areas


def structural(element) -> bool:
    """A slab or wall the structural engineer owns: Revit's Structural tick, or IFC's LoadBearing."""
    psets = E.get_psets(element)
    return any(values.get(key) is True for name, values in psets.items() for key in ('Structural', 'LoadBearing')
               if name in ('PSet_Revit_Structural', 'Pset_SlabCommon', 'Pset_WallCommon'))


def read_models(models: list[dict], open_ifc) -> tuple[list[dict], list[dict]]:
    """Every element of every model: [{ref, gid, model, class, family, type, storey, layers, q, source, shape}], and a
    summary per model with its storeys. shape (and the entity, ifc) stay in memory for the run; they are never saved."""
    elements = []
    summaries = []
    by_gid: dict[str, list[dict]] = defaultdict(list)
    for model in models:
        ifc = open_ifc(model)
        scale = U.calculate_unit_scale(ifc)
        storeys = [{'name': storey.Name, 'elevation': number(getattr(storey, 'Elevation', None))} for storey in ifc.by_type('IfcBuildingStorey')]
        for storey in storeys:
            storey['elevation'] = storey['elevation'] * scale if storey['elevation'] is not None else None
        mine = []
        for element in ifc.by_type('IfcElement'):
            if any(element.is_a(skip) for skip in SKIP):
                continue
            if any(part for rel in element.IsDecomposedBy for part in rel.RelatedObjects):
                continue  # a whole made of parts (a roof of slabs, a stair of flights): its parts are measured
            kind = E.get_type(element)
            family, type_name = split_name(element.Name)
            if kind is not None and kind.Name:
                type_name = split_name(kind.Name)[1] if ':' in kind.Name else kind.Name
            q, source = quantities(element, scale)
            record = {
                'ref': f'{model["id"]}#{element.GlobalId}', 'gid': element.GlobalId, 'model': model['name'], 'model_id': str(model['id']),
                'class': element.is_a(), 'family': family, 'type': type_name, 'name': element.Name,
                'storey': storey_of(element), 'layers': layers_of(element, scale),
                'material': ', '.join(sorted({m.Name for m in (E.get_materials(element) or []) if getattr(m, 'Name', None)}))[:200],
                'q': q, 'source': source, 'ifc': element, 'file': ifc, 'scale': scale,  # the file kept open while its entities are used
                'structural': (element.is_a('IfcSlab') or element.is_a('IfcWall')) and structural(element),
            }
            mine.append(record)
        shape_elements(ifc, mine)
        frame = ('IfcBeam', 'IfcColumn', 'IfcFooting', 'IfcPile')  # not members: a curtain wall's mullions are members too
        share = sum(1 for r in mine if r['class'].startswith(frame)) / max(1, sum(1 for r in mine if r['class'].startswith(SHAPED)))
        is_structural = share >= 0.7 or bool(re.search(r'(?<![A-Z])STR(UCT\w*)?(?![A-Z])', model['name'].upper()))
        summaries.append({'model': model['name'], 'storeys': storeys, 'schema': ifc.schema, 'structural': is_structural})
        for record in mine:
            record['structural_model'] = is_structural
            elements.append(record)
            by_gid[record['gid']].append(record)
    # the same element in two models is billed once: the structure governs the frame, foundations and structural slabs
    # and walls; the architecture everything else
    for copies in by_gid.values():
        if len(copies) < 2:
            continue
        frame = copies[0]['class'].startswith(STRUCTURAL) or any(copy['structural'] and copy['class'].startswith(('IfcSlab', 'IfcWall')) for copy in copies)
        structure = next((copy for copy in copies if copy['structural_model']), None)
        governing = structure if structure and frame else next((copy for copy in copies if not copy['structural_model']), copies[0])
        for copy in copies:
            if copy is not governing:
                copy['duplicate_of'] = governing['model']
    return elements, summaries


def shape_elements(ifc, records: list[dict]) -> None:
    """Each solid element's shape, read in one pass (and any element the model gives no quantities); then what the shapes
    correct: a volume 1000 times too big, and a net wall area with the small openings it should not have lost."""
    wanted = [record for record in records if record['class'].startswith(SHAPED) or not record['q']]
    shapes = read_shapes(ifc, [record['ifc'] for record in wanted])
    for record in wanted:
        record['shape'] = shapes.get(record['ifc'].id())
    openings = [rel.RelatedOpeningElement for record in records if record['class'].startswith(('IfcWall', 'IfcSlab'))
                for rel in getattr(record['ifc'], 'HasOpenings', None) or []]
    opening_shapes = read_shapes(ifc, openings, world=False)  # in its own axes: a slanted wall's window keeps its size
    for record in records:
        q, shape = record['q'], record.get('shape')
        if shape and q.get('volume') and shape.volume and 500 < q['volume'] / shape.volume < 2000:
            q['volume'] /= 1000
            record['fixed'] = 'volume ÷ 1000 (the model stated it 1000 times too big)'
        if record['class'].startswith(('IfcWall', 'IfcSlab')):
            areas = openings_of(record['ifc'], opening_shapes)
            record['openings'] = areas
            small = sum(area for area in areas if area <= RULES['wall_void'])
            if small and q.pop('net', False) and q.get('area') and record['class'].startswith('IfcWall'):
                q['area'] += small  # voids of 0.5 m² or less are not deducted
                record['added_back'] = round(small, 3)
        q.pop('net', None)


def size_of(element: dict) -> str | None:
    q = element['q']
    if element['class'] in ('IfcDoor', 'IfcWindow') and q.get('width') and q.get('height'):
        return f'{round(q["width"] * 1000)} wide × {round(q["height"] * 1000)} high (mm)'
    return None


def catalogue(elements: list[dict]) -> list[dict]:
    """Elements grouped into types: same model, class, type name, build-up and size."""
    groups: dict[tuple, list[dict]] = defaultdict(list)
    for element in elements:
        layers = '|'.join(f'{layer["material"]}:{layer["thickness_mm"]}' for layer in element['layers'])
        groups[(element['model'], element['class'], element['family'], element['type'], layers, size_of(element), bool(element.get('duplicate_of')))].append(element)
    types = []
    for number_, ((model, cls, family, type_name, _, size, duplicate), members) in enumerate(sorted(groups.items(), key=lambda item: (item[0][1], item[0][3] or '')), start=1):
        totals = Counter()
        for member in members:
            for key in ('length', 'area', 'volume'):
                totals[key] += member['q'].get(key) or 0
        first = members[0]
        types.append({
            'key': f'T{number_:03d}', 'model': model, 'class': cls, 'family': family, 'type': type_name, 'size': size,
            'count': len(members), 'gids': [member['ref'] for member in members],
            'sample_names': list({member['name'] for member in members if member['name']})[:3],
            'material': first['material'], 'layers': first['layers'],
            'storeys': dict(Counter(member['storey'] or 'no storey' for member in members)),
            'totals': {key: round(value, 3) for key, value in totals.items() if value},
            'thickness_mm': round(first['q']['thickness'] * 1000) if first['q'].get('thickness') else None,
            'width_mm': round(first['q']['width'] * 1000) if first['q'].get('width') else None,
            'duplicate_of': first.get('duplicate_of') if duplicate else None,
            'sources': dict(Counter(member['source'] for member in members)),
        })
    return types


