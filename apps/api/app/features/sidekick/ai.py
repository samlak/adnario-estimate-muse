"""The sidekick's answer: an orchestrator agent (LangGraph, core/llm.py) over the chat, with the read-only look-ups
(tools.py) and the model, cost and programme specialists, streamed."""

from collections.abc import AsyncIterator
from datetime import date

from app import llm
from app.config import MODEL_FAST, MODEL_SMART
from app.features.sidekick.constants import (
    EFFORT,
    MAX_STEPS,
    MAX_TURNS,
    SPECIALISTS,
    TITLE_CONTEXT,
    TITLE_LENGTH,
    TITLE_WORDS,
)
from app.features.sidekick.prompt import CHAT_TITLE, SIDEKICK_RULES, SPECIALIST_RULES
from app.features.sidekick.tools import TOOLS, Tools

SEES_ALL = 'They see the quantities and money.'
NO_MONEY = 'They may not see quantities or money: answer about the model and the programme only.'


async def answer(tools: Tools, project: str, conversation: list[dict]) -> AsyncIterator[tuple[str, dict]]:
    """conversation: the chat's messages ({role, text, steps}), the question last."""
    today = date.today().isoformat()
    system = SIDEKICK_RULES.format(project=project, access=SEES_ALL if tools.money else NO_MONEY, today=today)
    specialists = tuple(
        llm.Specialist(
            name=name,
            about=each['about'],
            system=SPECIALIST_RULES.format(area=name, project=project, today=today),
            tools=each['tools'],
        )
        for name, each in SPECIALISTS.items()
        if tools.money or not each['money']
    )
    schemas = [tool['schema'] for tool in TOOLS.values()]
    async for event in llm.converse(
        MODEL_SMART, system, conversation[-MAX_TURNS:], schemas, tools.run, MAX_STEPS, EFFORT, specialists
    ):
        yield event


async def title(question: str, answer: str) -> str:
    """A short name for a chat from its first question and the start of its answer (fast model, low effort)."""
    start = ' '.join(answer.split()[:TITLE_CONTEXT])
    named = await llm.ask_text(
        MODEL_FAST, CHAT_TITLE.format(words=TITLE_WORDS), f'Question: {question}\nAnswer: {start}', 'low'
    )
    return named.strip().strip('"').rstrip('.')[:TITLE_LENGTH] or question[:TITLE_LENGTH]
