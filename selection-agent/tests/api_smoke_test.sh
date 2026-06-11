#!/bin/bash
# L1 冒烟测试: Selection Agent API (23 端点)
# 运行: bash selection-agent/tests/api_smoke_test.sh
set -e
BASE="http://localhost:8011"
PASS=0
FAIL=0

test_endpoint() {
  local method=$1 url=$2 expected_code=$3 label=$4 extra=$5
  local code
  if [ "$method" = "POST" ]; then
    code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$url" \
      -H "Content-Type: application/json" ${extra} 2>/dev/null)
  else
    code=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)
  fi
  if [ "$code" = "$expected_code" ]; then
    echo "✅ $label ($code)"
    PASS=$((PASS + 1))
  else
    echo "❌ $label — 期望 $expected_code, 实际 $code"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== L1 冒烟测试: Selection Agent API ==="
echo "开始: $(date)"
echo ""

# ── 健康检查 ──
test_endpoint GET "$BASE/health" 200 "GET /health"

# ── 选品分析 ──
test_endpoint GET "$BASE/selection/analyze?batch_id=test&marketplace=UK" 200 "GET /selection/analyze (SSE)"
test_endpoint POST "$BASE/selection/analyze-sync?batch_id=test&marketplace=UK" 200 "POST /selection/analyze-sync"
test_endpoint POST "$BASE/selection/verify" 422 "POST /selection/verify (空body→422)"
test_endpoint POST "$BASE/selection/feedback" 422 "POST /selection/feedback (空body→422)"
test_endpoint GET "$BASE/selection/feedback/stats" 200 "GET /selection/feedback/stats"
test_endpoint GET "$BASE/selection/feedback/stats?archetype=da" 200 "GET /selection/feedback/stats?archetype=da"
test_endpoint POST "$BASE/selection/verification/run?marketplace=UK&decision_month=2026-05" 200 "POST /selection/verification/run"
test_endpoint GET "$BASE/selection/verification/report?marketplace=UK&decision_month=2026-06" 200 "GET /selection/verification/report"
test_endpoint POST "$BASE/selection/calibrate?min_samples=30" 200 "POST /selection/calibrate"
test_endpoint POST "$BASE/selection/calibrate/approve" 422 "POST /selection/calibrate/approve (空body→422)"
test_endpoint GET "$BASE/selection/calibrate/history" 200 "GET /selection/calibrate/history"

# ── 蓝海扫描 ──
test_endpoint POST "$BASE/blue-ocean/scan?marketplace=UK&month=2026-06&call_llm=false" 200 "POST /blue-ocean/scan"
test_endpoint GET "$BASE/blue-ocean/scan-results?marketplace=UK&month=2026-06" 200 "GET /blue-ocean/scan-results"
test_endpoint GET "$BASE/blue-ocean/scan-results/2026-06?marketplace=UK" 200 "GET /blue-ocean/scan-results/{month}"
test_endpoint GET "$BASE/blue-ocean/category/Home%20Garden/opportunity-card?marketplace=UK&month=2026-06" 200 "GET /blue-ocean/category/.../opportunity-card"

# ── 基线 ──
test_endpoint POST "$BASE/api/baseline/compute?marketplace=UK&month=2026-06" 200 "POST /api/baseline/compute"

# ── 卖家 ──
test_endpoint GET "$BASE/seller/profiles?marketplace=UK&limit=5" 200 "GET /seller/profiles"
test_endpoint GET "$BASE/seller/profiles/TestSeller?marketplace=UK" 200 "GET /seller/profiles/{seller_name}"
test_endpoint GET "$BASE/seller/heat-matrix?marketplace=UK" 200 "GET /seller/heat-matrix"
test_endpoint GET "$BASE/seller/follow-signals?marketplace=UK&limit=5" 200 "GET /seller/follow-signals"
test_endpoint GET "$BASE/seller/recommendations?marketplace=UK&limit=5" 200 "GET /seller/recommendations"
test_endpoint POST "$BASE/seller/scan" 200 "POST /seller/scan" '-d {"marketplace":"UK","month":"2026-06"}'

echo ""
echo "=== 完成: $(date) ==="
echo "✅ $PASS 通过  ❌ $FAIL 失败"
