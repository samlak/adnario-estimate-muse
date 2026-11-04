"""Rate build-ups: lines plus additions, a missing price leaving the rate blank (nothing is guessed), WORK lines at
another item's rate, and the shipped library pricing every item."""

import json

import pytest

from app.core.config import env
from app.features.rate_cards.buildup import output_of, rate_of

BLOCKWORK = {
    'code': 'W1',
    'lines': [
        {'kind': 'MATERIAL', 'price': 'Block', 'qty': 10},
        {'kind': 'LABOUR', 'price': 'Mason', 'qty': 0.1},
        {'kind': 'PLANT', 'price': 'Mixer', 'qty': 0.05},
    ],
    'additions': {'material': 5, 'labour': 10, 'risk': 10},
}
PRICES = {'Block': 900, 'Mason': 18000, 'Mixer': 20000}


def test_a_rate_is_its_lines_plus_additions():
    # material 9,000 × 1.05 + labour 1,800 × 1.10 + plant 1,000 = 12,430, then 10% risk
    assert rate_of(BLOCKWORK, PRICES) == round(12430 * 1.1)


def test_a_missing_price_leaves_the_rate_blank():
    assert rate_of(BLOCKWORK, {'Mason': 18000, 'Mixer': 20000}) is None


def test_a_typed_rate_stands_when_there_is_no_build_up():
    assert rate_of({'price': 4500}, {}) == 4500.0
    assert rate_of({'price': None}, {}) is None


def test_a_work_line_is_another_items_rate():
    wall = {'code': 'W2', 'lines': [{'kind': 'WORK', 'rate': 'W1', 'qty': 2}]}
    assert rate_of(wall, PRICES, {'W1': BLOCKWORK}) == 2 * rate_of(BLOCKWORK, PRICES)
    loop = {'code': 'W3', 'lines': [{'kind': 'WORK', 'rate': 'W3', 'qty': 1}]}
    assert rate_of(loop, PRICES, {'W3': loop}) is None  # an item built on itself has no rate


def test_labour_days_give_the_output():
    assert output_of({'lines': [{'kind': 'LABOUR', 'price': 'Concrete gang', 'qty': 0.125}]}, {'Concrete gang': 'day'}) == {'per_day': 8.0, 'gang': '1 concrete gang'}
    assert output_of({'lines': [{'kind': 'LABOUR', 'price': 'Fixer', 'qty': 1}]}, {'Fixer': 'point'}) is None


@pytest.mark.skipif(not (env.RATE_CARD / 'rates.json').exists(), reason='the rate card library is not here')
def test_the_library_prices_every_item():
    rates = {r['code']: r for r in json.loads((env.RATE_CARD / 'rates.json').read_text())}
    prices = {p['name']: p['price'] for p in json.loads((env.RATE_CARD / 'prices.json').read_text()) if p.get('price') is not None}
    assert all(rate_of(item, prices, rates) is not None for item in rates.values())
    assert rate_of(rates['CON-15'], prices, rates) == 5499  # blinding: 0.05 of CON-02, as the sample BOQ prices it
