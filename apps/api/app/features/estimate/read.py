"""Read and Catalogue (README §7.2): code reads every element of every model (class, type, storey, materials, layers,
quantities), and groups them into types (same model, class, type name, build-up and size). That compact catalogue is
what the AI reads, never the IFC file.

Measuring takes each quantity from the cheapest reliable source: the standard IFC quantity sets (with guards for the
Revit exporter's bugs), Revit's own dimensions, then the geometry. Doors and windows get their size from the element,
never from a name."""

from collections import Counter, defaultdict

import ifcopenshell.util.element as E
import ifcopenshell.util.unit as U

from app.features.estimate.constants import LINEAR, SKIP, STRUCTURAL


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
    if revit:
        source = 'quantity set' if qto else 'Revit dimensions'
        for key, mine in (('length', 'Length'), ('area', 'Area'), ('volume', 'Volume'), ('width', 'Width'), ('perimeter', 'Perimeter'), ('thickness', 'Thickness')):
            out[key] = out.get(key) or revit.get(mine)
        out['length'] = out.get('length') or number(psets.get('PSet_Revit_Structural', {}).get('Cut Length'))
    out['width'] = out.get('width') or revit_type.get('Width')
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
    if element.is_a('IfcDoor') or element.is_a('IfcWindow'):
        if out.get('width') and out['width'] > 20:  # mm
            out['width'] /= 1000
        if out.get('height') and out['height'] > 20:
            out['height'] /= 1000
    return {key: value for key, value in out.items() if value}, source


def geometry_quantities(element) -> dict:
    """The last resort: measured from the shape (slow, and Revit's own figures are better when there are any)."""
    import ifcopenshell.geom as G
    import ifcopenshell.util.shape as S

    settings = G.settings()
    settings.set('use-world-coords', True)
    try:
        shape = G.create_shape(settings, element).geometry
    except Exception:
        return {}
    return {
        'volume': S.get_volume(shape), 'area': S.get_max_side_area(shape), 'footprint': S.get_footprint_area(shape),
        'length': max(S.get_x(shape), S.get_y(shape)), 'height': S.get_z(shape),
    }


def read_models(models: list[dict], open_ifc) -> tuple[list[dict], list[dict]]:
    """Every element of every model: [{ref, gid, model, class, family, type, storey, layers, q, source}], and a summary
    per model with its storeys."""
    elements = []
    summaries = []
    by_gid: dict[str, list[dict]] = defaultdict(list)
    for model in models:
        ifc = open_ifc(model)
        scale = U.calculate_unit_scale(ifc)
        storeys = [{'name': storey.Name, 'elevation': number(getattr(storey, 'Elevation', None))} for storey in ifc.by_type('IfcBuildingStorey')]
        summaries.append({'model': model['name'], 'storeys': storeys, 'schema': ifc.schema})
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
                'q': q, 'source': source,
            }
            elements.append(record)
            by_gid[element.GlobalId].append(record)
    # the same element in two models is billed once
    for gid, copies in by_gid.items():
        if len(copies) < 2:
            continue
        structural = next((copy for copy in copies if 'STR' in copy['model'].upper()), None)
        governing = structural if structural and copies[0]['class'].startswith(STRUCTURAL) else next((c for c in copies if c is not structural), copies[0])
        for copy in copies:
            if copy is not governing:
                copy['duplicate_of'] = governing['model']
    return elements, summaries


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


