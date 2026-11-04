import re


def safe_name(filename: str) -> str:
    """A file name safe to keep on disk."""
    return re.sub(r'[^\w.\- ]', '_', filename)


def mentioned(people: list[dict], text: str) -> list[dict]:
    """The people named with an @ in the text."""
    return [person for person in people if f'@{person["name"]}' in text]
