"""The estimate's AI calls, through core/llm.py: each asks one step of the work and returns what the model said;
the caller's code checks every answer."""

from app.core import llm
from app.core.constants import MODEL
from app.features.estimate import prompt


async def summarise(documents: str) -> str:
    """The project documents in a paragraph, for the steps after."""
    return await llm.ask_text(MODEL, prompt.CONTEXT, documents[:60000], 'low')


async def see(user: str) -> str:
    """The building as the model shows it, in a few lines."""
    return await llm.ask_text(MODEL, prompt.SEE, user, 'low')


async def map_types(user: str):
    """What BOQ item each type in a batch is, and how it is measured."""
    return await llm.ask_json(MODEL, prompt.MAP, user, 'low')


async def review(user: str):
    """The draft reviewed: brief, facts, questions for the QS and provisional items."""
    return await llm.ask_json(MODEL, prompt.REVIEW, user, 'low')


async def group(shown: str):
    """One bill's measured lines grouped into the contractor's items."""
    return await llm.ask_json(MODEL, prompt.GROUP, f'Measured lines:\n{shown}', 'low')


async def link(items: str, lines: str):
    """For each BOQ line, the rate card item that is the same work."""
    return await llm.ask_json(MODEL, prompt.LINK.replace('B1A', 'G001'), f'Rate card items:\n{items}\n\nBOQ lines:\n{lines}', 'low')
