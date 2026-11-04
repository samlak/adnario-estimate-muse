"""The demo (README §13): a firm with three projects from samples/, and a second firm that never sees the first's
data. Seeded once, into an empty database, with no AI: the FINISHED projects get their saved estimate (takeoff, BOQ,
rates, programme), the others are left to run from the app. Models are converted in the background."""

import asyncio
import json
import logging

from app.core.config import env
from app.core.constants import DEMO_PASSWORD
from app.database import connection as db
from app.database.seed.constants import DEMO, FINISHED, PEOPLE, PROJECTS
from app.database.seed.estimates import placed
from app.features.auth.utils import hashed
from app.features.models.convert import convert
from app.features.models.service import add_model
from app.features.rate_cards.library import copy_library, top_up

log = logging.getLogger('adnario.seed')


def seed() -> list[tuple]:
    """The rows, if the database is empty; returns the models to convert."""
    with db.system() as connection:
        if connection.execute('select 1 from orgs limit 1').fetchone():
            if added := top_up(connection):
                log.info('added %s new library items to the firms\' cards', added)
            return []
        password = hashed(DEMO_PASSWORD)
        org = connection.execute('insert into orgs (name) values (%s) returning id', [DEMO]).fetchone()['id']
        card = copy_library(connection, org)
        rows = {row['code']: row['id'] for row in connection.execute("select code, id from rate_rows where card_id = %s and kind = 'RATE'", [card]).fetchall()}
        people = {}
        for name, email, role in PEOPLE:
            people[role] = connection.execute(
                'insert into people (org_id, name, email, role, password_hash) values (%s, %s, %s, %s, %s) returning id', [org, name, email, role, password]
            ).fetchone()['id']
        connection.execute(
            "insert into people (org_id, name, email, role, invite_token, invited_by) values (%s, 'Bisi Lawal', 'estimator@demo.adnario.app', 'qs', %s, %s)",
            [org, 'seeded-invite-not-a-real-token-hash', people['admin']],
        )
        other = connection.execute("insert into orgs (name) values ('Northbridge Cost Consultants') returning id").fetchone()['id']
        copy_library(connection, other)
        connection.execute(
            "insert into people (org_id, name, email, role, password_hash) values (%s, 'Kemi Adisa', 'admin@northbridge.adnario.app', 'admin', %s)", [other, password]
        )
        connection.execute(
            "insert into projects (org_id, name, client, location, description) values (%s, 'Abuja Mixed-Use Tower', 'Northbridge Developments', 'Abuja', 'A project only Northbridge sees.')",
            [other],
        )
        work, projects = [], {}
        for name, client, location, description, folder, files in PROJECTS:
            project = connection.execute(
                'insert into projects (org_id, name, client, location, description, created_by) values (%s, %s, %s, %s, %s, %s) returning id',
                [org, name, client, location, description, people['qs']],
            ).fetchone()['id']
            projects[name] = project
            for role, access in (('qs', 'edit'), ('contributor', 'edit'), ('viewer', 'view')):
                connection.execute('insert into members (org_id, project_id, person_id, access) values (%s, %s, %s, %s)', [org, project, people[role], access])
            models = {file: add_model(connection, org, project, file, (env.SAMPLES / folder / file).read_bytes(), people['contributor'])['id'] for file in files}
            if folder in FINISHED:
                saved = json.loads((env.SAMPLES / folder / 'estimate.json').read_text())
                connection.execute(
                    "insert into estimates (org_id, project_id, status, result, programme) values (%s, %s, 'ready', %s, %s)",
                    [org, project, db.Jsonb(placed(saved['result'], models, card, rows)), db.Jsonb(saved['programme'])],
                )
            else:
                connection.execute('insert into estimates (org_id, project_id) values (%s, %s)', [org, project])
            work.append((org, list(models.values())))
        lekki = projects[PROJECTS[0][0]]
        for person, text, kind, label in (
            (people['qs'], '@Chidi Eze can you confirm the external wall build-up? The model shows stud framing with brick facing.', 'project', 'An estimate'),
            (people['contributor'], 'Confirmed: 152mm metal studs, 90mm facing brick. The STR model is the latest.', 'project', 'An estimate'),
            (people['viewer'], 'When can we see the priced BOQ?', 'project', 'An estimate'),
        ):
            connection.execute('insert into comments (org_id, project_id, person_id, on_kind, on_label, text) values (%s, %s, %s, %s, %s, %s)', [org, lekki, person, kind, label, text])
        connection.execute(
            'insert into notifications (org_id, person_id, project_id, title, text) values (%s, %s, %s, %s, %s), (%s, %s, %s, %s, %s)',
            [org, people['contributor'], lekki, 'Tunde Bello mentioned you on Lekki Office Block', 'Can you confirm the external wall build-up?',
             org, people['qs'], lekki, 'Ngozi Adeyemi commented on Lekki Office Block', 'When can we see the priced BOQ?'],
        )
    return work


async def finish(work: list[tuple]) -> None:
    """Convert every demo model, one after another."""
    for org, models in work:
        for model in models:
            await asyncio.to_thread(convert, org, model)
