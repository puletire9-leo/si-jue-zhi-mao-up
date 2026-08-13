package models

import "time"

type ResearchTask struct {
	ID                string  `gorm:"primaryKey;size:64"`
	Status            string  `gorm:"size:16;index"`
	TargetKey         string  `gorm:"size:128;index"`
	Marketplace       string  `gorm:"size:32;index"`
	PayloadJSON       string  `gorm:"type:text"`
	TotalKeywords     int
	ProcessedKeywords int
	FailedKeywords    int
	TimingJSON        string `gorm:"type:text"`
	CacheStatsJSON    string `gorm:"type:text"`
	ProgressJSON      string `gorm:"type:text"`
	ErrorMessage      *string `gorm:"type:text"`
	StartedAt         *time.Time
	FinishedAt        *time.Time
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

type KeywordResult struct {
	ID         uint      `gorm:"primaryKey"`
	TaskID     string    `gorm:"size:64;index"`
	Keyword    string    `gorm:"size:512;index"`
	Score1     float64
	Score2     float64
	TotalScore float64   `gorm:"index"`
	KeywordType *string  `gorm:"size:32"`
	ScoreTime  *time.Time
	DebugJSON  string    `gorm:"type:text"`
	CreatedAt  time.Time
}

