# 领星产品表现月更操作手册

## 目标

同步领星 UK + DE 产品表现数据到 dev 库 `lingxing_product_performance`，只保留我们需要的 6 个打标商品。

## 前置条件

- Java 后端 `java-product` 容器运行中
- 领星店铺数据已同步（`lingxing_seller` 表已有数据）
- 领星凭证已配置（`LINGXING_APP_ID`、`LINGXING_APP_SECRET`）

## 操作步骤

### 1. 验证领星链路

```bash
curl -s -X POST http://localhost:8002/api/v1/modules/lingxing/ping
```

预期返回：`{"code":200, "data": {"token":"OK"}}`

如果失败，检查：
- 领星后台 IP 白名单是否包含当前服务器公网 IP
- 凭证是否过期（`POST /credentials` 更新）
- token 接口返回了什么错误

### 2. 同步指定国家的产品表现

> **重要：UK 和 DE 必须串行执行**，不要同时跑。两个请求会抢领星令牌桶，触发限流 3001008。

#### 同步 UK（mid=4，status 1/2 店铺）

```bash
UK=$(docker exec dev-mysql mysql -uroot -proot -N -B -e "SELECT GROUP_CONCAT(sid ORDER BY sid SEPARATOR ',') FROM sijuelishi_dev.lingxing_seller WHERE status IN (1,2) AND mid=4")

curl -s -X POST http://localhost:8002/api/v1/modules/lingxing/product-performance/sync \
  -H "Content-Type: application/json" \
  -d "{\"sids\":[$UK],\"startDate\":\"$(date +'%Y-%m-%d' -d '7 days ago')\",\"endDate\":\"$(date +'%Y-%m-%d')\",\"summaryField\":\"asin\"}"
```

#### 等待完成后，再同步 DE（mid=5，status 1/2 店铺）

```bash
DE=$(docker exec dev-mysql mysql -uroot -proot -N -B -e "SELECT GROUP_CONCAT(sid ORDER BY sid SEPARATOR ',') FROM sijuelishi_dev.lingxing_seller WHERE status IN (1,2) AND mid=5")

curl -s -X POST http://localhost:8002/api/v1/modules/lingxing/product-performance/sync \
  -H "Content-Type: application/json" \
  -d "{\"sids\":[$DE],\"startDate\":\"$(date +'%Y-%m-%d' -d '7 days ago')\",\"endDate\":\"$(date +'%Y-%m-%d')\",\"summaryField\":\"asin\"}"
```

> 时间窗每次取最近 7 天（上述脚本自动计算），跨度不要超过 92 天。
> 建议每月 1 号跑一次，拉上个月最后 7 天的数据。

### 2.1 后续计划：SKU 池 + 每日 SKU 快照

后续精细打磨“精铺测品二批转正模型”时，领星数据采集拆成两部分，不混在一个同步里。

#### 第一部分：每周更新 SKU 池

```text
目标：得到 UK + DE 两国店铺中，属于 6 个目标 listing/产品标签的全部 SKU。
```

6 个目标标签：

```text
绿标
欧洲精铺2025非标品
欧洲精铺2025季节性断货
欧洲精铺2025待淘汰
欧洲精铺2025淘汰
欧洲精铺2025
```

推荐来源：

```text
主来源：lingxing_product_performance.raw_json.tag_set。
筛选键：6 个目标标签的 global_tag_id。
补充来源：lingxing_local_product 只补开发人、成本、图片、状态等主数据。
```

执行口径：

```text
1. 同步 UK + DE 产品表现，summary_field=sku。
2. 展开 lingxing_product_performance.raw_json.tag_set。
3. 按 6 个 global_tag_id 自动筛出目标 SKU。
4. 展开 `raw_json.price_list[*]`，按 `price_list.mid` 限定 UK(mid=4)、DE(mid=5)。
5. JOIN lingxing_local_product 补开发人、成本、图片、状态等主数据。
6. UPSERT sku_pool，记录 snapshot_week。
7. 对比上周 SKU 池，识别新增、移除、标签变化、状态变化。
```

注意：

```text
产品表现接口不能直接按标签请求，但响应里的 tag_set 已落在 raw_json。
正确做法是先同步产品表现，再在本地按 tag_set.global_tag_id 自动筛 SKU 池。
SKU 池形成后，再按 SKU 查每日表现。
```

#### 第二部分：每天更新 SKU 日表现

```text
目标：对 SKU 池里的每个 SKU，按天获取经营表现，形成 SKU 日快照。
历史回补：从 2026-01-01 到 2026-07-09。
日常更新：每天拉昨天或当天的单日表现。
```

产品表现接口支持按 SKU 搜索，但 `search_value` 单次最多 50 个。因此约 6000 个 SKU 需要拆成约 120 批。UK 和 DE 应分开串行执行，避免抢同一个产品表现接口令牌桶。

请求口径：

```json
{
  "offset": 0,
  "length": 1000,
  "sort_field": "volume",
  "sort_type": "desc",
  "sid": [1, 109],
  "start_date": "2026-07-08",
  "end_date": "2026-07-08",
  "summary_field": "sku",
  "search_field": "local_sku",
  "search_value": ["SKU001", "SKU002"]
}
```

执行口径：

```text
1. 从 SKU 池读取当前目标 SKU 清单。
2. 每 50 个 SKU 分一组。
3. UK 店铺集合先跑完，再跑 DE 店铺集合。
4. 每次请求 start_date = end_date = 目标日期。
5. 将每日结果落库为独立 SKU 日快照，避免覆盖月更产品表现表。
6. 记录 date + marketplace + sku + sid_scope + currency 的幂等键。
7. 失败批次记录游标，支持断点续跑。
```

注意：

```text
产品表现 = 每日经营结果，适合拉销量、销售额、毛利、广告、库存。
本地产品详情 = 商品主数据，适合拉成本、规格、供应商、标签、开发人，不是每日经营结果。
批量本地产品详情接口单次最多 100 个 SKU，可作为低频主数据补充。
```

可信性和风险点：

```text
1. 标签可信性取决于领星后台标签维护是否及时；需要每周对比标签变化。
2. productList 的 global_tags 是产品标签，productPerformance 的 tag_set 是 Listing 标签，SKU 池以 tag_set 为准。
3. `lingxing_product_performance` 没有结构化 listing_tags 列，筛选时读取 raw_json.tag_set。
4. 筛选优先使用 global_tag_id，tag_name 只作为展示和兜底。
5. 产品表现按天查询是双闭区间 start_date=end_date，但领星侧结算/广告/退货可能存在延迟回写。
6. 历史回补 2026-01-01~2026-07-09 共 190 天，6000 SKU 约 120 批/天/国家，UK+DE 约 45600 次请求，按多店铺 10 秒限流理论下限约 5.3 天。
7. 若 SKU 同时存在多店铺/多 MSKU，summary_field=sku 需要保留 sid_scope/raw_json，避免把跨店铺数据混成一行后无法追溯。
8. 日快照表必须幂等，可重跑同一天同一批，不应重复累计。
9. SKU 池全量同步必须传 `is_recently_enum=false`，否则领星默认只查活跃商品，会漏掉淘汰 SKU。
10. SKU 池站点口径取 `raw_json.price_list[*].mid`，不要用历史 `sid_scope`，因为旧 ASIN 聚合数据里可能是多店铺 sid 拼接。
```

### 3. 查询目标标签商品数（验证）

同步后通过以下 6 个标签 ID 筛选：

| 标签 | global_tag_id |
|------|---------------|
| 绿标 | 907657425150046095 |
| 欧洲精铺2025 | 907563170455592213 |
| 欧洲精铺2025非标品 | 907654877317203632 |
| 欧洲精铺2025季节性断货 | 907596133278666918 |
| 欧洲精铺2025待淘汰 | 907585847123066054 |
| 欧洲精铺2025淘汰 | 907585631391968576 |

```sql
SELECT pl.mid, COUNT(DISTINCT pl.local_sku) AS sku_count
FROM lingxing_product_performance p
JOIN JSON_TABLE(
  p.raw_json,
  '$.tag_set[*]'
  COLUMNS (
    global_tag_id VARCHAR(64) PATH '$.global_tag_id',
    tag_name VARCHAR(255) PATH '$.tag_name'
  )
) jt
JOIN JSON_TABLE(
  p.raw_json,
  '$.price_list[*]'
  COLUMNS (
    local_sku VARCHAR(128) PATH '$.local_sku',
    mid VARCHAR(16) PATH '$.mid'
  )
) pl
WHERE pl.mid IN ('4', '5')
  AND pl.local_sku IS NOT NULL
  AND pl.local_sku <> ''
  AND jt.global_tag_id IN (
    '907657425150046095',
    '907563170455592213',
    '907654877317203632',
    '907596133278666918',
    '907585847123066054',
    '907585631391968576'
  )
GROUP BY pl.mid;
```

当前 dev 库结果（2026-07-09，全量 `is_recently_enum=false`，并补入前台可见 `status=2` 店铺后）：UK **5,573** 个 `sku+marketplace`，DE **647** 个 `sku+marketplace`，合计 **6,220**；去重 SKU **5,870**。与前台 `sku.md` 的 `SKU+店铺+国家` 口径对比，缺口为 **0**。

## 时间预估

| 步骤 | 耗时 |
|------|------|
| 验证链路 + 获取 sid | <1 分 |
| 同步 UK（~19 页 × 10s/页限流） | ~3 分 |
| 同步 DE（~13 页 × 10s/页限流） | ~2 分 |
| 容错缓冲（可能的限流重试） | ~3 分 |
| **合计** | **~10 分钟** |

> 如果触发限流或网络超时，代码会自动退避重试（最多 8 次，每次等 30s × attempt），耗时可能延长到 15~30 分钟。

## 常见问题

### 限流 3001008 / 103
已自动处理。连续重试 8 次仍失败时，任务返回失败并保留已落库数据，下次可重跑同一时间窗。

### 网络超时
已自动处理为临时失败重试。重跑同一时间窗是幂等 upsert，不会重复累计。

### 同步成功但数据量明显偏少
检查：
1. 时间窗是否太短（建议 ≥7 天）
2. 店铺列表是否完整（SKU 池口径使用 `status IN (1,2)`；2026-07-09 dev 库 UK=143 家、DE=140 家）
3. 领星凭证是否有对应权限

### 标签名称变了
如果领星后台改了标签名称（如 "欧洲精铺2025" → "欧洲精铺2026"），需要更新：
1. 展示文案
2. 必要时更新 tag_id 白名单

## 参考

- `LingxingClient.java` — 限流自动重试逻辑（`sendWithRetry` 方法）
- `LingxingProductPerformanceSyncService.java` — 同步服务
- `lingxing_product_performance` 表 — 唯一键 `uk_biz_key`（SHA-256 幂等键）
- `sku_pool` 表 — UK/DE 6 标签 SKU 池
