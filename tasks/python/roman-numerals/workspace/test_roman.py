"""Acceptance test for to_roman. Do not modify."""

import pytest

from roman import to_roman


@pytest.mark.parametrize(
    "n,expected",
    [
        (1, "I"),
        (3, "III"),
        (4, "IV"),
        (9, "IX"),
        (14, "XIV"),
        (40, "XL"),
        (49, "XLIX"),
        (90, "XC"),
        (400, "CD"),
        (444, "CDXLIV"),
        (900, "CM"),
        (1990, "MCMXC"),
        (2024, "MMXXIV"),
        (3888, "MMMDCCCLXXXVIII"),
        (3999, "MMMCMXCIX"),
    ],
)
def test_to_roman(n, expected):
    assert to_roman(n) == expected


def test_round_trip_all():
    # Every value 1..3999 must be non-empty and use only valid symbols.
    valid = set("IVXLCDM")
    for n in range(1, 4000):
        s = to_roman(n)
        assert s and set(s) <= valid


def test_out_of_range():
    with pytest.raises(ValueError):
        to_roman(0)
    with pytest.raises(ValueError):
        to_roman(4000)
