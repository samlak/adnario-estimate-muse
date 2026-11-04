"""Generate BOQ (README §7.3): the AI groups the measured lines into the contractor's items and words them; code
checks every line is used once, no item mixes units, every section is ours, and adds the quantities up. Refs are
B1A style: bill letter, element number (sections present, in Nigerian order), item letter (I and O skipped)."""

import asyncio

from app import llm
from app.config import MODEL_SMART
from app.features.estimate import prompts

LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'


def letter(at: int) -> str:
    return LETTERS[at] if at < len(LETTERS) else LETTERS[at // len(LETTERS) - 1] + LETTERS[at % len(LETTERS)]


def ordered(boq: list[dict]) -> list[dict]:
    order = {section: at for at, section in enumerate(prompts.SECTIONS)}
    return sorted(boq, key=lambda line: (line['bill'], order.get(line['section'], 99), line.get('position', 0)))


def display_refs(boq: list[dict]) -> dict[str, str]:
    """Each item's code → its ref in the bill (B1A)."""
    refs, sections, counts = {}, {}, {}
    for line in ordered(boq):
        bill_sections = sections.setdefault(line['bill'], [])
        if line['section'] not in bill_sections:
            bill_sections.append(line['section'])
        key = (line['bill'], line['section'])
        counts[key] = counts.get(key, -1) + 1
        refs[line['code']] = f'{line["bill"]}{bill_sections.index(line["section"]) + 1}{letter(counts[key])}'
    return refs


def amount(line: dict) -> float | None:
    return None if line.get('rate') is None else (line.get('qty') or 0) * line['rate']


def totals(boq: list[dict], pricing: dict) -> dict:
    """Each bill and section, measured work, then prelims on it, contingency on that, VAT on that (as the summary)."""
    bills: dict[str, dict] = {}
    unpriced = 0
    for line in ordered(boq):
        bill = bills.setdefault(line['bill'], {'name': prompts.BILLS[line['bill']][0], 'total': 0.0, 'sections': {}})
        value = amount(line)
        unpriced += value is None
        bill['sections'][line['section']] = bill['sections'].get(line['section'], 0.0) + (value or 0)
        bill['total'] += value or 0
    measured = sum(bill['total'] for bill in bills.values())
    prelims = measured * pricing.get('prelims', 0) / 100
    contingency = (measured + prelims) * pricing.get('contingency', 0) / 100
    vat = (measured + prelims + contingency) * pricing.get('vat', 0) / 100
    return {'bills': bills, 'measured': measured, 'prelims': prelims, 'contingency': contingency, 'vat': vat,
            'total': measured + prelims + contingency + vat, 'unpriced': unpriced, 'priced': len(boq) - unpriced}


def item_of(code: str, section: str, description: str, members: list[dict], position: int) -> dict:
    confidences = {member['confidence'] for member in members}
    return {
        'code': code, 'bill': prompts.BILL_OF[section], 'section': section, 'description': description, 'unit': members[0]['unit'],
        'qty': round(sum(member['qty'] for member in members), 3), 'count': sum(member['count'] for member in members),
        'gids': [gid for member in members for gid in member['gids']], 'lines': [member['code'] for member in members],
        'confidence': 'Low' if 'Low' in confidences else 'Medium' if 'Medium' in confidences else 'High',
        'rate': None, 'rate_item_id': None, 'rate_note': None, 'source': 'group', 'position': position,
    }


def check_groups(lines: list[dict], answer: dict | None) -> list[dict]:
    """The AI's grouping, checked: a line used twice, an unknown line, mixed units or a foreign section is refused;
    a line it left out becomes its own item, as measured."""
    by_code = {line['code']: line for line in lines}
    used: set[str] = set()
    boq = []
    for item in (answer or {}).get('items') or []:
        codes = [code for code in item.get('lines') or [] if code in by_code and code not in used]
        if not codes or len({by_code[code]['unit'] for code in codes}) > 1:
            continue
        section = item.get('section') if item.get('section') in prompts.SECTIONS else by_code[codes[0]]['section']
        description = str(item.get('description') or '').strip()[:400] or by_code[codes[0]]['description']
        used.update(codes)
        boq.append(item_of(f'G{len(boq) + 1:03d}', section, description, [by_code[code] for code in codes], len(boq)))
    for line in lines:
        if line['code'] not in used:
            boq.append(item_of(f'G{len(boq) + 1:03d}', line['section'], line['description'], [line], len(boq)))
    return ordered(boq)


async def group(lines: list[dict]) -> list[dict]:
    """By bill, side by side: each call sees one bill's lines."""
    async def one(bill: str):
        mine = [line for line in lines if line['bill'] == bill]
        if not mine:
            return []
        shown = [{key: line[key] for key in ('code', 'section', 'description', 'unit', 'count')} for line in mine]
        try:
            return mine, await llm.ask_json(MODEL_SMART, prompts.GROUP, f'Measured lines:\n{shown}', 'low')
        except Exception:
            return mine, None

    found = await asyncio.gather(*(one(bill) for bill in prompts.BILLS))
    boq = []
    for each in found:
        if each:
            for item in check_groups(*each):
                boq.append({**item, 'code': f'G{len(boq) + 1:03d}'})
    return ordered(boq)


def provisional_line(item: dict, position: int) -> dict:
    return {
        'code': item['code'], 'bill': item['bill'], 'section': item['section'], 'description': item['description'], 'unit': item['unit'],
        'qty': item.get('qty') or 0, 'count': 0, 'gids': [], 'lines': [], 'confidence': 'Low', 'rate': None, 'rate_item_id': None,
        'rate_note': f'Provisional: {item.get("reason") or item.get("basis")}', 'source': 'provisional', 'position': position,
    }
