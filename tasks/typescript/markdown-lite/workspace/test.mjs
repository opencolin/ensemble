// Hidden acceptance suite for the inline-markdown renderer.
// Do not modify. Run with `node --test`. Each case is independent.
import { test } from "node:test";
import assert from "node:assert/strict";
import { render } from "./markdown.mjs";

// -------------------------------------------------------------------------
// Backslash escapes
// -------------------------------------------------------------------------

test("escaped asterisks are literal, not emphasis", () => {
  assert.equal(render("\\*not em\\*"), "*not em*");
});

test("backslash before non-punctuation stays literal", () => {
  assert.equal(render("\\a"), "\\a");
});

test("escaped backslash yields one backslash", () => {
  assert.equal(render("\\\\"), "\\");
});

test("backslash before a backtick blocks the code span", () => {
  assert.equal(render("foo\\`bar"), "foo`bar");
});

test("escaped brackets do not form a link", () => {
  assert.equal(render("\\[not a link\\](x)"), "[not a link](x)");
});

test("escaped ampersand is a literal & (then escaped for output)", () => {
  assert.equal(render("\\&"), "&amp;");
});

test("trailing backslash at end of input is literal", () => {
  assert.equal(render("end\\"), "end\\");
});

test("backslash before a space is literal", () => {
  assert.equal(render("a\\ b"), "a\\ b");
});


// -------------------------------------------------------------------------
// Code spans
// -------------------------------------------------------------------------

test("simple code span", () => {
  assert.equal(render("`foo`"), "<code>foo</code>");
});

test("a single backtick with no match is literal", () => {
  assert.equal(render("`"), "`");
});

test("two unmatched backticks are literal", () => {
  assert.equal(render("``"), "``");
});

test("a longer run can hold a shorter backtick run", () => {
  assert.equal(render("`` ` ``"), "<code>`</code>");
});

test("two-backtick span keeps an interior single backtick", () => {
  assert.equal(render("`` foo ` bar ``"), "<code>foo ` bar</code>");
});

test("one leading and trailing space are stripped together", () => {
  assert.equal(render("` a `"), "<code>a</code>");
});

test("a leading space alone is not stripped", () => {
  assert.equal(render("` a`"), "<code> a</code>");
});

test("a trailing space alone is not stripped", () => {
  assert.equal(render("`a `"), "<code>a </code>");
});

test("all-space content is preserved", () => {
  assert.equal(render("`  `"), "<code>  </code>");
});

test("only a single space pair is stripped", () => {
  assert.equal(render("`  a  `"), "<code> a </code>");
});

test("interior spaces are preserved", () => {
  assert.equal(render("`foo   bar`"), "<code>foo   bar</code>");
});

test("backslash is literal inside a code span", () => {
  assert.equal(render("`foo\\`"), "<code>foo\\</code>");
});

test("ampersand is escaped inside a code span", () => {
  assert.equal(render("`a&b`"), "<code>a&amp;b</code>");
});

test("angle brackets are escaped inside a code span", () => {
  assert.equal(render("`<a>`"), "<code>&lt;a&gt;</code>");
});

test("double quote IS escaped inside a code span", () => {
  assert.equal(render("`a\"b`"), "<code>a&quot;b</code>");
});

test("asterisks inside a code span are literal", () => {
  assert.equal(render("`a*b*c`"), "<code>a*b*c</code>");
});

test("two adjacent code spans", () => {
  assert.equal(render("`x` `y`"), "<code>x</code> <code>y</code>");
});

test("an unmatched run after text is literal", () => {
  assert.equal(render("foo `bar"), "foo `bar");
});

test("three backticks with no closer are literal", () => {
  assert.equal(render("```"), "```");
});


// -------------------------------------------------------------------------
// Emphasis with *
// -------------------------------------------------------------------------

test("basic emphasis", () => {
  assert.equal(render("*foo bar*"), "<em>foo bar</em>");
});

test("basic strong", () => {
  assert.equal(render("**foo bar**"), "<strong>foo bar</strong>");
});

test("opener after a space is not left-flanking", () => {
  assert.equal(render("a * foo*"), "a * foo*");
});

test("intraword emphasis is allowed for *", () => {
  assert.equal(render("foo*bar*baz"), "foo<em>bar</em>baz");
});

test("intraword emphasis between digits", () => {
  assert.equal(render("5*6*7"), "5<em>6</em>7");
});

test("a run surrounded by spaces cannot open or close", () => {
  assert.equal(render("* foo *"), "* foo *");
});

test("closer preceded by a space does not close", () => {
  assert.equal(render("*foo bar *"), "*foo bar *");
});

test("opener followed by a space does not open", () => {
  assert.equal(render("foo* bar*"), "foo* bar*");
});

test("a lone strong run with no content is literal", () => {
  assert.equal(render("**"), "**");
});

test("emphasis then trailing text", () => {
  assert.equal(render("*foo*bar"), "<em>foo</em>bar");
});

test("strong immediately followed by text", () => {
  assert.equal(render("**foo**bar"), "<strong>foo</strong>bar");
});

test("two separate strong spans", () => {
  assert.equal(render("**a**b**c**"), "<strong>a</strong>b<strong>c</strong>");
});

test("an unmatched opener stays literal", () => {
  assert.equal(render("[a](b) *c"), "<a href=\"b\">a</a> *c");
});


// -------------------------------------------------------------------------
// Emphasis with _
// -------------------------------------------------------------------------

test("basic underscore emphasis", () => {
  assert.equal(render("_foo_"), "<em>foo</em>");
});

test("basic underscore strong", () => {
  assert.equal(render("__foo__"), "<strong>foo</strong>");
});

test("intraword underscore does not emphasize", () => {
  assert.equal(render("foo_bar_baz"), "foo_bar_baz");
});

test("a single intraword underscore is literal", () => {
  assert.equal(render("foo_bar"), "foo_bar");
});

test("underscore run inside a word stays literal", () => {
  assert.equal(render("pa_th_way"), "pa_th_way");
});

test("underscore can close across an inner word", () => {
  assert.equal(render("_foo_bar_baz_"), "<em>foo_bar_baz</em>");
});

test("underscore opener after a space is not usable when word-internal on the right", () => {
  assert.equal(render("_ foo bar_"), "_ foo bar_");
});

test("underscore emphasis with spaces", () => {
  assert.equal(render("_foo bar_"), "<em>foo bar</em>");
});

test("underscore opener enabled by preceding punctuation", () => {
  assert.equal(render("foo-_(bar)_"), "foo-<em>(bar)</em>");
});

test("underscore around a parenthesized word", () => {
  assert.equal(render("_(bar)_"), "<em>(bar)</em>");
});

test("double quote next to underscore blocks it (quote left literal)", () => {
  assert.equal(render("aaa_\"bbb\"_ccc"), "aaa_\"bbb\"_ccc");
});


// -------------------------------------------------------------------------
// Emphasis nesting and the rule of three
// -------------------------------------------------------------------------

test("triple delimiters split into em + strong", () => {
  assert.equal(render("***x***"), "<em><strong>x</strong></em>");
});

test("triple underscores split into em + strong", () => {
  assert.equal(render("___x___"), "<em><strong>x</strong></em>");
});

test("strong containing emphasis", () => {
  assert.equal(render("**foo, *bar*, baz**"), "<strong>foo, <em>bar</em>, baz</strong>");
});

test("emphasis containing strong", () => {
  assert.equal(render("*foo**bar**baz*"), "<em>foo<strong>bar</strong>baz</em>");
});

test("rule of three keeps the inner delimiters literal", () => {
  assert.equal(render("*foo**bar*"), "<em>foo**bar</em>");
});

test("rule of three mirrored", () => {
  assert.equal(render("**foo*bar**"), "<strong>foo*bar</strong>");
});

test("strong with an interior emphasis span", () => {
  assert.equal(render("**foo*bar*baz**"), "<strong>foo<em>bar</em>baz</strong>");
});

test("leftover opener delimiter is literal", () => {
  assert.equal(render("**foo* bar"), "*<em>foo</em> bar");
});

test("emphasis wrapping a strong pair", () => {
  assert.equal(render("*foo **bar** baz*"), "<em>foo <strong>bar</strong> baz</em>");
});

test("nested emphasis of the same char", () => {
  assert.equal(render("*(*foo*)*"), "<em>(<em>foo</em>)</em>");
});

test("two emphasis spans around plain text", () => {
  assert.equal(render("*foo*bar*baz*"), "<em>foo</em>bar<em>baz</em>");
});

test("strong inside strong via a four run", () => {
  assert.equal(render("****foo****"), "<strong><strong>foo</strong></strong>");
});


// -------------------------------------------------------------------------
// Links
// -------------------------------------------------------------------------

test("basic link", () => {
  assert.equal(render("[foo](/uri)"), "<a href=\"/uri\">foo</a>");
});

test("empty link text", () => {
  assert.equal(render("[](/uri)"), "<a href=\"/uri\"></a>");
});

test("empty destination", () => {
  assert.equal(render("[foo]()"), "<a href=\"\">foo</a>");
});

test("link with a title", () => {
  assert.equal(render("[foo](/uri \"ti\")"), "<a href=\"/uri\" title=\"ti\">foo</a>");
});

test("single-quoted title", () => {
  assert.equal(render("[a](b 'c')"), "<a href=\"b\" title=\"c\">a</a>");
});

test("escaped quote inside the title is escaped in output", () => {
  assert.equal(render("[a](b \"c\\\"d\")"), "<a href=\"b\" title=\"c&quot;d\">a</a>");
});

test("emphasis is parsed inside link text", () => {
  assert.equal(render("[link *em*](u)"), "<a href=\"u\">link <em>em</em></a>");
});

test("a code span inside link text", () => {
  assert.equal(render("[`code`](u)"), "<a href=\"u\"><code>code</code></a>");
});

test("strong wraps a whole link", () => {
  assert.equal(render("**[a](b)**"), "<strong><a href=\"b\">a</a></strong>");
});

test("a link wraps strong text", () => {
  assert.equal(render("[**a**](b)"), "<a href=\"b\"><strong>a</strong></a>");
});

test("emphasis wraps a link", () => {
  assert.equal(render("*[t](u)*"), "<em><a href=\"u\">t</a></em>");
});

test("angle-bracketed destination allows spaces", () => {
  assert.equal(render("[x](<a b>)"), "<a href=\"a b\">x</a>");
});

test("a stray < inside link text is escaped", () => {
  assert.equal(render("[foo <bar](u)"), "<a href=\"u\">foo &lt;bar</a>");
});

test("no image syntax: ! is literal, brackets still link", () => {
  assert.equal(render("![a](b)"), "!<a href=\"b\">a</a>");
});

test("reference-style link syntax is not supported", () => {
  assert.equal(render("[foo][bar]"), "[foo][bar]");
});

test("two adjacent inline links", () => {
  assert.equal(render("[a](b)[c](d)"), "<a href=\"b\">a</a><a href=\"d\">c</a>");
});

test("escaped closing bracket inside link text", () => {
  assert.equal(render("[a\\]b](c)"), "<a href=\"c\">a]b</a>");
});

test("innermost bracket pair wins; outer brackets are literal", () => {
  assert.equal(render("[a[b](c)d](e)"), "[a<a href=\"c\">b</a>d](e)");
});

test("a link may not contain another link", () => {
  assert.equal(render("[[x](y)]"), "[<a href=\"y\">x</a>]");
});

test("emphasis cannot straddle a link boundary", () => {
  assert.equal(render("[a *b](c)*"), "<a href=\"c\">a *b</a>*");
});

test("ampersand in the destination is escaped", () => {
  assert.equal(render("[a](x&y)"), "<a href=\"x&amp;y\">a</a>");
});


// -------------------------------------------------------------------------
// Autolinks
// -------------------------------------------------------------------------

test("basic https autolink", () => {
  assert.equal(render("<https://example.com>"), "<a href=\"https://example.com\">https://example.com</a>");
});

test("http autolink", () => {
  assert.equal(render("<http://a.b>"), "<a href=\"http://a.b\">http://a.b</a>");
});

test("any scheme with a colon works", () => {
  assert.equal(render("<mailto:foo@bar.com>"), "<a href=\"mailto:foo@bar.com\">mailto:foo@bar.com</a>");
});

test("ampersands in an autolink are escaped both places", () => {
  assert.equal(render("<https://x.com/a?b=1&c=2>"), "<a href=\"https://x.com/a?b=1&amp;c=2\">https://x.com/a?b=1&amp;c=2</a>");
});

test("no scheme means no autolink; angle brackets are escaped", () => {
  assert.equal(render("<notaurl>"), "&lt;notaurl&gt;");
});

test("a space after < prevents an autolink", () => {
  assert.equal(render("< http://a>"), "&lt; http://a&gt;");
});

test("a bare pair of angle brackets around a word is escaped", () => {
  assert.equal(render("a <b> c"), "a &lt;b&gt; c");
});


// -------------------------------------------------------------------------
// Raw-text HTML escaping
// -------------------------------------------------------------------------

test("less-than and greater-than are escaped", () => {
  assert.equal(render("3 < 5 and 6 > 4"), "3 &lt; 5 and 6 &gt; 4");
});

test("every ampersand becomes &amp;", () => {
  assert.equal(render("Tom & Jerry"), "Tom &amp; Jerry");
});

test("an entity-looking ampersand is still escaped", () => {
  assert.equal(render("&amp;"), "&amp;amp;");
});

test("a numeric character reference is still escaped", () => {
  assert.equal(render("x&#38;y"), "x&amp;#38;y");
});

test("multiple ampersands", () => {
  assert.equal(render("a & b & c"), "a &amp; b &amp; c");
});

test("double quotes are left as-is in plain text", () => {
  assert.equal(render("say \"hi\""), "say \"hi\"");
});

test("apostrophes are left as-is", () => {
  assert.equal(render("it's fine"), "it's fine");
});

test("plain text passes through unchanged", () => {
  assert.equal(render("just plain text"), "just plain text");
});

test("a lone less-than is escaped", () => {
  assert.equal(render("<"), "&lt;");
});


// -------------------------------------------------------------------------
// Precedence and interaction
// -------------------------------------------------------------------------

test("a code span suppresses emphasis delimiters inside it", () => {
  assert.equal(render("`a*b`"), "<code>a*b</code>");
});

test("a code span consumes a would-be emphasis closer", () => {
  assert.equal(render("*a`*`b"), "*a<code>*</code>b");
});

test("emphasis wraps around a code span", () => {
  assert.equal(render("*a `b` c*"), "<em>a <code>b</code> c</em>");
});

test("a code span inside a link, escaping applied", () => {
  assert.equal(render("[`x<y`](u)"), "<a href=\"u\"><code>x&lt;y</code></a>");
});

test("emphasized links on both sides", () => {
  assert.equal(render("*[a](b)* *[c](d)*"), "<em><a href=\"b\">a</a></em> <em><a href=\"d\">c</a></em>");
});

test("a link then independent emphasis", () => {
  assert.equal(render("[foo](/uri) *bar*"), "<a href=\"/uri\">foo</a> <em>bar</em>");
});

test("code span binds before the surrounding backslash-free text", () => {
  assert.equal(render("a `&` b"), "a <code>&amp;</code> b");
});

test("escaped star adjacent to a real emphasis span", () => {
  assert.equal(render("\\**foo*"), "*<em>foo</em>");
});

