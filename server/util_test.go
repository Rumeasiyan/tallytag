package main

import "testing"

func TestNormalizeTag(t *testing.T) {
	for in, want := range map[string]string{
		"TEST-0007":   "TEST-0007",
		" test-0007 ": "TEST-0007",
		"test 0007":   "TEST0007",
		"":            "",
	} {
		if got := normalizeTag(in); got != want {
			t.Errorf("normalizeTag(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestCSVSafe(t *testing.T) {
	for in, want := range map[string]string{"=1+1": "'=1+1", "@x": "'@x", "-5": "'-5", "plain": "plain", "": ""} {
		if got := csvSafe(in); got != want {
			t.Errorf("csvSafe(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestIsUUID(t *testing.T) {
	if !isUUID(newUUID()) {
		t.Error("newUUID should produce a valid UUID")
	}
	if isUUID("not-a-uuid") {
		t.Error("garbage must not pass")
	}
}
