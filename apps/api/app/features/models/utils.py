import re

from fastapi import HTTPException

from app.features.models.constants import STEP_HEADER, UPLOAD_LIMIT


def check_upload(filename: str | None, data: bytes) -> None:
    """An IFC by its name, its size and its first bytes, or refused with why."""
    if not re.search(r'\.ifc$', filename or '', re.I):
        raise HTTPException(422, f'{filename} is not an IFC file')
    if len(data) > UPLOAD_LIMIT:
        raise HTTPException(413, f'{filename} is over 200 MB')
    if not data.lstrip()[:20].startswith(STEP_HEADER):
        raise HTTPException(422, f'{filename} is not a readable IFC (STEP) file')


def listed(rows: list[dict]) -> list[dict]:
    """The model list shows each version's change counts; the full diff is one request away."""
    for row in rows:
        if row['diff']:
            row['changes'] = {key: len(value) for key, value in row['diff'].items()}
            row['diff'] = None
    return rows


def properties(found, model: dict) -> dict:
    """An IFC element as the Properties card shows it."""
    import ifcopenshell.util.element as E

    kind = E.get_type(found)
    storey = E.get_container(found)
    return {
        'gid': found.GlobalId, 'class': found.is_a(), 'name': found.Name, 'type': kind.Name if kind else None,
        'storey': storey.Name if storey else None, 'model': model['name'],
        'material': [m.Name for m in (E.get_materials(found) or []) if getattr(m, 'Name', None)],
        'psets': E.get_psets(found),
    }
