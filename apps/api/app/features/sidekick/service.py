import json
from uuid import UUID

from app.access import Actor, NotFound
from app.db import Connection
from app.features.programme.service import shown
from app.features.sidekick.constants import TITLE_LENGTH
from app.features.sidekick.tools import Tools


def tools_for(connection: Connection, actor: Actor, estimate_id: str) -> Tools:
    """The tools over an estimate, as this person may see it."""
    found = connection.execute('select result, programme from estimates where id = %s', [estimate_id]).fetchone()
    if not found or not found['result']:
        raise NotFound('Run the takeoff first')
    result = {**found['result'], 'boq': found['result'].get('boq') or []}
    return Tools(result, shown(actor, found['programme']), actor.can('see_estimate'))


def chats(connection: Connection, actor: Actor, project_id: UUID) -> list[dict]:
    """This person's chats on the project, newest first."""
    return connection.execute(
        'select id, title, updated_at from sidekick_chats where person_id = %s and project_id = %s'
        ' order by updated_at desc limit 100',
        [actor.person_id, project_id],
    ).fetchall()


def chat(connection: Connection, actor: Actor, chat_id: UUID) -> dict:
    """One of this person's chats; nobody else's exists for them."""
    found = connection.execute(
        'select id, title, updated_at, messages from sidekick_chats where id = %s and person_id = %s',
        [chat_id, actor.person_id],
    ).fetchone()
    if found is None:
        raise NotFound('Unknown chat')
    return found


def save(connection: Connection, actor: Actor, chat_id: UUID, project_id: UUID, messages: list[dict]) -> None:
    """The chat as it now is: made on its first question, its messages replaced after."""
    title = next(message['text'] for message in messages if message['role'] == 'user')[:TITLE_LENGTH]
    connection.execute(
        'insert into sidekick_chats (org_id, id, project_id, person_id, title, messages)'
        ' values (%s, %s, %s, %s, %s, %s)'
        ' on conflict (org_id, id) do update set messages = excluded.messages, updated_at = now()'
        ' where sidekick_chats.person_id = excluded.person_id',
        [actor.org_id, chat_id, project_id, actor.person_id, title, json.dumps(messages)],
    )


def rename(connection: Connection, actor: Actor, chat_id: UUID, title: str) -> None:
    connection.execute(
        'update sidekick_chats set title = %s where id = %s and person_id = %s', [title, chat_id, actor.person_id]
    )


def delete(connection: Connection, actor: Actor, chat_id: UUID) -> None:
    connection.execute('delete from sidekick_chats where id = %s and person_id = %s', [chat_id, actor.person_id])
