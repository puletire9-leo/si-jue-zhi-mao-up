# SKU 池总量获取（领星全自动）

> 用途：从领星产品表现 API/已落库数据中自动筛选 UK + DE 的目标标签 SKU。  
> 当前结论：旧 `sku_pool` 是兼容表，规范基线是 `lingxing_target_sku_pool` active 行，当前 2026-W29 = 6,560。

## 当前事实（2026-07-09）

| 数据源/表 | 结论 |
|-----------|------|
| `lingxing_product_performance.raw_json.tag_set` | 目标标签主来源 |
| `lingxing_product_performance.raw_json.price_list[*]` | SKU、店铺、国家、MSKU 主来源 |
| `lingxing_local_product.raw_json.global_tags` | 标签覆盖不稳定，不作为目标标签主来源 |
| `sku_pool` | 旧兼容池，`sku + marketplace` 口径，当前 6,220 |
| `lingxing_target_sku_pool` | 规范目标池，`snapshot_week + marketplace + sid + sku` 口径，当前 6,560 |
| `产品数据/领星数据api/sku.md` | 前台 listing 标签正确对照文件 |

## 目标标签

| 标签 | global_tag_id |
|------|---------------|
| 绿标 | `907657425150046095` |
| 欧洲精铺2025 | `907563170455592213` |
| 欧洲精铺2025非标品 | `907654877317203632` |
| 欧洲精铺2025季节性断货 | `907596133278666918` |
| 欧洲精铺2025待淘汰 | `907585847123066054` |
| 欧洲精铺2025淘汰 | `907585631391968576` |

## 建池正确流程

```text
1. 同步店铺
   -> lingxing_seller

2. 取 UK(mid=4) / DE(mid=5) 的 status IN (1,2) 店铺
   -> 前台仍展示部分 status=2 店铺，不能只取 status=1

3. 调 productPerformance/asinList
   -> summary_field=sku
   -> is_recently_enum=false
   -> UK/DE 串行

4. 落库 lingxing_product_performance
   -> 结构化关键列 + raw_json 整包
   -> raw JSON gzip 归档

5. 展开 raw_json
   -> tag_set[*] 取 global_tag_id
   -> price_list[*] 取 local_sku / mid / sid / seller_name / seller_sku

6. 按 6 个标签筛选
   -> 限定 mid=4/5
   -> 写旧 sku_pool
   -> 写规范 lingxing_sku_store_snapshot
   -> 写规范 lingxing_target_sku_pool
```

注意：建池链路使用 `summary_field=sku` 是正确的，因为目的是拿全量本地 SKU 和标签；周数据表现更新链路另用 `summary_field=msku`。

## 当前基线

规范目标池：

```sql
SELECT COUNT(*) AS required_sku_rows,
       COUNT(DISTINCT CONCAT(snapshot_week, '|', marketplace, '|', sid, '|', sku)) AS baseline_key_count
FROM lingxing_target_sku_pool
WHERE snapshot_week = '2026-W29'
  AND is_active = 1;
-- required_sku_rows = 6560
-- baseline_key_count = 6560
```

分国家：

| marketplace | target_store_count | required_sku_rows |
|-------------|-------------------:|------------------:|
| UK | 13 | 5,913 |
| DE | 3 | 647 |
| 合计 | 16 | 6,560 |

旧兼容池：

| 表 | 口径 | 行数 |
|----|------|-----:|
| `sku_pool` | `sku + marketplace` | 6,220 |
| `lingxing_target_sku_pool` | `snapshot_week + marketplace + sid + sku` | 6,560 |

不要用 `COUNT(DISTINCT sku)` 当业务基线；它只能做诊断。

## 接口

### 1. 从现有库重建 SKU 池

```bash
curl -s -X POST http://localhost:18002/api/v1/modules/lingxing/sku-pool/rebuild \
  -H "Content-Type: application/json" \
  -d '{"snapshotWeek":"2026-W29"}'
```

### 2. 同步 UK/DE 全量 SKU 后重建

```bash
curl -s -X POST http://localhost:18002/api/v1/modules/lingxing/sku-pool/sync-uk-de-and-rebuild \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2026-07-01",
    "endDate": "2026-07-07",
    "currencyCode": "CNY",
    "snapshotWeek": "2026-W29"
  }'
```

说明：

- 自动取 `lingxing_seller.status IN (1,2) AND mid IN (4,5)`。
- 产品表现同步使用 `summary_field=sku`。
- 必须传或固定 `is_recently_enum=false`，避免领星默认只查活跃商品。
- 重跑是幂等 upsert。

### 3. 回填规范数据层

```bash
curl -s -X POST http://localhost:18002/api/v1/modules/lingxing/sku-data-layer/backfill-existing \
  -H "Content-Type: application/json" \
  -d '{
    "snapshotWeek": "2026-W29",
    "snapshotDate": "2026-07-09",
    "startDate": "2026-07-01",
    "endDate": "2026-07-07",
    "yearMonth": "2026-07"
  }'
```

### 4. 查看统计

```bash
curl -s "http://localhost:18002/api/v1/modules/lingxing/sku-data-layer/stats?snapshotWeek=2026-W29&yearMonth=2026-07"
```

## 前台对照结果

前台文件：`产品数据/领星数据api/sku.md`

```text
数字 SKU 展开行: 6,513
数字 SKU 去重:   5,821
```

OpenAPI 全量同步并补齐 `status=2` 店铺后：

```text
sku_pool UK: 5,573
sku_pool DE:   647
sku_pool 合计: 6,220
前台 SKU+店铺+国家 未命中: 0
```

根因：旧链路只同步 `status=1` 店铺，漏了前台仍展示的 4 个 `status=2` UK 店铺：

```text
AM-Zhangxiaof-UK
AM-Yuanyue-UK
AM-Trunfa-UK
AM-Hechao-UK
```

补拉后前台缺口为 0。不是模糊匹配问题，也不是 OpenAPI 不返回。

## 关键 SQL

按标签和 `price_list[*]` 展开统计：

```sql
SELECT pl.mid,
       COUNT(*) AS rows_count,
       COUNT(DISTINCT CONCAT(pl.sid, '|', pl.local_sku)) AS distinct_store_sku
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
    mid VARCHAR(16) PATH '$.mid',
    sid VARCHAR(32) PATH '$.sid'
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

目标店铺池：

```sql
SELECT marketplace, sid, MAX(store_name) AS store_name, COUNT(*) AS target_rows
FROM lingxing_target_sku_pool
WHERE snapshot_week = '2026-W29'
  AND is_active = 1
GROUP BY marketplace, sid
ORDER BY marketplace, target_rows DESC;
```

## 和周数据更新的关系

- 建池：`summary_field=sku`，目的是找全目标 SKU 和标签。
- 周数据：`summary_field=msku`，按国家分组目标店铺，目的是保留店铺 listing 粒度。
- 周数据覆盖率最终仍按 `lingxing_target_sku_pool` 的 `marketplace + sid + sku` 校验。
