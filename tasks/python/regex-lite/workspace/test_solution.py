"""Acceptance test for the regex-lite engine. Do not modify.

Graded as the fraction of these cases that pass. Depends only on the public
`match(pattern, text)` and `search(pattern, text)` contract in task.yaml.

Every expected value below is derived by hand from the specification, NOT from
Python's `re` module (whose semantics differ: `re` supports lazy quantifiers and
capture groups, treats an unparseable `{...}` as a literal, and lets `$` match
before a trailing newline -- none of which is true here).
"""

import pytest

from solution import match, search


# =====================================================================
# 1. Literals, anchoring of match, basic search
# =====================================================================


@pytest.mark.parametrize(
    "pattern, text, expected",
    [
        ("", "", True),                # empty pattern matches only empty text
        ("", "a", False),              # match is anchored at both ends
        ("abc", "abc", True),
        ("abc", "ab", False),
        ("abc", "abcd", False),        # anchored: no trailing junk
        ("abc", "zabc", False),        # anchored: no leading junk
        ("a", "a", True),
        ("a", "b", False),
        ("hello world", "hello world", True),
        ("hello world", "hello  world", False),
    ],
)
def test_match_literals(pattern, text, expected):
    assert match(pattern, text) is expected


@pytest.mark.parametrize(
    "pattern, text, expected",
    [
        ("abc", "xxabcyy", (2, 5)),    # leftmost occurrence
        ("abc", "abcabc", (0, 3)),     # leftmost of several
        ("abc", "ababc", (2, 5)),
        ("abc", "xyz", None),
        ("a", "", None),               # nothing to find in empty text
        ("z", "abc", None),
        ("world", "hello world", (6, 11)),
    ],
)
def test_search_literals(pattern, text, expected):
    assert search(pattern, text) == expected


# =====================================================================
# 2. Dot: any char except newline
# =====================================================================


@pytest.mark.parametrize(
    "pattern, text, expected",
    [
        (".", "a", True),
        (".", "Z", True),
        (".", " ", True),
        (".", "\t", True),             # tab is not newline -> dot matches
        (".", "\r", True),             # carriage return is not newline
        (".", "\n", False),            # dot never matches newline
        (".", "", False),              # dot needs exactly one char
        ("a.c", "abc", True),
        ("a.c", "a.c", True),
        ("a.c", "a\nc", False),        # the middle char is a newline
        ("...", "xyz", True),
        ("...", "xy", False),
    ],
)
def test_dot(pattern, text, expected):
    assert match(pattern, text) is expected


def test_dot_star_stops_at_newline_in_search():
    # ".*" is greedy but a dot never crosses a newline, so from index 0 it
    # consumes only "a" and stops -> span (0, 1).
    assert search(".*", "a\nb") == (0, 1)


# =====================================================================
# 3. Shorthand escapes: \d \D \w \W \s \S
# =====================================================================


@pytest.mark.parametrize(
    "pattern, text, expected",
    [
        (r"\d", "5", True),
        (r"\d", "0", True),
        (r"\d", "a", False),
        (r"\D", "a", True),
        (r"\D", "5", False),
        (r"\w", "a", True),
        (r"\w", "Z", True),
        (r"\w", "_", True),
        (r"\w", "9", True),
        (r"\w", "-", False),
        (r"\w", " ", False),
        (r"\W", "-", True),
        (r"\W", "a", False),
        (r"\s", " ", True),
        (r"\s", "\t", True),
        (r"\s", "\n", True),
        (r"\s", "\r", True),
        (r"\s", "x", False),
        (r"\S", "x", True),
        (r"\S", " ", False),
    ],
)
def test_shorthand_single(pattern, text, expected):
    assert match(pattern, text) is expected


def test_shorthand_digit_run_match():
    assert match(r"\d\d\d\d", "2026") is True


def test_shorthand_digit_run_search():
    assert search(r"\d+", "abc123def") == (3, 6)


def test_shorthand_word_plus_anchored():
    assert match(r"\w+", "hi_there9") is True
    assert match(r"\w+", "hi there") is False   # space is not a word char


# =====================================================================
# 4. Escaped literals: backslash before a non-alphanumeric is that literal
# =====================================================================


@pytest.mark.parametrize(
    "pattern, text, expected",
    [
        (r"\.", ".", True),
        (r"\.", "a", False),
        (r"\*", "*", True),
        (r"\+", "+", True),
        (r"\?", "?", True),
        (r"\(", "(", True),
        (r"\)", ")", True),
        (r"\[", "[", True),
        (r"\]", "]", True),
        (r"\{", "{", True),
        (r"\}", "}", True),
        (r"\^", "^", True),
        (r"\$", "$", True),
        (r"\|", "|", True),
        (r"\-", "-", True),
    ],
)
def test_escaped_literals(pattern, text, expected):
    assert match(pattern, text) is expected


def test_escaped_backslash_matches_one_backslash():
    # pattern is two chars (backslash, backslash) -> one literal backslash
    assert match("\\\\", "\\") is True
    assert match("\\\\", "\\\\") is False   # only one backslash in the text


def test_unescaped_close_bracket_and_brace_are_literals():
    # ']' and '}' outside their special contexts are ordinary literals
    assert match("]", "]") is True
    assert match("a}b", "a}b") is True
    assert match("a]b", "a]b") is True


def test_escaped_dot_in_search():
    assert search(r"a\.c", "xa.cy") == (1, 4)
    assert search(r"a\.c", "xabcy") is None   # '.' here is a literal dot


# =====================================================================
# 5. Character classes
# =====================================================================


@pytest.mark.parametrize(
    "pattern, text, expected",
    [
        ("[abc]", "a", True),
        ("[abc]", "b", True),
        ("[abc]", "c", True),
        ("[abc]", "d", False),
        ("[a-z]", "m", True),
        ("[a-z]", "M", False),
        ("[A-Z]", "M", True),
        ("[0-9]", "7", True),
        ("[0-9]", "a", False),
        ("[a-zA-Z0-9_]", "_", True),
        ("[a-zA-Z0-9_]", "%", False),
    ],
)
def test_class_basic(pattern, text, expected):
    assert match(pattern, text) is expected


@pytest.mark.parametrize(
    "pattern, text, expected",
    [
        ("[^0-9]", "a", True),
        ("[^0-9]", "5", False),
        ("[^abc]", "d", True),
        ("[^abc]", "a", False),
        ("[^a]", "\n", True),          # negated class DOES match newline
    ],
)
def test_class_negation(pattern, text, expected):
    assert match(pattern, text) is expected


@pytest.mark.parametrize(
    "pattern, text, expected",
    [
        # '-' is a literal at the first or last position of a class
        ("[-a]", "-", True),
        ("[-a]", "a", True),
        ("[a-]", "-", True),
        ("[a-]", "a", True),
        ("[a-]", "b", False),
        # ']' as the first char (after optional '^') is a literal ']'
        ("[]a]", "]", True),
        ("[]a]", "a", True),
        ("[]a]", "b", False),
        ("[^]a]", "b", True),
        ("[^]a]", "]", False),
        ("[^]a]", "a", False),
        # escaped ']' inside a class
        (r"[\]]", "]", True),
        (r"[\]]", "x", False),
    ],
)
def test_class_bracket_and_dash_edges(pattern, text, expected):
    assert match(pattern, text) is expected


@pytest.mark.parametrize(
    "text, expected",
    [
        # "[a-c-e]": range a-c, then a LITERAL '-' (it follows a completed
        # range), then literal 'e'. Membership = {a, b, c, '-', e}.
        ("a", True),
        ("b", True),
        ("c", True),
        ("-", True),
        ("e", True),
        ("d", False),   # d is NOT in the set
        ("f", False),
    ],
)
def test_class_dash_after_range_is_literal(text, expected):
    assert match("[a-c-e]", text) is expected


def test_class_escaped_dash_is_not_a_range():
    # "[a\-z]" is the three literals a, '-', z -- NOT the range a..z.
    assert match(r"[a\-z]", "-") is True
    assert match(r"[a\-z]", "a") is True
    assert match(r"[a\-z]", "z") is True
    assert match(r"[a\-z]", "m") is False   # 'm' would be inside a real a-z range


@pytest.mark.parametrize(
    "pattern, text, expected",
    [
        # metacharacters are ordinary literals inside a class
        ("[.]", ".", True),
        ("[.]", "a", False),
        ("[*+?]", "*", True),
        ("[*+?]", "+", True),
        ("[()]", "(", True),
        # shorthand classes inside a class
        (r"[\d]", "5", True),
        (r"[\d]", "a", False),
        (r"[\d.]", ".", True),
        (r"[\d.]", "7", True),
        (r"[\d.]", "a", False),
        (r"[\s\d]", " ", True),
        (r"[\s\d]", "4", True),
        (r"[\s\d]", "a", False),
        (r"[^\d]", "a", True),
        (r"[^\d]", "3", False),
        # double negation: [^\D] == \d
        (r"[^\D]", "3", True),
        (r"[^\D]", "a", False),
    ],
)
def test_class_literals_and_shorthands(pattern, text, expected):
    assert match(pattern, text) is expected


def test_class_quantified():
    assert match("[0-9]{3}", "123") is True
    assert match("[0-9]{3}", "12") is False
    assert search("[a-f]+", "xxdeadbeefyy") == (2, 10)


# =====================================================================
# 6. Quantifiers: *, +, ?, {m}, {m,}, {m,n} -- greedy
# =====================================================================


@pytest.mark.parametrize(
    "pattern, text, expected",
    [
        ("a*", "", True),
        ("a*", "a", True),
        ("a*", "aaaa", True),
        ("a*", "aab", False),          # anchored: trailing 'b'
        ("a+", "", False),
        ("a+", "a", True),
        ("a+", "aaa", True),
        ("a?", "", True),
        ("a?", "a", True),
        ("a?", "aa", False),
        ("a{3}", "aaa", True),
        ("a{3}", "aa", False),
        ("a{3}", "aaaa", False),       # anchored: exactly 3
        ("a{0}", "", True),            # zero copies -> empty
        ("a{2,}", "aa", True),
        ("a{2,}", "aaaaa", True),
        ("a{2,}", "a", False),
        ("a{2,4}", "aa", True),
        ("a{2,4}", "aaaa", True),
        ("a{2,4}", "a", False),
        ("a{2,4}", "aaaaa", False),    # anchored: at most 4
        ("a{0,}", "", True),
        ("a{0,}", "aaa", True),
    ],
)
def test_quantifier_counts(pattern, text, expected):
    assert match(pattern, text) is expected


def test_quantifier_zero_copies_skips_atom():
    # b{0} matches zero b's, so "ac" matches but "abc" does not.
    assert match("ab{0}c", "ac") is True
    assert match("ab{0}c", "abc") is False


@pytest.mark.parametrize(
    "pattern, text, expected",
    [
        ("a*", "aaa", (0, 3)),         # greedy: consume all
        ("a+", "aaa", (0, 3)),
        ("a?", "aaa", (0, 1)),         # '?' is greedy: takes one
        ("a{2}", "aaaa", (0, 2)),
        ("a{2,3}", "aaaaa", (0, 3)),   # greedy up to the max
        ("a{2,}", "aaaa", (0, 4)),
        ("a*", "bbb", (0, 0)),         # empty match at the leftmost position
        ("b*", "aaa", (0, 0)),         # empty match at index 0 wins
    ],
)
def test_quantifier_greedy_search(pattern, text, expected):
    assert search(pattern, text) == expected


# =====================================================================
# 7. Groups and alternation (leftmost-alternative preference)
# =====================================================================


@pytest.mark.parametrize(
    "pattern, text, expected",
    [
        ("(abc)", "abc", True),
        ("(ab)+", "ababab", True),
        ("(ab)+", "ababa", False),
        ("(ab)+", "", False),
        ("(ab)*", "", True),
        ("(ab)*", "abab", True),
        ("a(b|c)d", "abd", True),
        ("a(b|c)d", "acd", True),
        ("a(b|c)d", "aed", False),
        ("ab|cd", "ab", True),
        ("ab|cd", "cd", True),
        ("ab|cd", "ad", False),        # '|' splits the WHOLE pattern
        ("(a|b|c)+", "abcabc", True),
        ("((ab)|(cd))+", "abcdab", True),
        ("a|", "", True),              # empty alternative matches empty
        ("a|", "a", True),
        ("(a|)b", "b", True),          # empty branch inside a group
        ("(a|)b", "ab", True),
        ("|", "", True),
    ],
)
def test_groups_and_alternation(pattern, text, expected):
    assert match(pattern, text) is expected


def test_empty_alternative_in_search():
    # 'x' then (a|): the empty branch lets the match end right after 'x'.
    assert search("x(a|)", "xb") == (0, 1)


# =====================================================================
# 8. Backtracking correctness and giveback (hand-derived)
# =====================================================================


def test_star_gives_one_back():
    # a* greedily eats all 4 a's, then backtracks one so the trailing 'a'
    # can match.
    assert match("a*a", "aaaa") is True


def test_alternation_backtracks_to_second():
    # (a|ab)c on "abc": the 'a' branch leaves 'bc', 'c' fails -> backtrack to
    # 'ab', then 'c' matches.
    assert match("(a|ab)c", "abc") is True


def test_search_alternation_is_leftmost_first_not_longest():
    # At index 1 the 'a' branch already succeeds -> span (1, 2), NOT (1, 3).
    assert search("a|ab", "xab") == (1, 2)


def test_match_alternation_backtracks_when_anchored():
    # match must consume the whole text, so the 'a' branch (end 1) fails the
    # end-anchor and the engine backtracks to 'ab' (end 2).
    assert match("a|ab", "ab") is True


def test_search_takes_first_alternative_even_if_shorter():
    assert search("a|ab", "ab") == (0, 1)


def test_nested_star_terminates_and_matches():
    # (a*)* must not loop forever on the inner empty match; it still matches.
    assert match("(a*)*b", "aaab") is True


def test_nested_star_no_match_terminates():
    # Same shape but the required trailing char is absent -> False, no hang.
    assert match("(a*)*c", "aaab") is False


def test_nested_plus_pair_matches():
    assert match("(a+a+)+b", "aaaab") is True


def test_nested_plus_pair_no_match_terminates():
    # Must return False (and terminate) even though many splits are tried.
    assert match("(a+a+)+c", "aaaab") is False


def test_plus_of_star_allows_empty_iteration():
    # (a*)+ : the '+' needs one iteration, which may match empty, then 'b'.
    assert match("(a*)+b", "b") is True


def test_bounded_giveback_across_two_quantifiers():
    # a{2,3} is greedy (grabs 3) but gives back to 2 so the second a{2,3}
    # can take its required 2.
    assert match("a{2,3}a{2,3}", "aaaa") is True


def test_numeric_giveback_before_trailing_atom():
    # a{2,4} grabs 4, then the trailing 'a' takes the 5th.
    assert match("a{2,4}a", "aaaaa") is True
    # only 3 a's: grab 2, trailing 'a' takes the 3rd.
    assert match("a{2,4}a", "aaa") is True
    # only 2 a's: a{2,4} needs >=2, leaving nothing for the trailing 'a'.
    assert match("a{2,4}a", "aa") is False


def test_group_optional_giveback_search_span():
    # (ab|a)(bc)?: 'ab' matches (0..2); then (bc)? tries 'bc' at index 2
    # ('c') and fails, so it matches empty. First complete match ends at 2.
    assert search("(ab|a)(bc)?", "abc") == (0, 2)


def test_two_alternations_interact_for_longer_span():
    # (a|ab)(c|bc): first group takes 'a' (0..1); second group's 'c' fails at
    # index 1 ('b'), 'bc' matches (1..3). Span (0, 3).
    assert search("(a|ab)(c|bc)", "abc") == (0, 3)


def test_first_alt_greedy_star_stops_early_in_search():
    # (a|ab)*: iteration 1 takes 'a' (left branch); iteration 2 at index 1
    # ('b') matches neither branch, so the star stops. First complete match
    # ends at 1 -> span (0, 1). (It does NOT backtrack 'a' into 'ab'.)
    assert search("(a|ab)*", "abab") == (0, 1)


def test_first_alt_greedy_star_consumes_all():
    # (ab|a)*: 'ab' is the first branch and greedily consumes both pairs.
    assert search("(ab|a)*", "abab") == (0, 4)


def test_anchored_star_backtracks_alternative_to_fit():
    # match must consume all 4 chars, forcing (a|ab)* to pick 'ab' twice.
    assert match("(a|ab)*", "abab") is True


# =====================================================================
# 9. Anchors ^ and $, empty matches
# =====================================================================


@pytest.mark.parametrize(
    "pattern, text, expected",
    [
        ("^abc$", "abc", True),
        ("^abc", "abc", True),
        ("abc$", "abc", True),
        ("^$", "", True),
        ("^$", "a", False),
        ("^a", "abc", False),          # match is anchored at the end too
        ("a$", "abc", False),
        ("a^b", "ab", False),          # '^' only holds at position 0
        ("a$b", "ab", False),          # '$' only holds at the end
    ],
)
def test_anchors_match(pattern, text, expected):
    assert match(pattern, text) is expected


@pytest.mark.parametrize(
    "pattern, text, expected",
    [
        ("^abc", "abcxyz", (0, 3)),
        ("^abc", "xabc", None),        # '^' forbids starting anywhere but 0
        ("abc$", "xyzabc", (3, 6)),
        ("abc$", "abcxyz", None),      # '$' forbids ending before the end
        ("^", "abc", (0, 0)),          # zero-width match at position 0
        ("$", "abc", (3, 3)),          # zero-width match at the end
        ("c$", "abc", (2, 3)),
        ("a$", "baa", (2, 3)),         # the LAST 'a' is the one before end
        ("^a", "ba", None),            # 'a' at index 1 is rejected by '^'
    ],
)
def test_anchors_search(pattern, text, expected):
    assert search(pattern, text) == expected


def test_dollar_does_not_match_before_trailing_newline():
    # Unlike Python's default `re`, '$' here matches ONLY at len(text), so it
    # does not match the position just before a final '\n'.
    assert search("a$", "a\n") is None
    assert match("a$", "a\n") is False


def test_caret_inside_alternation_only_at_zero():
    # (^a|b) on "xb": '^a' fails everywhere (index 0 is 'x'); 'b' matches at 1.
    assert search("(^a|b)", "xb") == (1, 2)


@pytest.mark.parametrize(
    "pattern, text, expected",
    [
        ("", "abc", (0, 0)),           # empty pattern -> empty match at 0
        ("", "", (0, 0)),
        ("a*", "", (0, 0)),
        ("a*b*", "", (0, 0)),
        ("x*", "yyy", (0, 0)),         # empty match preferred at leftmost start
    ],
)
def test_empty_matches_search(pattern, text, expected):
    assert search(pattern, text) == expected


def test_empty_pattern_matches_empty_only_for_match():
    assert match("", "") is True
    assert match("", "a") is False


# =====================================================================
# 10. Combined / realistic patterns
# =====================================================================


def test_optional_letter_word():
    assert match("colou?r", "color") is True
    assert match("colou?r", "colour") is True
    assert match("colou?r", "colouur") is False


def test_search_optional_letter():
    assert search("colou?r", "my colour!") == (3, 9)
    assert search("colou?r", "my color!") == (3, 8)


def test_integer_pattern():
    assert match(r"-?\d+", "-42") is True
    assert match(r"-?\d+", "42") is True
    assert match(r"-?\d+", "--42") is False
    assert match(r"-?\d+", "4x2") is False


def test_search_integer_in_text():
    assert search(r"\d+", "abc 2026 xyz") == (4, 8)


def test_dotted_number_class():
    assert match(r"[\d.]+", "3.14") is True
    assert match(r"[\d.]+", "3..1.4.") is True
    assert match(r"[\d.]+", "3a14") is False


def test_alternation_with_anchors():
    # branch '^ab' or 'cd$'
    assert match("^ab|cd$", "ab") is True
    assert match("^ab|cd$", "cd") is True
    assert match("^ab|cd$", "abcd") is False   # neither branch spans the text


def test_grouped_alternation_repeat():
    assert match("(cat|dog)+", "catdogcat") is True   # cat, dog, cat
    assert match("(cat|dog)+", "cat") is True          # a single iteration
    assert match("(cat|dog)+", "catdo") is False       # trailing "do" is incomplete
    assert match("(cat|dog)+", "") is False            # '+' needs at least one


# =====================================================================
# 11. Malformed patterns -> ValueError (both functions)
# =====================================================================


@pytest.mark.parametrize(
    "pattern",
    [
        "(",            # unbalanced open paren
        ")",            # unbalanced close paren
        "a(",
        "a)",
        "(a",
        "((a)",         # inner closed, outer open
        "a))",          # stray close paren
        "(a|b",         # unclosed group with alternation
        "[",            # unterminated class
        "[a",
        "[a-",          # unterminated (dash then end)
        "[abc",
        "[^",
        "[]",           # ']' taken as literal first char -> still unterminated
        "[^]",
        "[z-a]",        # range out of order
        "[c-a]",
        r"[a-\d]",      # a range cannot end in a shorthand class
        "*",            # nothing to repeat
        "+a",
        "?abc",
        "a**",          # stacked quantifiers
        "a*?",          # lazy quantifier is not supported
        "a+?",
        "a??",
        "a{2,3}?",      # lazy on a bounded quantifier
        "(*)",          # nothing to repeat at the start of a group
        "(a|*)",        # nothing to repeat at the start of an alternative
        "^*",           # an anchor cannot be quantified
        "$+",
        "a{",           # unterminated quantifier
        "a{}",          # empty quantifier body
        "a{,3}",        # lower bound is required
        "a{2,1}",       # min greater than max
        "a{x}",         # non-numeric quantifier
        "a{1,x}",
        "a{2,3",        # unterminated brace
        "{3}",          # quantifier with no preceding atom
        "\\",           # trailing backslash
        "a\\",
        r"\q",          # unknown alphabetic escape
        r"\1",          # unknown escape (digit, not a shorthand)
        r"\A",
    ],
)
def test_malformed_raises_value_error_match(pattern):
    with pytest.raises(ValueError):
        match(pattern, "anything")


@pytest.mark.parametrize(
    "pattern",
    [
        "(",
        ")",
        "[abc",
        "[z-a]",
        "a**",
        "a*?",
        "a{2,1}",
        "^*",
        "\\",
        r"\q",
    ],
)
def test_malformed_raises_value_error_search(pattern):
    with pytest.raises(ValueError):
        search(pattern, "anything")


# =====================================================================
# 12. Valid patterns that look malformed but are NOT
# =====================================================================


@pytest.mark.parametrize(
    "pattern, text, expected",
    [
        ("()", "", True),              # empty group matches empty
        ("()a", "a", True),
        ("(())", "", True),            # nested empty groups
        ("a{0,0}", "", True),          # a valid (degenerate) quantifier
        ("a{0,0}b", "b", True),
        (r"\{", "{", True),            # escaped brace is a literal, not a quantifier
        (r"a\{2\}", "a{2}", True),
        ("}", "}", True),              # a lone '}' is a literal
    ],
)
def test_valid_lookalikes(pattern, text, expected):
    assert match(pattern, text) is expected
