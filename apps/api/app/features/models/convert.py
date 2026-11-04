"""IFC → XKT on the converter, in the background, and the model's element counts."""

import httpx

from app.core.config import env
from app.database import connection as db
from app.features.models.constants import CONVERT_TIMEOUT
from app.features.models.files import ifc_path, open_ifc


def convert(org_id, model_id) -> None:
    """IFC → XKT on the converter (a background task): the viewer loads XKT; IFC in the browser crashes xeokit."""
    with db.in_org(org_id) as connection:
        model = connection.execute('select * from models where id = %s', [model_id]).fetchone()
    path = ifc_path(model)
    try:
        response = httpx.post(f'{env.CONVERTER_URL}/convert', content=path.read_bytes(), timeout=CONVERT_TIMEOUT)
        if response.status_code != 200:
            raise RuntimeError(response.text[:300] or f'converter answered {response.status_code}')
        path.with_suffix('.xkt').write_bytes(response.content)
        stats = element_stats(model)
        status, note, seconds = 'ready', None, float(response.headers.get('X-Seconds', 0))
    except Exception as error:  # the converter not running, or a file it cannot read
        status, note, seconds, stats = 'failed', f'Could not convert: {error}', None, {}
    with db.in_org(org_id) as connection:
        connection.execute(
            'update models set status = %s, note = %s, seconds = %s, stats = %s where id = %s',
            [status, note, seconds, db.Jsonb(stats), model_id],
        )


def element_stats(model: dict) -> dict:
    ifc = open_ifc(model)
    glass = 0
    for element in ifc.by_type('IfcWindow') + ifc.by_type('IfcPlate'):
        glass += 1
    return {'elements': len(ifc.by_type('IfcElement')), 'glass': glass, 'schema': ifc.schema}
