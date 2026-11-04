from app.features.orgs.constants import INVITE_PATH


def link(token: str) -> dict:
    return {'link': f'{INVITE_PATH}{token}'}


def leaves_no_admin(person: dict, new_role: str | None, admins: int) -> bool:
    """Would changing this person's role (or removing them, new_role None) leave the firm without an Admin?"""
    if person['role'] != 'admin' or new_role == 'admin' or person.get('invite_token') is not None:
        return False
    return admins <= 1
