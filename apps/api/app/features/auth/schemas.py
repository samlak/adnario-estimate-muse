from pydantic import BaseModel, EmailStr, Field


class SignIn(BaseModel):
    email: str
    password: str


class SignUp(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    company: str = Field(min_length=1, max_length=160)
    email: EmailStr
    password: str = Field(min_length=10, max_length=200)


class Join(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=10, max_length=200)


class Rename(BaseModel):
    name: str = Field(min_length=1, max_length=120)
