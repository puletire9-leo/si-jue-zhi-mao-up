# Keyword Research Microservice PoC (Go)

Standalone Go implementation using Gin + Asynq + Redis + SQLite.

## Features

- Async task flow: `score2 -> score1(threshold) -> keyword_type`.
- Two-level concurrency: keyword-level + image-level.
- Layered cache:
  - `oxysrp:{market}:{keywordNorm}:{page}`
  - `imgsim:{market}:{targetKey}:{imgFingerprint}:{targetVersion}`
- Batch persistence to SQLite.
- Task APIs for create/query/result/retry.
- Mock external mode enabled by default for local testing; set `USE_MOCK_EXTERNALS=false` for real Oxylabs + Alibaba ImageSearch.

## Run locally

```bash
cd keyword-research-ms-go
cp .env.example .env
go mod tidy
go run ./cmd/api
```

In another terminal:

```bash
cd keyword-research-ms-go
go run ./cmd/worker
```

## External Config (live mode)

When `USE_MOCK_EXTERNALS=false`, configure:

- `OXYLABS_API_URL`, `OXYLABS_USERNAME`, `OXYLABS_PASSWORD`
- `IMAGESEARCH_ACCESS_KEY_ID`, `IMAGESEARCH_ACCESS_KEY_SECRET`
- `IMAGESEARCH_ENDPOINT`, `IMAGESEARCH_REGION_ID`, `IMAGESEARCH_INSTANCE_NAME`
- `IMAGESEARCH_TIMEOUT_MS`, `IMAGESEARCH_MAX_RETRIES`

Runtime behavior is strict-failure: any external dependency error marks task as `failed`.

## APIs

- `POST /v1/tasks/keyword-research`
- `GET /v1/tasks/:taskId`
- `GET /v1/tasks/:taskId/results`
- `POST /v1/tasks/:taskId/retry`
- `GET /healthz`

## Sample payload

```json
{
  "target_key": "B00TEST001",
  "marketplace": "美国",
  "reference_titles": [
    "Wireless Earbuds Bluetooth Headphones",
    "Sports Earphones Waterproof"
  ],
  "keywords": [
    {"value":"wireless earbuds","traffic_score":0.93},
    {"value":"sports earphones","traffic_score":0.89}
  ],
  "options": {
    "top_n_per_market": 30,
    "score2_threshold": 0,
    "max_images_per_keyword": 8,
    "keyword_concurrency": 6,
    "image_concurrency": 3
  }
}
```

## Benchmark

```bash
go run ./scripts/benchmark_compare.go
```

