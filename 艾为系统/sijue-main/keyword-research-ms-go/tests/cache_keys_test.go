package tests

import (
	"testing"

	"keyword-research-ms-go/internal/cache"
)

func TestNormalizeImageURL(t *testing.T) {
	raw := "https://m.media-amazon.com/images/I/abc_AC_US40_SL500_.jpg?foo=1"
	out := cache.NormalizeImageURL(raw)
	if out == raw {
		t.Fatalf("expected normalized url differs")
	}
}

func TestPairKeyStableOrder(t *testing.T) {
	k1 := cache.PairResultKey("US", "B", "A", "v1", "v1", "v1", "v1")
	k2 := cache.PairResultKey("US", "A", "B", "v1", "v1", "v1", "v1")
	if k1 != k2 {
		t.Fatalf("pair key should be symmetric")
	}
}

