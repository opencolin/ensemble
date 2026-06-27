// Acceptance test for Parse. Do not modify.
package csvparse

import (
	"reflect"
	"testing"
)

func TestParse(t *testing.T) {
	cases := []struct {
		name    string
		in      string
		want    [][]string
		wantErr bool
	}{
		// --- success cases (compared with reflect.DeepEqual) ---
		{
			name: "single field",
			in:   "a",
			want: [][]string{{"a"}},
		},
		{
			name: "single multichar field",
			in:   "hello",
			want: [][]string{{"hello"}},
		},
		{
			name: "simple row",
			in:   "a,b,c",
			want: [][]string{{"a", "b", "c"}},
		},
		{
			name: "two rows lf",
			in:   "a,b\nc,d",
			want: [][]string{{"a", "b"}, {"c", "d"}},
		},
		{
			name: "three rows lf",
			in:   "1\n2\n3",
			want: [][]string{{"1"}, {"2"}, {"3"}},
		},
		{
			name: "crlf rows",
			in:   "a,b\r\nc,d",
			want: [][]string{{"a", "b"}, {"c", "d"}},
		},
		{
			name: "mixed lf and crlf rows",
			in:   "a\r\nb\nc",
			want: [][]string{{"a"}, {"b"}, {"c"}},
		},
		{
			name: "quoted field with comma",
			in:   `"x,y",z`,
			want: [][]string{{"x,y", "z"}},
		},
		{
			name: "quoted field with newline",
			in:   "\"line1\nline2\",z",
			want: [][]string{{"line1\nline2", "z"}},
		},
		{
			name: "quoted field with crlf inside",
			in:   "\"a\r\nb\"",
			want: [][]string{{"a\r\nb"}},
		},
		{
			name: "escaped quote",
			in:   `"he said ""hi"""`,
			want: [][]string{{`he said "hi"`}},
		},
		{
			name: "escaped quote only",
			in:   `""""`,
			want: [][]string{{`"`}},
		},
		{
			name: "empty middle field",
			in:   "a,,c",
			want: [][]string{{"a", "", "c"}},
		},
		{
			name: "leading empty field",
			in:   ",a",
			want: [][]string{{"", "a"}},
		},
		{
			name: "trailing empty field",
			in:   "a,",
			want: [][]string{{"a", ""}},
		},
		{
			name: "all empty fields",
			in:   ",,",
			want: [][]string{{"", "", ""}},
		},
		{
			name: "trailing newline no extra row",
			in:   "a\nb\n",
			want: [][]string{{"a"}, {"b"}},
		},
		{
			name: "trailing crlf no extra row",
			in:   "a\r\nb\r\n",
			want: [][]string{{"a"}, {"b"}},
		},
		{
			name: "empty input zero rows",
			in:   "",
			want: [][]string{},
		},
		{
			name: "quoted empty field",
			in:   `""`,
			want: [][]string{{""}},
		},
		{
			name: "quoted empty among others",
			in:   `a,"",c`,
			want: [][]string{{"a", "", "c"}},
		},
		{
			name: "ragged rows allowed",
			in:   "a,b,c\nd\ne,f",
			want: [][]string{{"a", "b", "c"}, {"d"}, {"e", "f"}},
		},
		{
			name: "unquoted keeps spaces",
			in:   " a , b ",
			want: [][]string{{" a ", " b "}},
		},
		{
			name: "quoted then unquoted",
			in:   `"a",b`,
			want: [][]string{{"a", "b"}},
		},
		{
			name: "row of quoted fields",
			in:   `"a","b","c"`,
			want: [][]string{{"a", "b", "c"}},
		},

		// --- error cases (only err != nil is asserted) ---
		{
			name:    "unterminated quote",
			in:      `"abc`,
			wantErr: true,
		},
		{
			name:    "unterminated quote after escape",
			in:      `"ab""`,
			wantErr: true,
		},
		{
			name:    "stray quote in unquoted field",
			in:      `ab"c`,
			wantErr: true,
		},
		{
			name:    "junk after closing quote",
			in:      `"a"b`,
			wantErr: true,
		},
		{
			name:    "junk after closing quote in row",
			in:      `"a"b,c`,
			wantErr: true,
		},
	}

	for _, c := range cases {
		c := c
		t.Run(c.name, func(t *testing.T) {
			got, err := Parse(c.in)
			if c.wantErr {
				if err == nil {
					t.Fatalf("Parse(%q) = %#v, nil; want error", c.in, got)
				}
				return
			}
			if err != nil {
				t.Fatalf("Parse(%q) returned unexpected error: %v", c.in, err)
			}
			if !reflect.DeepEqual(got, c.want) {
				t.Fatalf("Parse(%q) = %#v, want %#v", c.in, got, c.want)
			}
		})
	}
}
