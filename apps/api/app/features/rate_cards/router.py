"""Rate cards (README §6, §10): every firm starts from Adnario Market Rates, copied from database/seed/rate-card. Rows are
prices (material, labour, plant) or work items with a build-up; a rate is Σ(quantity × price) plus the additions, to
the naira, and stays blank when a price is missing. Change a price and every rate built on it changes."""


from uuid import UUID

from fastapi import APIRouter

from app.core.access import CurrentActor
from app.database import connection as db
from app.features.rate_cards import service
from app.features.rate_cards.schemas import Rename, Row, RowChange

router = APIRouter()


@router.get('/ratecards')
def ratecard(actor: CurrentActor):
    actor.need('see_rates')
    with db.in_org(actor.org_id) as connection:
        return service.card_of(connection)


@router.patch('/ratecards/{card_id}')
def rename(card_id: UUID, body: Rename, actor: CurrentActor):
    actor.need('edit_rates')
    with db.in_org(actor.org_id) as connection:
        service.rename(connection, card_id, body.name)
    return {'ok': True}


@router.post('/ratecards/{card_id}/rows')
def add_row(card_id: UUID, body: Row, actor: CurrentActor):
    actor.need('edit_rates')
    with db.in_org(actor.org_id) as connection:
        return service.add_row(connection, actor, card_id, body)


@router.patch('/raterows/{row_id}')
def change_row(row_id: UUID, body: RowChange, actor: CurrentActor):
    actor.need('edit_rates')
    with db.in_org(actor.org_id) as connection:
        service.change_row(connection, row_id, body)
    return {'ok': True}


@router.delete('/raterows/{row_id}')
def delete_row(row_id: UUID, actor: CurrentActor):
    actor.need('edit_rates')
    with db.in_org(actor.org_id) as connection:
        service.delete_row(connection, row_id)
    return {'ok': True}
