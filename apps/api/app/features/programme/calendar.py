"""The Nigerian working calendar: Monday to Saturday, less the public holidays and Easter."""

from datetime import date, timedelta

from app.features.programme.constants import FIXED_HOLIDAYS


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
    fixed = {date(year, m, d) for m, d in FIXED_HOLIDAYS}
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
