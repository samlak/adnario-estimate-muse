from uuid import UUID

from app.core.access import Actor
from app.database.connection import Connection
from app.features.notifications.constants import SHOWN


def notify(connection: Connection, org_id, people, project_id, title: str, text: str) -> None:
    for person in people:
        connection.execute(
            'insert into notifications (org_id, person_id, project_id, title, text) values (%s, %s, %s, %s, %s)',
            [org_id, person, project_id, title, text],
        )


def notifications(connection: Connection, actor: Actor) -> list[dict]:
    return connection.execute(
        'select id, project_id, title, text, read, created_at from notifications where person_id = %s order by created_at desc limit %s',
        [actor.person_id, SHOWN],
    ).fetchall()


def read(connection: Connection, actor: Actor, notice_id: UUID) -> None:
    connection.execute('update notifications set read = true where id = %s and person_id = %s', [notice_id, actor.person_id])


def read_all(connection: Connection, actor: Actor) -> None:
    connection.execute('update notifications set read = true where person_id = %s', [actor.person_id])
