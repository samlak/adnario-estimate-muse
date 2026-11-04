"""A work item's rate from its build-up: Σ(quantity × price) plus the additions, to the naira; blank when a price is
missing. A labour line by the day gives the item its output per gang-day."""

from app.features.rate_cards.constants import DAY_UNITS


def rate_of(item: dict, prices: dict[str, float], items: dict[str, dict] | None = None, seen: tuple = ()) -> float | None:
    """A work item's rate from its build-up; a typed rate when it has no build-up; blank when a price is missing.
    A WORK line is a quantity of another item (by code) at that item's rate, which already has its own additions."""
    if not item.get('lines'):
        return None if item.get('price') is None else float(item['price'])
    sums = {'MATERIAL': 0.0, 'LABOUR': 0.0, 'PLANT': 0.0}
    work = 0.0
    for line in item['lines']:
        if line['kind'] == 'WORK':
            other = (items or {}).get(line.get('rate') or '')
            sub = None if other is None or other.get('code') in seen else rate_of(other, prices, items, (*seen, item.get('code')))
            if sub is None:
                return None
            work += float(line['qty']) * sub
            continue
        price = prices.get(line['price']) if line.get('price') else line.get('own_price')
        if price is None:
            return None  # nothing is guessed
        sums[line['kind']] += float(line['qty']) * float(price)
    additions = item.get('additions') or {}
    total = sums['MATERIAL'] * (1 + additions.get('material', 0) / 100) + sums['LABOUR'] * (1 + additions.get('labour', 0) / 100) + sums['PLANT']
    return float(round(total * (1 + additions.get('risk', 0) / 100) + work))


def output_of(item: dict, units: dict[str, str]) -> dict | None:
    """Labour lines in days give an item its output per gang-day: 0.125 gang-days a m³ is 8 m³/day."""
    for line in item.get('lines') or []:
        if line['kind'] == 'LABOUR' and line.get('price') and line.get('qty') and units.get(line['price']) in DAY_UNITS:
            return {'per_day': round(1 / float(line['qty']), 2), 'gang': f'1 {line["price"].lower()}'}
    return None
