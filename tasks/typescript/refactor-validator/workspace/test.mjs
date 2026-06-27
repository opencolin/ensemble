// Acceptance test for validatePassword. Do not modify. Run with `node --test`.
// Pins exact messages and ordering so a refactor must preserve behavior.
import test from "node:test";
import assert from "node:assert/strict";
import { validatePassword } from "./validator.mjs";

test("valid password yields no errors", () => {
  assert.deepEqual(validatePassword("Abcdef12"), []);
});

test("empty / missing is required", () => {
  assert.deepEqual(validatePassword(""), ["password is required"]);
  assert.deepEqual(validatePassword(undefined), ["password is required"]);
  assert.deepEqual(validatePassword(null), ["password is required"]);
});

test("too short reports length only when other rules pass", () => {
  assert.deepEqual(validatePassword("Ab1"), ["must be at least 8 characters"]);
});

test("missing character classes, in order", () => {
  assert.deepEqual(validatePassword("abcdefgh"), [
    "must contain an uppercase letter",
    "must contain a digit",
  ]);
  assert.deepEqual(validatePassword("ABCDEFGH"), [
    "must contain a lowercase letter",
    "must contain a digit",
  ]);
  assert.deepEqual(validatePassword("12345678"), [
    "must contain an uppercase letter",
    "must contain a lowercase letter",
  ]);
});

test("multiple errors accumulate in canonical order", () => {
  assert.deepEqual(validatePassword("abc"), [
    "must be at least 8 characters",
    "must contain an uppercase letter",
    "must contain a digit",
  ]);
});
