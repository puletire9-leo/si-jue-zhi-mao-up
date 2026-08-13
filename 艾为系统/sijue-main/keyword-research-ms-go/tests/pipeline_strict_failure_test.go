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

func TestPipelineFailsWhenExternalFails(t *testing.T) {
	oxy := clients.NewOxylabsClient(false, "https://realtime.oxylabs.io/v1/queries", "", "", nil, 0, 0)
	img := clients.NewImageSearchClient(false, 10, "", "", "", "", "", 10000, 1)
	cacheStore := cache.New(nil)
	m := metrics.New()
	orch := pipeline.NewOrchestrator(oxy, img, cacheStore, m)

	req := models.TaskRequest{
		TargetKey:        "B00TEST001",
		Marketplace:      "美国",
		ReferenceTitles:  []string{"Wireless Earbuds Bluetooth Headphones"},
		Keywords:         []models.KeywordInput{{Value: "wireless earbuds", TrafficScore: 0.91}},
		Options:          models.ResearchOptions{TopNPerMarket: 30, Score2Threshold: 2, MaxImagesPerKeyword: 8, KeywordConcurrency: 1, ImageConcurrency: 1},
	}

	out, err := orch.Run(context.Background(), "", req, nil)
	if err != nil {
		t.Fatalf("unexpected run error: %v", err)
	}
	if out.FailedKeywords == 0 || out.ProcessedKeywords > 0 {
		t.Fatalf("expected all keywords to fail when credentials missing, got processed=%d failed=%d",
			out.ProcessedKeywords, out.FailedKeywords)
	}
}
