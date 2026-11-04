from typing import Literal

from pydantic import BaseModel, Field


class Link(BaseModel):
    before: int  # the activity it waits for
    kind: Literal['FS', 'SS'] = 'FS'  # for it to finish, or to start
    lag: int = Field(0, ge=-365, le=365)  # working days after that


class ActivityEdit(BaseModel):
    """One change to one activity: its name, its working days, or what it waits for."""
    id: int
    name: str | None = Field(None, min_length=1, max_length=300)
    days: int | None = Field(None, ge=0, le=2000)
    add_link: Link | None = None
    remove_link: int | None = None  # the activity it no longer waits for
