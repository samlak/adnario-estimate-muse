"""The sidekick: questions about a project's estimate (model, takeoff, BOQ, programme, cash flow) answered by the AI
from read-only tools. Each person's chats are kept per project (service.py), to reopen from the history; the question
is saved when asked and the answer, with the steps taken, when it ends or is stopped."""

import asyncio
import time
from uuid import UUID

from fastapi import APIRouter

from app.core import runs
from app.core.access import Actor, CurrentActor, check_estimate, find_project
from app.database import connection as db
from app.features.sidekick import ai, service
from app.features.sidekick.constants import RESULT_SHOWN, TITLE_LENGTH
from app.features.sidekick.schemas import Ask, Chat, ChatSummary

router = APIRouter()


@router.post('/estimates/{estimate_id}/sidekick')
async def sidekick(estimate_id: str, ask: Ask, actor: CurrentActor):
    """Streams `chat` ({id}) first, then `tool` ({id, name, args, seconds}) for each look-up or hand-off to a
    specialist, `result` ({id, text}) with what it answered, `token` ({text}) as the answer comes, and after a chat's
    first answer `title` ({title}), the name the AI gave the chat."""
    chat_id = ask.chat_id or db.new_id()

    def begin():
        with db.in_org(actor.org_id) as connection:
            check_estimate(connection, actor, estimate_id, 'see_programme')
            project = connection.execute(
                'select p.id, p.name from estimates e join projects p on p.id = e.project_id where e.id = %s',
                [estimate_id],
            ).fetchone()
            before = service.chat(connection, actor, ask.chat_id)['messages'] if ask.chat_id else []
            history = [*before, {'role': 'user', 'text': ask.question.strip(), 'steps': []}]
            service.save(connection, actor, chat_id, project['id'], history)
            return project, history, service.tools_for(connection, actor, estimate_id)

    project, history, tools = await asyncio.to_thread(begin)

    async def work():
        yield 'chat', {'id': str(chat_id)}
        text, steps, since = '', [], time.monotonic()
        try:
            async for event, given in ai.answer(tools, project['name'], history):
                data = given
                if event == 'token':
                    text += data['text']
                elif event == 'tool':  # what it said before a look-up is its plan: a step, not the answer
                    steps += [{'note': text.strip()}] if text.strip() else []
                    data = {**given, 'seconds': round(time.monotonic() - since, 1)}
                    steps.append(
                        {'id': given['id'], 'tool': given['name'], 'args': given['args'], 'seconds': data['seconds']}
                    )
                    text = ''
                elif event == 'result':
                    data = {**given, 'text': given['text'][:RESULT_SHOWN]}
                    # look-ups run side by side, so a result finds its own step
                    for step in steps:
                        if step.get('id') == given['id']:
                            step['result'] = data['text']
                    since = time.monotonic()
                yield event, data
            if len(history) == 1 and text.strip():  # the first answer: the chat is named from it
                yield 'title', {'title': await name_chat(actor, chat_id, history[0]['text'], text)}
        finally:
            # a blocking write here so it also runs when Stop cancels the task; one row
            answer = {'role': 'assistant', 'text': text.strip() or 'No answer: it was stopped.', 'steps': steps}
            with db.in_org(actor.org_id) as connection:
                service.save(connection, actor, chat_id, project['id'], [*history, answer])

    return runs.stream(runs.start(f'sidekick:{chat_id}', work()))


async def name_chat(actor: Actor, chat_id: UUID, question: str, answer: str) -> str:
    """The chat's name from its first answer, kept; if the AI cannot name it, it keeps its question as its title."""
    try:
        title = await ai.title(question, answer)
    except Exception:  # a name is a nicety, never a failed answer
        return question[:TITLE_LENGTH]

    def rename():
        with db.in_org(actor.org_id) as connection:
            service.rename(connection, actor, chat_id, title)

    await asyncio.to_thread(rename)
    return title


@router.post('/sidekick/chats/{chat_id}/stop', status_code=204)
async def stop(chat_id: UUID, actor: CurrentActor):
    """Stops the answer being written; what it has so far is kept."""

    def check():
        with db.in_org(actor.org_id) as connection:
            service.chat(connection, actor, chat_id)

    await asyncio.to_thread(check)
    runs.stop(f'sidekick:{chat_id}')


@router.get('/projects/{project_id}/sidekick/chats', response_model=list[ChatSummary])
def chats(project_id: UUID, actor: CurrentActor):
    """This person's chats on the project, newest first."""
    with db.in_org(actor.org_id) as connection:
        project = find_project(connection, actor, project_id, 'see_programme')
        return service.chats(connection, actor, project['id'])


@router.get('/sidekick/chats/{chat_id}', response_model=Chat)
def chat(chat_id: UUID, actor: CurrentActor):
    with db.in_org(actor.org_id) as connection:
        return service.chat(connection, actor, chat_id)


@router.delete('/sidekick/chats/{chat_id}', status_code=204)
def delete(chat_id: UUID, actor: CurrentActor):
    with db.in_org(actor.org_id) as connection:
        service.delete(connection, actor, chat_id)
