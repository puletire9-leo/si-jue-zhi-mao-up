package config

import (
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	AppEnv              string
	AppPort             string
	RedisAddr           string
	RedisDB             int
	RedisPassword       string
	DatabasePath        string
	UseMockExternals    bool
	OxylabsAPIURL            string
	OxylabsUsername          string
	OxylabsPassword          string
	OxylabsTimeoutMs         int
	OxylabsMaxConcurrent     int
	OxylabsSemaphoreWaitMs   int
	OxylabsSemaphoreSlotTTL  int
	ImageSearchAccessKeyID     string
	ImageSearchAccessKeySecret string
	ImageSearchEndpoint        string
	ImageSearchRegionID        string
	ImageSearchInstanceName    string
	ImageSearchTimeoutMs       int
	ImageSearchMaxRetries      int
	KeywordConcurrency  int
	ImageConcurrency    int
	TopNPerMarket       int
	Score2Threshold     float64
	MaxImagesPerKeyword int
	ImageRateLimitPerSec int
}

func Load() Config {
	_ = godotenv.Load()
	return Config{
		AppEnv:              get("APP_ENV", "dev"),
		AppPort:             get("APP_PORT", "8092"),
		RedisAddr:           get("REDIS_ADDR", "127.0.0.1:6379"),
		RedisDB:             getInt("REDIS_DB", 14),
		RedisPassword:       get("REDIS_PASSWORD", ""),
		DatabasePath:        get("DATABASE_PATH", "./keyword_research_go.db"),
		UseMockExternals:    getBool("USE_MOCK_EXTERNALS", true),
		OxylabsAPIURL:           get("OXYLABS_API_URL", "https://realtime.oxylabs.io/v1/queries"),
		OxylabsUsername:         get("OXYLABS_USERNAME", ""),
		OxylabsPassword:         get("OXYLABS_PASSWORD", ""),
		OxylabsTimeoutMs:        getInt("OXYLABS_TIMEOUT_MS", 45000),
		OxylabsMaxConcurrent:    getInt("OXYLABS_MAX_CONCURRENT", 4),
		OxylabsSemaphoreWaitMs:  getInt("OXYLABS_SEMAPHORE_WAIT_MS", 180000),
		OxylabsSemaphoreSlotTTL: getInt("OXYLABS_SEMAPHORE_SLOT_TTL_SEC", 180),
		ImageSearchAccessKeyID:     get("IMAGESEARCH_ACCESS_KEY_ID", ""),
		ImageSearchAccessKeySecret: get("IMAGESEARCH_ACCESS_KEY_SECRET", ""),
		ImageSearchEndpoint:        get("IMAGESEARCH_ENDPOINT", "imagesearch.cn-shenzhen.aliyuncs.com"),
		ImageSearchRegionID:        get("IMAGESEARCH_REGION_ID", "cn-shenzhen"),
		ImageSearchInstanceName:    get("IMAGESEARCH_INSTANCE_NAME", ""),
		ImageSearchTimeoutMs:       getInt("IMAGESEARCH_TIMEOUT_MS", 10000),
		ImageSearchMaxRetries:      getInt("IMAGESEARCH_MAX_RETRIES", 2),
		KeywordConcurrency:  getInt("KEYWORD_CONCURRENCY", 6),
		ImageConcurrency:    getInt("IMAGE_CONCURRENCY", 3),
		TopNPerMarket:       getInt("TOP_N_PER_MARKET", 30),
		Score2Threshold:     getFloat("SCORE2_THRESHOLD", 0),
		MaxImagesPerKeyword: getInt("MAX_IMAGES_PER_KEYWORD", 8),
		ImageRateLimitPerSec: getInt("IMAGE_RATE_LIMIT_PER_SEC", 10),
	}
}

func get(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}

func getInt(key string, fallback int) int {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func getFloat(key string, fallback float64) float64 {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	parsed, err := strconv.ParseFloat(value, 64)
	if err != nil {
		return fallback
	}
	return parsed
}

func getBool(key string, fallback bool) bool {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return fallback
	}
	return parsed
}

