// Package balancedparens reports whether brackets in a string are balanced.
//
// This implementation is BUGGY: it only counts openers vs. closers and never
// checks that a closer matches the most recent opener, so "(]" is wrongly
// accepted and a leading closer like ")(" is mishandled. Fix IsBalanced.
package balancedparens

// IsBalanced reports whether the brackets (), [], {} in s are correctly nested.
func IsBalanced(s string) bool {
	depth := 0
	for _, r := range s {
		switch r {
		case '(', '[', '{':
			depth++
		case ')', ']', '}':
			depth-- // BUG: ignores which bracket type, and can go negative mid-string
		}
	}
	return depth == 0
}
