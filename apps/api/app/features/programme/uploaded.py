"""The contractor's programme read from its PDF by code: each activity's ID, name, duration, dates and links, and
the headings it sits under."""

from datetime import datetime

from app.features.programme.constants import FLOOR, LINK, MAX_ROWS, ROW


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
