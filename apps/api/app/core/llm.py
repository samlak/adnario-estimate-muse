"""The one door to the language models. Features call ask / ask_text / stream_text / converse from their ai.py and
never import a provider. converse is a LangGraph graph: an orchestrator agent over the chat, with look-ups and
specialist sub-agents.
Which model: MODEL in core/constants.py.
Every model is Meta Muse, on Meta's Model API (MUSE_BASE_URL, key MUSE_API_KEY)."""

import asyncio
import functools
from collections.abc import AsyncIterator, Callable
from dataclasses import dataclass
from typing import Annotated, TypedDict

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage, AnyMessage, HumanMessage, SystemMessage, ToolCall, ToolMessage
from langchain_openai import ChatOpenAI  # the client for the Chat Completions format, which Meta's Model API speaks
from langgraph.errors import GraphRecursionError
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.graph.state import CompiledStateGraph
from langgraph.types import Send

from app.core.config import MUSE_BASE_URL, env
from app.core.constants import MODEL_TIMEOUT

Content = str | list[dict]

@functools.cache
def chat(model: str, effort: str | None = None) -> BaseChatModel:
    """effort: how long Muse reasons before it answers (low, medium, high); None is its own default."""
    # created on first use so the app starts (and the viewer works) without a key
    if not env.MUSE_API_KEY:
        raise RuntimeError('MUSE_API_KEY is not set: add it to .env in the repo root and restart the server')
    return ChatOpenAI(
        model=model,
        api_key=env.MUSE_API_KEY,
        base_url=MUSE_BASE_URL,
        timeout=MODEL_TIMEOUT,
        max_retries=2,
        reasoning_effort=effort,
    )


def messages(system: str | None, user: Content) -> list[tuple[str, Content]]:
    return ([('system', system)] if system else []) + [('user', user)]


async def ask_text(model: str, system: str, user: Content, effort: str | None = None) -> str:
    return (await chat(model, effort).ainvoke(messages(system, user))).text.strip()


def _json_of(text: str):
    """The JSON in an answer: the whole text, or the first object or list in it (a model may wrap it in a fence)."""
    import json
    import re

    text = text.strip()
    fenced = re.search(r'```(?:json)?\s*(.*?)```', text, re.S)
    if fenced:
        text = fenced.group(1).strip()
    try:
        return json.loads(text)
    except ValueError:
        start = min((at for at in (text.find('{'), text.find('[')) if at >= 0), default=-1)
        if start < 0:
            raise
        end = max(text.rfind('}'), text.rfind(']'))
        return json.loads(text[start : end + 1])


async def ask_json(model: str, system: str, user: Content, effort: str | None = None, tries: int = 2):
    """An answer that must be JSON: asked again once with the error when it is not. Code checks what it says."""
    said = ''
    for attempt in range(tries):
        prompt = user if attempt == 0 else f'{user}\n\nYour last answer was not valid JSON ({said[:200]!r}). Answer with JSON only.'
        said = await ask_text(model, system, prompt, effort)
        try:
            return _json_of(said)
        except ValueError:
            continue
    raise ValueError('The AI did not answer with JSON')


@dataclass(frozen=True)
class Specialist:
    """A sub-agent the orchestrator can hand a task to: its own rules and look-ups, and its own short context (the
    task alone, not the chat). about: what the orchestrator is told it is for."""

    name: str
    about: str
    system: str
    tools: list[str]


class Talk(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]


class Call(TypedDict):
    call: ToolCall


def handoff(specialist: Specialist) -> dict:
    """The tool the orchestrator calls to hand a specialist its task."""
    return {
        'type': 'function',
        'function': {
            'name': f'ask_{specialist.name}',
            'description': specialist.about,
            'parameters': {
                'type': 'object',
                'properties': {
                    'task': {
                        'type': 'string',
                        'description': 'What to find out, with what the chat already settled (dates, items, months)',
                    }
                },
                'required': ['task'],
            },
        },
    }


def agent(
    model: BaseChatModel,
    system: str,
    tools: list[dict],
    run_tool: Callable[[str, dict], str],
    max_steps: int,
    specialists: dict[str, CompiledStateGraph] | None = None,
) -> CompiledStateGraph:
    """A LangGraph agent loop: `model` answers, or asks for look-ups and specialists; every one asked for in a round
    runs side by side (Send), each answering with a ToolMessage, and the model goes again."""
    specialists = specialists or {}
    bound = model.bind_tools(tools)

    async def think(state: Talk) -> dict:
        return {'messages': [await bound.ainvoke([SystemMessage(system), *state['messages']])]}

    def next_step(state: Talk) -> list[Send] | str:
        calls = state['messages'][-1].tool_calls  # type: ignore[union-attr]
        if not calls:
            return END
        return [Send('specialist' if call['name'] in specialists else 'look_up', {'call': call}) for call in calls]

    async def look_up(task: Call) -> dict:
        call = task['call']
        said = await asyncio.to_thread(run_tool, call['name'], call['args'])
        return {'messages': [ToolMessage(said, tool_call_id=call['id'], name=call['name'])]}

    async def specialist(task: Call) -> dict:
        call = task['call']
        try:
            found = await specialists[call['name']].ainvoke(
                {'messages': [HumanMessage(call['args'].get('task', ''))]},
                config={'recursion_limit': 2 * max_steps},
            )
            said = found['messages'][-1].text or 'It found nothing.'
        except GraphRecursionError:
            said = 'It ran out of steps before it finished.'
        return {'messages': [ToolMessage(said, tool_call_id=call['id'], name=call['name'])]}

    graph = StateGraph(Talk)
    graph.add_node('think', think)
    graph.add_node('look_up', look_up, input_schema=Call)  # type: ignore[arg-type]
    graph.add_edge(START, 'think')
    graph.add_conditional_edges('think', next_step, ['look_up', 'specialist', END] if specialists else ['look_up', END])
    graph.add_edge('look_up', 'think')
    if specialists:
        graph.add_node('specialist', specialist, input_schema=Call)  # type: ignore[arg-type]
        graph.add_edge('specialist', 'think')
    return graph.compile()


def history(conversation: list[dict]) -> list[AnyMessage]:
    """The chat as the model sees it: each earlier answer with the look-ups behind it and what they answered, so a
    follow-up can be answered from them."""
    said: list[AnyMessage] = []
    for number, message in enumerate(conversation):
        if message['role'] == 'user':
            said.append(HumanMessage(message['text']))
            continue
        for step, done in enumerate(each for each in message.get('steps', []) if each.get('result') is not None):
            call_id = done.get('id') or f'earlier-{number}-{step}'
            call: ToolCall = {'name': done['tool'], 'args': done.get('args') or {}, 'id': call_id}
            said += [AIMessage('', tool_calls=[call]), ToolMessage(done['result'], tool_call_id=call_id)]
        said.append(AIMessage(message['text']))
    return said


async def converse(
    model: str,
    system: str,
    conversation: list[dict],
    tools: list[dict],
    run_tool: Callable[[str, dict], str],
    max_steps: int,
    effort: str | None = None,
    specialists: tuple[Specialist, ...] = (),
) -> AsyncIterator[tuple[str, dict]]:
    """A chat with an orchestrator (LangGraph): it sees the whole chat with the earlier look-ups, and answers at once,
    looks things up itself, or hands tasks to specialists (sub-agents with their own look-ups), several side by side.
    conversation: [{role: 'user' | 'assistant', text, steps: [{id, tool, args, result}]}]; tools: function schemas in
    the Chat Completions format; run_tool(name, args) → the result as text. Yields ('tool', {id, name, args}) for each
    look-up or hand-off (a specialist's own look-ups too), ('result', {id, text}) once it has answered, and
    ('token', {text}) as the orchestrator's words stream; at most max_steps rounds for each agent."""
    muse = chat(model, effort)
    by_name = {tool['function']['name']: tool for tool in tools}
    helpers = {
        f'ask_{each.name}': agent(muse, each.system, [by_name[name] for name in each.tools], run_tool, max_steps)
        for each in specialists
    }
    orchestrator = agent(muse, system, [*tools, *map(handoff, specialists)], run_tool, max_steps, helpers)
    try:
        async for part in orchestrator.astream(
            {'messages': history(conversation)},
            stream_mode=['messages', 'updates'],
            subgraphs=True,
            version='v2',
            config={'recursion_limit': 2 * max_steps},  # max_steps model calls, each with its round of look-ups
        ):
            if part['type'] == 'messages':
                chunk, meta = part['data']
                # only the orchestrator speaks to the person; a specialist reports back to it
                spoken = not part['ns'] and meta.get('langgraph_node') == 'think'
                if spoken and isinstance(chunk, AIMessage) and chunk.text:
                    yield 'token', {'text': chunk.text}
                continue
            for update in part['data'].values():
                for message in (update or {}).get('messages', []):
                    if isinstance(message, ToolMessage):
                        yield 'result', {'id': message.tool_call_id, 'text': message.text}
                    elif isinstance(message, AIMessage):
                        for call in message.tool_calls:
                            yield 'tool', {'id': call['id'], 'name': call['name'], 'args': call['args']}
    except GraphRecursionError:
        yield 'token', {'text': '\n\n(Stopped: that took too many steps. Ask a narrower question.)'}


