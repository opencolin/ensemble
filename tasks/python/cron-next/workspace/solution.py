"""Cron "next fire time" resolver.

REFERENCE IMPLEMENTATION (used only to validate the hidden test suite).
This will be replaced by the stub below before the task ships.
"""

from __future__ import annotations

from datetime import datetime, timedelta


def _is_uint(s: str) -> bool:
    return len(s) > 0 and s.isdigit()


def _parse_field(text: str, lo: int, hi: int, is_dow: bool = False) -> set:
    if text == "":
        raise ValueError("empty field")
    values: set = set()
    for part in text.split(","):
        if part == "":
            raise ValueError("empty element in list")

        step = 1
        if "/" in part:
            base, _, step_str = part.partition("/")
            if not _is_uint(step_str):
                raise ValueError("invalid step")
            step = int(step_str)
            if step == 0:
                raise ValueError("step must be positive")
            # Steps are only defined on '*' or on an 'a-b' range.
            if base != "*" and "-" not in base:
                raise ValueError("step requires '*' or a range")
        else:
            base = part

        if base == "*":
            start, end = lo, hi
        elif "-" in base:
            a_str, _, b_str = base.partition("-")
            if not _is_uint(a_str) or not _is_uint(b_str):
                raise ValueError("invalid range")
            start, end = int(a_str), int(b_str)
        else:
            if not _is_uint(base):
                raise ValueError("invalid value")
            start = end = int(base)

        if start < lo or end > hi or start > end:
            raise ValueError("value out of range")

        v = start
        while v <= end:
            values.add(v)
            v += step

    if is_dow:
        values = {0 if v == 7 else v for v in values}
    return values


def _parse(cron: str):
    if not isinstance(cron, str):
        raise ValueError("cron must be a string")
    fields = cron.split()
    if len(fields) != 5:
        raise ValueError("cron must have exactly 5 fields")
    minutes = _parse_field(fields[0], 0, 59)
    hours = _parse_field(fields[1], 0, 23)
    doms = _parse_field(fields[2], 1, 31)
    months = _parse_field(fields[3], 1, 12)
    dows = _parse_field(fields[4], 0, 7, is_dow=True)
    dom_star = fields[2] == "*"
    dow_star = fields[4] == "*"
    return minutes, hours, doms, months, dows, dom_star, dow_star


def _day_matches(t: datetime, doms, dows, dom_star: bool, dow_star: bool) -> bool:
    dom_ok = t.day in doms
    dow_ok = (t.isoweekday() % 7) in dows  # cron dow: Sun=0..Sat=6
    if dom_star and dow_star:
        return True
    if dom_star:
        return dow_ok
    if dow_star:
        return dom_ok
    return dom_ok or dow_ok  # both restricted -> union


def next_fire(cron: str, after: datetime) -> datetime:
    minutes, hours, doms, months, dows, dom_star, dow_star = _parse(cron)

    base = after.replace(second=0, microsecond=0)
    t = base + timedelta(minutes=1)
    limit = base + timedelta(days=366 * 5)

    while t <= limit:
        if t.month not in months:
            if t.month == 12:
                t = t.replace(year=t.year + 1, month=1, day=1, hour=0, minute=0)
            else:
                t = t.replace(month=t.month + 1, day=1, hour=0, minute=0)
            continue
        if not _day_matches(t, doms, dows, dom_star, dow_star):
            t = (t + timedelta(days=1)).replace(hour=0, minute=0)
            continue
        if t.hour not in hours:
            t = (t + timedelta(hours=1)).replace(minute=0)
            continue
        if t.minute not in minutes:
            t = t + timedelta(minutes=1)
            continue
        return t

    raise ValueError("no matching time within 5 years")
