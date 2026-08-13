package main

import (
	"context"
	"fmt"
	"math/rand"
	"time"

	"keyword-research-ms-go/internal/cache"
	"keyword-research-ms-go/internal/clients"
	"keyword-research-ms-go/internal/metrics"
	"keyword-research-ms-go/internal/models"
	"keyword-research-ms-go/internal/pipeline"
)

func buildRequest(count int) models.TaskRequest {
	keywords := make([]models.KeywordInput, 0, count)
	for i := 0; i < count; i++ {
		keywords = append(keywords, models.KeywordInput{
			Value:        fmt.Sprintf("mock keyword %d", i),
			TrafficScore: float64(count-i) / float64(count),
		})
	}
	return models.TaskRequest{
		TargetKey:       "B00BENCH001",
		Marketplace:     "美国",
		ReferenceTitles: []string{"Premium wireless earbuds charging case", "Sports earphones waterproof"},
		Keywords:        keywords,
		Options: models.ResearchOptions{
			TopNPerMarket:       30,
			Score2Threshold:     2,
			MaxImagesPerKeyword: 8,
			KeywordConcurrency:  6,
			ImageConcurrency:    3,
		},
	}
}

func main() {
	req := buildRequest(30)
	ctx := context.Background()

	newOrchestrator := func() *pipeline.Orchestrator {
		oxy := clients.NewOxylabsClient(true, "", "", "", nil, 0, 0)
		img := clients.NewImageSearchClient(true, 10, "", "", "", "", "", 10000, 1)
		c := cache.New(nil)
		m := metrics.New()
		return pipeline.NewOrchestrator(oxy, img, c, m)
	}

	cold := make([]float64, 0, 3)
	for i := 0; i < 3; i++ {
		orchestrator := newOrchestrator()
		start := time.Now()
		_, _ = orchestrator.Run(ctx, "", req, nil)
		cold = append(cold, float64(time.Since(start).Milliseconds()))
	}

	warmOrchestrator := newOrchestrator()
	warm := make([]float64, 0, 5)
	for i := 0; i < 5; i++ {
		start := time.Now()
		_, _ = warmOrchestrator.Run(ctx, "", req, nil)
		warm = append(warm, float64(time.Since(start).Milliseconds()))
	}

	coldAvg := avg(cold)
	warmAvg := avg(warm)
	fmt.Println("=== Benchmark Compare Report (Go) ===")
	fmt.Printf("Cold avg ms: %.2f\n", coldAvg)
	fmt.Printf("Warm avg ms: %.2f\n", warmAvg)
	fmt.Printf("Warm p50 ms: %.2f\n", p50(warm))
	if coldAvg > 0 {
		fmt.Printf("Cache improvement ratio: %.2f%%\n", (coldAvg-warmAvg)/coldAvg*100)
	}
}

func avg(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	sum := 0.0
	for _, v := range values {
		sum += v
	}
	return sum / float64(len(values))
}

func p50(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	cp := make([]float64, len(values))
	copy(cp, values)
	for i := range cp {
		for j := i + 1; j < len(cp); j++ {
			if cp[j] < cp[i] {
				cp[i], cp[j] = cp[j], cp[i]
			}
		}
	}
	return cp[len(cp)/2]
}

func init() {
	rand.Seed(time.Now().UnixNano())
}

