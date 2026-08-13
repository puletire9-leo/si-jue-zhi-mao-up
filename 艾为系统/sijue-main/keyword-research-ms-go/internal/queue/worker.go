package queue

import (
	"context"
	"fmt"
	"sync"
	"time"

	"keyword-research-ms-go/internal/krlog"
	"keyword-research-ms-go/internal/models"
	"keyword-research-ms-go/internal/pipeline"
	"keyword-research-ms-go/internal/store"

	"github.com/hibiken/asynq"
)

type WorkerHandler struct {
	Store        *store.Store
	Orchestrator *pipeline.Orchestrator
}

func (h *WorkerHandler) ProcessTask(ctx context.Context, t *asynq.Task) error {
	if t.Type() != TaskTypeKeywordResearch {
		return fmt.Errorf("unsupported task type: %s", t.Type())
	}
	payload, err := UnmarshalTaskPayload(t.Payload())
	if err != nil {
		krlog.Errorf("task=? stage=worker_decode err=%v", err)
		return err
	}
	_ = h.Store.UpdateTaskStatus(payload.TaskID, models.TaskRunning, nil)
	req, err := h.Store.GetTaskPayload(payload.TaskID)
	if err != nil || req == nil {
		msg := "task payload not found"
		krlog.Errorf("task=%s stage=worker_payload err=%v", payload.TaskID, err)
		_ = h.Store.UpdateTaskStatus(payload.TaskID, models.TaskFailed, &msg)
		if err != nil {
			return err
		}
		return fmt.Errorf(msg)
	}
	var progressMu sync.Mutex
	latestProgress := models.TaskProgressView{}
	flushProgress := func() {
		progressMu.Lock()
		snap := latestProgress
		progressMu.Unlock()
		_ = h.Store.UpdateTaskProgress(payload.TaskID, snap)
	}
	progressCh := make(chan models.TaskProgressView, 256)
	reporter := func(p models.TaskProgressView) {
		select {
		case progressCh <- p:
		default:
		}
	}
	done := make(chan struct{})
	go func() {
		ticker := time.NewTicker(1 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case p := <-progressCh:
				progressMu.Lock()
				latestProgress = p
				progressMu.Unlock()
			case <-ticker.C:
				flushProgress()
			case <-done:
				flushProgress()
				return
			case <-ctx.Done():
				flushProgress()
				return
			}
		}
	}()

	out, err := h.Orchestrator.Run(ctx, payload.TaskID, *req, reporter)
	close(done)
	if err != nil {
		msg := err.Error()
		krlog.Errorf("task=%s stage=worker_run err=%v", payload.TaskID, err)
		_ = h.Store.UpdateTaskStatus(payload.TaskID, models.TaskFailed, &msg)
		return err
	}
	if err := h.Store.ReplaceResults(payload.TaskID, out.Results); err != nil {
		msg := err.Error()
		krlog.Errorf("task=%s stage=worker_store_results err=%v", payload.TaskID, err)
		_ = h.Store.UpdateTaskStatus(payload.TaskID, models.TaskFailed, &msg)
		return err
	}
	if out.FailedKeywords > 0 && out.ProcessedKeywords == 0 {
		krlog.Errorf(
			"task=%s stage=worker_empty_result marketplace=%s target=%s failed=%d total=%d",
			payload.TaskID,
			req.Marketplace,
			req.TargetKey,
			out.FailedKeywords,
			out.Progress.KeywordsTotal,
		)
	}
	_ = h.Store.UpdateTaskStats(payload.TaskID, out.ProcessedKeywords, out.FailedKeywords, out.TimingBreakdown, out.CacheStats, out.Progress)
	return h.Store.UpdateTaskStatus(payload.TaskID, models.TaskFinished, nil)
}

