package tests

import (
	"testing"

	"keyword-research-ms-go/internal/clients"
)

func TestParseOxylabsUrlImageField(t *testing.T) {
	raw := []byte(`{
		"results": [
			{
				"content": {
					"results": {
						"organic": [
							{
								"asin": "B09BMRM6J9",
								"title": "sample title",
								"url_image": "https://m.media-amazon.com/images/I/519iXP1TLeL._AC_UL320_.jpg",
								"pos": 1
							}
						]
					}
				}
			}
		]
	}`)
	out, err := clients.ParseOxylabsSearchResultsForTest(raw)
	if err != nil {
		t.Fatalf("parse failed: %v", err)
	}
	if len(out) != 1 {
		t.Fatalf("expected 1 row, got %d", len(out))
	}
	if out[0].URLImage == "" {
		t.Fatalf("expected URLImage from url_image field")
	}
}
