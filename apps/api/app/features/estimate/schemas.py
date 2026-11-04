from typing import Literal

from pydantic import BaseModel, Field


# ── Project information, before the run ──────────────────────────────────────────────────────────────────────────
class Info(BaseModel):
    text: str = Field('', max_length=200_000)


class Edit(BaseModel):
    op: Literal['rate', 'percent', 'add_provisional', 'add_line', 'remove_line', 'line', 'type']
    code: str | None = None
    rate: float | None = Field(None, ge=0)
    name: Literal['prelims', 'contingency', 'vat'] | None = None
    value: float | None = Field(None, ge=0, le=100)
    section: str | None = None
    description: str | None = Field(None, max_length=400)
    qty: float | None = Field(None, ge=0)
    unit: str | None = None
    decision: Literal['bill', 'exclude'] | None = None
