"""The cash flow by month, from each activity's cost and the preliminaries."""


def cash_flow(programme: dict, pricing: dict, prelims_total: float) -> list[dict]:
    """By month: each activity's cost spread evenly over its working days; preliminaries over every working day;
    contingency on work and prelims, VAT on all three (as the BOQ summary)."""
    days = programme['days']
    months: dict[str, dict] = {}
    for day in days:
        months.setdefault(day[:7], {'month': day[:7], 'work': 0.0, 'prelims': 0.0, 'activities': {}, 'days': 0})['days'] += 1
    for activity in programme['activities']:
        if activity['summary']:
            continue
        length = activity['finish'] - activity['start']
        for at in range(activity['start'], activity['finish'] if length else activity['start'] + 1):
            if at >= len(days):
                break
            month = months[days[at][:7]]
            share = activity['cost'] / length if length else 0
            month['work'] += share
            entry = month['activities'].setdefault(activity['id'], {'id': activity['id'], 'days': 0, 'amount': 0.0})
            entry['days'] += 1 if length else 0
            entry['amount'] += share
    running = 0.0
    out = []
    for month in months.values():
        month['prelims'] = prelims_total * month['days'] / len(days)
        month['contingency'] = (month['work'] + month['prelims']) * pricing.get('contingency', 0) / 100
        month['vat'] = (month['work'] + month['prelims'] + month['contingency']) * pricing.get('vat', 0) / 100
        month['total'] = month['work'] + month['prelims'] + month['contingency'] + month['vat']
        running += month['total']
        month['cumulative'] = running
        month['activities'] = list(month['activities'].values())
        out.append(month)
    return out
