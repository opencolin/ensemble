// Package stack provides a simple generic LIFO stack.
//
// This implementation is correct and complete. The task is to write tests for
// it (stack_test.go) reaching >= 90% statement coverage. Do not modify it.
package stack

// Stack is a last-in, first-out collection of T.
type Stack[T any] struct {
	items []T
}

// Push adds v to the top of the stack.
func (s *Stack[T]) Push(v T) {
	s.items = append(s.items, v)
}

// Pop removes and returns the top item. ok is false if the stack is empty,
// in which case the zero value of T is returned.
func (s *Stack[T]) Pop() (value T, ok bool) {
	if len(s.items) == 0 {
		var zero T
		return zero, false
	}
	last := len(s.items) - 1
	v := s.items[last]
	s.items = s.items[:last]
	return v, true
}

// Peek returns the top item without removing it. ok is false if empty.
func (s *Stack[T]) Peek() (value T, ok bool) {
	if len(s.items) == 0 {
		var zero T
		return zero, false
	}
	return s.items[len(s.items)-1], true
}

// Len returns the number of items in the stack.
func (s *Stack[T]) Len() int {
	return len(s.items)
}

// IsEmpty reports whether the stack has no items.
func (s *Stack[T]) IsEmpty() bool {
	return len(s.items) == 0
}
