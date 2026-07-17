// Acceptance test for Split. Do not modify.
package shellsplit

import (
	"reflect"
	"testing"
)

func TestSplit(t *testing.T) {
	cases := []struct {
		name    string
		in      string
		want    []string
		wantErr bool
	}{
		// --- basic whitespace splitting (compared with reflect.DeepEqual) ---
		{name: "single word", in: `a`, want: []string{"a"}},
		{name: "two words", in: `a b`, want: []string{"a", "b"}},
		{name: "three words", in: `a b c`, want: []string{"a", "b", "c"}},
		{name: "collapse spaces", in: `a   b`, want: []string{"a", "b"}},
		{name: "leading trailing spaces", in: `  a b  `, want: []string{"a", "b"}},
		{name: "tab separator", in: "a\tb", want: []string{"a", "b"}},
		{name: "tabs and spaces mixed", in: " \t a \t b \t ", want: []string{"a", "b"}},
		{name: "newline separator", in: "a\nb", want: []string{"a", "b"}},
		{name: "multiple newlines collapse", in: "a\n\n\nb", want: []string{"a", "b"}},
		{name: "all whitespace kinds", in: "\n\t a \t\n b \n", want: []string{"a", "b"}},

		// --- empty / whitespace-only inputs must be non-nil empty slices ---
		{name: "empty input", in: ``, want: []string{}},
		{name: "only spaces", in: `   `, want: []string{}},
		{name: "only mixed whitespace", in: "  \t\n  ", want: []string{}},

		// --- single quotes ---
		{name: "single quoted", in: `'abc'`, want: []string{"abc"}},
		{name: "single quoted spaces literal", in: `'a b c'`, want: []string{"a b c"}},
		{name: "single quoted empty", in: `''`, want: []string{""}},
		{name: "single quoted empty among words", in: `a '' b`, want: []string{"a", "", "b"}},
		{name: "single quotes preserve backslash", in: `'a\b'`, want: []string{`a\b`}},
		{name: "single quotes preserve newline", in: "'a\nb'", want: []string{"a\nb"}},
		{name: "single quote spec closing after backslash", in: `'a\'`, want: []string{`a\`}},

		// --- double quotes ---
		{name: "double quoted", in: `"abc"`, want: []string{"abc"}},
		{name: "double quoted spaces literal", in: `"a b c"`, want: []string{"a b c"}},
		{name: "double quoted empty", in: `""`, want: []string{""}},
		{name: "single quote inside double", in: `"it's"`, want: []string{"it's"}},
		{name: "hash inside double quotes", in: `"#"`, want: []string{"#"}},
		{name: "single quote via double", in: `"'"`, want: []string{"'"}},
		{name: "double quote backslash dollar", in: `"a\$b"`, want: []string{"a$b"}},
		{name: "double quote backslash n keeps backslash", in: `"a\nb"`, want: []string{`a\nb`}},
		{name: "double quote escaped quote", in: `"\""`, want: []string{`"`}},
		{name: "double quote escaped backslash", in: `"\\"`, want: []string{`\`}},
		{name: "double quote escaped backtick", in: "\"\\`\"", want: []string{"`"}},
		{name: "double quote backslash before other char keeps backslash", in: `"a\qb"`, want: []string{`a\qb`}},

		// --- double quote inside single quote ---
		{name: "double quote inside single", in: `'"'`, want: []string{`"`}},

		// --- concatenation of adjacent segments ---
		{name: "adjacent empty quotes one empty word", in: `""''`, want: []string{""}},
		{name: "concat dq sq unquoted", in: `a"b"'c'd`, want: []string{"abcd"}},
		{name: "concat space inside quotes", in: `a"b c"d`, want: []string{"ab cd"}},
		{name: "empty dq mid word", in: `a""b`, want: []string{"ab"}},
		{name: "dq then sq concat", in: `"a"'b'`, want: []string{"ab"}},
		{name: "concat prefix quoted suffix", in: `pre"fix"post`, want: []string{"prefixpost"}},
		{name: "three empty quoted words", in: `'' "" ''`, want: []string{"", "", ""}},

		// --- unquoted backslash ---
		{name: "backslash escapes space", in: `a\ b`, want: []string{"a b"}},
		{name: "lone escaped space", in: `\ `, want: []string{" "}},
		{name: "escaped hash unquoted literal", in: `\#foo`, want: []string{"#foo"}},
		{name: "escaped single quote unquoted", in: `\'`, want: []string{"'"}},
		{name: "escaped double quote unquoted", in: `\"`, want: []string{`"`}},
		{name: "two backslashes unquoted", in: `\\`, want: []string{`\`}},
		{name: "unquoted backslash n is literal n", in: `a\nb`, want: []string{"anb"}},

		// --- dollar sign is never expanded ---
		{name: "dollar literal unquoted no expansion", in: `$HOME`, want: []string{"$HOME"}},
		{name: "dollar literal in double quotes", in: `"$HOME"`, want: []string{"$HOME"}},
		{name: "dollar literal in single quotes", in: `'$HOME'`, want: []string{"$HOME"}},

		// --- comments ---
		{name: "hash mid word not comment", in: `a#b`, want: []string{"a#b"}},
		{name: "hash after space is comment", in: `a #b`, want: []string{"a"}},
		{name: "hash after tab is comment", in: "a\t# x", want: []string{"a"}},
		{name: "comment at start", in: `#leading`, want: []string{}},
		{name: "trailing comment after words", in: `echo hello # a comment`, want: []string{"echo", "hello"}},
		{name: "hash attached then space", in: `echo a# b`, want: []string{"echo", "a#", "b"}},
		{name: "quoted hash concat char", in: `'#'x`, want: []string{"#x"}},
		{name: "leading spaces then comment", in: `   # hi`, want: []string{}},
		{name: "comment line in middle", in: "one\n# comment\ntwo", want: []string{"one", "two"}},

		// --- newlines as separators ---
		{name: "words across newlines", in: "a b\nc d", want: []string{"a", "b", "c", "d"}},

		// --- line continuation (backslash-newline removed) ---
		{name: "line continuation joins words", in: "a\\\nb", want: []string{"ab"}},
		{name: "line continuation at end", in: "a\\\n", want: []string{"a"}},
		{name: "line continuation after space no join", in: "a \\\nb", want: []string{"a", "b"}},
		{name: "line continuation inside double quotes", in: "\"a\\\nb\"", want: []string{"ab"}},

		// --- carriage return is an ordinary character, not whitespace ---
		{name: "carriage return is literal", in: "a\rb", want: []string{"a\rb"}},

		// --- realistic composite ---
		{name: "realistic mixed", in: `echo "hello world" 'single' bare`, want: []string{"echo", "hello world", "single", "bare"}},

		// --- error cases (only err != nil is asserted) ---
		{name: "unterminated single quote", in: `'abc`, wantErr: true},
		{name: "unterminated single quote mid", in: `abc'def`, wantErr: true},
		{name: "unterminated double quote", in: `"abc`, wantErr: true},
		{name: "unterminated double quote mid", in: `abc"def`, wantErr: true},
		{name: "trailing backslash", in: `abc\`, wantErr: true},
		{name: "lone backslash", in: `\`, wantErr: true},
		{name: "backslash then eof in double quote", in: "\"a\\", wantErr: true},
		{name: "reopened single quote unterminated", in: `'\''`, wantErr: true},
		{name: "apostrophe opens unterminated quote", in: `it's`, wantErr: true},
	}

	for _, c := range cases {
		c := c
		t.Run(c.name, func(t *testing.T) {
			got, err := Split(c.in)
			if c.wantErr {
				if err == nil {
					t.Fatalf("Split(%q) = %#v, nil; want error", c.in, got)
				}
				return
			}
			if err != nil {
				t.Fatalf("Split(%q) returned unexpected error: %v", c.in, err)
			}
			if !reflect.DeepEqual(got, c.want) {
				t.Fatalf("Split(%q) = %#v, want %#v", c.in, got, c.want)
			}
		})
	}
}
