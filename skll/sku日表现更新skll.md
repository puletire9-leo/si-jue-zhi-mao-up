# SKU 日/周表现更新（领星 API 正确口径）

> 用途：从领星产品表现 API 获取 UK/DE 目标 SKU 的日/周表现。  
> 关键结论：不要按 SKU 每 50 个拆批；应从目标 SKU 池反查目标店铺，再按国家分组用 `summary_field=msku` 拉全量表现。

## 当前正确主链路

```text
lingxing_target_sku_pool
  -> snapshot_week = 2026-W29
  -> is_active = 1
  -> 反查目标店铺
  -> 按 marketplace 分组
     - DE: 3 个 sid
     - UK: 13 个 sid
  -> productPerformance/asinList
     - summary_field = msku
     - is_recently_enum = false
     - 不传 search_value
  -> lingxing_product_performance
  -> lingxing_sku_weekly_performance
```

## 为什么不用 50 个 SKU 一批

错误路线：

```text
6,560 个目标 SKU
  -> search_field=local_sku
  -> search_value 每 50 个一批
  -> 139 个 API 批次
```

实测结果：会连续触发领星 `103`，60 分钟只落 552 行，无法作为全量主链路。

`search_field=local_sku/search_value` 只用于精确验证和小样本 smoke test，不用于日/周全量更新。

## 为什么用 MSKU

`summary_field=sku` 在多店铺请求下会出现多 sid 聚合行，不适合 `SKU + 店铺` 粒度。

`summary_field=msku` 实测可以保留店铺 listing 粒度：

```text
测试窗口: 2026-04-08 ~ 2026-04-14
耗时: 5.51 分钟
原始产品表现行: 15,166
周表行: 15,166
sid 为空行: 0
多 sid 聚合行: 0
目标 marketplace+sid+sku 覆盖: 6,560 / 6,560
```

周表 `is_target_sku=1` 行数为 6,618，比目标池 6,560 多 58。原因是少量同一店铺同一 SKU 下存在多个 `MSKU/ASIN listing`；这是保留 listing 明细，不是重复错误。

## 当前基线

```sql
SELECT COUNT(*) AS target_rows,
       COUNT(DISTINCT CONCAT(marketplace, '|', sid, '|', sku)) AS target_keys
FROM lingxing_target_sku_pool
WHERE snapshot_week = '2026-W29'
  AND is_active = 1;
-- target_rows = 6560
-- target_keys = 6560
```

目标店铺：

| marketplace | target_store_count | target_rows |
|-------------|-------------------:|------------:|
| UK | 13 | 5,913 |
| DE | 3 | 647 |
| 合计 | 16 | 6,560 |

## API 调用

当前后端接口已封装正确策略：

```bash
curl -s -X POST http://localhost:18002/api/v1/modules/lingxing/sku-data-layer/weekly/sync-target-pool \
  -H "Content-Type: application/json" \
  -d '{
    "snapshotWeek": "2026-W29",
    "startDate": "2026-04-08",
    "endDate": "2026-04-14",
    "currencyCode": "CNY"
  }'
```

接口内部行为：

```text
1. 从 lingxing_target_sku_pool 取 active 目标池
2. 反查目标店铺
3. 按 marketplace 分组
4. 对每个国家请求一次产品表现
5. summary_field=msku
6. is_recently_enum=false
7. 写入 raw JSON gzip
8. upsert lingxing_product_performance
9. 回填 lingxing_sku_weekly_performance
10. 从 raw_json 安全解析并落列所有规范表预留表现字段
```

周表落列字段包括：

```text
net_amount, avg_volume, avg_custom_price,
promotion_volume, promotion_amount,
predict_gross_profit, roi,
acos, acoas, ad_order_quantity, ad_sales_amount,
page_views_total, clicks, impressions, ctr, cvr,
afn_fulfillable_quantity, fbm_quantity, available_days, fbm_available_days, stock_up_num,
reserved_fc_transfers, reserved_customerorders, reserved_fc_processing,
reviews_count, avg_star,
return_count, return_rate, return_goods_count, return_goods_rate
```

落列规则：使用 MySQL `JSON_VALUE(... RETURNING ... NULL ON ERROR)`，异常值落 NULL，不允许因为单个脏字段中断整批。

## 覆盖率验证

```sql
SELECT
  COUNT(*) AS weekly_target_rows,
  COUNT(DISTINCT CONCAT(marketplace, '|', sid, '|', sku)) AS target_store_sku_keys,
  COUNT(DISTINCT CONCAT(marketplace, '|', sid, '|', sku, '|', COALESCE(seller_sku, ''), '|', COALESCE(asin, ''))) AS target_listing_keys
FROM lingxing_sku_weekly_performance
WHERE week_start = '2026-04-08'
  AND week_end = '2026-04-14'
  AND is_target_sku = 1;
-- weekly_target_rows = 6618
-- target_store_sku_keys = 6560
```

```sql
SELECT
  COUNT(*) AS weekly_rows,
  SUM(is_target_sku) AS target_weekly_rows,
  SUM(CASE WHEN sid IS NULL THEN 1 ELSE 0 END) AS sid_null_rows,
  SUM(CASE WHEN sid_scope LIKE '%,%' THEN 1 ELSE 0 END) AS multi_sid_rows
FROM lingxing_sku_weekly_performance
WHERE week_start = '2026-04-08'
  AND week_end = '2026-04-14';
-- weekly_rows = 15166
-- target_weekly_rows = 6618
-- sid_null_rows = 0
-- multi_sid_rows = 0
```

## 限流经验

| 路线 | 结果 |
|------|------|
| 目标 SKU 每 50 个拆批 | 错误主链路，139 批，极慢 |
| 16 个目标店铺逐个请求 `summary_field=sku` | 精确但慢，11/16 店铺耗时约 59 分钟 |
| 按国家分组请求 `summary_field=msku` | 当前正确主链路，2 个请求组，5.51 分钟 |

## 4/5/6 三个月完整回填基线

2026-07-09 已用当前主链路完成 2026-04、2026-05、2026-06 周数据回填和月表重建。

批处理：

```text
data/lingxing/test-runs/run-weekly-msku-456.ps1
```

结果目录：

```text
data/lingxing/test-runs/456-weekly-msku/
```

raw JSON gzip：

```text
java-backend/sjzm-product/data/lingxing/raw-json/product-performance/summary-msku/
data/lingxing/raw-json/product-performance/summary-msku/
```

当前 Java 服务按容器工作目录实际写入第一处；本次已复制一份到第二处。后续生产化时建议显式设置 `LINGXING_RAW_ARCHIVE_DIR` 到稳定挂载目录。

总结果：

| 项 | 结果 |
|----|------|
| 周窗口 | 12 / 12 成功 |
| 月表重建 | 2026-04、2026-05、2026-06 成功 |
| 运行时间 | 2026-07-09 19:51:36 ~ 21:02:32 |
| 错误日志 | 无 `errors.log` |
| `summary-msku` gzip | 26 个文件，约 39.1 MB |

周表验收：

| 时间窗 | 周表行 | 目标 listing 行 | 目标 `marketplace+sid+sku` |
|--------|-------:|----------------:|---------------------------:|
| 2026-04-01 ~ 2026-04-07 | 15,166 | 6,618 | 6,560 |
| 2026-04-08 ~ 2026-04-14 | 15,166 | 6,618 | 6,560 |
| 2026-04-15 ~ 2026-04-21 | 15,166 | 6,618 | 6,560 |
| 2026-04-22 ~ 2026-04-30 | 15,166 | 6,618 | 6,560 |
| 2026-05-01 ~ 2026-05-07 | 15,166 | 6,618 | 6,560 |
| 2026-05-08 ~ 2026-05-14 | 15,166 | 6,618 | 6,560 |
| 2026-05-15 ~ 2026-05-21 | 15,164 | 6,618 | 6,560 |
| 2026-05-22 ~ 2026-05-31 | 15,164 | 6,618 | 6,560 |
| 2026-06-01 ~ 2026-06-07 | 15,164 | 6,618 | 6,560 |
| 2026-06-08 ~ 2026-06-14 | 15,164 | 6,618 | 6,560 |
| 2026-06-15 ~ 2026-06-21 | 15,164 | 6,618 | 6,560 |
| 2026-06-22 ~ 2026-06-30 | 15,164 | 6,618 | 6,560 |

月表验收：

| 月份 | 月表行 | 目标行 | 目标 `marketplace+sid+sku` |
|------|-------:|-------:|---------------------------:|
| 2026-04 | 14,875 | 6,560 | 6,560 |
| 2026-05 | 14,875 | 6,560 | 6,560 |
| 2026-06 | 14,873 | 6,560 | 6,560 |

判断规则：

- 每个周窗口目标 `marketplace+sid+sku` 必须是 6,560。
- 周表目标 listing 行 6,618 是正常明细，不要当成重复去删。
- 月表目标行 6,560 是聚合后的正确基线。
- 任何扩历史任务都继续用 `summary_field=msku` + 目标店铺按国家分组。

## 数据表

| 表 | 用途 |
|----|------|
| `lingxing_target_sku_pool` | 目标 SKU 池，业务键 `snapshot_week + marketplace + sid + sku` |
| `lingxing_product_performance` | 产品表现原始事实表，保留 `raw_json` |
| `lingxing_sku_weekly_performance` | SKU 周表现规范事实表 |
| `lingxing_sku_monthly_performance` | 从周表聚合出的月表 |
| `lingxing_data_sync_run` | 同步运行记录 |

## 注意

- 不要单字段 `COUNT(DISTINCT sku)` 当基线。
- 不要为了“去重”合并不同店铺的同一 SKU。
- 不要删除 raw JSON；后续补字段要靠它。
- Java dev 日志不要开 `com.sjzm.product=debug`，否则 MyBatis 会打印巨大 `raw_json`，严重拖慢大批量 upsert。
