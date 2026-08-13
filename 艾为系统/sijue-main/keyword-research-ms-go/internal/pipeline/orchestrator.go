package pipeline

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"keyword-research-ms-go/internal/cache"
	"keyword-research-ms-go/internal/clients"
	"keyword-research-ms-go/internal/krlog"
	"keyword-research-ms-go/internal/metrics"
	"keyword-research-ms-go/internal/models"
)

type Orchestrator struct {
	oxylabs *clients.OxylabsClient
	image   *clients.ImageSearchClient
	cache   *cache.Store
	metrics *metrics.Collector
}

type ProgressReporter func(models.TaskProgressView)

type ProgressTracker struct {
	mu sync.Mutex
	p  models.TaskProgressView
}

func NewProgressTracker(totalKeywords int) *ProgressTracker {
	return &ProgressTracker{
		p: models.TaskProgressView{
			KeywordsTotal: totalKeywords,
		},
	}
}

func (t *ProgressTracker) Snapshot() models.TaskProgressView {
	t.mu.Lock()
	defer t.mu.Unlock()
	return t.p
}

func (t *ProgressTracker) addKeywordDone(failed bool) models.TaskProgressView {
	t.mu.Lock()
	t.p.KeywordsDone++
	if failed {
		t.p.KeywordsFailed++
	}
	t.recomputeLocked()
	out := t.p
	t.mu.Unlock()
	return out
}

func (t *ProgressTracker) addImage(cacheHit bool, apiCalled bool, apiSuccess bool, apiError bool) models.TaskProgressView {
	t.mu.Lock()
	t.p.ImagesTotal++
	if cacheHit {
		t.p.ImagesCacheHit++
	} else {
		t.p.ImagesCacheMiss++
	}
	if apiCalled {
		t.p.ImagesAPICalled++
	}
	if apiSuccess {
		t.p.ImagesAPISuccess++
	}
	if apiError {
		t.p.ImagesAPIError++
	}
	t.recomputeLocked()
	out := t.p
	t.mu.Unlock()
	return out
}

func (t *ProgressTracker) recomputeLocked() {
	t.p.KeywordErrorRate = ratioPrecise(t.p.KeywordsFailed, t.p.KeywordsTotal)
	t.p.ImageCacheHitRate = ratioPrecise(t.p.ImagesCacheHit, t.p.ImagesTotal)
	t.p.ImageAPIErrorRate = ratioPrecise(t.p.ImagesAPIError, t.p.ImagesAPICalled)
}

type score1Task struct {
	key         string
	marketplace string
	targetKey   string
	imageURL    string
}

type score1Result struct {
	score    float64
	cacheHit bool
	err      error
}

type score1Scheduler struct {
	ctx       context.Context
	cache     *cache.Store
	image     *clients.ImageSearchClient
	batchSize int
	timeout   time.Duration

	queue chan score1Task
	mu    sync.Mutex
	// key -> waiters
	pending map[string][]chan score1Result
	progress *ProgressTracker
	reporter ProgressReporter
}

func newScore1Scheduler(ctx context.Context, cacheStore *cache.Store, imageClient *clients.ImageSearchClient, batchSize int, timeout time.Duration, progress *ProgressTracker, reporter ProgressReporter) *score1Scheduler {
	if batchSize <= 0 {
		batchSize = 10
	}
	if timeout <= 0 {
		timeout = 10 * time.Second
	}
	s := &score1Scheduler{
		ctx:       ctx,
		cache:     cacheStore,
		image:     imageClient,
		batchSize: batchSize,
		timeout:   timeout,
		queue:     make(chan score1Task, 4096),
		pending:   make(map[string][]chan score1Result),
		progress:  progress,
		reporter:  reporter,
	}
	go s.run()
	return s
}

func (s *score1Scheduler) submit(ctx context.Context, marketplace, targetKey, imageURL string) (float64, bool, error) {
	key := cache.Score1Key(marketplace, targetKey, imageURL, "v1")
	var cached struct{ Score float64 `json:"score"` }
	if s.cache.GetJSON(ctx, key, &cached) {
		if s.progress != nil {
			snap := s.progress.addImage(true, false, false, false)
			if s.reporter != nil {
				s.reporter(snap)
			}
		}
		return cached.Score, true, nil
	}

	waiter := make(chan score1Result, 1)
	task := score1Task{
		key:         key,
		marketplace: marketplace,
		targetKey:   targetKey,
		imageURL:    imageURL,
	}

	s.mu.Lock()
	if list, ok := s.pending[key]; ok {
		s.pending[key] = append(list, waiter)
		s.mu.Unlock()
	} else {
		s.pending[key] = []chan score1Result{waiter}
		s.mu.Unlock()
		select {
		case <-ctx.Done():
			s.failAndFlush(task.key, ctx.Err())
			return 0, false, ctx.Err()
		case s.queue <- task:
		}
	}

	select {
	case <-ctx.Done():
		return 0, false, ctx.Err()
	case res := <-waiter:
		return res.score, res.cacheHit, res.err
	}
}

func (s *score1Scheduler) run() {
	for {
		select {
		case <-s.ctx.Done():
			return
		case first := <-s.queue:
			batch := make([]score1Task, 0, s.batchSize)
			batch = append(batch, first)
		drain:
			for len(batch) < s.batchSize {
				select {
				case task := <-s.queue:
					batch = append(batch, task)
				default:
					break drain
				}
			}
			s.processBatch(batch)
		}
	}
}

func (s *score1Scheduler) processBatch(batch []score1Task) {
	var wg sync.WaitGroup
	wg.Add(len(batch))
	for _, task := range batch {
		task := task
		go func() {
			defer wg.Done()
			reqCtx, cancel := context.WithTimeout(s.ctx, s.timeout)
			score, err := s.image.Similarity(reqCtx, task.imageURL, task.targetKey)
			cancel()
			if err != nil {
				if s.progress != nil {
					snap := s.progress.addImage(false, true, false, true)
					if s.reporter != nil {
						s.reporter(snap)
					}
				}
				s.flush(task.key, score1Result{score: 0, cacheHit: false, err: err})
				return
			}
			if s.progress != nil {
				snap := s.progress.addImage(false, true, true, false)
				if s.reporter != nil {
					s.reporter(snap)
				}
			}
			s.cache.SetJSON(s.ctx, task.key, map[string]float64{"score": score}, 7*24*time.Hour)
			s.flush(task.key, score1Result{score: score, cacheHit: false, err: nil})
		}()
	}
	wg.Wait()
}

func (s *score1Scheduler) failAndFlush(key string, err error) {
	s.flush(key, score1Result{score: 0, cacheHit: false, err: err})
}

func (s *score1Scheduler) flush(key string, res score1Result) {
	s.mu.Lock()
	waiters := s.pending[key]
	delete(s.pending, key)
	s.mu.Unlock()
	for _, ch := range waiters {
		ch <- res
		close(ch)
	}
}

type Output struct {
	Results          []models.KeywordResultView
	ProcessedKeywords int
	FailedKeywords   int
	TimingBreakdown  map[string]float64
	CacheStats       map[string]int
	Progress         models.TaskProgressView
}

func NewOrchestrator(o *clients.OxylabsClient, i *clients.ImageSearchClient, c *cache.Store, m *metrics.Collector) *Orchestrator {
	return &Orchestrator{oxylabs: o, image: i, cache: c, metrics: m}
}

func (o *Orchestrator) Run(ctx context.Context, taskID string, req models.TaskRequest, reporter ProgressReporter) (Output, error) {
	progress := NewProgressTracker(len(selectTopKeywords(req.Keywords, req.Options.TopNPerMarket)))
	scheduler := newScore1Scheduler(ctx, o.cache, o.image, 10, 10*time.Second, progress, reporter)
	referenceKeywords := BuildReferenceKeywords(req.ReferenceTitles)
	selected := selectTopKeywords(req.Keywords, req.Options.TopNPerMarket)
	results := make([]models.KeywordResultView, 0, len(selected))
	var failed int
	var mu sync.Mutex

	sem := make(chan struct{}, req.Options.KeywordConcurrency)
	var wg sync.WaitGroup
	for _, kw := range selected {
		wg.Add(1)
		sem <- struct{}{}
		go func(item models.KeywordInput) {
			defer wg.Done()
			defer func() { <-sem }()
			res, err := o.processKeyword(ctx, req, item, referenceKeywords, scheduler)
			if err != nil {
				krlog.Errorf(
					"task=%s stage=keyword marketplace=%s target=%s keyword=%q err=%v",
					taskID,
					req.Marketplace,
					req.TargetKey,
					item.Value,
					err,
				)
				mu.Lock(); failed++; mu.Unlock()
				if reporter != nil {
					reporter(progress.addKeywordDone(true))
				}
				return
			}
			mu.Lock()
			results = append(results, res)
			mu.Unlock()
			if reporter != nil {
				reporter(progress.addKeywordDone(false))
			}
		}(kw)
	}
	wg.Wait()

	if failed > 0 {
		krlog.Errorf(
			"task=%s stage=run_summary marketplace=%s target=%s processed=%d failed=%d total=%d",
			taskID,
			req.Marketplace,
			req.TargetKey,
			len(results),
			failed,
			len(selected),
		)
	}

	results = AssignKeywordTypes(results)
	sort.Slice(results, func(i, j int) bool { return results[i].TotalScore > results[j].TotalScore })
	return Output{
		Results:           results,
		ProcessedKeywords: len(results),
		FailedKeywords:    failed,
		TimingBreakdown:   o.metrics.Timings,
		CacheStats:        o.cache.Stats,
		Progress:          progress.Snapshot(),
	}, nil
}

func (o *Orchestrator) processKeyword(ctx context.Context, req models.TaskRequest, item models.KeywordInput, referenceKeywords []string, scheduler *score1Scheduler) (models.KeywordResultView, error) {
	var searchResults []clients.SearchResult
	var err error
	serpCacheHit := false
	o.metrics.Time("score2_stage", func() {
		searchResults, serpCacheHit, err = o.searchWithCache(ctx, item.Value, req.Marketplace)
	})
	if err != nil {
		return models.KeywordResultView{}, err
	}
	score2 := CalculateMatchScore(searchResults, referenceKeywords)
	score1Raw := 0.0
	imageCacheHitCount := 0
	imageCacheTotal := 0
	imageFailedCount := 0
	imageFailedSamples := make([]string, 0)
	if score2 > req.Options.Score2Threshold {
		o.metrics.Time("score1_stage", func() {
			score1Raw, imageCacheHitCount, imageCacheTotal, imageFailedCount, imageFailedSamples = o.score1(
				ctx,
				req.Marketplace,
				req.TargetKey,
				searchResults,
				0,
				req.Options.ImageConcurrency,
				scheduler,
			)
		})
	}
	now := time.Now().UTC()
	total := score2 + score1Raw*10
	return models.KeywordResultView{
		Keyword:    item.Value,
		Score1:     round2(score1Raw * 10),
		Score2:     score2,
		TotalScore: round2(total),
		ScoreTime:  &now,
		Debug: map[string]interface{}{
			"result_count":           len(searchResults),
			"reference_titles":       len(req.ReferenceTitles),
			"reference_terms":        len(referenceKeywords),
			"traffic_score":          item.TrafficScore,
			"serp_cache_hit":         serpCacheHit,
			"image_cache_hit_count":  imageCacheHitCount,
			"image_cache_total":      imageCacheTotal,
			"image_cache_hit_ratio":  ratio(imageCacheHitCount, imageCacheTotal),
			"image_failed_count":     imageFailedCount,
			"image_failed_samples":   imageFailedSamples,
		},
	}, nil
}

func (o *Orchestrator) searchWithCache(ctx context.Context, keyword, marketplace string) ([]clients.SearchResult, bool, error) {
	const minSERPResults = 15
	const maxRetry = 3
	key := cache.SERPKey(marketplace, keyword, 1)
	var cached []clients.SearchResult
	if o.cache.GetJSON(ctx, key, &cached) {
		if len(cached) >= minSERPResults {
			return cached, true, nil
		}
	}

	var (
		results []clients.SearchResult
		err     error
	)
	for attempt := 1; attempt <= maxRetry; attempt++ {
		results, err = o.oxylabs.SearchAmazon(ctx, keyword, marketplace, 1)
		if err != nil {
			return nil, false, err
		}
		if len(results) >= minSERPResults {
			break
		}
		if attempt < maxRetry {
			select {
			case <-ctx.Done():
				return nil, false, ctx.Err()
			case <-time.After(300 * time.Millisecond):
			}
		}
	}
	o.cache.SetJSON(ctx, key, results, 12*time.Hour)
	return results, false, nil
}

func (o *Orchestrator) score1(
	ctx context.Context,
	marketplace, targetKey string,
	results []clients.SearchResult,
	maxImages, imgConcurrency int,
	scheduler *score1Scheduler,
) (float64, int, int, int, []string) {
	urls := make([]string, 0, len(results))
	for _, r := range results {
		url := r.URLImage
		if url == "" || !strings.Contains(url, "m.media-amazon.com") || strings.Contains(strings.ToLower(url), ".gif") {
			continue
		}
		urls = append(urls, url)
		if maxImages > 0 && len(urls) >= maxImages {
			break
		}
	}
	if len(urls) == 0 {
		return 0, 0, 0, 0, nil
	}
	sem := make(chan struct{}, imgConcurrency)
	var wg sync.WaitGroup
	var mu sync.Mutex
	scores := make([]float64, 0, len(urls))
	cacheHits := 0
	failedCount := 0
	failedSamples := make([]string, 0, 10)
	for _, u := range urls {
		wg.Add(1)
		sem <- struct{}{}
		go func(imageURL string) {
			defer wg.Done()
			defer func() { <-sem }()
			score, cacheHit, err := scheduler.submit(ctx, marketplace, targetKey, imageURL)
			mu.Lock()
			if err != nil {
				failedCount++
				if len(failedSamples) < 10 {
					failedSamples = append(failedSamples, fmt.Sprintf("image=%s err=%v", imageURL, err))
				}
				mu.Unlock()
				return
			}
			scores = append(scores, score)
			if cacheHit {
				cacheHits++
			}
			mu.Unlock()
		}(u)
	}
	wg.Wait()
	if len(scores) == 0 {
		return 0, cacheHits, len(urls), failedCount, failedSamples
	}
	total := 0.0
	for _, score := range scores {
		total += score
	}
	return total / float64(len(scores)), cacheHits, len(urls), failedCount, failedSamples
}

func (o *Orchestrator) similarityWithCache(ctx context.Context, marketplace, targetKey, imageURL string) (float64, bool, error) {
	key := cache.Score1Key(marketplace, targetKey, imageURL, "v1")
	var cached struct{ Score float64 `json:"score"` }
	if o.cache.GetJSON(ctx, key, &cached) {
		return cached.Score, true, nil
	}
	score, err := o.image.Similarity(ctx, imageURL, targetKey)
	if err != nil {
		return 0, false, err
	}
	o.cache.SetJSON(ctx, key, map[string]float64{"score": score}, 7*24*time.Hour)
	return score, false, nil
}

func selectTopKeywords(items []models.KeywordInput, topN int) []models.KeywordInput {
	copied := make([]models.KeywordInput, len(items))
	copy(copied, items)
	sort.Slice(copied, func(i, j int) bool {
		return copied[i].TrafficScore > copied[j].TrafficScore
	})
	if topN > 0 && len(copied) > topN {
		return copied[:topN]
	}
	return copied
}

func round2(v float64) float64 {
	return float64(int(v*100+0.5)) / 100
}

func ratio(hit, total int) float64 {
	if total <= 0 {
		return 0
	}
	return round2(float64(hit) / float64(total))
}

func ratioPrecise(hit, total int) float64 {
	if total <= 0 {
		return 0
	}
	return float64(hit) / float64(total)
}

