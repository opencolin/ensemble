// Acceptance test for IsBalanced. Do not modify.
package balancedparens

import "testing"

func TestIsBalanced(t *testing.T) {
	cases := []struct {
		in   string
		want bool
	}{
		{"", true},
		{"()", true},
		{"()[]{}", true},
		{"([{}])", true},
		{"a(b)c[d]e{f}", true},
		{"(]", false},
		{"([)]", false},
		{"(((", false},
		{")(", false},
		{"{[}", false},
		{"]", false},
		{"((())", false},
	}
	for _, c := range cases {
		if got := IsBalanced(c.in); got != c.want {
			t.Errorf("IsBalanced(%q) = %v, want %v", c.in, got, c.want)
		}
	}
}
