package main

import (
	"log"

	"keyword-research-ms-go/internal/api"
	"keyword-research-ms-go/internal/config"
	"keyword-research-ms-go/internal/models"
	"keyword-research-ms-go/internal/store"

	"github.com/hibiken/asynq"
)

func main() {
	cfg := config.Load()
	st, err := store.New(cfg.DatabasePath)
	if err != nil {
		log.Fatalf("init store failed: %v", err)
	}
	asynqClient := asynq.NewClient(asynq.RedisClientOpt{
		Addr:     cfg.RedisAddr,
		Password: cfg.RedisPassword,
		DB:       cfg.RedisDB,
	})
	defer asynqClient.Close()

	defaults := models.ResearchOptions{
		TopNPerMarket:       cfg.TopNPerMarket,
		Score2Threshold:     cfg.Score2Threshold,
		MaxImagesPerKeyword: cfg.MaxImagesPerKeyword,
		KeywordConcurrency:  cfg.KeywordConcurrency,
		ImageConcurrency:    cfg.ImageConcurrency,
	}
	s := api.NewServer(st, asynqClient, defaults)
	if err := s.Router().Run(":" + cfg.AppPort); err != nil {
		log.Fatalf("run api failed: %v", err)
	}
}

