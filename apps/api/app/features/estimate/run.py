"""The estimate run (README §7.2): Context, Read, Catalogue, Brief, Map, Derive, takeoff lines, Review, streamed as
it goes. Code measures and adds up; the AI decides what each type is and how it is billed, and code checks every
answer. Confidence is code's, from checks anyone can repeat; a Low mapping is held for the QS, not billed."""

import asyncio
import time
from collections import Counter, defaultdict
from collections.abc import AsyncIterator

from app.database import connection as db
from app.core import llm
from app.core.constants import MODEL_FAST, MODEL_SMART, PERCENT
from app.features.estimate import prompts
from app.features.estimate.read import catalogue, read_models
from app.features.estimate.takeoff import card_of, check_mapping, derive, identity, measure, provisional_qty, roll_up
from app.features.models import open_ifc

BATCH = 22  # types per Map call
PARALLEL = 4


async def run(estimate_id, org_id) -> AsyncIterator[tuple[str, dict]]:
    started = time.monotonic()

    def stage(name: str, state: str = 'start', **more):
        return 'stage', {'name': name, 'state': state, 'seconds': round(time.monotonic() - started, 1), **more}

    def load():
        with db.in_org(org_id) as connection:
            estimate = connection.execute('select * from estimates where id = %s', [estimate_id]).fetchone()
            project = connection.execute('select * from projects where id = %s', [estimate['project_id']]).fetchone()
            models = connection.execute("select * from models where project_id = %s and state = 'current' order by name", [estimate['project_id']]).fetchall()
            before = connection.execute(
                "select result from estimates where project_id = %s and revision < %s and status = 'ready' order by revision desc limit 1",
                [estimate['project_id'], estimate['revision']],
            ).fetchone()
            connection.execute("update estimates set status = 'running', updated_at = now() where id = %s", [estimate_id])
        return estimate, project, models, (before or {}).get('result')

    estimate, project, models, before = await asyncio.to_thread(load)
    if not models:
        raise ValueError('Upload the building models first')
    info = estimate['info'] or {}

    yield stage('Context')
    context = info.get('text', '')
    if context:
        context = await llm.ask_text(MODEL_SMART, 'Summarise these project documents for a quantity surveyor: what is to be built, where, the specification and anything excluded. Plain text, at most 200 words.', context[:60000], 'low')
    yield stage('Context', 'done')

    yield stage('Read')
    elements, summaries = await asyncio.to_thread(read_models, models, open_ifc)
    for cls, count in sorted(Counter(element['class'] for element in elements).items(), key=lambda kv: kv[1]):
        measured = sum(1 for element in elements if element['class'] == cls and element['q'])
        yield 'log', {'text': f'{cls}: {count} read, {measured} with quantities'}
    yield stage('Read', 'done', elements=len(elements))

    yield stage('Catalogue')
    types = catalogue(elements)
    type_of = {}
    for entry in types:
        for ref in entry['gids']:
            type_of[ref] = entry['key']
    for element in elements:
        element['type_key'] = type_of[element['ref']]
    # which elements make up each type: the viewer fills them in as the AI decides each type
    yield 'catalogue', {'types': {entry['key']: entry['gids'] for entry in types}}
    yield 'log', {'text': f'{len(elements)} elements → {len(types)} distinct types (this is what the AI reads, not the file)'}
    yield stage('Catalogue', 'done', types=len(types))

    # Understand the building: what the AI makes of the model before it maps anything; it goes into every Map call
    yield stage('Understand')
    overview = {'models': [{'name': summary['model'], 'schema': summary['schema'], 'storeys': summary['storeys']} for summary in summaries],
                'classes': dict(Counter(element['class'] for element in elements).most_common()),
                'types': [f'{entry["class"]} {entry["family"] or ""} {entry["type"]} ×{entry["count"]}' for entry in types][:150]}
    try:
        seen = await llm.ask_text(MODEL_FAST, prompts.SEE, f'Project: {project["name"]}, {project["location"]}. {project["description"]}\n{context}\nModel: {overview}', 'low')
    except Exception as error:
        seen = f'- The model could not be summarised: {error}'
    yield 'seen', {'text': seen}
    yield stage('Understand', 'done')

    # the Map step: as each batch is answered, code measures it at once
    yield stage('Map')
    yield 'log', {'text': f'{len(types)} types in {-(-len(types) // BATCH)} batches, {PARALLEL} at a time ({MODEL_FAST})'}
    carried = {identity(entry): entry['mapping'] for entry in (before or {}).get('types', []) if entry.get('mapping') and entry['mapping'].get('decision') != 'unmapped'}
    members: dict[str, list[dict]] = defaultdict(list)
    for element in elements:
        members[element['type_key']].append(element)
    rows: list[dict] = []

    def measure_type(entry: dict) -> None:
        mapping = entry['mapping']
        status = 'billed' if mapping['decision'] == 'bill' and not mapping['held'] else 'held' if mapping['held'] else mapping['decision']
        for element in members[entry['key']]:
            for item in mapping['items']:
                qty, source = measure(element, item, entry.get('layers') or [])
                rows.append({
                    'ref': element['ref'], 'gid': element['ref'], 'storey': element['storey'], 'type_key': entry['key'], 'section': item['section'],
                    'description': item['description'], 'unit': item['unit'], 'qty': qty or 0, 'source': source,
                    'status': status if qty else 'not_measured', 'confidence': mapping['confidence'],
                })

    pending = [entry for entry in types if identity(entry) not in carried]
    for entry in types:
        if identity(entry) in carried:
            entry['mapping'] = carried[identity(entry)]
            measure_type(entry)
    if len(pending) < len(types):
        yield 'mapped', {'keys': [entry['key'] for entry in types if entry.get('mapping')], 'confidence': {entry['key']: entry['mapping']['confidence'] for entry in types if entry.get('mapping')}, 'carried': True}

    def ask(batch: list[dict]) -> str:
        shown = [{key: entry.get(key) for key in ('key', 'class', 'family', 'type', 'model', 'size', 'count', 'material', 'layers', 'storeys', 'totals', 'thickness_mm', 'width_mm')} for entry in batch]
        return f'Project: {project["name"]}, {project["location"]}.\n{context}\nWhat the model is:\n{seen}\nTypes:\n{shown}'

    async def map_batch(batch: list[dict]):
        try:
            answer = await llm.ask_json(MODEL_FAST, prompts.MAP, ask(batch), 'low')
            said = {item.get('key'): item for item in answer.get('types', [])} if isinstance(answer, dict) else {}
        except Exception:
            said = {}
        return batch, said

    gate = asyncio.Semaphore(PARALLEL)

    async def guarded(batch):
        async with gate:
            return await map_batch(batch)

    tasks = [asyncio.create_task(guarded(pending[at : at + BATCH])) for at in range(0, len(pending), BATCH)]
    for task in asyncio.as_completed(tasks):
        batch, said = await task
        for entry in batch:
            entry['mapping'] = check_mapping(entry, said.get(entry['key']))
            await asyncio.to_thread(measure_type, entry)
        yield 'mapped', {'keys': [entry['key'] for entry in batch], 'confidence': {entry['key']: entry['mapping']['confidence'] for entry in batch}, 'rows': len(rows),
                         'cards': [card_of(entry, rows) for entry in batch]}
    yield stage('Map', 'done')

    yield stage('Derive')
    derived = derive(elements, rows)
    rows += derived
    sums: dict[str, float] = defaultdict(float)
    for row in derived:
        sums[row['description']] += row['qty']
    for description, qty in sums.items():
        yield 'log', {'text': f'{"Bed" if "formwork" not in description.lower() else "Formwork"}: {description}: {qty:,.2f} m²'}
    yield stage('Derive', 'done', rows=len(derived))

    yield stage('BOQ')
    lines = roll_up(rows)
    yield 'log', {'text': f'{len(lines)} BOQ lines from {len(rows)} takeoff rows; {sum(1 for row in rows if row.get("source") == "geometry")} measured from geometry'}
    yield stage('BOQ', 'done', lines=len(lines))

    yield stage('Brief')
    yield stage('Review')
    overview = {'models': [m['name'] for m in models], 'storeys': sorted({s['name'] for summary in summaries for s in summary['storeys']}),
                'classes': dict(sorted(((entry['class'], sum(t['count'] for t in types if t['class'] == entry['class'])) for entry in types), key=lambda kv: -kv[1]))}
    shown_lines = [{key: line[key] for key in ('code', 'section', 'description', 'qty', 'unit', 'count', 'confidence')} for line in lines]
    held = [{'type': f'{entry["class"]} {entry["type"]}', 'count': entry['count'], 'why': entry['mapping']['reason']} for entry in types if entry['mapping'].get('held')]
    left = [{'type': f'{entry["class"]} {entry["type"]}', 'count': entry['count'], 'why': entry['mapping']['reason']} for entry in types if entry['mapping']['decision'] in ('exclude', 'unmapped')]
    user = (f'Project: {project["name"]} for {project["client"]}, {project["location"]}. {project["description"]}\nDocuments: {context or "none given"}\n'
            f'Model overview: {overview}\nMeasured lines: {shown_lines}\nHeld: {held}\nLeft out: {left}')
    try:
        review = await llm.ask_json(MODEL_SMART, prompts.REVIEW, user, 'low')
    except Exception as error:
        review = {'brief': '', 'summary': f'The review could not run: {error}', 'questions': [], 'provisional': []}
    yield 'brief', {'text': review.get('brief', '')}
    yield stage('Brief', 'done')
    codes = {line['code'] for line in lines}
    questions = [
        {'severity': q.get('severity') if q.get('severity') in ('high', 'medium', 'low') else 'medium', 'question': str(q.get('question', ''))[:600],
         'line_codes': [code for code in q.get('lines') or [] if code in codes]}
        for q in review.get('questions') or [] if q.get('question')
    ]
    provisional = []
    for number, item in enumerate(review.get('provisional') or [], start=1):
        section = item.get('section') if item.get('section') in prompts.SECTIONS else 'External works'
        unit = {'m2': 'm²', 'm3': 'm³'}.get(item.get('unit'), item.get('unit')) if item.get('unit') in prompts.UNITS | {'m2', 'm3'} else 'item'
        provisional.append({
            'code': f'P{number:02d}', 'description': str(item.get('description', ''))[:300], 'section': section, 'bill': prompts.BILL_OF[section],
            'unit': unit, 'basis': item.get('basis') or 'none', 'reason': str(item.get('reason', ''))[:300],
            'qty': provisional_qty(item.get('basis') or 'none', elements, rows),
        })
    yield stage('Review', 'done', questions=len(questions))

    for entry in types:
        entry['mapping'].setdefault('items', [])
    result = {
        'run': {'name': 'Takeoff 1' if estimate['revision'] == 0 else f'Rev {chr(64 + estimate["revision"])}', 'seconds': round(time.monotonic() - started)},
        'models': [{'id': str(m['id']), 'name': m['name'], 'version': m['version']} for m in models],
        'summaries': summaries, 'brief': review.get('brief', ''), 'facts': review.get('facts') or {}, 'city': (review.get('facts') or {}).get('city') or project['location'],
        'context': context, 'review_summary': review.get('summary', ''),
        'types': types, 'takeoff': rows, 'takeoff_lines': lines, 'boq': (before or {}).get('boq_added', []) and [],
        'questions': questions, 'provisional': provisional,
        'pricing': {**PERCENT, **((before or {}).get('pricing') or {}), 'rate_card': ((before or {}).get('pricing') or {}).get('rate_card'), 'sources': {}},
        'qs_lines': (before or {}).get('qs_lines', []),
        'added_provisional': [code for code in (before or {}).get('added_provisional', []) if any(p['code'] == code for p in provisional)],
    }

    def save():
        with db.in_org(org_id) as connection:
            connection.execute("update estimates set status = 'ready', result = %s, updated_at = now() where id = %s", [db.Jsonb(result), estimate_id])
            connection.execute('update projects set updated_at = now() where id = %s', [estimate['project_id']])

    await asyncio.to_thread(save)
    yield 'result', {'estimate': str(estimate_id), 'lines': len(lines), 'seconds': result['run']['seconds']}
