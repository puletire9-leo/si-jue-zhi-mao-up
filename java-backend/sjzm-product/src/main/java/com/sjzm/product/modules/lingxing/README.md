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
| POST `/profit-asin/sync`、GET `/profit-asin` | 利润统计同步 / 分页 |
| POST `/sampling-model/analyze` | 精铺测品模型分析：基于已落库数据计算 cohort R1/R2 和盈亏平衡试算 |

同步入参（sync）走 JSON body：`{sids:[..], startDate, endDate, summaryField?, currencyCode?}`。

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
- **限流**：领星接口按令牌桶限流（`appId + 接口 url` 维度），触发 429 错误码 `3001008` 时稍等重试；产品表现多店铺同步受 10s/页限流较慢（前端超时放到 10 分钟）。
- **鉴权**：所有接口走网关鉴权，未加额外权限校验（与模块内其它接口一致）。
- **部署**：`mvn install`（勿 clean）→ 重启 product 容器；前端宿主机 `npm run build`（OOM 加 `--minify false`）；新库需先执行 4 个建表 SQL。
- 未做：张总蓝本的 API 调用日志/配额监控（credit_count 求和 + caller/call_location 归因）。
