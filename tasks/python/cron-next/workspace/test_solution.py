"""Acceptance test for next_fire. Do not modify.

Graded as the fraction of these cases that pass. Depends only on the public
`next_fire(cron, after)` contract described in task.yaml.
"""

from datetime import datetime

import pytest

from solution import next_fire

D = datetime


# --- Basic scheduling + minute/hour anchoring ------------------------------


@pytest.mark.parametrize(
    "cron, after, expected",
    [
        ("*/15 * * * *", D(2026, 1, 1, 10, 7), D(2026, 1, 1, 10, 15)),
        ("*/15 * * * *", D(2026, 1, 1, 10, 52), D(2026, 1, 1, 11, 0)),
        ("* * * * *", D(2026, 1, 1, 10, 7, 30), D(2026, 1, 1, 10, 8)),
        ("* * * * *", D(2026, 1, 1, 10, 7), D(2026, 1, 1, 10, 8)),
        ("5 * * * *", D(2026, 1, 1, 10, 7), D(2026, 1, 1, 11, 5)),
        ("5 * * * *", D(2026, 1, 1, 10, 3), D(2026, 1, 1, 10, 5)),
        # '*/6' in hour anchors at 0 -> {0,6,12,18}
        ("0 */6 * * *", D(2026, 1, 1, 0, 0), D(2026, 1, 1, 6, 0)),
        ("0 */6 * * *", D(2026, 1, 1, 7, 0), D(2026, 1, 1, 12, 0)),
    ],
)
def test_basic_and_time_anchoring(cron, after, expected):
    assert next_fire(cron, after) == expected


# --- '*/n' in day-of-month anchors at 1, not 0 -----------------------------


def test_dom_step_anchors_at_one():
    # {1,11,21,31}; from Jan 1 00:00 the next is the 11th, never the 10th.
    assert next_fire("0 0 */10 * *", D(2026, 1, 1, 0, 0)) == D(2026, 1, 11, 0, 0)


def test_dom_step_rolls_into_next_month_at_day_one():
    assert next_fire("0 0 */10 * *", D(2026, 1, 31, 0, 0)) == D(2026, 2, 1, 0, 0)


# --- Step over a range: 10-40/7 -> {10,17,24,31,38} ------------------------


@pytest.mark.parametrize(
    "after, expected",
    [
        (D(2026, 1, 1, 0, 0), D(2026, 1, 1, 0, 10)),
        (D(2026, 1, 1, 0, 10, 0), D(2026, 1, 1, 0, 17)),
        (D(2026, 1, 1, 0, 33), D(2026, 1, 1, 0, 38)),  # 34..37 excluded
        (D(2026, 1, 1, 0, 38), D(2026, 1, 1, 1, 10)),  # 45 > 40 -> next hour
    ],
)
def test_step_over_range(after, expected):
    assert next_fire("10-40/7 * * * *", after) == expected


# --- Mixed list of number + stepped-range + number: 1,5-10/2,50 ------------
# -> {1,5,7,9,50}  (note: 5-10/2 is 5,7,9 -- NOT 10, and 6/8 excluded)


@pytest.mark.parametrize(
    "after, expected",
    [
        (D(2026, 1, 1, 0, 0), D(2026, 1, 1, 0, 1)),
        (D(2026, 1, 1, 0, 1), D(2026, 1, 1, 0, 5)),   # 2,3,4 excluded
        (D(2026, 1, 1, 0, 9), D(2026, 1, 1, 0, 50)),  # 10..49 excluded
        (D(2026, 1, 1, 0, 50), D(2026, 1, 1, 1, 1)),  # wrap to next hour
    ],
)
def test_mixed_list(after, expected):
    assert next_fire("1,5-10/2,50 * * * *", after) == expected


# --- Strictly-after at minute granularity; seconds ignored -----------------


def test_after_exactly_on_match_zero_seconds_advances():
    # on the matching minute with 0 seconds -> the NEXT match, never the same.
    assert next_fire("*/15 * * * *", D(2026, 1, 1, 10, 15, 0)) == D(2026, 1, 1, 10, 30)


def test_after_exactly_on_match_with_seconds_advances():
    assert next_fire("*/15 * * * *", D(2026, 1, 1, 10, 15, 30)) == D(2026, 1, 1, 10, 30)


def test_daily_after_exact_match_zero_seconds_goes_to_next_day():
    assert next_fire("30 10 * * *", D(2026, 1, 1, 10, 30, 0)) == D(2026, 1, 2, 10, 30)


def test_daily_after_match_with_seconds_goes_to_next_day():
    assert next_fire("30 10 * * *", D(2026, 1, 1, 10, 30, 20)) == D(2026, 1, 2, 10, 30)


def test_midnight_daily_strictly_after_zero_seconds():
    assert next_fire("0 0 * * *", D(2026, 1, 1, 0, 0, 0)) == D(2026, 1, 2, 0, 0)


def test_midnight_daily_seconds_ignored():
    assert next_fire("0 0 * * *", D(2026, 1, 1, 0, 0, 45)) == D(2026, 1, 2, 0, 0)


def test_result_has_zero_seconds_and_microseconds():
    r = next_fire("*/15 * * * *", D(2026, 1, 1, 10, 7, 42, 999999))
    assert r == D(2026, 1, 1, 10, 15)
    assert r.second == 0 and r.microsecond == 0


# --- Day-of-week only (dom is '*') -----------------------------------------


def test_weekday_range_same_weekday_later_time():
    # Thu 2026-01-01 08:00 -> same day 12:00 (Thursday is within Mon-Fri).
    assert next_fire("0 12 * * 1-5", D(2026, 1, 1, 8, 0)) == D(2026, 1, 1, 12, 0)


def test_weekday_range_on_the_minute_advances_to_next_weekday():
    # Thu 2026-01-01 12:00 exactly -> strictly after -> Fri 2026-01-02 12:00.
    assert next_fire("0 12 * * 1-5", D(2026, 1, 1, 12, 0)) == D(2026, 1, 2, 12, 0)


def test_weekday_range_saturday_noon_to_monday_noon():
    # Sat 2026-01-03 12:00 -> skip Sun -> Mon 2026-01-05 12:00.
    assert next_fire("0 12 * * 1-5", D(2026, 1, 3, 12, 0)) == D(2026, 1, 5, 12, 0)


def test_weekday_range_same_day_later():
    # Fri 2026-01-02 08:00 -> same day 12:00.
    assert next_fire("0 12 * * 1-5", D(2026, 1, 2, 8, 0)) == D(2026, 1, 2, 12, 0)


# --- dow 0 and 7 both mean Sunday ------------------------------------------


def test_dow_zero_is_sunday():
    # 2026-01-04 is the first Sunday after 2026-01-01.
    assert next_fire("0 0 * * 0", D(2026, 1, 1, 0, 0)) == D(2026, 1, 4, 0, 0)


def test_dow_seven_is_sunday():
    assert next_fire("0 0 * * 7", D(2026, 1, 1, 0, 0)) == D(2026, 1, 4, 0, 0)


def test_dow_zero_and_seven_equivalent():
    after = D(2026, 3, 10, 4, 30)
    assert next_fire("30 9 * * 0", after) == next_fire("30 9 * * 7", after)


def test_dow_seven_with_time():
    assert next_fire("30 9 * * 7", D(2026, 1, 1, 0, 0)) == D(2026, 1, 4, 9, 30)


# --- THE UNION RULE: dom AND dow both restricted -> EITHER matches ----------
# "0 0 13 * 5" fires at 00:00 on the 13th OR on any Friday.


def test_union_next_is_a_friday_not_the_13th():
    # From Thu 2026-01-01: next fire is Fri 2026-01-02 (a Friday, not the 13th).
    # (If dom/dow were ANDed this would jump to Fri-the-13th 2026-02-13.)
    assert next_fire("0 0 13 * 5", D(2026, 1, 1, 0, 0)) == D(2026, 1, 2, 0, 0)


def test_union_next_is_the_13th_not_a_friday():
    # From 2026-01-10: the 13th (a Tuesday) comes before the next Friday (16th).
    assert next_fire("0 0 13 * 5", D(2026, 1, 10, 0, 0)) == D(2026, 1, 13, 0, 0)


def test_union_lands_on_friday_the_13th():
    # From Wed 2026-02-11: next fire is Fri 2026-02-13 (both a Friday and 13th).
    assert next_fire("0 0 13 * 5", D(2026, 2, 11, 0, 0)) == D(2026, 2, 13, 0, 0)


def test_union_just_after_the_13th_goes_to_next_friday():
    # Just after Fri-the-13th: next fire is the following Friday, 2026-02-20.
    assert next_fire("0 0 13 * 5", D(2026, 2, 13, 12, 0)) == D(2026, 2, 20, 0, 0)


def test_union_dom_list_or_monday_hits_monday():
    # "0 0 1,15 * 1": 1st/15th OR Monday. From 2026-01-01 -> Mon 2026-01-05.
    assert next_fire("0 0 1,15 * 1", D(2026, 1, 1, 0, 0)) == D(2026, 1, 5, 0, 0)


def test_union_dom_list_or_monday_hits_the_15th():
    # From 2026-01-13: the 15th (a Thursday) beats the next Monday (19th).
    assert next_fire("0 0 1,15 * 1", D(2026, 1, 13, 0, 0)) == D(2026, 1, 15, 0, 0)


def test_dow_restricted_dom_star_does_not_match_every_day():
    # Guard against "always OR": with dom '*', only Fridays match, not all days.
    assert next_fire("0 0 * * 5", D(2026, 1, 1, 0, 0)) == D(2026, 1, 2, 0, 0)


def test_dom_restricted_dow_star_matches_only_that_day():
    # With dow '*', only the 20th matches (not "every day").
    assert next_fire("0 0 20 * *", D(2026, 1, 1, 0, 0)) == D(2026, 1, 20, 0, 0)


# --- Month rollover / year rollover ----------------------------------------


def test_month_rollover():
    assert next_fire("0 0 1 * *", D(2026, 1, 15, 0, 0)) == D(2026, 2, 1, 0, 0)


def test_year_rollover():
    # "0 0 1 1 *" only fires Jan 1; from Jan 2 2026 -> Jan 1 2027.
    assert next_fire("0 0 1 1 *", D(2026, 1, 2, 0, 0)) == D(2027, 1, 1, 0, 0)


# --- Short months: nonexistent day-of-month never matches, search skips -----


def test_skips_february_to_august_31():
    # "0 0 31 2,8 *": Feb has no 31st, so first fire is Aug 31.
    assert next_fire("0 0 31 2,8 *", D(2026, 1, 1, 0, 0)) == D(2026, 8, 31, 0, 0)


def test_skips_february_to_next_january_31():
    # "0 0 31 1,2 *" from Feb 1 -> Jan 31 of the following year.
    assert next_fire("0 0 31 1,2 *", D(2026, 2, 1, 0, 0)) == D(2027, 1, 31, 0, 0)


def test_never_fires_31st_in_30_day_months():
    # April and June have no 31st -> never fires -> ValueError within 5 years.
    with pytest.raises(ValueError):
        next_fire("0 0 31 4,6 *", D(2026, 1, 1, 0, 0))


def test_never_fires_31st_of_february():
    with pytest.raises(ValueError):
        next_fire("0 0 31 2 *", D(2026, 1, 1, 0, 0))


# --- Leap day (Feb 29) ------------------------------------------------------


def test_leap_day_from_non_leap_year():
    # From 2025 the next Feb 29 is 2028-02-29.
    assert next_fire("0 0 29 2 *", D(2025, 1, 1, 0, 0)) == D(2028, 2, 29, 0, 0)


def test_leap_day_strictly_after_a_leap_day():
    # On 2028-02-29 00:00 -> next Feb 29 is 2032-02-29.
    assert next_fire("0 0 29 2 *", D(2028, 2, 29, 0, 0)) == D(2032, 2, 29, 0, 0)


def test_feb_30_never_fires_five_year_cap():
    # February never has a 30th -> nothing within 5 years -> ValueError.
    with pytest.raises(ValueError):
        next_fire("0 0 30 2 *", D(2025, 1, 1, 0, 0))


# --- Invalid syntax / out-of-range -> ValueError ---------------------------


@pytest.mark.parametrize(
    "cron",
    [
        "60 * * * *",     # minute out of range (0-59)
        "0 24 * * *",     # hour out of range (0-23)
        "0 0 0 * *",      # day-of-month out of range (1-31)
        "0 0 * 13 *",     # month out of range (1-12)
        "0 0 * * 8",      # day-of-week out of range (0-7)
        "1- * * * *",     # incomplete range
        "a * * * *",      # non-numeric token
        "*/0 * * * *",    # step of zero
        "1,,2 * * * *",   # empty element in a list
        "* * * *",        # too few fields (4)
        "* * * * * *",    # too many fields (6)
        "",               # empty expression
        "0 0 * * SUN",    # day-of-week names not supported
        "0 0 * JAN *",    # month names not supported
    ],
)
def test_invalid_raises_value_error(cron):
    with pytest.raises(ValueError):
        next_fire(cron, D(2026, 1, 1, 0, 0))
