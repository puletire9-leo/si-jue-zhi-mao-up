package pipeline

import (
	"math"
	"regexp"
	"sort"
	"strings"
	"time"

	"keyword-research-ms-go/internal/clients"
	"keyword-research-ms-go/internal/models"
)

func ProcessTitleToKeywords(title string) []string {
	if title == "" {
		return []string{}
	}
	clean := strings.NewReplacer(",", "", "&", "", ".", "", "\"", "", "|", "").Replace(title)
	words := strings.Fields(clean)
	if len(words) > 7 {
		words = words[1:]
		return words[:6]
	}
	return words
}

func BuildReferenceKeywords(titles []string) []string {
	dedup := map[string]bool{}
	merged := make([]string, 0)
	for _, title := range titles {
		for _, kw := range ProcessTitleToKeywords(title) {
			norm := strings.ToLower(strings.TrimSpace(kw))
			if norm == "" || dedup[norm] {
				continue
			}
			dedup[norm] = true
			merged = append(merged, norm)
		}
	}
	return merged
}

func CalculateMatchScore(results []clients.SearchResult, candidateKeywords []string) float64 {
	resultCount := len(results)
	if resultCount > 30 {
		resultCount = 30
	}
	if resultCount == 0 || len(candidateKeywords) == 0 {
		return 0
	}
	norm := make([]string, 0, len(candidateKeywords))
	for _, kw := range candidateKeywords {
		kw = strings.ToLower(strings.TrimSpace(kw))
		if kw != "" {
			norm = append(norm, kw)
		}
	}
	total := 0.0
	for i := 0; i < resultCount; i++ {
		title := strings.ToLower(results[i].Title)
		hit := 0
		for _, kw := range norm {
			reg := regexp.MustCompile(`(\b` + regexp.QuoteMeta(kw) + `\b|` + regexp.QuoteMeta(kw) + `[a-z])`)
			if reg.MatchString(title) {
				hit++
			}
		}
		itemScore := math.Min(float64(hit)*1.66, 10)
		total += itemScore
	}
	avg := total / float64(resultCount)
	return math.Round(avg*100) / 100
}

func AssignKeywordTypes(items []models.KeywordResultView) []models.KeywordResultView {
	valid := make([]models.KeywordResultView, 0)
	for _, item := range items {
		if item.Score2 >= 2 {
			valid = append(valid, item)
		}
	}
	sort.Slice(valid, func(i, j int) bool { return valid[i].TotalScore > valid[j].TotalScore })
	high := make([]models.KeywordResultView, 0)
	for _, v := range valid {
		if v.Score1 >= 6.8 {
			high = append(high, v)
		}
	}

	selected := map[string]bool{}
	if len(high) == 0 {
		for i := range valid {
			if i >= 30 {
				break
			}
			setType(&valid[i], i)
			selected[valid[i].Keyword] = true
		}
	} else {
		for i := range high {
			setType(&high[i], i)
			selected[high[i].Keyword] = true
		}
	}
	now := time.Now().UTC()
	for i := range items {
		if !selected[items[i].Keyword] {
			items[i].KeywordType = nil
		}
		items[i].ScoreTime = &now
	}
	return items
}

func setType(item *models.KeywordResultView, index int) {
	val := "long_tail"
	if index == 0 {
		val = "core_major"
	} else if index <= 2 {
		val = "core"
	}
	item.KeywordType = &val
}

