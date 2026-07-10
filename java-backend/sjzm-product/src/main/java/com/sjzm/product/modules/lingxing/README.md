# 领星开放平台对接（modules/lingxing）

Java sjzm-product 内的领星 ERP 开放平台对接模块。参照 `产品数据/领星数据api/lingxing_api.py`（Python 移植蓝本）与 `docs/参考/张总系统可借鉴设计.md`（落库范式蓝本）。

## 设计范式（张总蓝本）

- **双写落库**：结构化业务列（供查询/聚合）+ `raw_json` 整包留底。领星报表 200+ 字段且持续演进，未映射全的也不丢数据。
- **组合业务键手动幂等 upsert**：先按业务键查存在 → 命中回填 id → `saveOrUpdate`，同一维度反复同步只更新不堆积、天然可重跑。
- **预防式限流**：翻页 sleep（按令牌桶容量），不依赖服务端 429 重试。
- **凭证不硬编码**：`LingxingConfigService` 读 DB api_config 覆盖 env（`LINGXING_APP_ID`/`LINGXING_APP_SECRET`）。

## 鉴权与签名（`LingxingClient`）

- token：`POST /api/auth-server/oauth/access-token`（query 传 appId+appSecret，`expires_in=7199`）；续约 `/api/auth-server/oauth/refresh`（refreshToken 2h、一次性）。过期前 60s 刷新，refresh 失败则重换。
- 签名：`MD5(ASCII排序参数)` → 大写 → `AES/ECB/PKCS5Padding`(密钥=appId) → Base64。与 Python `_generate_sign` 字节级一致。
- 业务请求：公共参 `access_token/app_key/timestamp/sign`；POST 业务参放 body，GET 全拼 URL。

## 数据域与落库

| 数据域 | 领星接口 | 表 | 幂等唯一键 | 约束 |
|--------|---------|-----|-----------|------|
| 店铺列表（**sid 来源**） | `GET /erp/sc/data/seller/lists` | `lingxing_seller` | `sid` | 无参，一次性全量 |
| 本地产品（拉取） | `POST .../local_inventory/productList` | `lingxing_local_product` | `lingxing_id` | offset/length ≤1000，令牌桶 1 |
| 本地产品（写回） | `POST .../storage/product/set`、`.../uploadPictures` | 同上（写回后回拉刷新） | — | 忠实透传领星 body |
| 产品表现 | `POST /bd/productPerformance/openApi/asinList` | `lingxing_product_performance` | `summaryField:value\|sidScope\|start\|end\|currency` | 时间窗 ≤92天；sid 必填 ≤200；多店铺 10s/页 |
| 利润统计-ASIN | `POST /bd/profit/statistics/open/asin/list` | `lingxing_profit_asin` | `asin\|sid\|dataDate\|currency` | 时间窗 ≤7天；逐日拆行；令牌桶 10 |
| 6 标签 SKU 池 | 已落库产品表现 `raw_json.tag_set` | `sku_pool` | `sku\|marketplace\|snapshot_week` | UK/DE 自动筛选 6 个目标标签 |
| SKU 规范数据层 | 已落库产品表现 + SKU 池 | `lingxing_sku_store_snapshot` / `lingxing_target_sku_pool` / `lingxing_sku_weekly_performance` / `lingxing_sku_monthly_performance` | SHA-256 业务键 | 全量快照、目标池、周事实、月聚合 |
| 采购事实层 | `POST .../getPurchasePlans`、`POST .../purchaseOrderList` | `lingxing_purchase_plan` / `lingxing_purchase_order` / `lingxing_purchase_order_item` | SHA-256 业务键 | Q1/Q2 精确备货量来源 |

建表脚本：`java-backend/sql/create_lingxing_*.sql`（charset `utf8mb4_unicode_ci`，与其它表一致）。

## HTTP 接口（前缀 `/api/v1/modules/lingxing`）

| 方法 路径 | 说明 |
|-----------|------|
| POST `/ping` | 链路验证（换 token + 调关键词列表 1 条） |
| POST `/credentials` | 更新凭证（写 api_config） |
| POST `/call` | 通用业务透传（调试用：path + body） |
| POST `/sellers/sync`、GET `/sellers` | 店铺同步 / 列表 |
| POST `/local-products/sync`、GET `/local-products` | 本地产品同步 / 分页 |
| POST `/local-products/set` | 添加/编辑本地产品（写回领星） |
| POST `/local-products/upload-pictures` | 上传产品图片（写回领星） |
| POST `/product-performance/sync`、GET `/product-performance` | 产品表现同步 / 分页 |
| POST `/sku-pool/rebuild` | 从已落库产品表现 `raw_json.tag_set` 自动重建 UK/DE 6 标签 SKU 池 |
| POST `/sku-pool/sync-uk-de-and-rebuild` | 串行同步 UK/DE 全量 SKU 产品表现后重建 SKU 池 |
| GET `/sku-pool/stats`、GET `/sku-pool` | SKU 池统计 / 分页 |
| POST `/sku-data-layer/backfill-existing` | 从现有真实领星表回填规范 SKU 数据层 |
| POST `/sku-data-layer/weekly/backfill-existing` | 从现有产品表现表回填 SKU 周数据规范表 |
| POST `/sku-data-layer/monthly/rebuild` | 从 SKU 周表聚合生成 SKU 月表 |
| GET `/sku-data-layer/stats` | 查看规范 SKU 数据层统计 |
| POST `/purchase/plans/sync` | 同步采购计划列表，落 `quantity_plan` 计划量 |
| POST `/purchase/orders/sync` | 同步采购单列表，落 `quantity_real` 实际采购量和 `quantity_entry` 入库量 |
| GET `/purchase/stats` | 查看采购事实层统计 |
| POST `/profit-asin/sync`、GET `/profit-asin` | 利润统计同步 / 分页 |
| POST `/sampling-model/analyze` | 精铺测品模型分析：基于已落库数据计算 cohort R1/R2 和盈亏平衡试算 |

产品表现同步入参（sync）走 JSON body：`{sids:[..], startDate, endDate, summaryField?, currencyCode?, searchField?, searchValues?, isRecentlyEnum?}`。`isRecentlyEnum=false` 表示不要只查活跃商品。

## 6 标签 SKU 池自动化

目标标签以领星 `global_tag_id` 为准：

| 标签 | global_tag_id |
|------|---------------|
| 绿标 | `907657425150046095` |
| 欧洲精铺2025 | `907563170455592213` |
| 欧洲精铺2025非标品 | `907654877317203632` |
| 欧洲精铺2025季节性断货 | `907596133278666918` |
| 欧洲精铺2025待淘汰 | `907585847123066054` |
| 欧洲精铺2025淘汰 | `907585631391968576` |

自动流程：产品表现 API 落库（SKU 池链路固定 `summary_field=sku`、`is_recently_enum=false`）→ 展开 `lingxing_product_performance.raw_json.tag_set` → 展开 `price_list[*]` 获取全部 `local_sku/mid` → 按 6 个标签 ID 筛选 → 限定 UK(mid=4)/DE(mid=5) → 写入 `sku_pool`。`lingxing_local_product` 只补开发人、成本、图片和状态。

2026-07-09 用前台 `产品数据/领星数据api/sku.md` 对照验证：新增店铺/国家列后确认，前台 `SKU+店铺+国家` 去重 6,500；旧链路只取 `status=1` 店铺，漏掉 4 个前台仍展示的 `status=2` UK 店铺。补拉 AM-Zhangxiaof-UK、AM-Yuanyue-UK、AM-Trunfa-UK、AM-Hechao-UK 后，`sku_pool` 为 UK 5,573、DE 647、合计 6,220，前台缺口为 0。结论不是模糊匹配，也不是 OpenAPI 不返回，而是 SKU 池全量店铺口径必须包含 `status IN (1,2)`。

## SKU 规范数据层

2026-07-09 已新增并实测：

- `lingxing_data_sync_run`：同步/回填运行记录。
- `lingxing_sku_store_snapshot`：UK/DE 全量 `SKU+店铺+国家` 快照。
- `lingxing_target_sku_pool`：6 标签目标 SKU 池，保留店铺维度。
- `lingxing_sku_weekly_performance`：SKU 周数据事实表，保留 `sid_scope`，防止多店铺聚合行被错误拆分。
- `lingxing_sku_monthly_performance`：从周表聚合的月数据缓存。

现有真实数据已回填验证：

| 表 | 基线行数 | 基线业务键 |
|----|---------:|-----------:|
| `lingxing_sku_store_snapshot` | 15,147 | 15,147 |
| `lingxing_target_sku_pool` | 6,560 | 6,560 |
| `lingxing_sku_weekly_performance` | 11,174 | 11,174 |
| `lingxing_sku_monthly_performance` | 11,174 | 11,174 |

所需 SKU 池基线固定为 `lingxing_target_sku_pool` 的 active 行数，业务键是 `snapshot_week + marketplace/mid + sid + sku`。当前 `2026-W29` 基线是 6,560 行（UK 5,913，DE 647）。不要用 `COUNT(DISTINCT sku)` 做拉取、分析、对账基线；同一个 SKU 在不同店铺下就是不同分析对象。

`product-performance/sync` 后续会在旧 `lingxing_product_performance` 双写基础上继续写规范周表；`sku-pool/rebuild` 后会同步刷新全量快照和规范目标池。旧 `sku_pool` 暂保留作对账/回滚，不直接删除。

raw JSON 文件归档：

- 默认目录：`data/lingxing/raw-json/product-performance/summary-{summaryField}/yyyy-MM/{run_id}/part-001.jsonl.gz`
- `LINGXING_RAW_ARCHIVE_ENABLED=true`
- `LINGXING_RAW_ARCHIVE_DIR=data/lingxing/raw-json`
- `LINGXING_RAW_ARCHIVE_RETENTION_DAYS=180`
- `LINGXING_RAW_ARCHIVE_MAX_FILE_MB=50`

每次产品表现同步结束后会自动清理超过保留期的 gzip JSONL 文件；数据库周表/月表/同步记录不随文件清理删除。

## 采购事实层

2026-07-10 已新增采购接口规范层：

- `lingxing_purchase_plan`：采购计划。`quantity_plan` 是计划采购量，只能用于计划口径、采购前预测和采购单对账。
- `lingxing_purchase_order`：采购单主表。记录订单状态、到货状态、总实际采购量、总入库量、供应商、仓库。
- `lingxing_purchase_order_item`：采购单子项。`quantity_real` 是实际采购量，优先作为精铺模型 Q1/Q2 主口径；`quantity_entry` 是到货入库量，用于确认实际到货。

同步接口：

```http
POST /api/v1/modules/lingxing/purchase/plans/sync
{
  "searchFieldTime": "creator_time",
  "startDate": "2026-05-01",
  "endDate": "2026-05-31",
  "statuses": [-2],
  "sids": [4298]
}

POST /api/v1/modules/lingxing/purchase/orders/sync
{
  "searchFieldTime": "order_time",
  "startDate": "2026-05-01",
  "endDate": "2026-05-31",
  "purchaseType": 1
}
```

模型使用规则：

```text
Q1 = SKU 首个有效采购单子项 quantity_real
Q1_entry = 同一采购批次 quantity_entry
Q2 = Q1 之后下一次有效采购单子项 quantity_real
```

有效采购单过滤建议：作废单 `status IN (-1,124)` 和删除子项 `item_list.is_delete=1` 不进入模型；只看已完成批次时优先 `status=9 AND status_shipped=3`。部分到货 `status_shipped=2` 可以保留采购决策量 `quantity_real`，但已入库可用量只能看 `quantity_entry`。

## 精铺测品模型分析

`/sampling-model/analyze` 不调用领星外部接口，只读取 `lingxing_local_product`、`lingxing_product_performance`、`lingxing_profit_asin` 已落库数据，适合反复调整模型参数。

示例：

```json
{
  "source": "performance",
  "startDate": "2026-07-01",
  "endDate": "2026-07-07",
  "cohortMonth": "2026-07",
  "targetTag": "欧洲精铺2025",
  "hitUnitsThreshold": 1,
  "turnoverUnitsThreshold": 30,
  "q1": 15,
  "q2": 45,
  "unitMargin": 3.5,
  "firstBatchLoss": 2.2,
  "secondBatchLoss": 2.8,
  "fixedCost": 12000
}
```

返回重点：

- `cohort.r1`：达到首批出单阈值的 SKU 占比。
- `cohort.r2`：达到转正销量阈值且未标记淘汰的 SKU / 已出单 SKU。
- `actuals.avgContributionProfit`：未传 `unitMargin` 时用于临时代替 M 的报表平均毛利/件。
- `model.netProfit`、`requiredR1AtCurrentR2`、`requiredR2AtCurrentR1`：二阶段盈亏平衡试算。
- `dataGaps`：当前数据对模型仍不足的部分，尤其是补货流水、到货日期、每日库存。

口径说明：

- `source=performance` 使用产品表现时间窗报表，数据量更全；如果同步窗口重叠，可能重复计入。
- `source=profit` 使用利润统计逐日数据，更适合严肃财务复盘，但目前需要先补齐 UK/DE 全量利润同步。
- `cohortMonth` 当前使用 `lingxing_local_product.lx_create_time` 近似 SKU cohort；真正上架日期还未结构化。

## 前端

即插即用模块（`frontend/src/modules/`，menuGroup「领星」，不改 router/sidebar）：
`lingxing-sellers`、`lingxing-products`（含新增/编辑/传图弹窗）、`lingxing-performance`、`lingxing-profit`。
API 封装 `frontend/src/api/lingxingProduct.ts`。

## 注意事项

- **sid 依赖**：产品表现/利润按店铺维度取数，必须先同步店铺拿 sid。
- **写回慎用空值**：`productSet` 对 `supplier_quote` 等传空会**清空**原数据；前端表单只提交非空字段规避，透传复杂 body 要严格按文档语义。
- **限流**：领星接口按令牌桶限流（`appId + 接口 url` 维度），`3001008` 和 `103` 都会自动退避重试；网络超时也会自动重试。产品表现多店铺同步受 10s/页限流较慢（前端超时放到 10 分钟以上）。
- **周数据同步口径**：先用 UK/DE 全量店铺建池，再从 `lingxing_target_sku_pool` 反查有目标 SKU 的店铺；周数据按国家分组同步这些目标店铺的 `summary_field=msku` 全量表现，不按 6,560 个 SKU 每 50 个拆批。当前 2026-W29 为 UK 13 个、DE 3 个目标店铺；2026-04-08~2026-04-14 实测 5.51 分钟完成，目标 `marketplace+sid+sku` 覆盖 6,560/6,560。
- **鉴权**：所有接口走网关鉴权，未加额外权限校验（与模块内其它接口一致）。
- **部署**：`mvn install`（勿 clean）→ 重启 product 容器；前端宿主机 `npm run build`（OOM 加 `--minify false`）；新库需先执行 4 个建表 SQL。
- 未做：张总蓝本的 API 调用日志/配额监控（credit_count 求和 + caller/call_location 归因）。
