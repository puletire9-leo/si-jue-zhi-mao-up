package tests

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"

	miniredis "github.com/alicebob/miniredis/v2"
	"github.com/hibiken/asynq"
	"github.com/joho/godotenv"
	"github.com/redis/go-redis/v9"

	"keyword-research-ms-go/internal/api"
	"keyword-research-ms-go/internal/cache"
	"keyword-research-ms-go/internal/clients"
	"keyword-research-ms-go/internal/metrics"
	"keyword-research-ms-go/internal/models"
	"keyword-research-ms-go/internal/pipeline"
	"keyword-research-ms-go/internal/queue"
	"keyword-research-ms-go/internal/store"
)

func TestSubmitTaskAndWaitForResult(t *testing.T) {
	loadEnvForTests(t)
	t.Log("step 1/7: start miniredis")
	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("start miniredis failed: %v", err)
	}
	defer mr.Close()

	t.Log("step 2/7: init sqlite store and dependencies")
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "keyword_research_test.db")
	st, err := store.New(dbPath)
	if err != nil {
		t.Fatalf("init store failed: %v", err)
	}

	redisOpt := asynq.RedisClientOpt{Addr: mr.Addr(), DB: 0}
	asynqClient := asynq.NewClient(redisOpt)
	defer asynqClient.Close()

	redisClient := redis.NewClient(&redis.Options{Addr: mr.Addr(), DB: 0})
	cacheStore := cache.New(redisClient)
	metric := metrics.New()
	useMock := false
	oxyAPIURL := getenvDefault("OXYLABS_API_URL", "https://realtime.oxylabs.io/v1/queries")
	oxyUsername := strings.TrimSpace(os.Getenv("OXYLABS_USERNAME"))
	oxyPassword := strings.TrimSpace(os.Getenv("OXYLABS_PASSWORD"))
	imageAK := strings.TrimSpace(os.Getenv("IMAGESEARCH_ACCESS_KEY_ID"))
	imageSK := strings.TrimSpace(os.Getenv("IMAGESEARCH_ACCESS_KEY_SECRET"))
	imageEndpoint := getenvDefault("IMAGESEARCH_ENDPOINT", "imagesearch.cn-shenzhen.aliyuncs.com")
	imageRegion := getenvDefault("IMAGESEARCH_REGION_ID", "cn-shenzhen")
	imageInstance := strings.TrimSpace(os.Getenv("IMAGESEARCH_INSTANCE_NAME"))
	imageTimeoutMs := 10000
	imageMaxRetry := 2
	if oxyUsername == "" || oxyPassword == "" || imageAK == "" || imageSK == "" || imageInstance == "" {
		t.Fatalf("live test requires credentials: OXYLABS_USERNAME/OXYLABS_PASSWORD/IMAGESEARCH_ACCESS_KEY_ID/IMAGESEARCH_ACCESS_KEY_SECRET/IMAGESEARCH_INSTANCE_NAME")
	}
	oxy := clients.NewOxylabsClient(useMock, oxyAPIURL, oxyUsername, oxyPassword, nil, 0, 0)
	img := clients.NewImageSearchClient(useMock, 20, imageAK, imageSK, imageEndpoint, imageRegion, imageInstance, imageTimeoutMs, imageMaxRetry)
	orch := pipeline.NewOrchestrator(oxy, img, cacheStore, metric)

	handler := &queue.WorkerHandler{
		Store:        st,
		Orchestrator: orch,
	}

	t.Log("step 3/7: start asynq worker server")
	asynqSrv := asynq.NewServer(redisOpt, asynq.Config{
		Concurrency: 4,
		Queues:      map[string]int{"keyword_research": 1},
	})
	mux := asynq.NewServeMux()
	mux.HandleFunc(queue.TaskTypeKeywordResearch, handler.ProcessTask)
	go func() {
		if runErr := asynqSrv.Run(mux); runErr != nil {
			t.Logf("asynq server stopped: %v", runErr)
		}
	}()
	defer asynqSrv.Shutdown()

	t.Log("step 4/7: start httptest api server")
	defaults := models.ResearchOptions{
		TopNPerMarket:       30,
		Score2Threshold:     2,
		MaxImagesPerKeyword: 8,
		KeywordConcurrency:  6,
		ImageConcurrency:    3,
	}
	srv := api.NewServer(st, asynqClient, defaults)
	httpServer := httptest.NewServer(srv.Router())
	defer httpServer.Close()

	t.Log("step 5/7: load fixture json")
	fixturePath := filepath.Join("fixtures", "task_b0fvg1fk4t_uk.json")
	raw, err := os.ReadFile(fixturePath)
	if err != nil {
		t.Fatalf("read fixture failed: %v", err)
	}
	t.Log("step 6/7: run first task")
	first := runTaskAndWait(t, httpServer.URL, raw, "first")
	t.Log("step 7/7: run second task (should hit cache)")
	second := runTaskAndWait(t, httpServer.URL, raw, "second")

	firstHits := readCacheHit(first.CacheStats)
	secondHits := readCacheHit(second.CacheStats)
	t.Logf("cache hit compare first=%d second=%d", firstHits, secondHits)
	if secondHits < firstHits {
		t.Fatalf("expected second run cache hits >= first run cache hits")
	}

	<-time.After(150 * time.Millisecond)
}

func runTaskAndWait(t *testing.T, baseURL string, raw []byte, tag string) models.TaskResultView {
	t.Helper()
	createResp, err := http.Post(baseURL+"/v1/tasks/keyword-research", "application/json", bytes.NewReader(raw))
	if err != nil {
		t.Fatalf("[%s] submit task failed: %v", tag, err)
	}
	defer createResp.Body.Close()
	if createResp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(createResp.Body)
		t.Fatalf("[%s] submit task bad status=%d body=%s", tag, createResp.StatusCode, string(body))
	}
	var created models.TaskStateView
	if err := json.NewDecoder(createResp.Body).Decode(&created); err != nil {
		t.Fatalf("[%s] decode create response failed: %v", tag, err)
	}
	t.Logf("[%s] task submitted: %s status=%s", tag, created.TaskID, created.Status)

	deadline := time.Now().Add(600 * time.Second)
	nextProgressLogAt := time.Now()
	var finalState models.TaskStateView
	for time.Now().Before(deadline) {
		resp, getErr := http.Get(baseURL + "/v1/tasks/" + created.TaskID)
		if getErr != nil {
			t.Fatalf("[%s] poll task status failed: %v", tag, getErr)
		}
		var state models.TaskStateView
		if decodeErr := json.NewDecoder(resp.Body).Decode(&state); decodeErr != nil {
			_ = resp.Body.Close()
			t.Fatalf("[%s] decode state failed: %v", tag, decodeErr)
		}
		_ = resp.Body.Close()
		if time.Now().After(nextProgressLogAt) {
			logTaskProgress(t, tag, "poll-30s", state)
			nextProgressLogAt = time.Now().Add(30 * time.Second)
		}
		finalState = state
		if state.Status == models.TaskFinished || state.Status == models.TaskFailed {
			break
		}
		time.Sleep(30 * time.Second)
	}
	if finalState.Status != models.TaskFinished {
		errMsg := "<nil>"
		if finalState.ErrorMessage != nil {
			errMsg = *finalState.ErrorMessage
		}
		t.Fatalf("[%s] task not finished, final status=%s err=%s", tag, finalState.Status, errMsg)
	}
	logTaskProgress(t, tag, "final", finalState)

	resultResp, err := http.Get(baseURL + "/v1/tasks/" + created.TaskID + "/results")
	if err != nil {
		t.Fatalf("[%s] get results failed: %v", tag, err)
	}
	defer resultResp.Body.Close()
	if resultResp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resultResp.Body)
		t.Fatalf("[%s] results bad status=%d body=%s", tag, resultResp.StatusCode, string(body))
	}
	var result models.TaskResultView
	if err := json.NewDecoder(resultResp.Body).Decode(&result); err != nil {
		t.Fatalf("[%s] decode result failed: %v", tag, err)
	}
	t.Logf("[%s] result rows=%d timings=%v cache=%v", tag, len(result.Results), result.TimingBreakdown, result.CacheStats)
	if len(result.Results) == 0 {
		t.Fatalf("[%s] expected non-empty results", tag)
	}
	if result.Task.Status != models.TaskFinished {
		t.Fatalf("[%s] expected finished task status in results, got %s", tag, result.Task.Status)
	}
	return result
}

func logTaskProgress(t *testing.T, tag, phase string, state models.TaskStateView) {
	t.Helper()
	p := state.Progress
	t.Logf(
		"[%s][%s] status=%s keywords=%d/%d failed=%d keyword_err=%.2f%% images_total=%d cache_hit=%d cache_miss=%d cache_hit_rate=%.2f%% api_called=%d api_ok=%d api_err=%d api_err_rate=%.2f%%",
		tag,
		phase,
		state.Status,
		p.KeywordsDone,
		p.KeywordsTotal,
		p.KeywordsFailed,
		p.KeywordErrorRate*100,
		p.ImagesTotal,
		p.ImagesCacheHit,
		p.ImagesCacheMiss,
		p.ImageCacheHitRate*100,
		p.ImagesAPICalled,
		p.ImagesAPISuccess,
		p.ImagesAPIError,
		p.ImageAPIErrorRate*100,
	)
}

func readCacheHit(stats map[string]int) int {
	if stats == nil {
		return 0
	}
	return stats["hit"]
}

func getenvDefault(key, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}

func loadEnvForTests(t *testing.T) {
	t.Helper()
	candidates := make([]string, 0, 8)
	addIfExists := func(p string) {
		if p == "" {
			return
		}
		if _, err := os.Stat(p); err == nil {
			candidates = append(candidates, p)
		}
	}
	if cwd, err := os.Getwd(); err == nil {
		addIfExists(filepath.Join(cwd, ".env"))
		addIfExists(filepath.Join(cwd, "..", ".env"))
	}
	_, currentFile, _, ok := runtime.Caller(0)
	if !ok {
		if len(candidates) > 0 {
			_ = godotenv.Overload(candidates...)
		}
		return
	}
	testsDir := filepath.Dir(currentFile)
	addIfExists(filepath.Join(testsDir, ".env"))
	addIfExists(filepath.Join(testsDir, "..", ".env"))
	addIfExists(".env")
	addIfExists("../.env")
	if len(candidates) > 0 {
		_ = godotenv.Overload(candidates...)
	}
}

