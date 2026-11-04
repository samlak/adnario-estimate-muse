"""A new version of a model compared with the current one, element by element by GlobalId: what was added, removed
or changed (type, quantity, position, material, properties)."""

import hashlib
import json

from app.features.models.constants import COMPARED
from app.features.models.files import open_ifc


def fingerprints(model: dict) -> dict[str, dict]:
    """Each element by GlobalId: what a new version is compared on (type, quantity, position, material, properties)."""
    import ifcopenshell.util.element as E
    import ifcopenshell.util.placement as P

    out = {}
    for element in open_ifc(model).by_type('IfcElement'):
        if element.is_a('IfcOpeningElement'):
            continue
        kind = E.get_type(element)
        psets = E.get_psets(element)
        dims = psets.get('PSet_Revit_Dimensions', {})
        try:
            where = [round(float(v), 2) for v in P.get_local_placement(element.ObjectPlacement)[:3, 3]] if element.ObjectPlacement else None
        except Exception:
            where = None
        out[element.GlobalId] = {
            'name': element.Name,
            'type': (kind.Name if kind else None) or (element.Name or '').split(':')[0],
            'quantity': {key: round(float(value), 3) for key, value in dims.items() if isinstance(value, (int, float))},
            'position': where,
            'material': sorted(m.Name for m in (E.get_materials(element) or []) if getattr(m, 'Name', None)),
            'properties': hashlib.md5(json.dumps(psets, sort_keys=True, default=str).encode()).hexdigest(),
            'class': element.is_a(),
        }
    return out


def diff(old: dict, new: dict) -> dict:
    before, after = fingerprints(old), fingerprints(new)
    changed = []
    for gid in before.keys() & after.keys():
        what = [field for field in COMPARED if before[gid][field] != after[gid][field]]
        if what:
            changed.append({'gid': gid, 'name': after[gid]['name'], 'class': after[gid]['class'], 'changed': what})
    pick = lambda found, gids: [{'gid': gid, 'name': found[gid]['name'], 'class': found[gid]['class']} for gid in sorted(gids)]
    return {'added': pick(after, after.keys() - before.keys()), 'removed': pick(before, before.keys() - after.keys()), 'changed': changed}
