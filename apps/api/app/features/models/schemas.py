from pydantic import BaseModel, Field


class Nudge(BaseModel):
    x: float = 0
    z: float = 0
    rotate: float = 0


class Decision(BaseModel):
    accept: bool
    reason: str = Field('', max_length=1000)
