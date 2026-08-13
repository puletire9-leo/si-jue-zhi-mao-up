package store

import (
	"encoding/json"
	"errors"
	"time"

	"keyword-research-ms-go/internal/models"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

type Store struct {
	DB *gorm.DB
}

func New(dbPath string) (*Store, error) {
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		return nil, err
	}
	if err := db.AutoMigrate(&models.ResearchTask{}, &models.KeywordResult{}); err != nil {
		return nil, err
	}
	return &Store{DB: db}, nil
}

func (s *Store) CreateTask(taskID string, req models.TaskRequest) error {
	payload, _ := json.Marshal(req)
	now := time.Now().UTC()
	totalKeywords := len(req.Keywords)
	if req.Options.TopNPerMarket > 0 && req.Options.TopNPerMarket < totalKeywords {
		totalKeywords = req.Options.TopNPerMarket
	}
	row := models.ResearchTask{
		ID:            taskID,
		Status:        string(models.TaskQueued),
		TargetKey:     req.TargetKey,
		Marketplace:   req.Marketplace,
		PayloadJSON:   string(payload),
		TotalKeywords: totalKeywords,
		CreatedAt:     now,
		UpdatedAt:     now,
		ProgressJSON:  string(mustJSON(models.TaskProgressView{KeywordsTotal: totalKeywords})),
	}
	return s.DB.Create(&row).Error
}

func mustJSON(v any) []byte {
	raw, _ := json.Marshal(v)
	return raw
}

func (s *Store) UpdateTaskStatus(taskID string, status models.TaskStatus, errMsg *string) error {
	updates := map[string]interface{}{
		"status":     string(status),
		"updated_at": time.Now().UTC(),
	}
	now := time.Now().UTC()
	if status == models.TaskRunning {
		updates["started_at"] = now
	}
	if status == models.TaskFinished || status == models.TaskFailed {
		updates["finished_at"] = now
	}
	if errMsg != nil {
		updates["error_message"] = *errMsg
	}
	return s.DB.Model(&models.ResearchTask{}).Where("id = ?", taskID).Updates(updates).Error
}

func (s *Store) UpdateTaskStats(taskID string, processed, failed int, timing map[string]float64, cacheStats map[string]int, progress models.TaskProgressView) error {
	tj, _ := json.Marshal(timing)
	cj, _ := json.Marshal(cacheStats)
	pj, _ := json.Marshal(progress)
	return s.DB.Model(&models.ResearchTask{}).Where("id = ?", taskID).Updates(map[string]interface{}{
		"processed_keywords": processed,
		"failed_keywords":    failed,
		"timing_json":        string(tj),
		"cache_stats_json":   string(cj),
		"progress_json":      string(pj),
		"updated_at":         time.Now().UTC(),
	}).Error
}

func (s *Store) UpdateTaskProgress(taskID string, progress models.TaskProgressView) error {
	pj, _ := json.Marshal(progress)
	return s.DB.Model(&models.ResearchTask{}).Where("id = ?", taskID).Updates(map[string]interface{}{
		"processed_keywords": progress.KeywordsDone,
		"failed_keywords":    progress.KeywordsFailed,
		"progress_json":      string(pj),
		"updated_at":         time.Now().UTC(),
	}).Error
}

func (s *Store) ReplaceResults(taskID string, rows []models.KeywordResultView) error {
	return s.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("task_id = ?", taskID).Delete(&models.KeywordResult{}).Error; err != nil {
			return err
		}
		for _, row := range rows {
			dj, _ := json.Marshal(row.Debug)
			entity := models.KeywordResult{
				TaskID:      taskID,
				Keyword:     row.Keyword,
				Score1:      row.Score1,
				Score2:      row.Score2,
				TotalScore:  row.TotalScore,
				KeywordType: row.KeywordType,
				ScoreTime:   row.ScoreTime,
				DebugJSON:   string(dj),
				CreatedAt:   time.Now().UTC(),
			}
			if err := tx.Create(&entity).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func (s *Store) GetTask(taskID string) (*models.TaskStateView, error) {
	var row models.ResearchTask
	if err := s.DB.First(&row, "id = ?", taskID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	view := &models.TaskStateView{
		TaskID:            row.ID,
		Status:            models.TaskStatus(row.Status),
		TargetKey:         row.TargetKey,
		Marketplace:       row.Marketplace,
		TotalKeywords:     row.TotalKeywords,
		ProcessedKeywords: row.ProcessedKeywords,
		FailedKeywords:    row.FailedKeywords,
		ErrorMessage:      row.ErrorMessage,
		StartedAt:         row.StartedAt,
		FinishedAt:        row.FinishedAt,
		CreatedAt:         row.CreatedAt,
		UpdatedAt:         row.UpdatedAt,
	}
	_ = json.Unmarshal([]byte(row.ProgressJSON), &view.Progress)
	return view, nil
}

func (s *Store) GetTaskPayload(taskID string) (*models.TaskRequest, error) {
	var row models.ResearchTask
	if err := s.DB.First(&row, "id = ?", taskID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	var req models.TaskRequest
	if err := json.Unmarshal([]byte(row.PayloadJSON), &req); err != nil {
		return nil, err
	}
	return &req, nil
}

func (s *Store) GetTaskResult(taskID string) (*models.TaskResultView, error) {
	task, err := s.GetTask(taskID)
	if err != nil || task == nil {
		return nil, err
	}
	var rows []models.KeywordResult
	if err := s.DB.Order("total_score desc").Find(&rows, "task_id = ?", taskID).Error; err != nil {
		return nil, err
	}
	results := make([]models.KeywordResultView, 0, len(rows))
	for _, row := range rows {
		debug := map[string]interface{}{}
		_ = json.Unmarshal([]byte(row.DebugJSON), &debug)
		results = append(results, models.KeywordResultView{
			Keyword:    row.Keyword,
			Score1:     row.Score1,
			Score2:     row.Score2,
			TotalScore: row.TotalScore,
			KeywordType: row.KeywordType,
			ScoreTime:  row.ScoreTime,
			Debug:      debug,
		})
	}
	timing := map[string]float64{}
	cacheStats := map[string]int{}
	var rt models.ResearchTask
	if err := s.DB.First(&rt, "id = ?", taskID).Error; err == nil {
		_ = json.Unmarshal([]byte(rt.TimingJSON), &timing)
		_ = json.Unmarshal([]byte(rt.CacheStatsJSON), &cacheStats)
	}
	return &models.TaskResultView{
		Task:            *task,
		Results:         results,
		TimingBreakdown: timing,
		CacheStats:      cacheStats,
	}, nil
}

