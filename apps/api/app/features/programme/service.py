"""The programme (README §8): the contractor's programme of works is read from its PDF by code, put on the Nigerian
working calendar, and checked with the critical path method (float and the critical path from its own links). The AI
says which activity does each piece of the BOQ's work (an item on a storey); code checks every answer, then works out
each activity's cost and the cash flow by month."""

import asyncio
import re
from collections import defaultdict
from datetime import date, datetime, timedelta

from app import llm
from app.config import MODEL_FAST
from app.features.estimate.boq import totals

ROW = re.compile(r'^(\d+) (.+?) (\d+) days? (\d\d \w{3} \d{4}) (\d\d \w{3} \d{4}) ?(.*)$')
LINK = re.compile(r'(\d+)\s*(FS|SS|FF|SF)?\s*([+-]\s*\d+)?', re.I)
FLOOR = re.compile(r'^(FOUNDATION|GROUND FLOOR|FIRST FLOOR|SECOND FLOOR|THIRD FLOOR|\w+ FLOOR|ROOF|BASEMENT|LEVEL \w+|WHOLE BUILDING|EXTERNAL)$')
MAX_ROWS = 5000
PIECES_PER_CALL = 60

ASSIGN = """You are a Nigerian quantity surveyor linking a contractor's programme of works to the BOQ. You are given
the programme's activities (id, name, the stage and floor it sits under) and pieces of BOQ work (key, BOQ section,
storey, description). For each piece say which activity or activities do that work on that storey: usually one;
more only when the work is plainly split between them (zones A and B of the same operation). Procurement, approvals
and delivery activities never do measured work. When no activity does it, answer an empty list.

Answer with JSON only: {"pieces": [{"key": "W001", "activities": [61, 62]}]}"""


# ── The calendar ─────────────────────────────────────────────────────────────────────────────────────────────────
def easter(year: int) -> date:
    a, b, c = year % 19, year // 100, year % 100
    d, e = b // 4, b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = c // 4, c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    return date(year, (h + l - 7 * m + 114) // 31, (h + l - 7 * m + 114) % 31 + 1)


def holidays(year: int) -> set[date]:
    sunday = easter(year)
    fixed = {date(year, m, d) for m, d in ((1, 1), (5, 1), (6, 12), (10, 1), (12, 25), (12, 26))}
    return fixed | {sunday - timedelta(days=2), sunday + timedelta(days=1)}


def working(day: date) -> bool:
    return day.weekday() != 6 and day not in holidays(day.year)


def working_days(start: date, end: date) -> list[date]:
    out, day = [], start
    while day <= end:
        if working(day):
            out.append(day)
        day += timedelta(days=1)
    return out


# ── Reading the PDF ──────────────────────────────────────────────────────────────────────────────────────────────
def parse_rows(text: str) -> list[dict]:
    rows = []
    for line in text.splitlines():
        found = ROW.match(line.strip())
        if not found:
            continue
        number, name, days, start, finish, before = found.groups()
        rows.append({
            'id': int(number), 'name': name.strip(), 'duration': int(days),
            'start_date': datetime.strptime(start, '%d %b %Y').date(), 'finish_date': datetime.strptime(finish, '%d %b %Y').date(),
            'before': [(int(m[1]), (m[2] or 'FS').upper(), int((m[3] or '0').replace(' ', ''))) for m in LINK.finditer(before or '')],
        })
        if len(rows) > MAX_ROWS:
            raise ValueError(f'The programme has over {MAX_ROWS} activities')
    if not rows:
        raise ValueError('No activities found: the PDF needs rows of ID, name, duration, start, finish and predecessors')
    # a summary (its name in capitals) holds what follows it; a floor summary sits under the stage it falls inside
    stack: list[dict] = []
    for row in rows:
        row['summary'] = row['name'] == row['name'].upper() and any(ch.isalpha() for ch in row['name'])
        if row['summary']:
            while stack and len(stack) > 1 and not (FLOOR.match(row['name']) and not FLOOR.match(stack[-1]['name'])
                                                   and stack[-1]['start_date'] <= row['start_date'] and row['finish_date'] <= stack[-1]['finish_date']):
                stack.pop()
            row['level'] = len(stack)
            row['parent'] = stack[-1]['id'] if stack else None
            stack.append(row)
        else:
            row['level'] = len(stack)
            row['parent'] = stack[-1]['id'] if stack else None
    return rows


def read_pdf(path) -> tuple[str, list[dict]]:
    import pdfplumber

    with pdfplumber.open(path) as pdf:
        text = '\n'.join(page.extract_text() or '' for page in pdf.pages)
    title = next((line.split(':', 1)[1].split(' Page ')[0].strip() for line in text.splitlines() if line.startswith('PROGRAMME OF WORKS:')), '')
    return title, parse_rows(text)


# ── Critical path ────────────────────────────────────────────────────────────────────────────────────────────────
def schedule(rows: list[dict]) -> dict:
    """The programme on working days: each activity's start and (exclusive) finish day, float, critical."""
    start = min(row['start_date'] for row in rows)
    end = max(row['finish_date'] for row in rows)
    days = working_days(start, end)
    index = {day: at for at, day in enumerate(days)}

    def at(day: date) -> int:  # a date on a holiday counts from the next working day
        while day not in index and day <= end:
            day += timedelta(days=1)
        return index.get(day, len(days) - 1)

    activities = []
    for row in rows:
        first = at(row['start_date'])
        finish = first if row['duration'] == 0 else max(first + 1, at(row['finish_date']) + 1)
        activities.append({
            'id': row['id'], 'code': str(row['id']), 'name': row['name'], 'summary': row['summary'], 'level': row['level'],
            'parent': row['parent'], 'start': first, 'finish': finish, 'milestone': row['duration'] == 0, 'cost': 0.0, 'work': [], 'refs': [],
        })
    tasks = {a['id']: a for a in activities if not a['summary']}
    for row in rows:  # a milestone on the day its predecessor finishes sits at the end of that day
        task = tasks.get(row['id'])
        if task and task['milestone'] and any(b in tasks and tasks[b]['finish'] == task['start'] + 1 for b, _, _ in row['before']):
            task['start'] = task['finish'] = task['start'] + 1
    links = [{'before': before, 'after': row['id'], 'kind': kind, 'lag': lag}
             for row in rows for before, kind, lag in row['before'] if before in tasks and row['id'] in tasks]
    n = len(days)
    late = {key: n for key in tasks}  # late finish
    for _ in range(len(tasks)):  # relax until nothing moves (links are few; ponytail: topological order if it gets slow)
        moved = False
        for link in links:
            before, after = tasks[link['before']], tasks[link['after']]
            length = before['finish'] - before['start']
            late_start = late[after['id']] - (after['finish'] - after['start'])
            bound = {'FS': late_start - link['lag'], 'SS': late_start - link['lag'] + length,
                     'FF': late[after['id']] - link['lag'], 'SF': late[after['id']] - link['lag'] + length}[link['kind']]
            if bound < late[before['id']]:
                late[before['id']] = bound
                moved = True
        if not moved:
            break
    for key, task in tasks.items():
        task['float'] = max(0, late[key] - task['finish'])
        task['critical'] = task['float'] == 0
    for activity in activities:
        if activity['summary']:
            under = [t for t in tasks.values() if t['start'] >= activity['start'] and t['finish'] <= activity['finish']]
            activity['float'] = min((t['float'] for t in under), default=0)
            activity['critical'] = any(t['critical'] for t in under)
    return {'start': start.isoformat(), 'days': [day.isoformat() for day in days], 'end': n, 'activities': activities,
            'links': [{'before': link['before'], 'after': link['after']} for link in links]}


# ── The BOQ's work, put in the programme ─────────────────────────────────────────────────────────────────────────
def pieces_of(result: dict) -> list[dict]:
    """Each BOQ item split by storey: what the AI links to activities."""
    storey_of = {row['gid']: row['storey'] for row in result['takeoff']}
    out = []
    for line in result['boq']:
        counts: dict = defaultdict(int)
        for gid in line['gids']:
            counts[storey_of.get(gid) or 'whole building'] += 1
        total = sum(counts.values())
        for storey, count in (counts.items() if total else [('whole building', 1)]):
            out.append({'key': f'W{len(out) + 1:03d}', 'code': line['code'], 'section': line['section'], 'storey': storey, 'description': line['description'],
                        'unit': line['unit'], 'share': count / (total or 1), 'qty': (line['qty'] or 0) * count / (total or 1),
                        'gids': [gid for gid in line['gids'] if (storey_of.get(gid) or 'whole building') == storey]})
    return out


def check_answer(pieces: list[dict], answer: dict | None, tasks: dict) -> tuple[dict, list[str]]:
    found, wrong = {}, []
    for each in (answer or {}).get('pieces') or []:
        ids = [int(x) for x in each.get('activities') or [] if str(x).isdigit()]
        if any(x not in tasks for x in ids):
            wrong.append(each.get('key'))
            continue
        found[each.get('key')] = ids
    return found, wrong


async def assign(programme: dict, result: dict) -> dict:
    activities = programme['activities']
    named = {a['id']: a for a in activities}
    tasks = {a['id']: a for a in activities if not a['summary']}
    listed = [{'id': a['id'], 'name': a['name'], 'under': ' / '.join(named[p]['name'] for p in [a['parent'], named.get(a['parent'], {}).get('parent')] if p in named)}
              for a in tasks.values()]
    pieces = pieces_of(result)
    gate = asyncio.Semaphore(4)

    async def one(batch, again=False):
        shown = [{key: piece[key] for key in ('key', 'section', 'storey', 'description')} for piece in batch]
        note = '\nSome answers named activities that do not exist or are summaries: use only the ids listed.' if again else ''
        async with gate:
            try:
                answer = await llm.ask_json(MODEL_FAST, ASSIGN + note, f'Activities:\n{listed}\n\nPieces of work:\n{shown}', 'low')
            except Exception:
                answer = None
        found, wrong = check_answer(batch, answer, tasks)
        if wrong and not again:  # one retry for the pieces it got wrong
            retry = await one([piece for piece in batch if piece['key'] in wrong], True)
            found.update(retry)
        return found

    said = {}
    for found in await asyncio.gather(*(one(pieces[at : at + PIECES_PER_CALL]) for at in range(0, len(pieces), PIECES_PER_CALL))):
        said.update(found)
    lines = {line['code']: line for line in result['boq']}
    missing = []
    for piece in pieces:
        ids = said.get(piece['key']) or []
        if not ids:
            missing.append(piece)
            continue
        rate = lines[piece['code']].get('rate')
        span = sum(tasks[x]['finish'] - tasks[x]['start'] or 1 for x in ids)
        for x in ids:
            weight = (tasks[x]['finish'] - tasks[x]['start'] or 1) / span
            task = tasks[x]
            task['work'].append({'code': piece['code'], 'description': piece['description'], 'qty': round(piece['qty'] * weight, 3), 'unit': piece['unit'], 'shared': len(ids) > 1})
            task['refs'] += piece['gids']
            task['cost'] += (piece['qty'] * weight * rate) if rate is not None else 0
    grouped: dict = defaultdict(int)
    for piece in missing:
        grouped[(piece['section'], piece['storey'], piece['description'])] += len(piece['gids']) or 1
    programme['not_in_programme'] = [{'section': s, 'storey': st, 'operation': op, 'count': c} for (s, st, op), c in grouped.items()]
    programme['unpriced'] = sorted({piece['code'] for piece in pieces if lines[piece['code']].get('rate') is None})
    return programme


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


async def build(path, result: dict) -> dict:
    title, rows = await asyncio.to_thread(read_pdf, path)
    programme = schedule(rows)
    programme['title'] = title
    programme = await assign(programme, result)
    summary = totals(result['boq'], result['pricing'])
    programme['cash_flow'] = cash_flow(programme, result['pricing'], summary['prelims'])
    return programme


def reprice(programme: dict, result: dict) -> dict:
    """After the QS changes rates: the same links, new costs and cash flow."""
    lines = {line['code']: line for line in result['boq']}
    for activity in programme['activities']:
        activity['cost'] = sum(work['qty'] * (lines.get(work['code'], {}).get('rate') or 0) for work in activity.get('work') or [])
    programme['unpriced'] = sorted({w['code'] for a in programme['activities'] for w in a.get('work') or [] if lines.get(w['code'], {}).get('rate') is None})
    programme['cash_flow'] = cash_flow(programme, result['pricing'], totals(result['boq'], result['pricing'])['prelims'])
    return programme


def shown(actor, programme: dict | None) -> dict | None:
    """The programme as this person may see it: no money for who may not see the estimate."""
    if programme is None or actor.can('see_estimate'):
        return programme
    hidden = {**programme, 'cash_flow': [], 'unpriced': []}
    hidden['activities'] = [{**a, 'cost': None, 'work': [{**w, 'qty': None} for w in a.get('work') or []]} for a in programme['activities']]
    return hidden
