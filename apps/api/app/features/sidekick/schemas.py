from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

Role = Literal['user', 'assistant']


class Ask(BaseModel):
    """A question, in a chat the server keeps (none: a new chat)."""

    question: str = Field(min_length=1, max_length=8000)
    chat_id: UUID | None = None


class Step(BaseModel):
    """One thing the AI did on the way to an answer: a look-up (tool, its arguments and what it answered) or what it
    said it would do. seconds: how long the AI took to get to it."""

    id: str | None = None  # the look-up's own id, which its result carries
    tool: str | None = None
    args: dict | None = None
    result: str | None = None
    note: str | None = None
    seconds: float | None = None


class Message(BaseModel):
    role: Role
    text: str
    steps: list[Step] = []


class ChatSummary(BaseModel):
    id: UUID
    title: str
    updated_at: datetime


class Chat(ChatSummary):
    messages: list[Message]
