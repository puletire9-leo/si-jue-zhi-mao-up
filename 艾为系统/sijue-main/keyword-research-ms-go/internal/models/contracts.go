package models

import "time"

type TaskStatus string

const (
	TaskQueued   TaskStatus = "queued"
	TaskRunning  TaskStatus = "running"
	TaskFinished TaskStatus = "finished"
	TaskFailed   TaskStatus = "failed"
)

type KeywordInput struct {
	Value        string  `json:"value"`
	TrafficScore float64 `json:"traffic_score"`
}

type ResearchOptions struct {
	TopNPerMarket       int     `json:"top_n_per_market"`
	Score2Threshold     float64 `json:"score2_threshold"`
	MaxImagesPerKeyword int     `json:"max_images_per_keyword"`
	KeywordConcurrency  int     `json:"keyword_concurrency"`
	ImageConcurrency    int     `json:"image_concurrency"`
}

type TaskRequest struct {
	TargetKey       string         `json:"target_key"`
	Marketplace     string         `json:"marketplace"`
	ReferenceTitles []string       `json:"reference_titles"`
	Keywords        []KeywordInput `json:"keywords"`
	Options         ResearchOptions `json:"options"`
}

type TaskProgressView struct {
	KeywordsTotal     int     `json:"keywords_total"`
	KeywordsDone      int     `json:"keywords_done"`
	KeywordsFailed    int     `json:"keywords_failed"`
	KeywordErrorRate  float64 `json:"keyword_error_rate"`
	ImagesTotal       int     `json:"images_total"`
	ImagesCacheHit    int     `json:"images_cache_hit"`
	ImagesCacheMiss   int     `json:"images_cache_miss"`
	ImagesAPICalled   int     `json:"images_api_called"`
	ImagesAPISuccess  int     `json:"images_api_success"`
	ImagesAPIError    int     `json:"images_api_error"`
	ImageAPIErrorRate float64 `json:"image_api_error_rate"`
	ImageCacheHitRate float64 `json:"image_cache_hit_rate"`
}

type KeywordResultView struct {
	Keyword    string                 `json:"keyword"`
	Score1     float64                `json:"score1"`
	Score2     float64                `json:"score2"`
	TotalScore float64                `json:"total_score"`
	KeywordType *string               `json:"keyword_type"`
	ScoreTime  *time.Time             `json:"score_time"`
	Debug      map[string]interface{} `json:"debug"`
}

type TaskStateView struct {
	TaskID            string     `json:"task_id"`
	Status            TaskStatus `json:"status"`
	TargetKey         string     `json:"target_key"`
	Marketplace       string     `json:"marketplace"`
	TotalKeywords     int        `json:"total_keywords"`
	ProcessedKeywords int        `json:"processed_keywords"`
	FailedKeywords    int        `json:"failed_keywords"`
	ErrorMessage      *string    `json:"error_message"`
	Progress          TaskProgressView `json:"progress"`
	StartedAt         *time.Time `json:"started_at"`
	FinishedAt        *time.Time `json:"finished_at"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
}

type TaskResultView struct {
	Task             TaskStateView        `json:"task"`
	Results          []KeywordResultView  `json:"results"`
	TimingBreakdown  map[string]float64   `json:"timing_breakdown_ms"`
	CacheStats       map[string]int       `json:"cache_stats"`
}

func ApplyDefaultOptions(input ResearchOptions, defaults ResearchOptions) ResearchOptions {
	result := input
	if result.TopNPerMarket <= 0 {
		result.TopNPerMarket = defaults.TopNPerMarket
	}
	if result.Score2Threshold <= 0 {
		result.Score2Threshold = defaults.Score2Threshold
	}
	if result.MaxImagesPerKeyword <= 0 {
		result.MaxImagesPerKeyword = defaults.MaxImagesPerKeyword
	}
	if result.KeywordConcurrency <= 0 {
		result.KeywordConcurrency = defaults.KeywordConcurrency
	}
	if result.ImageConcurrency <= 0 {
		result.ImageConcurrency = defaults.ImageConcurrency
	}
	return result
}

