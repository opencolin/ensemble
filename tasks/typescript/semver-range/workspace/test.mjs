// Acceptance test for the SemVer comparator + range matcher.
// Do not modify. Run with `node --test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { compare, satisfies } from "./semver.mjs";

// ---------------------------------------------------------------------------
// compare(): canonical prerelease ordering chain. Each adjacent pair is its own
// test, asserting both directions. Chain (low -> high):
//   1.0.0-alpha < 1.0.0-alpha.1 < 1.0.0-alpha.beta < 1.0.0-beta
//     < 1.0.0-beta.2 < 1.0.0-beta.11 < 1.0.0-rc.1 < 1.0.0
// ---------------------------------------------------------------------------

test("chain: alpha < alpha.1 (shorter prefix is lower)", () => {
  assert.equal(compare("1.0.0-alpha", "1.0.0-alpha.1"), -1);
  assert.equal(compare("1.0.0-alpha.1", "1.0.0-alpha"), 1);
});

test("chain: alpha.1 < alpha.beta (numeric id < alphanumeric id)", () => {
  assert.equal(compare("1.0.0-alpha.1", "1.0.0-alpha.beta"), -1);
  assert.equal(compare("1.0.0-alpha.beta", "1.0.0-alpha.1"), 1);
});

test("chain: alpha.beta < beta (ASCII lexical on alphanumerics)", () => {
  assert.equal(compare("1.0.0-alpha.beta", "1.0.0-beta"), -1);
  assert.equal(compare("1.0.0-beta", "1.0.0-alpha.beta"), 1);
});

test("chain: beta < beta.2 (shorter prefix is lower)", () => {
  assert.equal(compare("1.0.0-beta", "1.0.0-beta.2"), -1);
  assert.equal(compare("1.0.0-beta.2", "1.0.0-beta"), 1);
});

test("chain: beta.2 < beta.11 (numeric ids compare numerically)", () => {
  assert.equal(compare("1.0.0-beta.2", "1.0.0-beta.11"), -1);
  assert.equal(compare("1.0.0-beta.11", "1.0.0-beta.2"), 1);
});

test("chain: beta.11 < rc.1 (ASCII lexical b < r)", () => {
  assert.equal(compare("1.0.0-beta.11", "1.0.0-rc.1"), -1);
  assert.equal(compare("1.0.0-rc.1", "1.0.0-beta.11"), 1);
});

test("chain: rc.1 < 1.0.0 (prerelease is lower than release)", () => {
  assert.equal(compare("1.0.0-rc.1", "1.0.0"), -1);
  assert.equal(compare("1.0.0", "1.0.0-rc.1"), 1);
});

// ---------------------------------------------------------------------------
// compare(): other precedence rules.
// ---------------------------------------------------------------------------

test("prerelease is lower than the same core release", () => {
  assert.equal(compare("1.0.0-alpha", "1.0.0"), -1);
  assert.equal(compare("1.0.0", "1.0.0-alpha"), 1);
});

test("build metadata does not affect equality", () => {
  assert.equal(compare("1.0.0+a", "1.0.0+b"), 0);
  assert.equal(compare("1.0.0+build.99", "1.0.0+build.1"), 0);
});

test("build metadata versus no build is still equal", () => {
  assert.equal(compare("1.0.0+x", "1.0.0"), 0);
  assert.equal(compare("1.2.3", "1.2.3+build"), 0);
});

test("numeric core compares numerically, not lexically", () => {
  assert.equal(compare("2.0.0", "10.0.0"), -1);
  assert.equal(compare("1.9.0", "1.10.0"), -1);
  assert.equal(compare("1.0.9", "1.0.10"), -1);
});

test("numeric identifier is lower than alphanumeric identifier", () => {
  assert.equal(compare("1.0.0-1", "1.0.0-alpha"), -1);
  assert.equal(compare("1.0.0-alpha", "1.0.0-1"), 1);
});

test("numeric identifiers: 11 is greater than 2", () => {
  assert.equal(compare("1.0.0-2", "1.0.0-11"), -1);
  assert.equal(compare("1.0.0-11", "1.0.0-2"), 1);
});

test("prefix rule on multi-identifier prereleases", () => {
  assert.equal(compare("1.0.0-1.2", "1.0.0-1.2.0"), -1);
  assert.equal(compare("1.0.0-1.2.0", "1.0.0-1.2"), 1);
});

test("equal versions compare to 0 (with and without build)", () => {
  assert.equal(compare("1.2.3", "1.2.3"), 0);
  assert.equal(compare("1.2.3-rc.1", "1.2.3-rc.1"), 0);
  assert.equal(compare("1.2.3+x", "1.2.3+y"), 0);
});

test("plain release ordering across core parts", () => {
  assert.equal(compare("1.2.3", "1.2.4"), -1);
  assert.equal(compare("1.3.0", "1.2.9"), 1);
  assert.equal(compare("2.0.0", "1.9.9"), 1);
});

// ---------------------------------------------------------------------------
// compare(): invalid version strings throw.
// ---------------------------------------------------------------------------

test("compare throws on leading zero in the core", () => {
  assert.throws(() => compare("01.2.3", "1.2.3"));
  assert.throws(() => compare("1.2.3", "1.02.3"));
});

test("compare throws on missing version parts", () => {
  assert.throws(() => compare("1.2", "1.2.0"));
  assert.throws(() => compare("1", "1.0.0"));
});

test("compare throws on a v prefix and on garbage", () => {
  assert.throws(() => compare("v1.2.3", "1.2.3"));
  assert.throws(() => compare("1.2.3", "not-a-version"));
});

test("compare throws on an empty prerelease", () => {
  assert.throws(() => compare("1.0.0-", "1.0.0"));
  assert.throws(() => compare("1.0.0-alpha..1", "1.0.0"));
});

// ---------------------------------------------------------------------------
// satisfies(): exact / bare comparators and build metadata.
// ---------------------------------------------------------------------------

test("exact match via bare version and via =", () => {
  assert.equal(satisfies("1.2.3", "1.2.3"), true);
  assert.equal(satisfies("1.2.3", "=1.2.3"), true);
  assert.equal(satisfies("1.2.4", "1.2.3"), false);
});

test("build metadata is ignored by satisfies", () => {
  assert.equal(satisfies("1.2.3+build", "1.2.3"), true);
  assert.equal(satisfies("1.2.3+build", "=1.2.3"), true);
});

test("primitive comparators >, >=, <, <=", () => {
  assert.equal(satisfies("1.2.4", ">1.2.3"), true);
  assert.equal(satisfies("1.2.3", ">1.2.3"), false);
  assert.equal(satisfies("1.2.3", ">=1.2.3"), true);
  assert.equal(satisfies("1.2.2", "<1.2.3"), true);
  assert.equal(satisfies("1.2.3", "<1.2.3"), false);
  assert.equal(satisfies("1.2.3", "<=1.2.3"), true);
});

// ---------------------------------------------------------------------------
// satisfies(): caret ranges.
// ---------------------------------------------------------------------------

test("caret on a non-zero major", () => {
  assert.equal(satisfies("1.2.3", "^1.2.3"), true);
  assert.equal(satisfies("1.9.9", "^1.2.3"), true);
  assert.equal(satisfies("2.0.0", "^1.2.3"), false);
  assert.equal(satisfies("1.2.2", "^1.2.3"), false);
});

test("caret zero-major keeps the minor fixed", () => {
  assert.equal(satisfies("0.2.3", "^0.2.3"), true);
  assert.equal(satisfies("0.2.9", "^0.2.3"), true);
  assert.equal(satisfies("0.3.0", "^0.2.3"), false);
});

test("caret zero-major zero-minor keeps the patch fixed", () => {
  assert.equal(satisfies("0.0.3", "^0.0.3"), true);
  assert.equal(satisfies("0.0.4", "^0.0.3"), false);
  assert.equal(satisfies("0.0.2", "^0.0.3"), false);
});

// ---------------------------------------------------------------------------
// satisfies(): tilde ranges.
// ---------------------------------------------------------------------------

test("tilde with full version allows patch bumps only", () => {
  assert.equal(satisfies("1.2.3", "~1.2.3"), true);
  assert.equal(satisfies("1.2.9", "~1.2.3"), true);
  assert.equal(satisfies("1.3.0", "~1.2.3"), false);
  assert.equal(satisfies("1.2.2", "~1.2.3"), false);
});

test("tilde with major.minor", () => {
  assert.equal(satisfies("1.2.0", "~1.2"), true);
  assert.equal(satisfies("1.2.9", "~1.2"), true);
  assert.equal(satisfies("1.3.0", "~1.2"), false);
});

test("tilde with major only allows minor bumps", () => {
  assert.equal(satisfies("1.0.0", "~1"), true);
  assert.equal(satisfies("1.9.9", "~1"), true);
  assert.equal(satisfies("2.0.0", "~1"), false);
});

// ---------------------------------------------------------------------------
// satisfies(): X-ranges.
// ---------------------------------------------------------------------------

test("x-range at the patch position", () => {
  assert.equal(satisfies("1.2.0", "1.2.x"), true);
  assert.equal(satisfies("1.2.9", "1.2.*"), true);
  assert.equal(satisfies("1.2.5", "1.2"), true);
  assert.equal(satisfies("1.3.0", "1.2"), false);
  assert.equal(satisfies("1.1.9", "1.2.x"), false);
});

test("x-range at the minor position", () => {
  assert.equal(satisfies("1.0.0", "1.x"), true);
  assert.equal(satisfies("1.9.9", "1"), true);
  assert.equal(satisfies("2.0.0", "1.x"), false);
  assert.equal(satisfies("0.9.9", "1"), false);
});

test("star and empty string match any release", () => {
  assert.equal(satisfies("1.2.3", "*"), true);
  assert.equal(satisfies("9.9.9", ""), true);
  assert.equal(satisfies("0.0.0", "*"), true);
});

// ---------------------------------------------------------------------------
// satisfies(): hyphen ranges.
// ---------------------------------------------------------------------------

test("hyphen range is inclusive on both ends", () => {
  assert.equal(satisfies("1.2.3", "1.2.3 - 2.3.4"), true);
  assert.equal(satisfies("1.5.0", "1.2.3 - 2.3.4"), true);
  assert.equal(satisfies("2.3.4", "1.2.3 - 2.3.4"), true);
  assert.equal(satisfies("2.3.5", "1.2.3 - 2.3.4"), false);
  assert.equal(satisfies("1.2.2", "1.2.3 - 2.3.4"), false);
});

test("hyphen range with a partial right side", () => {
  assert.equal(satisfies("2.3.9", "1.2.3 - 2.3"), true);
  assert.equal(satisfies("2.3.0", "1.2.3 - 2.3"), true);
  assert.equal(satisfies("2.4.0", "1.2.3 - 2.3"), false);
});

test("hyphen range with a partial left side", () => {
  assert.equal(satisfies("1.2.0", "1.2 - 2.3.4"), true);
  assert.equal(satisfies("1.1.9", "1.2 - 2.3.4"), false);
  assert.equal(satisfies("2.3.4", "1.2 - 2.3.4"), true);
});

// ---------------------------------------------------------------------------
// satisfies(): AND sets and OR alternatives.
// ---------------------------------------------------------------------------

test("space-separated comparators are ANDed", () => {
  assert.equal(satisfies("1.5.0", ">=1.2.3 <2.0.0"), true);
  assert.equal(satisfies("2.0.0", ">=1.2.3 <2.0.0"), false);
  assert.equal(satisfies("1.2.2", ">=1.2.3 <2.0.0"), false);
});

test("|| separates OR alternatives", () => {
  assert.equal(satisfies("0.9.0", "<1.0.0 || >=2.0.0"), true);
  assert.equal(satisfies("2.5.0", "<1.0.0 || >=2.0.0"), true);
  assert.equal(satisfies("1.0.0", "<1.0.0 || >=2.0.0"), false);
});

test("OR of two caret ranges", () => {
  assert.equal(satisfies("1.2.3", "^1.0.0 || ^2.0.0"), true);
  assert.equal(satisfies("2.5.0", "^1.0.0 || ^2.0.0"), true);
  assert.equal(satisfies("3.0.0", "^1.0.0 || ^2.0.0"), false);
});

// ---------------------------------------------------------------------------
// satisfies(): PRERELEASE GATING (the crux). A prerelease version satisfies a
// set only if some comparator in that set carries a prerelease on the identical
// [major,minor,patch] tuple.
// ---------------------------------------------------------------------------

test("gating: prerelease does not satisfy a caret without a matching prerelease", () => {
  assert.equal(satisfies("1.2.3-alpha", "^1.2.2"), false);
});

test("gating: prerelease does not satisfy a bare lower bound", () => {
  assert.equal(satisfies("1.2.3-alpha", ">=1.0.0"), false);
});

test("gating: prerelease does not satisfy a wildcard range", () => {
  assert.equal(satisfies("1.2.3-alpha", "*"), false);
  assert.equal(satisfies("1.2.3-alpha", ""), false);
});

test("gating: prerelease satisfies a matching-tuple comparator", () => {
  assert.equal(satisfies("1.2.3-alpha", ">=1.2.3-alpha"), true);
});

test("gating: prerelease satisfies a caret whose lower bound is a prerelease", () => {
  assert.equal(satisfies("1.2.3-alpha", "^1.2.3-0"), true);
});

test("gating: prerelease clears comparators but no matching-tuple prerelease", () => {
  // 2.0.0-beta passes >=1.2.3-alpha and <2.0.0 numerically, yet no comparator
  // carries a prerelease on the [2,0,0] tuple, so it must NOT satisfy.
  assert.equal(satisfies("2.0.0-beta", ">=1.2.3-alpha <2.0.0"), false);
});

test("gating: strictly-greater prerelease on the same tuple", () => {
  assert.equal(satisfies("1.2.3-beta", ">1.2.3-alpha"), true);
});

test("gating: prerelease on a different tuple is rejected", () => {
  // 1.2.4-alpha > 1.2.3-alpha numerically, but the comparator's prerelease is on
  // tuple [1,2,3], not the version's [1,2,4].
  assert.equal(satisfies("1.2.4-alpha", ">=1.2.3-alpha"), false);
});

test("gating: a release version is not gated by a prerelease comparator", () => {
  assert.equal(satisfies("1.2.3", ">=1.2.3-alpha"), true);
});

test("gating: OR set supplies the matching prerelease comparator", () => {
  // First set (>=2.0.0) fails numerically; second set carries the matching
  // prerelease on [1,2,3].
  assert.equal(satisfies("1.2.3-alpha", ">=2.0.0 || >=1.2.3-alpha"), true);
});

test("gating: matching prerelease comparator inside an AND set", () => {
  assert.equal(satisfies("1.2.3-alpha", ">=1.2.3-alpha <1.3.0"), true);
});

// ---------------------------------------------------------------------------
// satisfies(): invalid VERSION -> false; invalid RANGE -> throw.
// ---------------------------------------------------------------------------

test("satisfies returns false for an invalid version", () => {
  assert.equal(satisfies("not-a-version", ">=1.0.0"), false);
  assert.equal(satisfies("01.2.3", "*"), false);
  assert.equal(satisfies("1.2", "^1.0.0"), false);
});

test("satisfies throws for an invalid range", () => {
  assert.throws(() => satisfies("1.2.3", "^x.y"));
  assert.throws(() => satisfies("1.2.3", ">=not-a-version"));
});
