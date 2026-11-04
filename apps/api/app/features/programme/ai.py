"""The programme's AI call, through core/llm.py."""

from app.core import llm
from app.core.constants import MODEL_FAST
from app.features.programme import prompt


async def assign(listed: list[dict], shown: list[dict], again: bool = False):
    """Which activity does each piece of BOQ work; again: a retry, told to use only the ids listed."""
    system = prompt.ASSIGN + (prompt.RETRY if again else '')
    return await llm.ask_json(MODEL_FAST, system, f'Activities:\n{listed}\n\nPieces of work:\n{shown}', 'low')
