"""Acceptance test for evaluate. Do not modify."""

import pytest

from solution import evaluate

TOL = 1e-9


# --- Operator precedence ---------------------------------------------------


def test_precedence_mul_over_add():
    assert evaluate("2+3*4") == pytest.approx(14, abs=TOL)


def test_precedence_div_over_sub():
    assert evaluate("20-8/2") == pytest.approx(16, abs=TOL)


def test_precedence_mod_over_add():
    assert evaluate("2+7%3") == pytest.approx(3, abs=TOL)


# --- Parentheses overriding precedence -------------------------------------


def test_parens_override():
    assert evaluate("(2+3)*4") == pytest.approx(20, abs=TOL)


def test_parens_nested_override():
    assert evaluate("((1+2)*(3+4))") == pytest.approx(21, abs=TOL)


def test_parens_single_value():
    assert evaluate("(7)") == pytest.approx(7, abs=TOL)


# --- Unary minus / plus ----------------------------------------------------


def test_unary_minus_leading():
    assert evaluate("-3+4") == pytest.approx(1, abs=TOL)


def test_unary_minus_after_operator():
    assert evaluate("2*-3") == pytest.approx(-6, abs=TOL)


def test_unary_plus_leading():
    assert evaluate("+5") == pytest.approx(5, abs=TOL)


def test_unary_minus_on_parens():
    assert evaluate("-(2+3)") == pytest.approx(-5, abs=TOL)


# --- Unary chaining --------------------------------------------------------


def test_unary_double_minus():
    assert evaluate("--3") == pytest.approx(3, abs=TOL)


def test_unary_triple_minus():
    assert evaluate("---3") == pytest.approx(-3, abs=TOL)


def test_unary_mixed_chain():
    assert evaluate("-+-3") == pytest.approx(3, abs=TOL)


# --- True (float) division -------------------------------------------------


def test_true_division():
    assert evaluate("10/4") == pytest.approx(2.5, abs=TOL)


def test_division_chain_left_assoc():
    # (8 / 2) / 2 == 2, not 8 / (2 / 2) == 8
    assert evaluate("8/2/2") == pytest.approx(2, abs=TOL)


# --- Modulo ----------------------------------------------------------------


def test_modulo_basic():
    assert evaluate("10%3") == pytest.approx(1, abs=TOL)


def test_modulo_left_assoc():
    # (17 % 10) % 4 == 3
    assert evaluate("17%10%4") == pytest.approx(3, abs=TOL)


# --- Subtraction / addition associativity ----------------------------------


def test_subtraction_left_assoc():
    # (10 - 3) - 2 == 5, not 10 - (3 - 2) == 9
    assert evaluate("10-3-2") == pytest.approx(5, abs=TOL)


# --- Mixed / nesting -------------------------------------------------------


def test_mixed_expression():
    assert evaluate("2*(3+4)-5") == pytest.approx(9, abs=TOL)


def test_deep_nesting():
    assert evaluate("((2+3)*(4-1))/(1+2)") == pytest.approx(5, abs=TOL)


def test_mixed_unary_and_precedence():
    assert evaluate("-2*3+10") == pytest.approx(4, abs=TOL)


# --- Decimals --------------------------------------------------------------


def test_decimal_multiply():
    assert evaluate("3.5*2") == pytest.approx(7, abs=TOL)


def test_leading_dot_decimals():
    assert evaluate(".5+.5") == pytest.approx(1, abs=TOL)


def test_trailing_dot_decimal():
    assert evaluate("10.+0") == pytest.approx(10, abs=TOL)


def test_decimal_division_result():
    assert evaluate("1/8") == pytest.approx(0.125, abs=TOL)


# --- Insignificant whitespace ----------------------------------------------


def test_whitespace_insignificant():
    assert evaluate("  1 +  2 ") == pytest.approx(3, abs=TOL)


def test_whitespace_inside_number_region():
    assert evaluate("\t12\n*\t3 ") == pytest.approx(36, abs=TOL)


# --- Return type -----------------------------------------------------------


def test_returns_float():
    assert isinstance(evaluate("1+1"), float)


# --- Error cases -----------------------------------------------------------


def test_error_empty():
    with pytest.raises(ValueError):
        evaluate("")


def test_error_whitespace_only():
    with pytest.raises(ValueError):
        evaluate("   ")


def test_error_trailing_operator():
    with pytest.raises(ValueError):
        evaluate("1+")


def test_error_leading_binary_operator():
    with pytest.raises(ValueError):
        evaluate("*2")


def test_error_unbalanced_open_paren():
    with pytest.raises(ValueError):
        evaluate("(1+2")


def test_error_unbalanced_close_paren():
    with pytest.raises(ValueError):
        evaluate("1+2)")


def test_error_empty_parens():
    with pytest.raises(ValueError):
        evaluate("(")


def test_error_two_adjacent_operands():
    with pytest.raises(ValueError):
        evaluate("1 2")


def test_error_power_operator():
    with pytest.raises(ValueError):
        evaluate("2**3")


def test_error_division_by_zero():
    with pytest.raises(ValueError):
        evaluate("1/0")


def test_error_modulo_by_zero():
    with pytest.raises(ValueError):
        evaluate("5%0")


def test_error_unknown_character():
    with pytest.raises(ValueError):
        evaluate("@")


def test_error_unknown_character_in_expr():
    with pytest.raises(ValueError):
        evaluate("3 & 4")
