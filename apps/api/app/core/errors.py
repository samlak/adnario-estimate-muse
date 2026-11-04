"""The errors a route raises, each with its status."""

from fastapi import HTTPException


class NotFound(HTTPException):
    def __init__(self, what: str = 'Not found'):
        super().__init__(404, what)


class Forbidden(HTTPException):
    def __init__(self, what: str = 'Your role does not allow that'):
        super().__init__(403, what)
