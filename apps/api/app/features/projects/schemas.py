from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class NewProject(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    client: str = ''
    location: str = ''
    description: str = ''


class Member(BaseModel):
    person_id: UUID
    access: Literal['edit', 'view'] = 'edit'


class Access(BaseModel):
    access: Literal['edit', 'view']
