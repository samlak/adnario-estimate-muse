"""Saves the demo firm's finished estimates as the seed's JSON (samples/<project>/estimate.json), from a database where
they were run: `uv run python -m app.database.seed.export`. Run it again after a better run, or when a result's shape
changes."""

import json

from app.core.config import env
from app.database import connection as db
from app.database.seed.constants import DEMO, PROJECTS
from app.database.seed.estimates import portable


def export() -> None:
    with db.system() as connection:
        for name, *_, folder, _models, _programme in PROJECTS:
            estimate = connection.execute(
                """select e.result, e.programme from estimates e join projects p on p.id = e.project_id join orgs o on o.id = p.org_id
                   where o.name = %s and p.name = %s and e.status = 'ready' order by e.revision desc limit 1""",
                [DEMO, name],
            ).fetchone()
            if not estimate:
                print(f'{name}: no finished estimate, skipped')
                continue
            saved = {'result': portable(estimate['result']), 'programme': estimate['programme']}
            (env.SAMPLES / folder / 'estimate.json').write_text(json.dumps(saved, ensure_ascii=False, separators=(',', ':')))
            print(f'{name}: saved')


if __name__ == '__main__':
    db.pool.open(wait=True, timeout=30)
    export()
