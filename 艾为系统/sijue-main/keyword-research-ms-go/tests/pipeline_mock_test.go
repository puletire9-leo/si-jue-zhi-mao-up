package tests

import (
	"context"
	"testing"

	"keyword-research-ms-go/internal/cache"
	"keyword-research-ms-go/internal/clients"
	"keyword-research-ms-go/internal/metrics"
	"keyword-research-ms-go/internal/models"
	"keyword-research-ms-go/internal/pipeline"
)

func TestPipelineRunsWithMocks(t *testing.T) {
	oxy := clients.NewOxylabsClient(true, "", "", "", nil, 0, 0)
	img := clients.NewImageSearchClient(true, 10, "", "", "", "", "", 10000, 1)
	cacheStore := cache.New(nil)
	m := metrics.New()
	orch := pipeline.NewOrchestrator(oxy, img, cacheStore, m)

	req := models.TaskRequest{
		TargetKey:   "B00TEST001",
		Marketplace: "美国",
		ReferenceTitles: []string{
			"Wireless Earbuds Bluetooth Headphones",
			"Sports Earphones Waterproof",
		},
		Keywords: []models.KeywordInput{
			{Value: "wireless earbuds", TrafficScore: 0.91},
			{Value: "sports earphones", TrafficScore: 0.88},
		},
		Options: models.ResearchOptions{
			TopNPerMarket:       30,
			Score2Threshold:     2,
			MaxImagesPerKeyword: 8,
			KeywordConcurrency:  4,
			ImageConcurrency:    2,
		},
	}

	out, err := orch.Run(context.Background(), "", req, nil)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if out.ProcessedKeywords != 2 {
		t.Fatalf("expected 2 processed keywords, got %d", out.ProcessedKeywords)
	}
	if len(out.Results) != 2 {
		t.Fatalf("expected 2 results, got %d", len(out.Results))
	}
}

