"""What the sidekick may look up: read-only answers over one estimate (its models' types and takeoff, the BOQ, the
programme and cash flow), worked out by code from what the app already shows. The AI chooses the tool and words the
answer; every number comes from here. Without see_estimate (an architect or engineer), no quantities and no money:
the takeoff, BOQ and cash flow tools say so, and the model and programme tools leave those out. Money in whole
naira, as the app shows it."""

import collections
import json
from datetime import date, timedelta

from app.features.estimate.boq import display_refs, totals
from app.features.sidekick.constants import MAX_ROWS
from app.features.sidekick.definitions import TOOLS


def capped(rows: list, name: str = 'rows') -> dict:
    """A list cut to MAX_ROWS, saying how many were left out."""
    return {name: rows[:MAX_ROWS], **({'more': len(rows) - MAX_ROWS} if len(rows) > MAX_ROWS else {})}


class Tools:
    def __init__(self, result: dict, programme: dict | None, money: bool):
        self.result = result
        self.programme = programme
        self.money = money
        self.refs = display_refs(result['boq'])
        self.lines = {line['code']: line for line in result['boq']}
        self.storey_of = {row['gid']: row['storey'] for row in result['takeoff']}
        self.type_of = {gid: entry for entry in result['types'] for gid in entry['gids']}
        self.code_of = {ref: code for code, ref in self.refs.items()}
        activities = (programme or {}).get('activities') or []
        self.activities = {activity['code']: activity for activity in activities if not activity['summary']}
        self.code_by_id = {activity['id']: activity['code'] for activity in activities}

    def run(self, name: str, args: dict) -> str:
        """A tool's answer as JSON text for the model; a wrong name or argument is told back, not raised."""
        tool = TOOLS.get(name)
        if tool is None:
            return json.dumps({'error': f'No tool {name}'})
        if tool['money'] and not self.money:
            return json.dumps({'error': 'This person may not see quantities or money (contributor).'})
        try:
            return json.dumps(getattr(self, name)(**args), default=str)
        except (TypeError, ValueError) as error:
            return json.dumps({'error': str(error)})

    # ── The project ──────────────────────────────────────────────────────────────────────────────────────────────
    def project_info(self) -> dict:
        info = {
            'brief': self.result.get('brief'),
            'facts': self.result.get('facts'),
            'city': self.result.get('city'),
            'models': [model['name'] for model in self.result['models']],
        }
        if self.money:
            pricing = self.result['pricing']
            info['rate_card'] = (pricing.get('rate_card') or {}).get('title')
            info['percentages'] = {name: pricing[name] for name in ('prelims', 'contingency', 'vat')}
            info['review_summary'] = self.result.get('review_summary')
        return info

    # ── The model ────────────────────────────────────────────────────────────────────────────────────────────────
    def model_overview(self) -> dict:
        storeys = sorted({storey['name'] for summary in self.result['summaries'] for storey in summary['storeys']})
        classes = collections.Counter()
        for entry in self.result['types']:
            classes[entry['class']] += entry['count']
        return {
            'models': [model['name'] for model in self.result['models']],
            'storeys': storeys,
            'types': len(self.result['types']),
            'elements': sum(classes.values()),
            'elements_by_class': dict(classes.most_common()),
        }

    def query_elements(self, ifc_class: str = '', storey: str = '', name: str = '', group_by: str = 'type') -> dict:
        """Elements by class, storey and words in their type or family, counted by type, storey or class."""
        found = []
        for entry in self.result['types']:
            if ifc_class and ifc_class.lower() not in entry['class'].lower():
                continue
            words = f'{entry["type"]} {entry.get("family") or ""} {" ".join(entry.get("sample_names") or [])}'
            if name and name.lower() not in words.lower():
                continue
            for gid in entry['gids']:
                if storey and storey.lower() != (self.storey_of.get(gid) or '').lower():
                    continue
                found.append((gid, entry))
        groups = collections.Counter()
        for gid, entry in found:
            key = {'storey': self.storey_of.get(gid) or 'no storey', 'class': entry['class']}.get(group_by)
            groups[key or type_label(entry)] += 1
        return {
            'count': len(found),
            'by_' + (group_by if group_by in ('storey', 'class') else 'type'): dict(groups.most_common(MAX_ROWS)),
            'sample_refs': [gid for gid, _ in found[:10]],
        }

    def element_details(self, ref: str) -> dict:
        entry = self.type_of.get(ref) or next(
            (each for each in self.result['types'] if any(gid.endswith('#' + ref) for gid in each['gids'])), None
        )
        if entry is None:
            raise ValueError(f'No element {ref} in this estimate')
        details = {
            'class': entry['class'],
            'type': type_label(entry),
            'model': entry.get('model'),
            'storey': self.storey_of.get(ref),
            'material': entry.get('material'),
            'size': entry.get('size'),
            'decision': (entry.get('mapping') or {}).get('decision'),
        }
        if self.money:
            rows = [row for row in self.result['takeoff'] if row['gid'] == ref or row['gid'].endswith('#' + ref)]
            details['measured'] = [
                {
                    'qty': row['qty'],
                    'unit': row['unit'],
                    'status': row['status'],
                    'boq': self.refs.get(row.get('code') or '', row.get('code')),
                }
                for row in rows
            ]
        return details

    # ── The takeoff ──────────────────────────────────────────────────────────────────────────────────────────────
    def takeoff_summary(self, section: str = '') -> dict:
        lines = self.result.get('takeoff_lines') or self.result['boq']
        rows = [
            {
                'section': line['section'],
                'description': line['description'],
                'qty': line['qty'],
                'unit': line['unit'],
                'elements': line['count'],
            }
            for line in lines
            if not line['code'].startswith('X') and (not section or section.lower() in line['section'].lower())
        ]
        return capped(rows, 'lines')

    def not_measured(self) -> dict:
        rows = []
        for entry in self.result['types']:
            mapping = entry.get('mapping') or {}
            if not mapping or mapping.get('decision') == 'unmapped':
                why = 'the AI could not say what BOQ item it is'
            elif mapping.get('held'):
                why = mapping.get('reason') or 'held: the AI was unsure'
            elif mapping.get('decision') == 'exclude':
                why = mapping.get('reason') or 'not a BOQ item'
            else:
                continue
            rows.append({'type': type_label(entry), 'class': entry['class'], 'count': entry['count'], 'why': why})
        return capped(rows, 'types')

    # ── The BOQ ──────────────────────────────────────────────────────────────────────────────────────────────────
    def boq_lines(self, bill: str = '', search: str = '', sort: str = '', limit: int = 0) -> dict:
        """BOQ items, optionally of one bill, section or element and with these words, ranked by code when asked
        (amount, qty or rate, largest first; cheapest for the smallest amount), with their count and total."""
        rows = []
        for line in self.result['boq']:
            if bill and bill.lower() not in f'{line["bill"]} {line["section"]}'.lower():
                continue
            if search and search.lower() not in f'{line["description"]} {line["section"]}'.lower():
                continue
            rows.append(self.line_row(line))
        priced = [row['amount'] for row in rows if row['amount'] is not None]
        found = {'count': len(rows), 'total_amount': sum(priced), 'without_rate': len(rows) - len(priced)}
        if sort in ('amount', 'rate', 'cheapest'):  # a ranking by money leaves out the lines without a rate
            field = 'rate' if sort == 'rate' else 'amount'
            rows = sorted((row for row in rows if row[field] is not None), key=lambda row: row[field])
            rows = rows if sort == 'cheapest' else rows[::-1]
        elif sort == 'qty':
            rows.sort(key=lambda row: row['qty'] or 0, reverse=True)
        return {**found, **capped(rows[:limit] if limit > 0 else rows, 'lines')}

    def line_row(self, line: dict) -> dict:
        rate = line.get('rate')
        return {
            'ref': self.refs.get(line['code'], line['code']),
            'code': line['code'],
            'bill': line['bill'],
            'section': line['section'],
            'description': line['description'],
            'qty': line['qty'],
            'unit': line['unit'],
            'rate': rate,
            'amount': None if rate is None else round((line['qty'] or 0) * rate),
        }

    def boq_line(self, ref: str) -> dict:
        """One BOQ item by its ref (B1A) or code: its rate and where the rate came from, its confidence, elements,
        the programme activities that do its work and the review questions about it."""
        code = self.code_of.get(ref.upper(), ref.upper())
        line = self.lines.get(code)
        if line is None:
            raise ValueError(f'No BOQ item {ref}')
        source = (self.result['pricing'].get('sources') or {}).get(line.get('rate_item_id') or '')
        return {
            **self.line_row(line),
            'rate_from': source
            and {'card': source.get('card'), 'item': source.get('code'), 'as': source.get('description')},
            'rate_note': line.get('rate_note'),
            'confidence': line.get('confidence'),
            'elements': line['count'],
            'sample_refs': line['gids'][:5],
            'activities': [
                {'activity': f'{activity["code"]} {activity["name"]}', **self.dates(activity)}
                for activity in self.activities.values()
                if any(work['code'] == code for work in activity.get('work') or [])
            ],
            'review_questions': [
                question['question'] for question in self.result['questions'] if code in question.get('line_codes', [])
            ],
        }

    def review_questions(self, severity: str = '') -> dict:
        """The questions the review left for the QS, with their severity and the BOQ items they are about."""
        rows = [
            {
                'question': question['question'],
                'severity': question['severity'],
                'boq': [{'ref': self.refs.get(code, code), 'code': code} for code in question.get('line_codes', [])],
            }
            for question in self.result['questions']
            if not severity or question['severity'] == severity.lower()
        ]
        counts = collections.Counter(question['severity'] for question in self.result['questions'])
        return {'count': len(self.result['questions']), 'by_severity': dict(counts), **capped(rows, 'questions')}

    def provisional_items(self) -> dict:
        """Items the design lacks, proposed for the QS to add: each with its quantity basis, reason and whether the
        QS has added it to the BOQ."""
        rows = [
            {
                'description': item['description'],
                'bill': item['bill'],
                'section': item['section'],
                'qty': item['qty'],
                'unit': item['unit'],
                'basis': item.get('basis'),
                'reason': item.get('reason'),
                'added_to_boq': item['code'] in self.lines,
            }
            for item in self.result['provisional']
        ]
        return {'count': len(rows), 'added': sum(row['added_to_boq'] for row in rows), **capped(rows, 'items')}

    def boq_totals(self) -> dict:
        summary = totals(self.result['boq'], self.result['pricing'])
        return {
            'bills': {bill: round(value['total']) for bill, value in summary['bills'].items() if value.get('total')},
            'measured_work': round(summary['measured']),
            'preliminaries': round(summary['prelims']),
            'contingency': round(summary['contingency']),
            'vat': round(summary['vat']),
            'total': round(summary['total']),
            'lines_without_rate': summary['unpriced'],
            'percentages': {name: self.result['pricing'][name] for name in ('prelims', 'contingency', 'vat')},
        }

    # ── Time and money ───────────────────────────────────────────────────────────────────────────────────────────
    def programme_at(self, week: int | None = None, day: str = '') -> dict:
        """What the programme shows in a week (1 = the week it starts) or on a date: under way, starting, finishing,
        and, for who may see money, the value of the work done to the end of it and in it."""
        programme = self.need_programme()
        start = date.fromisoformat(programme['start'])
        if day:
            first = last = date.fromisoformat(day)
        else:
            first = start + timedelta(weeks=(week or 1) - 1)
            last = first + timedelta(days=6)
        days = [date.fromisoformat(each) for each in programme['days']]
        inside = [number for number, each in enumerate(days) if first <= each <= last]
        if not inside:
            return {'from': first, 'to': last, 'note': 'Not a working day of the programme', 'ends': days[-1]}
        low, high = inside[0], inside[-1]
        activities = [activity for activity in programme['activities'] if not activity['summary']]

        def names(chosen):
            return [f'{activity["code"]} {activity["name"]}' for activity in chosen][:MAX_ROWS]

        answer = {
            'from': first,
            'to': last,
            'working_days': f'{low + 1} to {high + 1} of {programme["end"]}',
            'under_way': names(a for a in activities if a['start'] <= high and a['finish'] > low),
            'starting': names(a for a in activities if low <= a['start'] <= high),
            'finishing': names(a for a in activities if a['finish'] > a['start'] and low <= a['finish'] - 1 <= high),
        }
        if self.money:
            answer['work_done_to_date'] = round(done(activities, high))
            answer['work_done_in_it'] = round(done(activities, high) - (done(activities, low - 1) if low else 0))
        return answer

    def programme_overview(self) -> dict:
        """The programme's dates and size, its critical path and the measured work it does not cover."""
        programme = self.need_programme()
        activities = list(self.activities.values())
        critical = [f'{activity["code"]} {activity["name"]}' for activity in activities if activity.get('critical')]
        return {
            'start': programme['days'][0],
            'finish': programme['days'][-1],
            'working_days': programme['end'],
            'activities': len(activities),
            'critical_activities': len(critical),
            **capped(critical, 'critical_path'),
            'work_not_in_programme': [
                {key: each[key] for key in ('section', 'storey', 'operation', 'count') if key in each}
                for each in programme.get('not_in_programme') or []
            ][:MAX_ROWS],
        }

    def programme_activities(self, search: str = '', sort: str = '', critical: bool = False, limit: int = 0) -> dict:
        """Every activity with its dates, working days, float and (for who may see money) cost, optionally only those
        whose code or name has these words or on the critical path, ranked by code when asked (cost, working_days or
        float, largest first; start for the earliest); with their count and total cost."""
        programme = self.need_programme()
        rows = []
        for activity in self.activities.values():
            if search and search.lower() not in f'{activity["code"]} {activity["name"]}'.lower():
                continue
            if critical and not activity.get('critical'):
                continue
            row = {'activity': f'{activity["code"]} {activity["name"]}', **self.dates(activity)}
            if self.money:
                row['cost'] = round(activity.get('cost') or 0)
            rows.append(row)
        if sort in ('cost', 'working_days', 'float'):
            rows.sort(key=lambda row: row.get(sort) or 0, reverse=True)
        elif sort == 'start':
            rows.sort(key=lambda row: row['start'] or '')
        found = {'count': len(rows), 'programme_days': programme['end']}
        if self.money:
            found['total_cost'] = round(sum(activity.get('cost') or 0 for activity in self.matching(search, critical)))
        return {**found, **capped(rows[:limit] if limit > 0 else rows, 'activities')}

    def matching(self, search: str, critical: bool) -> list[dict]:
        return [
            activity
            for activity in self.activities.values()
            if (not search or search.lower() in f'{activity["code"]} {activity["name"]}'.lower())
            and (not critical or activity.get('critical'))
        ]

    def activity(self, code: str) -> dict:
        """One programme activity by its ID: dates, float, whether it is critical, the activities before and after it,
        and (for who may see money) the BOQ work it does and its cost."""
        self.need_programme()
        activity = self.activities.get(str(code))
        if activity is None:
            raise ValueError(f'No activity {code} in the programme')

        def named(ids):
            return [f'{self.activities[c]["code"]} {self.activities[c]["name"]}' for c in ids if c in self.activities]

        links = self.programme['links']  # type: ignore[index]
        answer = {
            'activity': f'{activity["code"]} {activity["name"]}',
            **self.dates(activity),
            'critical': bool(activity.get('critical')),
            'after': named(self.code_by_id.get(link['before']) for link in links if link['after'] == activity['id']),
            'before': named(self.code_by_id.get(link['after']) for link in links if link['before'] == activity['id']),
            'elements': len(activity.get('refs') or []),
        }
        if self.money:
            answer['cost'] = round(activity.get('cost') or 0)
            answer['boq_work'] = [
                {
                    'ref': self.refs.get(work['code'], work['code']),
                    'code': work['code'],
                    'description': work['description'],
                    'qty': work['qty'],
                    'unit': work['unit'],
                    'shared_with_other_activities': bool(work.get('shared')),
                }
                for work in activity.get('work') or []
            ]
        return answer

    def dates(self, activity: dict) -> dict:
        """An activity's first and last working day, with the programme weeks they fall in (as programme_at counts)."""
        days = self.programme['days']  # type: ignore[index]
        last = max(activity['start'], activity['finish'] - 1)
        start = days[activity['start']] if activity['start'] < len(days) else None
        finish = days[last] if last < len(days) else None
        return {
            'start': start,
            'finish': finish,
            'start_week': self.week(start),
            'finish_week': self.week(finish),
            'working_days': activity['finish'] - activity['start'],
            'float': activity.get('float'),
        }

    def week(self, day: str | None) -> int | None:
        if day is None:
            return None
        first = date.fromisoformat(self.programme['start'])  # type: ignore[index]
        return (date.fromisoformat(day) - first).days // 7 + 1

    def cash_flow(self, month: str = '') -> dict:
        programme = self.need_programme()
        named = {activity['id']: activity for activity in programme['activities']}
        months = []
        for row in programme.get('cash_flow') or []:
            if month and not row['month'].startswith(month):
                continue
            shown = {name: round(row[name]) for name in ('work', 'prelims', 'contingency', 'vat', 'total')}
            shown['to_date'] = round(row['cumulative'])
            if month:  # one month: its activities too
                shown['activities'] = [
                    {
                        'activity': f'{named[entry["id"]]["code"]} {named[entry["id"]]["name"]}',
                        'days': entry['days'],
                        'amount': round(entry['amount']),
                    }
                    for entry in row['activities']
                    if entry['id'] in named
                ]
            months.append({'month': row['month'], **shown})
        # the programme's busiest month, worked out here: the model misreads which of a dozen totals is largest
        flow = programme.get('cash_flow') or []
        peak = max(flow, key=lambda row: row['total'])['month'] if flow else None
        return {'months': months, 'peak_month': peak, 'lines_without_rate': len(programme.get('unpriced') or [])}

    def need_programme(self) -> dict:
        if not self.programme:
            raise ValueError('There is no programme yet: the QS uploads the programme of works in the Programme panel')
        return self.programme


def type_label(entry: dict) -> str:
    return f'{entry["family"]}: {entry["type"]}' if entry.get('family') else entry['type']


def done(activities: list[dict], day: int) -> float:
    """The value of the work done by the end of a day: each activity's cost spread evenly over its days (as the 4D)."""
    total = 0.0
    for activity in activities:
        span = activity['finish'] - activity['start']
        share = (1.0 if day >= activity['start'] else 0.0) if span <= 0 else (day + 1 - activity['start']) / span
        total += (activity.get('cost') or 0) * min(1.0, max(0.0, share))
    return total
