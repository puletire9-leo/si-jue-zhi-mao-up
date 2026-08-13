package tests

import (
	"testing"

	"keyword-research-ms-go/internal/clients"
	"keyword-research-ms-go/internal/pipeline"
)

func TestProcessTitleToKeywords(t *testing.T) {
	kws := pipeline.ProcessTitleToKeywords("Brand, Super Widget & Premium. Pack | Blue Large")
	if len(kws) < 3 {
		t.Fatalf("expected at least 3 keywords, got %d", len(kws))
	}
}

func TestCalculateMatchScore(t *testing.T) {
	results := []clients.SearchResult{
		{Title: "premium widget blue large bundle"},
		{Title: "widget replacement pack"},
	}
	score := pipeline.CalculateMatchScore(results, []string{"widget", "blue"})
	if score <= 0 {
		t.Fatalf("expected score > 0, got %f", score)
	}
}

