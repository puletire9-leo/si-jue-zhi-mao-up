package clients

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"strings"
	"time"

	"keyword-research-ms-go/internal/cache"
)

type SearchResult struct {
	ASIN     string `json:"asin"`
	Title    string `json:"title"`
	URLImage string `json:"url_image"`
	Pos      int    `json:"pos"`
}

type OxylabsClient struct {
	UseMock        bool
	APIURL         string
	Username       string
	Password       string
	HTTP           *http.Client
	Semaphore      *cache.Semaphore
	SemaphoreWait  time.Duration
}

func NewOxylabsClient(
	useMock bool,
	apiURL, username, password string,
	sem *cache.Semaphore,
	httpTimeout time.Duration,
	semaphoreWait time.Duration,
) *OxylabsClient {
	if httpTimeout <= 0 {
		httpTimeout = 45 * time.Second
	}
	if semaphoreWait <= 0 {
		semaphoreWait = 3 * time.Minute
	}
	return &OxylabsClient{
		UseMock:       useMock,
		APIURL:        apiURL,
		Username:      username,
		Password:      password,
		HTTP:          &http.Client{Timeout: httpTimeout},
		Semaphore:     sem,
		SemaphoreWait: semaphoreWait,
	}
}

func (c *OxylabsClient) SearchAmazon(ctx context.Context, keyword, marketplace string, pages int) ([]SearchResult, error) {
	if c.UseMock {
		return c.mock(keyword), nil
	}
	if strings.TrimSpace(c.Username) == "" || strings.TrimSpace(c.Password) == "" {
		return nil, wrapExternal(ErrUnauthorized, "oxylabs", "missing credentials", nil)
	}
	if c.Semaphore != nil {
		waitCtx := ctx
		if c.SemaphoreWait > 0 {
			var cancel context.CancelFunc
			waitCtx, cancel = context.WithTimeout(ctx, c.SemaphoreWait)
			defer cancel()
		}
		release, err := c.Semaphore.Acquire(waitCtx)
		if err != nil {
			return nil, wrapExternal(ErrTimeout, "oxylabs", "semaphore acquire timeout", err)
		}
		defer release()
	}
	payload := map[string]any{
		"source": "amazon_search",
		"query":  keyword,
		"parse":  true,
		"pages":  pages,
		"domain": domainByMarketplace(marketplace),
	}
	raw, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.APIURL, bytes.NewReader(raw))
	if err != nil {
		return nil, err
	}
	req.SetBasicAuth(c.Username, c.Password)
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.HTTP.Do(req)
	if err != nil {
		if errors.Is(err, io.EOF) {
			return nil, wrapExternal(ErrBadResponse, "oxylabs", "unexpected EOF", err)
		}
		return nil, wrapExternal(ErrTimeout, "oxylabs", "request failed", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return nil, wrapExternal(ErrUnauthorized, "oxylabs", fmt.Sprintf("http status %d", resp.StatusCode), nil)
	}
	if resp.StatusCode == http.StatusTooManyRequests {
		return nil, wrapExternal(ErrRateLimited, "oxylabs", "http 429", nil)
	}
	if resp.StatusCode >= 500 {
		return nil, wrapExternal(ErrTimeout, "oxylabs", fmt.Sprintf("server status %d", resp.StatusCode), nil)
	}
	if resp.StatusCode >= 400 {
		return nil, wrapExternal(ErrBadResponse, "oxylabs", fmt.Sprintf("http status %d", resp.StatusCode), nil)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, wrapExternal(ErrBadResponse, "oxylabs", "read body failed", err)
	}
	results, err := parseOxylabsSearchResults(body)
	if err != nil {
		return nil, err
	}
	return results, nil
}

func (c *OxylabsClient) mock(keyword string) []SearchResult {
	rnd := rand.New(rand.NewSource(int64(len(keyword) * 97)))
	out := make([]SearchResult, 0, 20)
	for i := 0; i < 20; i++ {
		out = append(out, SearchResult{
			ASIN:     fmt.Sprintf("MOCKASIN%03d", i),
			Title:    fmt.Sprintf("%s premium bundle set %d", keyword, i),
			URLImage: fmt.Sprintf("https://m.media-amazon.com/images/I/mock_%s_%d._SL500_.jpg", keyword, i),
			Pos:      i + 1 + rnd.Intn(2),
		})
	}
	return out
}

func parseOxylabsSearchResults(body []byte) ([]SearchResult, error) {
	var parsed struct {
		Results []struct {
			Content map[string]any `json:"content"`
		} `json:"results"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, wrapExternal(ErrBadResponse, "oxylabs", "decode json failed", err)
	}
	if len(parsed.Results) == 0 {
		return nil, wrapExternal(ErrNoSearchResult, "oxylabs", "empty results", nil)
	}
	content := parsed.Results[0].Content
	blocksRaw, ok := content["results"].(map[string]any)
	if !ok {
		return nil, wrapExternal(ErrBadResponse, "oxylabs", "missing content.results map", nil)
	}
	out := make([]SearchResult, 0, 32)
	for _, blockVal := range blocksRaw {
		items, ok := blockVal.([]any)
		if !ok {
			continue
		}
		for idx, item := range items {
			row, ok := item.(map[string]any)
			if !ok {
				continue
			}
			asin, _ := row["asin"].(string)
			title, _ := row["title"].(string)
			imageURL := firstImageURL(row)
			if asin == "" && title == "" && imageURL == "" {
				continue
			}
			out = append(out, SearchResult{
				ASIN:     asin,
				Title:    title,
				URLImage: imageURL,
				Pos:      idx + 1,
			})
		}
	}
	if len(out) == 0 {
		return nil, wrapExternal(ErrNoSearchResult, "oxylabs", "no organic items extracted", nil)
	}
	return out, nil
}

// ParseOxylabsSearchResultsForTest exposes parser for blackbox tests.
func ParseOxylabsSearchResultsForTest(body []byte) ([]SearchResult, error) {
	return parseOxylabsSearchResults(body)
}

func firstImageURL(row map[string]any) string {
	if images, ok := row["images"].([]any); ok && len(images) > 0 {
		if s, ok := images[0].(string); ok {
			return s
		}
	}
	if urlImage, ok := row["url_image"].(string); ok {
		return urlImage
	}
	if image, ok := row["image"].(string); ok {
		return image
	}
	if imageURL, ok := row["image_url"].(string); ok {
		return imageURL
	}
	return ""
}

func domainByMarketplace(marketplace string) string {
	switch strings.TrimSpace(marketplace) {
	case "美国", "US", "us":
		return "com"
	case "英国", "UK", "uk":
		return "co.uk"
	case "德国", "DE", "de":
		return "de"
	case "法国", "FR", "fr":
		return "fr"
	case "意大利", "IT", "it":
		return "it"
	case "西班牙", "ES", "es":
		return "es"
	case "日本", "JP", "jp":
		return "co.jp"
	case "加拿大", "CA", "ca":
		return "ca"
	default:
		return "com"
	}
}

