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

#### 同步 UK（mid=4，115 家店铺）

```bash
UK=$(docker exec dev-mysql mysql -uroot -proot -N -B -e "SELECT GROUP_CONCAT(sid ORDER BY sid SEPARATOR ',') FROM sijuelishi_dev.lingxing_seller WHERE status=1 AND mid=4")

curl -s -X POST http://localhost:8002/api/v1/modules/lingxing/product-performance/sync \
  -H "Content-Type: application/json" \
  -d "{\"sids\":[$UK],\"startDate\":\"$(date +'%Y-%m-%d' -d '7 days ago')\",\"endDate\":\"$(date +'%Y-%m-%d')\",\"summaryField\":\"asin\"}"
```

#### 等待完成后，再同步 DE（mid=5，115 家店铺）

```bash
DE=$(docker exec dev-mysql mysql -uroot -proot -N -B -e "SELECT GROUP_CONCAT(sid ORDER BY sid SEPARATOR ',') FROM sijuelishi_dev.lingxing_seller WHERE status=1 AND mid=5")

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
优先验证 lingxing_local_product.raw_json.global_tags 是否包含这 6 个目标标签；若包含，用它建 SKU 池。
如果本地产品标签不全，则先走领星后台按标签筛选导出，再导入 product_performance_actual 作为 SKU 池来源。
产品表现 API 只负责拉每日经营表现，不作为稳定标签来源。
```

执行口径：

```text
1. 每周同步/增量更新领星本地产品 productList。
2. 先抽样核对 raw_json.global_tags 是否能覆盖 6 个目标标签。
3. 若能覆盖，从 global_tags 中筛选 6 个目标标签，得到目标 SKU 集合。
4. 若不能覆盖，用领星后台按标签导出 + product_performance_actual 导入结果形成 SKU 集合。
5. 保存 SKU 池，记录 SKU、标签来源、开发人、状态、创建时间、更新时间、成本、图片等主数据。
6. 对比上周 SKU 池，识别新增、移除、标签变化、状态变化。
```

注意：

```text
产品表现接口不能直接按标签请求。官方文档里有 tag_set 返回字段，但当前实测同步表没有结构化 listing_tags，且不能把它当稳定筛选条件。
因此不能指望领星产品表现直接“只返回这 6 个标签”。
正确做法是先在本地形成目标 SKU 池，再按 SKU 查每日表现。
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
2. productList 的 global_tags 是产品标签，productPerformance 官方文档里的 tag_set 是 Listing 标签，两者可能不是完全同一口径。
3. 当前 API 同步表 lingxing_product_performance 没有 listing_tags 结构化列，标签筛选不能直接读这张表。
4. 如果 global_tags 不能稳定覆盖目标标签，SKU 池必须先用 product_performance_actual 这条后台导出链路兜底。
5. 产品表现按天查询是双闭区间 start_date=end_date，但领星侧结算/广告/退货可能存在延迟回写。
6. 历史回补 2026-01-01~2026-07-09 共 190 天，6000 SKU 约 120 批/天/国家，UK+DE 约 45600 次请求，按多店铺 10 秒限流理论下限约 5.3 天。
7. 若 SKU 同时存在多店铺/多 MSKU，summary_field=sku 需要保留 sid_scope/raw_json，避免把跨店铺数据混成一行后无法追溯。
8. 日快照表必须幂等，可重跑同一天同一批，不应重复累计。
```

### 3. 查询目标标签商品数（验证）

同步后通过以下 6 个标签筛选：

| 标签 | HEX 编码 |
|------|---------|
| 绿标 | E7BBBFE6A087 |
| 欧洲精铺2025 | E6ACA7E6B4B2E7B2BEE993BA32303235 |
| 欧洲精铺2025非标品 | E6ACA7E6B4B2E7B2BEE993BA32303235E99D9EE6A087E59381 |
| 欧洲精铺2025季节性断货 | E6ACA7E6B4B2E7B2BEE993BA32303235E5ADA3E88A82E680A7E696ADE8B4A7 |
| 欧洲精铺2025待淘汰 | E6ACA7E6B4B2E7B2BEE993BA32303235E5BE85E6B798E6B1B0 |
| 欧洲精铺2025淘汰 | E6ACA7E6B4B2E7B2BEE993BA32303235E6B798E6B1B0 |

```sql
SELECT COUNT(DISTINCT asin)
FROM lingxing_product_performance
WHERE raw_json LIKE CONCAT('%', UNHEX('E6ACA7E6B4B2E7B2BEE993BA32303235'), '%')
   OR raw_json LIKE CONCAT('%', UNHEX('E7BBBFE6A087'), '%')
   OR raw_json LIKE CONCAT('%', UNHEX('E6ACA7E6B4B2E7B2BEE993BA32303235E6B798E6B1B0'), '%')
   OR raw_json LIKE CONCAT('%', UNHEX('E6ACA7E6B4B2E7B2BEE993BA32303235E99D9EE6A087E59381'), '%')
   OR raw_json LIKE CONCAT('%', UNHEX('E6ACA7E6B4B2E7B2BEE993BA32303235E5ADA3E88A82E680A7E696ADE8B4A7'), '%')
   OR raw_json LIKE CONCAT('%', UNHEX('E6ACA7E6B4B2E7B2BEE993BA32303235E5BE85E6B798E6B1B0'), '%');
```

正常结果：UK+DE 合计约 **6,000+** 个独立 ASIN。

## 时间预估

| 步骤 | 耗时 |
|------|------|
| 验证链路 + 获取 sid | <1 分 |
| 同步 UK（~19 页 × 10s/页限流） | ~3 分 |
| 同步 DE（~13 页 × 10s/页限流） | ~2 分 |
| 容错缓冲（可能的限流重试） | ~3 分 |
| **合计** | **~10 分钟** |

> 如果触发限流 3001008，代码会自动重试（最多 5 次，每次等 15s），耗时可能延长到 15~20 分钟。
> 如果触发 103（请勿频繁请求），需要人工等 30 秒后重新跑该国家的同步。

## 常见问题

### 限流 3001008
已自动处理，无需人工介入。如果连续重试 5 次仍失败，等 30 秒后重新跑该国家。

### 限流 103（请勿频繁请求）
人工处理：**不要并行跑 UK 和 DE**。等 30 秒后重试。

### 同步成功但数据量明显偏少
检查：
1. 时间窗是否太短（建议 ≥7 天）
2. 店铺列表是否完整（`SELECT COUNT(*) FROM lingxing_seller WHERE status=1 AND mid=4` 应为 115 家）
3. 领星凭证是否有对应权限

### 标签名称变了
如果领星后台改了标签名称（如 "欧洲精铺2025" → "欧洲精铺2026"），需要更新：
1. 本手册的 HEX 编码对照表
2. 查询 SQL 里的 HEX 条件

## 参考

- `LingxingClient.java` — 限流自动重试逻辑（`sendWithRetry` 方法）
- `LingxingProductPerformanceSyncService.java` — 同步服务
- `lingxing_product_performance` 表 — 唯一键 `uk_biz_key`（SHA-256 幂等键）
- `lingxing_local_product` 表 — 36,848 条本地产品（产品标签 `global_tags`）
