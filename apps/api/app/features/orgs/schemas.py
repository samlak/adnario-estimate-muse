from pydantic import BaseModel, EmailStr, Field

from app.features.orgs.constants import Role


class Invite(BaseModel):
    email: EmailStr
    role: Role


class Change(BaseModel):
    role: Role


class Details(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    currency: str = Field(min_length=3, max_length=3)
