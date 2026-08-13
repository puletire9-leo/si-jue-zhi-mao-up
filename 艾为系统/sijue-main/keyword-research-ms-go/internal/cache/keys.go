package cache

import (
	"fmt"
	"net/url"
	"regexp"
	"strings"
)

var amazonSizeTokenRe = regexp.MustCompile(`_[A-Z]{2}_[A-Z]{2}\d+_SL\d+_`)

// NormalizeImageURL strips query/fragment and Amazon resize tokens for stable cache keys.
func NormalizeImageURL(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return raw
	}
	u, err := url.Parse(raw)
	if err != nil {
		return raw
	}
	u.RawQuery = ""
	u.Fragment = ""
	path := amazonSizeTokenRe.ReplaceAllString(u.Path, "_")
	if path != u.Path {
		u.Path = path
	}
	out := u.String()
	if out == raw && strings.Contains(raw, "?") {
		return strings.Split(raw, "?")[0]
	}
	return out
}

func normKeyword(keyword string) string {
	return strings.ToLower(strings.TrimSpace(keyword))
}

func normMarket(marketplace string) string {
	return strings.ToLower(strings.TrimSpace(marketplace))
}

// SERPKey caches Oxylabs SERP pages: oxysrp:{market}:{keywordNorm}:{page}
func SERPKey(marketplace, keyword string, page int) string {
	return fmt.Sprintf("oxysrp:%s:%s:%d", normMarket(marketplace), normKeyword(keyword), page)
}

// Score1Key caches image similarity scores: imgsim:{market}:{targetKey}:{imgFingerprint}:{version}
func Score1Key(marketplace, targetKey, imageURL, version string) string {
	return fmt.Sprintf(
		"imgsim:%s:%s:%s:%s",
		normMarket(marketplace),
		strings.TrimSpace(targetKey),
		NormalizeImageURL(imageURL),
		strings.TrimSpace(version),
	)
}

// PairResultKey builds a symmetric cache key for pairwise image comparisons.
func PairResultKey(market string, a, b string, versions ...string) string {
	x := strings.TrimSpace(a)
	y := strings.TrimSpace(b)
	if x > y {
		x, y = y, x
	}
	ver := strings.Join(versions, ":")
	return fmt.Sprintf("pair:%s:%s:%s:%s", normMarket(market), x, y, ver)
}
