"""Integer -> Roman numeral conversion.

This implementation is BUGGY: it omits the subtractive forms (IV, IX, XL, XC,
CD, CM), so values like 4, 9, 40, 90, 400, 900 (and any number containing them)
render incorrectly. Fix it so 1..3999 all convert correctly.
"""

from __future__ import annotations

# BUG: missing the subtractive pairs (900/CM, 400/CD, 90/XC, 40/XL, 9/IX, 4/IV).
_VALUES = [
    (1000, "M"),
    (500, "D"),
    (100, "C"),
    (50, "L"),
    (10, "X"),
    (5, "V"),
    (1, "I"),
]


def to_roman(n: int) -> str:
    if not 1 <= n <= 3999:
        raise ValueError("n must be in 1..3999")
    out = []
    for value, symbol in _VALUES:
        while n >= value:
            out.append(symbol)
            n -= value
    return "".join(out)
