"""Acceptance test for group_anagrams. Do not modify."""

from solution import group_anagrams


def test_basic_grouping():
    # Groups are sorted ascending by their first element: "ate" < "bat" < "nat".
    assert group_anagrams(["eat", "tea", "tan", "ate", "nat", "bat"]) == [
        ["ate", "eat", "tea"],
        ["bat"],
        ["nat", "tan"],
    ]


def test_empty():
    assert group_anagrams([]) == []


def test_singletons():
    assert group_anagrams(["abc", "xyz"]) == [["abc"], ["xyz"]]


def test_case_sensitive():
    # Case-sensitive: "Tea" (capital T) is not an anagram of "eat"/"ate".
    # Groups sort by first element; capital "T" (84) sorts before "a" (97).
    assert group_anagrams(["Tea", "eat", "ate"]) == [["Tea"], ["ate", "eat"]]


def test_within_group_sorted():
    groups = group_anagrams(["listen", "silent", "enlist"])
    assert groups == [["enlist", "listen", "silent"]]


def test_groups_sorted_by_first():
    groups = group_anagrams(["zzz", "aaa", "bbb"])
    assert groups == [["aaa"], ["bbb"], ["zzz"]]
