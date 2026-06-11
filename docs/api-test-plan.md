# 选品 Agent — API 功能测试计划

> 版本：0.1.0 | 测试范围：22 个端点 | 更新：2026-06-09

---

## 一、测试环境

| 项目 | 要求 |
|------|------|
| Docker Compose | `docker compose -f docker-compose.dev.yml up -d` |
| MySQL | dev-mysql:3307（已启动，healthy） |
| Redis | dev-redis:6379（已启动，healthy） |
| Nacos | dev-nacos:8848（已启动） |
| Java Product | java-product:8002（需启动完成） |
| Selection Agent | dev-selection-agent:8011（本服务） |
| 测试工具 | curl + pytest（容器内） |

## 二、前置数据准备（测试前必须执行）

### 2.1 Java 后端数据检查

```bash
# 1. 确认 Java Product 健康
curl http://localhost:8002/actuator/health

# 2. 确认数据库中有聚合数据（替换日期为实际批次）
curl "http://localhost:8002/api/v1/product-line/aggregated-data?batchId=20260609-001"

# 3. 确认品类基线可查询
curl "http://localhost:8002/api/v1/category-baseline/health?marketplace=UK&categoryLabel=Home%20Garden"
```

### 2.2 测试数据准备（SQL）

```sql
-- 确保 sijuelishi_dev 库中有测试数据
-- 至少需要：product_lines, product_data, category_baseline 表中有 UK 站点的记录
```

---

## 三、分级测试策略

| 级别 | 目标 | 时间 |
|------|------|------|
| **L1 冒烟测试** | 所有端点可访问，不验证业务逻辑 | 5 分钟 |
| **L2 功能测试** | 核心流程端到端正确 | 30 分钟 |
| **L3 全面测试** | 所有参数组合、边界条件、异常场景 | 2 小时 |

---

## 四、L1 冒烟测试（22 个端点 × 1 个请求）

### 4.1 健康检查

```bash
# TC-01: GET /health
curl -s -w "\n%{http_code}" http://localhost:8011/health
# 期望: 200 | {"status":"ok","service":"selection-agent"}
```

### 4.2 基线管理 (routers/baseline.py)

```bash
# TC-02: POST /api/baseline/compute
curl -s -X POST "http://localhost:8011/api/baseline/compute?marketplace=UK&month=2026-06" | python3 -m json.tool
# 期望: 200 | {"success":true|false, ...}
```

### 4.3 蓝海扫描 (routers/blue_ocean.py)

```bash
# TC-03: POST /blue-ocean/scan
curl -s -X POST "http://localhost:8011/blue-ocean/scan?marketplace=UK&month=2026-06&call_llm=false" | python3 -m json.tool
# 期望: 200 | {"status":"accepted","task_id":"..."}

# TC-04: GET /blue-ocean/scan-results
curl -s "http://localhost:8011/blue-ocean/scan-results?marketplace=UK&month=2026-06" | python3 -m json.tool
# 期望: 200 | 扫描结果JSON（可能返回404的文件不存在）

# TC-05: GET /blue-ocean/scan-results/{month}
curl -s "http://localhost:8011/blue-ocean/scan-results/2026-06?marketplace=UK" | python3 -m json.tool
# 期望: 200/404

# TC-06: GET /blue-ocean/category/{category_name}/opportunity-card
curl -s "http://localhost:8011/blue-ocean/category/Home%20Garden/opportunity-card?marketplace=UK&month=2026-06" | python3 -m json.tool
# 期望: 200 | 机会卡片JSON（可能失败，因需Java数据）
```

### 4.4 选品分析 — 核心 (routers/selection.py)

```bash
# TC-07: GET /selection/analyze (SSE) — 用 curl 读前 5 个事件
timeout 10 curl -s -N "http://localhost:8011/selection/analyze?batchId=20260609-001&marketplace=UK" 2>&1 | head -20
# 期望: 200 | SSE 事件流（data:{...}）

# TC-08: POST /selection/analyze-sync
curl -s -X POST "http://localhost:8011/selection/analyze-sync?batchId=20260609-001&marketplace=UK" | python3 -m json.tool
# 期望: 200 | 分析结果JSON（可能因batchId不存在而报错）

# TC-09: POST /selection/verify
curl -s -X POST http://localhost:8011/selection/verify \
  -H "Content-Type: application/json" \
  -d '[{"bsrId":"test-001","marketplace":"UK","decision":"GO","score":85}]' | python3 -m json.tool
# 期望: 200 | {"verified":1,"results":[...]}

# TC-10: POST /selection/feedback
curl -s -X POST http://localhost:8011/selection/feedback \
  -H "Content-Type: application/json" \
  -d '{"identifier":"test-001","marketplace":"UK","outcome":"CONFIRMED","detail":"测试反馈"}' | python3 -m json.tool
# 期望: 200 | {"status":"ok"|"not_found"}

# TC-11: GET /selection/feedback/stats
curl -s "http://localhost:8011/selection/feedback/stats" | python3 -m json.tool
# 期望: 200 | {"total_decisions":...,"verified_count":...,"accuracy":{...}}

# TC-12: GET /selection/feedback/stats?archetype=da
curl -s "http://localhost:8011/selection/feedback/stats?archetype=da" | python3 -m json.tool
# 期望: 200 | 按da原型过滤的统计

# TC-13: POST /selection/verification/run
curl -s -X POST "http://localhost:8011/selection/verification/run?marketplace=UK&decision_month=2026-05" | python3 -m json.tool
# 期望: 200 | 验证结果

# TC-14: GET /selection/verification/report
curl -s "http://localhost:8011/selection/verification/report?marketplace=UK&decision_month=2026-06" | python3 -m json.tool
# 期望: 200/404

# TC-15: POST /selection/calibrate
curl -s -X POST "http://localhost:8011/selection/calibrate?archetype=da&min_samples=30" | python3 -m json.tool
# 期望: 200 | 校准结果

# TC-16: POST /selection/calibrate/approve
curl -s -X POST http://localhost:8011/selection/calibrate/approve \
  -H "Content-Type: application/json" \
  -d '{"calibration_id":1,"approved_by":"admin"}' | python3 -m json.tool
# 期望: 200 | {"status":"ok"|"not_found"}

# TC-17: GET /selection/calibrate/history
curl -s "http://localhost:8011/selection/calibrate/history" | python3 -m json.tool
# 期望: 200 | {"total":...,"records":[...]}
```

### 4.5 卖家分析 (routers/seller.py)

```bash
# TC-18: GET /seller/profiles
curl -s "http://localhost:8011/seller/profiles?marketplace=UK&limit=5" | python3 -m json.tool
# 期望: 200（当前降级响应）

# TC-19: GET /seller/profiles/{seller_name}
curl -s "http://localhost:8011/seller/profiles/TestSeller?marketplace=UK" | python3 -m json.tool
# 期望: 200（当前降级响应）

# TC-20: GET /seller/heat-matrix
curl -s "http://localhost:8011/seller/heat-matrix?marketplace=UK&sort_by=smart_density" | python3 -m json.tool
# 期望: 200（当前降级响应）

# TC-21: GET /seller/follow-signals
curl -s "http://localhost:8011/seller/follow-signals?marketplace=UK&limit=5" | python3 -m json.tool
# 期望: 200（当前降级响应）

# TC-22: GET /seller/recommendations
curl -s "http://localhost:8011/seller/recommendations?marketplace=UK&limit=5" | python3 -m json.tool
# 期望: 200（当前降级响应）

# TC-23: POST /seller/scan
curl -s -X POST http://localhost:8011/seller/scan \
  -H "Content-Type: application/json" \
  -d '{"marketplace":"UK","month":"2026-06"}' | python3 -m json.tool
# 期望: 200（当前降级响应）
```

---

## 五、L2 功能测试（核心流程端到端）

### 5.1 选品分析 SSE 完整流程

> **前置条件**: 数据库中有 `batchId=20260609-001` 的聚合数据

| 步骤 | 操作 | 验证点 |
|------|------|--------|
| 1 | 连接 SSE 端点 | HTTP 200 + Content-Type: text/event-stream |
| 2 | 等待 `start` 事件 | `event: start` + 包含 batchId, marketplace |
| 3 | 等待 `data_ready` 事件 | `event: data_ready` + 包含 subCategoryCount |
| 4 | 等待 `sub_start` 事件 | `event: sub_start` + 包含 subCategoryId |
| 5 | 等待 `progress` 事件 | `event: progress` + 包含 current/total |
| 6 | 等待 `heartbeat` 事件 | 每 15 秒 `event: heartbeat` |
| 7 | 等待 `sub_complete` 事件 | 每个小类完成一次 |
| 8 | 等待 `writeback` 事件 | `event: writeback` + success=true |
| 9 | 等待 `complete` 事件 | `event: complete` + 包含 summary |

```bash
# SSE 完整流程测试脚本
curl -s -N "http://localhost:8011/selection/analyze?batchId=20260609-001&marketplace=UK" \
  -H "Accept: text/event-stream" \
  --max-time 120 2>&1 | while IFS= read -r line; do
    echo "[$(date +%H:%M:%S)] $line"
  done
```

### 5.2 蓝海扫描—机会卡片完整链路

| 步骤 | 操作 | 验证点 |
|------|------|--------|
| 1 | POST /blue-ocean/scan | 返回 accepted + task_id |
| 2 | 等待后台任务完成 (约 30-60s) | - |
| 3 | GET /blue-ocean/scan-results | 返回排名列表，包含 category, score |
| 4 | GET /blue-ocean/category/{name}/opportunity-card | 返回完整机会卡片（10维雷达 + 测品推荐） |

```bash
# 完整链路测试
# 步骤1: 触发扫描
TASK=$(curl -s -X POST "http://localhost:8011/blue-ocean/scan?marketplace=UK&month=2026-06&call_llm=false")
echo "Task: $TASK"

# 步骤2: 等待并获取结果
sleep 60
curl -s "http://localhost:8011/blue-ocean/scan-results?marketplace=UK&month=2026-06" | python3 -c "
import json, sys
data = json.load(sys.stdin)
if 'rankings' in data:
    print(f'Top category: {data[\"rankings\"][0][\"category\"]}')
    print(f'Total categories: {len(data[\"rankings\"])}')
"

# 步骤3: 获取机会卡片
curl -s "http://localhost:8011/blue-ocean/category/Home%20Garden/opportunity-card?marketplace=UK&month=2026-06" | python3 -m json.tool | head -50
```

### 5.3 反馈闭环完整链路

| 步骤 | 操作 | 验证点 |
|------|------|--------|
| 1 | POST /selection/feedback（提交反馈） | status: ok |
| 2 | POST /selection/feedback（重复提交） | 幂等性检查 |
| 3 | GET /selection/feedback/stats | 统计包含刚提交的反馈 |
| 4 | POST /selection/verify（验证决策） | 返回验证结果 |

```bash
# 反馈闭环测试
# 提交反馈
curl -s -X POST http://localhost:8011/selection/feedback \
  -H "Content-Type: application/json" \
  -d '{"identifier":"TC-001","marketplace":"UK","outcome":"CONFIRMED","detail":"测试闭环"}'

# 查看统计
curl -s "http://localhost:8011/selection/feedback/stats" | python3 -m json.tool

# 验证决策
curl -s -X POST http://localhost:8011/selection/verify \
  -H "Content-Type: application/json" \
  -d '[{"bsrId":"TC-001","marketplace":"UK","decision":"GO","score":85}]'
```

### 5.4 校准审批完整链路

| 步骤 | 操作 | 验证点 |
|------|------|--------|
| 1 | POST /selection/calibrate | 触发校准，返回 calibration_id |
| 2 | GET /selection/calibrate/history | 历史记录包含本次校准 |
| 3 | POST /selection/calibrate/approve | status: ok |
| 4 | GET /selection/calibrate/history | 状态已变为 approved |

---

## 六、L3 全面测试（参数组合 + 异常场景）

### 6.1 参数边界测试

| TC | 端点 | 测试内容 | 期望 |
|----|------|----------|------|
| 6.1.1 | GET /selection/analyze | `batchId` 为空字符串 | 400/422 |
| 6.1.2 | GET /selection/analyze | `batchId` 包含特殊字符 `../etc` | 400（参数非法） |
| 6.1.3 | GET /selection/analyze | `marketplace=FR`（不支持的站点） | SSE error 事件 |
| 6.1.4 | POST /blue-ocean/scan | `call_llm=false` | 不调LLM，更快返回 |
| 6.1.5 | GET /seller/profiles | `limit=0` | 422（ge=1 约束） |
| 6.1.6 | GET /seller/profiles | `limit=201` | 422（le=200 约束） |
| 6.1.7 | GET /seller/profiles | `limit=-1` | 422（ge=1 约束） |
| 6.1.8 | POST /selection/calibrate | `min_samples=0` | 应能处理（至少默认30） |
| 6.1.9 | POST /selection/calibrate | `min_samples=-1` | 400/422 |
| 6.1.10 | GET /blue-ocean/category/{}/opportunity-card | 空品类名 | 404 |
| 6.1.11 | GET /blue-ocean/category/{}/opportunity-card | 超长品类名（>255字符） | 422 或正常处理 |

### 6.2 依赖服务异常测试

| TC | 端点 | 模拟场景 | 期望 |
|----|------|----------|------|
| 6.2.1 | GET /selection/analyze | Java Product 不可达 | SSE error 事件 + 不崩溃 |
| 6.2.2 | POST /selection/analyze-sync | Java Product 超时 | 超时后返回错误 + 重试耗尽 |
| 6.2.3 | POST /api/baseline/compute | MySQL 无数据 | success=false + skipped count |
| 6.2.4 | POST /blue-ocean/scan | Java 蓝海端点未实现 | 降级处理 + 不崩溃 |
| 6.2.5 | GET /seller/* | Java 卖家端点未实现 | 当前降级响应 |

### 6.3 并发测试

| TC | 端点 | 测试内容 | 期望 |
|----|------|----------|------|
| 6.3.1 | GET /selection/analyze | 同时 3 个 SSE 连接 | 各自独立推送 |
| 6.3.2 | POST /blue-ocean/scan | 同时 2 个扫描任务 | 各自生成不同 task_id |
| 6.3.3 | GET /health | 持续 100 个并发请求 30s | 全部 200 |

```bash
# 并发测试脚本
# 6.3.1: 3 SSE 并发
for i in 1 2 3; do
  timeout 10 curl -s -N "http://localhost:8011/selection/analyze?batchId=20260609-001&marketplace=UK" > /tmp/sse_$i.log 2>&1 &
done
wait
wc -l /tmp/sse_*.log

# 6.3.3: 健康检查压测
for i in $(seq 1 100); do
  curl -s http://localhost:8011/health &
done
wait
```

### 6.4 热重载测试

| TC | 测试内容 | 期望 |
|----|----------|------|
| 6.4.1 | 修改 `routers/selection.py` 中的字符串 | uvicorn 自动重启 |
| 6.4.2 | 新增 `routers/test_route.py` | 不自动加载（新文件需手动重启） |
| 6.4.3 | 修改 `selection/` 下的算法文件 | 自动重启 |
| 6.4.4 | 修改 `app.py` | **不**自动重启（不在 reload-dir 中） |

```bash
# 热重载验证
# 在宿主机修改文件后检查容器日志
docker logs dev-selection-agent --tail 5
# 应看到 "3 changes detected" 或类似 reload 消息
```

### 6.5 错误处理测试

| TC | 端点 | 测试内容 | 期望 |
|----|------|----------|------|
| 6.5.1 | POST /selection/verify | 请求体为空 `{}` | 422（decisions 必需） |
| 6.5.2 | POST /selection/verify | decisions 包含非 dict 元素 | 422 |
| 6.5.3 | POST /selection/feedback | feedback 为空 `{}` | 422 或 status=error |
| 6.5.4 | POST /selection/feedback | 超大 payload (>10MB) | 413 或截断 |
| 6.5.5 | GET /selection/analyze | `batchId` 为不存在的批次 | SSE error 事件 |
| 6.5.6 | POST /selection/calibrate/approve | `calibration_id` 不存在 | status=not_found |
| 6.5.7 | GET /selection/verification/report | 无 `decision_month` 参数 | 422 |

---

## 七、自动化测试脚本

### 7.1 L1 冒烟测试（一键运行）

```bash
#!/bin/bash
# 保存为: selection-agent/tests/api_smoke_test.sh
set -e
BASE="http://localhost:8011"
PASS=0
FAIL=0

test_endpoint() {
  local method=$1 url=$2 expected_code=$3 label=$4
  local code
  if [ "$method" = "POST" ]; then
    code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$url" -H "Content-Type: application/json" ${5:-})
  else
    code=$(curl -s -o /dev/null -w "%{http_code}" "$url")
  fi
  if [ "$code" = "$expected_code" ]; then
    echo "✅ $label ($code)"
    ((PASS++)) || true
  else
    echo "❌ $label — 期望 $expected_code, 实际 $code"
    ((FAIL++)) || true
  fi
}

echo "=== L1 冒烟测试: Selection Agent API ==="
echo ""

# 健康检查
test_endpoint GET "$BASE/health" 200 "GET /health"

# 选品分析
test_endpoint GET "$BASE/selection/analyze?batchId=test&marketplace=UK" 200 "GET /selection/analyze (SSE)"
test_endpoint POST "$BASE/selection/analyze-sync?batchId=test&marketplace=UK" 200 "POST /selection/analyze-sync"
test_endpoint POST "$BASE/selection/verify" 422 "POST /selection/verify (空body=422期望)"
test_endpoint POST "$BASE/selection/feedback" 422 "POST /selection/feedback (空body=422期望)"
test_endpoint GET "$BASE/selection/feedback/stats" 200 "GET /selection/feedback/stats"
test_endpoint GET "$BASE/selection/feedback/stats?archetype=da" 200 "GET /selection/feedback/stats?archetype=da"
test_endpoint POST "$BASE/selection/verification/run?marketplace=UK&decision_month=2026-05" 200 "POST /selection/verification/run"
test_endpoint GET "$BASE/selection/verification/report?marketplace=UK&decision_month=2026-06" 200 "GET /selection/verification/report"
test_endpoint POST "$BASE/selection/calibrate?min_samples=30" 200 "POST /selection/calibrate"
test_endpoint POST "$BASE/selection/calibrate/approve" 422 "POST /selection/calibrate/approve (空body=422)"
test_endpoint GET "$BASE/selection/calibrate/history" 200 "GET /selection/calibrate/history"

# 蓝海扫描
test_endpoint POST "$BASE/blue-ocean/scan?marketplace=UK&month=2026-06&call_llm=false" 200 "POST /blue-ocean/scan"
test_endpoint GET "$BASE/blue-ocean/scan-results?marketplace=UK&month=2026-06" 200 "GET /blue-ocean/scan-results"
test_endpoint GET "$BASE/blue-ocean/scan-results/2026-06?marketplace=UK" 200 "GET /blue-ocean/scan-results/{month}"
test_endpoint GET "$BASE/blue-ocean/category/Home%20Garden/opportunity-card?marketplace=UK&month=2026-06" 200 "GET /blue-ocean/category/.../opportunity-card"

# 基线
test_endpoint POST "$BASE/api/baseline/compute?marketplace=UK&month=2026-06" 200 "POST /api/baseline/compute"

# 卖家
test_endpoint GET "$BASE/seller/profiles?marketplace=UK&limit=5" 200 "GET /seller/profiles"
test_endpoint GET "$BASE/seller/profiles/TestSeller?marketplace=UK" 200 "GET /seller/profiles/{seller_name}"
test_endpoint GET "$BASE/seller/heat-matrix?marketplace=UK" 200 "GET /seller/heat-matrix"
test_endpoint GET "$BASE/seller/follow-signals?marketplace=UK&limit=5" 200 "GET /seller/follow-signals"
test_endpoint GET "$BASE/seller/recommendations?marketplace=UK&limit=5" 200 "GET /seller/recommendations"
test_endpoint POST "$BASE/seller/scan" 200 "POST /seller/scan" '-d {"marketplace":"UK","month":"2026-06"}'

echo ""
echo "=== 结果: $PASS 通过, $FAIL 失败 ==="
```

### 7.2 pytest 集成测试（容器内运行）

```bash
# 在 selection-agent 容器内运行
docker exec dev-selection-agent python -m pytest tests/ -v --tb=short

# 预期: 81 passed
```

### 7.3 新增集成测试建议

建议在 `tests/` 下新增 `tests/test_api_integration.py`，使用 `httpx.AsyncClient` + `pytest-asyncio`：

```python
# tests/test_api_integration.py 结构建议
import pytest
from httpx import AsyncClient, ASGITransport
from app import create_app

@pytest.fixture
async def client():
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

class TestHealthEndpoint:
    async def test_health_returns_ok(self, client): ...
    async def test_health_content_type(self, client): ...

class TestSelectionAnalyze:
    async def test_missing_batch_id_returns_error(self, client): ...
    async def test_sse_content_type(self, client): ...
    async def test_invalid_marketplace(self, client): ...

class TestVerifyEndpoint:
    async def test_empty_body_returns_422(self, client): ...
    async def test_valid_decisions(self, client): ...
    async def test_malformed_json(self, client): ...

class TestFeedbackEndpoint:
    async def test_missing_identifier(self, client): ...
    async def test_valid_feedback(self, client): ...
    async def test_duplicate_feedback_idempotent(self, client): ...

class TestBlueOceanScan:
    async def test_scan_returns_accepted(self, client): ...
    async def test_scan_without_llm(self, client): ...

class TestSellerEndpoints:
    async def test_profiles_returns_degraded(self, client): ...
    async def test_profiles_limit_boundary(self, client): ...
    async def test_heat_matrix_default_sort(self, client): ...

class TestCalibrateFlow:
    async def test_full_calibrate_approve_cycle(self, client): ...

class TestBaselineCompute:
    async def test_compute_with_valid_params(self, client): ...
    async def test_compute_missing_month(self, client): ...
```

---

## 八、测试执行建议

### 优先级排序

| 优先级 | 测试范围 | 执行时机 |
|--------|----------|----------|
| **P0** | L1 冒烟（23条 curl） | 每次构建后 |
| **P1** | L2 核心流程 + 81个单元测试 | 每次提交前 |
| **P2** | L3 参数边界 + 异常场景 | PR Review 前 |
| **P3** | L3 并发 + 压测 | 发布前 |

### 快速执行命令

```bash
# P0: 冒烟测试（<5分钟）
bash selection-agent/tests/api_smoke_test.sh

# P1: 单元测试 + 集成测试（<2分钟）
docker exec dev-selection-agent python -m pytest tests/ -v

# P2+P3: 完整测试（需手动操作部分步骤）
# 参考第六节各 TC 的 curl 命令
```

---

## 九、当前已知限制

| 端点范围 | 限制 | 影响 |
|----------|------|------|
| `GET /seller/*` (5个) | 返回降级响应，依赖 Java 卖家端点 | L2/L3 测试需等 Java 端就绪 |
| `POST /blue-ocean/scan` | 依赖 Java 品类聚合端点 | 可能因数据缺失而跳过 |
| `GET /selection/analyze` | 需要有效的 batch_id | 需准备测试数据 |
| `POST /api/baseline/compute` | 需要 MySQL 中有产品数据 | 可能在空库上返回 skipped |
| 热重载—app.py | 不在 reload-dir 范围内 | 修改 app.py 需手动重启容器 |
