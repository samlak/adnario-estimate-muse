"""The demo (README §13): a firm with three projects from overview/samples, and a second firm that never sees the
first's data. Seeded once, into an empty database. Models are converted in the background; with a Muse key the
three estimates are then run end to end (takeoff, BOQ, rates, programme) so they open finished; a new project (or
Update estimate) runs the flow live."""

import asyncio
import logging

from app.database import connection as db
from app.core.config import env
from app.core.constants import DEMO_PASSWORD
from app.features.auth import hashed
from app.features.models import add_model, convert
from app.features.ratecards import copy_library, top_up
from app.database.seed.constants import DEMO, PEOPLE, PROJECTS

log = logging.getLogger('adnario.seed')


def seed() -> list[tuple]:
    """The rows, if the database is empty; returns what to convert and run."""
    with db.system() as connection:
        if connection.execute('select 1 from orgs limit 1').fetchone():
            if added := top_up(connection):
                log.info('added %s new library items to the firms\' cards', added)
            return []
        password = hashed(DEMO_PASSWORD)
        org = connection.execute('insert into orgs (name) values (%s) returning id', [DEMO]).fetchone()['id']
        copy_library(connection, org)
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
        work = []
        for name, client, location, description, folder, files, programme in PROJECTS:
            project = connection.execute(
                'insert into projects (org_id, name, client, location, description, created_by) values (%s, %s, %s, %s, %s, %s) returning id',
                [org, name, client, location, description, people['qs']],
            ).fetchone()['id']
            for role, access in (('qs', 'edit'), ('contributor', 'edit'), ('viewer', 'view')):
                connection.execute('insert into members (org_id, project_id, person_id, access) values (%s, %s, %s, %s)', [org, project, people[role], access])
            models = [add_model(connection, org, project, file, (env.SAMPLES / folder / file).read_bytes(), people['contributor'])['id'] for file in files]
            estimate = connection.execute('insert into estimates (org_id, project_id) values (%s, %s) returning id', [org, project]).fetchone()['id']
            work.append((org, project, models, estimate, env.SAMPLES / folder / programme if programme else None))
        lekki = work[0][1]
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
    """Convert every model, then (with a Muse key) run every demo estimate to the end."""
    from app.core import runs
    from app.features.estimate.router import generate, link, start_run
    from app.features.programme import service as programmes

    for org, _, models, _, _ in work:
        for model in models:
            await asyncio.to_thread(convert, org, model)
    if not env.MUSE_API_KEY:
        log.warning('No MUSE_API_KEY: the demo estimates are left to run from the app')
        return

    async def drain(run):
        async for event, data in run.follow():
            if event == 'error':
                raise RuntimeError(data.get('message'))

    async def whole(org, estimate, programme):
        try:
            await drain(start_run(org, estimate))
            await drain(runs.start(f'boq:{estimate}', generate(org, estimate)))
            await drain(runs.start(f'link:{estimate}', link(org, estimate)))

            async def read(org_id, estimate_id):
                yield 'stage', {'name': 'Read', 'state': 'start'}

                def load():
                    with db.in_org(org_id) as connection:
                        return connection.execute('select result from estimates where id = %s', [estimate_id]).fetchone()['result']

                result = await asyncio.to_thread(load)
                built = await programmes.build(programme, result)

                def save():
                    with db.in_org(org_id) as connection:
                        connection.execute('update estimates set programme = %s where id = %s', [db.Jsonb(built), estimate_id])

                await asyncio.to_thread(save)
                yield 'result', {'activities': len(built['activities'])}

            await drain(runs.start(f'programme:{estimate}', read(org, estimate)))
            log.info('demo estimate %s finished', estimate)
        except Exception:
            log.exception('demo estimate %s failed; run it from the app', estimate)

    await asyncio.gather(*(whole(org, estimate, programme) for org, _, _, estimate, programme in work if programme))
