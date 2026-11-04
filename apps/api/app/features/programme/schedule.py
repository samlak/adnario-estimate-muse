"""The programme on the working calendar, checked with the critical path method: float and the critical path from its
own links. Edited (a duration typed, a link added or removed), it is scheduled forward from its links: an activity
starts when what it waits for allows, never before the day the programme gave it, so an edit only pushes work later."""

from datetime import date, timedelta

from app.features.programme.calendar import working, working_days


# ── Reading the programme onto the calendar ──────────────────────────────────────────────────────────────────────
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
    for task in tasks.values():
        task['planned'] = task['start']  # the day the programme gives it: an edit never brings it earlier
    links = [{'before': before, 'after': row['id'], 'kind': kind, 'lag': lag}
             for row in rows for before, kind, lag in row['before'] if before in tasks and row['id'] in tasks]
    return floats({'start': start.isoformat(), 'days': [day.isoformat() for day in days], 'activities': activities, 'links': links})


# ── After an edit ────────────────────────────────────────────────────────────────────────────────────────────────
def timed(programme: dict) -> dict:
    """Each activity moved to when its links allow (its length kept), the summaries grown to cover what is under them, the
    calendar run on as far as the work goes, then float and the critical path again. A link from before kinds were
    kept is not scheduled from."""
    tasks = {a['id']: a for a in programme['activities'] if not a['summary']}
    length = {key: task['finish'] - task['start'] for key, task in tasks.items()}
    start = {key: task.get('planned', task['start']) for key, task in tasks.items()}
    links = [link for link in programme['links'] if 'kind' in link and link['before'] in tasks and link['after'] in tasks]
    for _ in range(len(tasks) + 1):  # relax until nothing moves; the links have no loop (checked when one is added)
        moved = False
        for link in links:
            before, after = link['before'], link['after']
            bound = link['lag'] + {
                'FS': start[before] + length[before], 'SS': start[before],
                'FF': start[before] + length[before] - length[after], 'SF': start[before] - length[after],
            }[link['kind']]
            if bound > start[after]:
                start[after] = bound
                moved = True
        if not moved:
            break
    for key, task in tasks.items():
        task['start'], task['finish'] = start[key], start[key] + length[key]
    children: dict = {}
    for activity in programme['activities']:
        children.setdefault(activity.get('parent'), []).append(activity)
    for summary in sorted((a for a in programme['activities'] if a['summary']), key=lambda a: -a['level']):
        under = children.get(summary['id'], [])
        if under:
            # it grows to cover what is under it, never shrinks below what the programme gave it
            summary['start'] = min(summary['start'], *(a['start'] for a in under))
            summary['finish'] = max(summary['finish'], *(a['finish'] for a in under))
    days = [date.fromisoformat(day) for day in programme['days']]
    while len(days) < max(a['finish'] for a in programme['activities']):
        day = days[-1] + timedelta(days=1)
        while not working(day):
            day += timedelta(days=1)
        days.append(day)
    programme['days'] = [day.isoformat() for day in days]
    return floats(programme)


def waits_on(programme: dict, after: int, before: int) -> bool:
    """Whether `before` already waits, through its links, on `after` (so a link before → after would make a loop)."""
    waiting = {before}
    while True:
        more = {link['before'] for link in programme['links'] if link['after'] in waiting} - waiting
        if after in waiting | more:
            return True
        if not more:
            return False
        waiting |= more


# ── The critical path ────────────────────────────────────────────────────────────────────────────────────────────
def floats(programme: dict) -> dict:
    """Float and the critical path, from a backward pass over the links."""
    tasks = {a['id']: a for a in programme['activities'] if not a['summary']}
    links = [link for link in programme['links'] if link['before'] in tasks and link['after'] in tasks]
    n = len(programme['days'])
    late = {key: n for key in tasks}  # late finish
    for _ in range(len(tasks)):  # relax until nothing moves (links are few; ponytail: topological order if it gets slow)
        moved = False
        for link in links:
            before, after = tasks[link['before']], tasks[link['after']]
            length = before['finish'] - before['start']
            late_start = late[after['id']] - (after['finish'] - after['start'])
            lag, kind = link.get('lag', 0), link.get('kind', 'FS')
            bound = {'FS': late_start - lag, 'SS': late_start - lag + length,
                     'FF': late[after['id']] - lag, 'SF': late[after['id']] - lag + length}[kind]
            if bound < late[before['id']]:
                late[before['id']] = bound
                moved = True
        if not moved:
            break
    for key, task in tasks.items():
        task['float'] = max(0, late[key] - task['finish'])
        task['critical'] = task['float'] == 0
    for activity in programme['activities']:
        if activity['summary']:
            under = [t for t in tasks.values() if t['start'] >= activity['start'] and t['finish'] <= activity['finish']]
            activity['float'] = min((t['float'] for t in under), default=0)
            activity['critical'] = any(t['critical'] for t in under)
    programme['end'] = n
    return programme
