package clients

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"hash/fnv"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	openapi "github.com/alibabacloud-go/darabonba-openapi/v2/client"
	imagesearch "github.com/alibabacloud-go/imagesearch-20201214/v4/client"
	teautil "github.com/alibabacloud-go/tea-utils/v2/service"
)

type RateLimiter struct {
	tokens chan struct{}
	stop   chan struct{}
	once   sync.Once
}

func NewRateLimiter(perSecond int) *RateLimiter {
	if perSecond <= 0 {
		perSecond = 1
	}
	rl := &RateLimiter{
		tokens: make(chan struct{}, perSecond),
		stop:   make(chan struct{}),
	}
	tick := time.NewTicker(time.Second / time.Duration(perSecond))
	go func() {
		for {
			select {
			case <-tick.C:
				select {
				case rl.tokens <- struct{}{}:
				default:
				}
			case <-rl.stop:
				tick.Stop()
				return
			}
		}
	}()
	return rl
}

func (r *RateLimiter) Acquire(ctx context.Context) bool {
	select {
	case <-ctx.Done():
		return false
	case <-r.tokens:
		return true
	}
}

func (r *RateLimiter) Close() {
	r.once.Do(func() { close(r.stop) })
}

type ImageSearchClient struct {
	UseMock        bool
	rl             *RateLimiter
	http           *http.Client
	client         *imagesearch.Client
	runtime        *teautil.RuntimeOptions
	instanceName   string
	requestTimeout time.Duration
}

func NewImageSearchClient(
	useMock bool,
	rateLimit int,
	accessKeyID string,
	accessKeySecret string,
	endpoint string,
	regionID string,
	instanceName string,
	requestTimeoutMs int,
	maxRetries int,
) *ImageSearchClient {
	if requestTimeoutMs <= 0 {
		requestTimeoutMs = 10000
	}
	runtime := &teautil.RuntimeOptions{
		ReadTimeout:    intPtr(requestTimeoutMs),
		ConnectTimeout: intPtr(requestTimeoutMs),
	}
	if maxRetries > 0 {
		runtime.Autoretry = boolPtr(true)
		runtime.MaxAttempts = intPtr(maxRetries)
	}
	c := &ImageSearchClient{
		UseMock:        useMock,
		rl:             NewRateLimiter(rateLimit),
		http:           &http.Client{Timeout: time.Duration(requestTimeoutMs) * time.Millisecond},
		instanceName:   strings.TrimSpace(instanceName),
		requestTimeout: time.Duration(requestTimeoutMs) * time.Millisecond,
		runtime:        runtime,
	}
	if !useMock {
		cfg := &openapi.Config{
			AccessKeyId:     stringPtr(accessKeyID),
			AccessKeySecret: stringPtr(accessKeySecret),
			Endpoint:        stringPtr(endpoint),
			RegionId:        stringPtr(regionID),
			Protocol:        stringPtr("HTTPS"),
		}
		client, err := imagesearch.NewClient(cfg)
		if err == nil {
			c.client = client
		}
	}
	return c
}

func (c *ImageSearchClient) Similarity(ctx context.Context, queryImageURL, targetKey string) (float64, error) {
	if ok := c.rl.Acquire(ctx); !ok {
		return 0, wrapExternal(ErrTimeout, "imagesearch", "rate limiter acquire canceled", ctx.Err())
	}
	if c.UseMock {
		h := fnv.New32a()
		_, _ = h.Write([]byte(queryImageURL + "|" + targetKey))
		n := h.Sum32()%6500 + 3000
		return float64(n) / 10000.0, nil
	}
	if c.client == nil {
		return 0, wrapExternal(ErrBadResponse, "imagesearch", "client not initialized", nil)
	}
	if c.instanceName == "" {
		return 0, wrapExternal(ErrBadResponse, "imagesearch", "missing instance name", nil)
	}
	var lastErr error
	maxAttempts := 3
	for attempt := 1; attempt <= maxAttempts; attempt++ {
		score, err := c.similarityOnce(ctx, queryImageURL, targetKey)
		if err == nil {
			return score, nil
		}
		lastErr = err
		// no-result is a valid business outcome; don't retry further.
		if errors.Is(err, ErrNoSearchResult) {
			return 0, nil
		}
		if attempt >= maxAttempts {
			break
		}
		wait := time.Duration(attempt*300) * time.Millisecond
		select {
		case <-ctx.Done():
			return 0, wrapExternal(ErrTimeout, "imagesearch", "retry interrupted by context", ctx.Err())
		case <-time.After(wait):
		}
	}
	return 0, lastErr
}

func (c *ImageSearchClient) similarityOnce(ctx context.Context, queryImageURL, targetKey string) (float64, error) {
	imgBytes, err := c.fetchImage(ctx, queryImageURL)
	if err != nil {
		return 0, err
	}
	req := &imagesearch.SearchImageByPicAdvanceRequest{
		InstanceName:     stringPtr(c.instanceName),
		PicContentObject: bytes.NewReader(imgBytes),
		Crop:             boolPtr(false),
		CategoryId:       int32Ptr(88888888),
		Num:              int32Ptr(100),
		Filter:           stringPtr(fmt.Sprintf("str_attr='%s'", escapeSingleQuote(targetKey))),
	}
	resp, err := c.client.SearchImageByPicAdvance(req, c.runtime)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "thrott") {
			return 0, wrapExternal(ErrRateLimited, "imagesearch", "throttled", err)
		}
		if strings.Contains(strings.ToLower(err.Error()), "forbidden") || strings.Contains(strings.ToLower(err.Error()), "unauthorized") {
			return 0, wrapExternal(ErrUnauthorized, "imagesearch", "auth failed", err)
		}
		return 0, wrapExternal(ErrBadResponse, "imagesearch", "request failed", err)
	}
	if resp == nil || resp.Body == nil {
		return 0, wrapExternal(ErrBadResponse, "imagesearch", "empty response body", nil)
	}
	body := resp.Body
	if body.Code != nil && *body.Code != 0 {
		msg := "api business error"
		if body.Msg != nil {
			msg = *body.Msg
		}
		return 0, wrapExternal(ErrBadResponse, "imagesearch", msg, nil)
	}
	auctions := body.Auctions
	if len(auctions) == 0 {
		return 0, wrapExternal(ErrNoSearchResult, "imagesearch", "empty auctions", nil)
	}
	for _, item := range auctions {
		if item == nil {
			continue
		}
		if item.StrAttr != nil && *item.StrAttr == targetKey {
			return clampScore(item.Score), nil
		}
		if item.ProductId != nil && *item.ProductId == targetKey {
			return clampScore(item.Score), nil
		}
	}
	return 0, nil
}

func (c *ImageSearchClient) fetchImage(ctx context.Context, url string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, wrapExternal(ErrBadResponse, "imagesearch", "build image request failed", err)
	}
	resp, err := c.http.Do(req)
	if err != nil {
		if errors.Is(err, context.DeadlineExceeded) || strings.Contains(strings.ToLower(err.Error()), "timeout") {
			return nil, wrapExternal(ErrTimeout, "imagesearch", "download timeout", err)
		}
		return nil, wrapExternal(ErrBadResponse, "imagesearch", "download failed", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return nil, wrapExternal(ErrBadResponse, "imagesearch", fmt.Sprintf("download status %d", resp.StatusCode), nil)
	}
	contentType := strings.ToLower(resp.Header.Get("Content-Type"))
	if contentType != "" && !strings.HasPrefix(contentType, "image/") {
		return nil, wrapExternal(ErrBadResponse, "imagesearch", "downloaded content is not image", nil)
	}
	buf, err := io.ReadAll(io.LimitReader(resp.Body, 4*1024*1024+1))
	if err != nil {
		return nil, wrapExternal(ErrBadResponse, "imagesearch", "read image bytes failed", err)
	}
	if len(buf) == 0 {
		return nil, wrapExternal(ErrBadResponse, "imagesearch", "empty image body", nil)
	}
	if len(buf) > 4*1024*1024 {
		return nil, wrapExternal(ErrBadResponse, "imagesearch", "image too large (>4MB)", nil)
	}
	return buf, nil
}

func clampScore(v *float32) float64 {
	if v == nil {
		return 0
	}
	score := float64(*v)
	if score < 0 {
		return 0
	}
	if score > 1 {
		return 1
	}
	return score
}

func stringPtr(v string) *string { return &v }
func boolPtr(v bool) *bool       { return &v }
func intPtr(v int) *int          { return &v }
func int32Ptr(v int32) *int32    { return &v }

func escapeSingleQuote(v string) string {
	return strings.ReplaceAll(v, "'", "\\'")
}

