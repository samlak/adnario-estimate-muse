from typing import Literal

from pydantic import BaseModel, Field


class Rename(BaseModel):
    name: str = Field(min_length=1, max_length=160)


class Row(BaseModel):
    kind: Literal['MATERIAL', 'LABOUR', 'PLANT', 'RATE']
    name: str = Field(min_length=1, max_length=400)
    unit: str = ''
    price: float | None = Field(None, ge=0)
    code: str | None = None
    section: str | None = None
    lines: list[dict] | None = None
    additions: dict | None = None


class RowChange(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=400)
    code: str | None = Field(None, max_length=40)
    section: str | None = Field(None, max_length=160)
    unit: str | None = None
    labour_basis: Literal['day', 'hour'] | None = None
    price: float | None = Field(None, ge=0)
    lines: list[dict] | None = None
    additions: dict | None = None
