"""Where a model's IFC and XKT are kept, and the IFC opened (the last few kept open)."""

import functools
from pathlib import Path

from app.core.config import env
from app.features.models.constants import OPEN_CACHED


def folder(org_id, project_id) -> Path:
    path = env.DATA / str(org_id) / str(project_id) / 'models'
    path.mkdir(parents=True, exist_ok=True)
    return path


def ifc_path(model: dict) -> Path:
    return folder(model['org_id'], model['project_id']) / f'{model["id"]}.ifc'


@functools.lru_cache(maxsize=OPEN_CACHED)
def _open(path: str, stamp: float):
    import ifcopenshell

    return ifcopenshell.open(path)


def open_ifc(model: dict):
    path = ifc_path(model)
    return _open(str(path), path.stat().st_mtime)
