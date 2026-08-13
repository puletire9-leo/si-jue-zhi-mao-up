package main

import (
	"log"
	"time"

	"keyword-research-ms-go/internal/cache"
	"keyword-research-ms-go/internal/clients"
	"keyword-research-ms-go/internal/config"
	"keyword-research-ms-go/internal/metrics"
	"keyword-research-ms-go/internal/pipeline"
	"keyword-research-ms-go/internal/queue"
	"keyword-research-ms-go/internal/store"

	"github.com/hibiken/asynq"
	"github.com/redis/go-redis/v9"
)

func main() {
	cfg := config.Load()
	st, err := store.New(cfg.DatabasePath)
	if err != nil {
		log.Fatalf("init store failed: %v", err)
	}
	redisClient := redis.NewClient(&redis.Options{
		Addr:     cfg.RedisAddr,
		Password: cfg.RedisPassword,
		DB:       cfg.RedisDB,
	})
	cacheStore := cache.New(redisClient)
	metric := metrics.New()
	oxySem := cache.NewSemaphore(
		redisClient,
		"krgo:oxylabs:serp:slot",
		cfg.OxylabsMaxConcurrent,
		time.Duration(cfg.OxylabsSemaphoreSlotTTL)*time.Second,
	)
	oxy := clients.NewOxylabsClient(
		cfg.UseMockExternals,
		cfg.OxylabsAPIURL,
		cfg.OxylabsUsername,
		cfg.OxylabsPassword,
		oxySem,
		time.Duration(cfg.OxylabsTimeoutMs)*time.Millisecond,
		time.Duration(cfg.OxylabsSemaphoreWaitMs)*time.Millisecond,
	)
	img := clients.NewImageSearchClient(
		cfg.UseMockExternals,
		cfg.ImageRateLimitPerSec,
		cfg.ImageSearchAccessKeyID,
		cfg.ImageSearchAccessKeySecret,
		cfg.ImageSearchEndpoint,
		cfg.ImageSearchRegionID,
		cfg.ImageSearchInstanceName,
		cfg.ImageSearchTimeoutMs,
		cfg.ImageSearchMaxRetries,
	)
	orch := pipeline.NewOrchestrator(oxy, img, cacheStore, metric)

	handler := &queue.WorkerHandler{
		Store:        st,
		Orchestrator: orch,
	}

	server := asynq.NewServer(
		asynq.RedisClientOpt{Addr: cfg.RedisAddr, Password: cfg.RedisPassword, DB: cfg.RedisDB},
		asynq.Config{Concurrency: cfg.KeywordConcurrency, Queues: map[string]int{"keyword_research": 1}},
	)
	mux := asynq.NewServeMux()
	mux.HandleFunc(queue.TaskTypeKeywordResearch, handler.ProcessTask)
	if err := server.Run(mux); err != nil {
		log.Fatalf("worker failed: %v", err)
	}
}

