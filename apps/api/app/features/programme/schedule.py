"""The programme on the working calendar, checked with the critical path method: float and the critical path from its
own links."""

from datetime import date, timedelta

from app.features.programme.calendar import working_days


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
