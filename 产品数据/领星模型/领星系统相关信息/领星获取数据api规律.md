# 领星获取数据 API 规律（能拉哪些数据 · 窗口约束 · 触发真相）

> 生成时间：2026-07-30
> 事实来源：逐个阅读 `modules/lingxing/service/*SyncService.java` + 模块 `README.md`（标注实测）核实。
> 配套文档：同目录 `领星集成现状_代码核实.md`（偏架构/鉴权）。本文偏"数据资产清单"。

---

## 核心结论（先记这三条）

1. **真正调领星 API 的端点有 7 个**（2026-07-30 新增亚马逊 Listing 接入），其余 `lingxing_*` 表都是拿这 7 个接口的落库数据做二次加工（周表/月表/SKU 池/采购模型）。
2. **"按每周同步"不是系统行为，是人工习惯**——代码里**没有任何 `@Scheduled`/cron/celery 定时任务**，全靠人手动 POST 接口或手跑 `scripts/lingxing_daily/*.py`。
3. **接口窗口不是"周"**：产品表现 ≤92 天、利润统计 ≤7 天。利润的 7 天≈一周，很可能是"每周"这个印象的来源，但它是接口硬约束（超限直接抛异常），不是调度周期。

---

## 一、能拉哪些数据（7 个真实接口）

| # | 数据 | 领星接口 | 方法 | 拉到的核心字段 | 窗口/约束 | 幂等键 |
|---|------|---------|:---:|--------------|----------|--------|
| 1 | **店铺列表** | `/erp/sc/data/seller/lists` | GET | sid、店铺名、国家（mid） | 无参，一次性全量 | `sid` |
| 2 | **本地产品**（静态） | `.../local_inventory/productList` | POST | SKU、品名、成本、图片、开发人、状态、价格列表(price_list) | 分页 ≤1000/页 | `lingxing_id` |
| 3 | **产品表现**（动态） | `/bd/productPerformance/openApi/asinList` | POST | 按 ASIN/SKU 的销量、流量、转化等表现指标 + `tag_set` 标签集 | **时间窗 ≤92 天**；sid 必填 ≤200；多店铺 10s/页 | `summaryField:value\|sidScope\|start\|end\|currency` |
| 4 | **利润统计（财务）** | `/bd/profit/statistics/open/asin/list` | POST | 见下方字段清单（逐日一行） | **时间窗 ≤7 天**；令牌桶 10 | `asin\|sid\|dataDate\|currency` |
| 5 | **采购计划** | `.../local_inventory/getPurchasePlans` | POST | 计划采购量 `quantity_plan` | 按时间/店铺 | SHA-256 业务键 |
| 6 | **采购订单+子项** | `.../local_inventory/purchaseOrderList` | POST | 实际采购量 `quantity_real`、入库量 `quantity_entry`、供应商、仓库、订单/到货状态 | 按时间/类型 | SHA-256 业务键 |
| 7 | **亚马逊 Listing** ✨2026-07-30接入 | `/erp/sc/data/mws/listing` | POST | 开售日 open_date / 首单 first_order_time / 开售 on_sale_time / 排名 seller_rank+small_rank / 变体 variant / 尺寸 dimension_info / FBA分段库存 / 7日14日30日销量额 / 负责人 / 全局标签 | **令牌桶=1 严格串行**（等同卖家精灵铁律）；sid 必填；分页 ≤1000/页 | `sid+seller_sku` |

**写回能力（非拉取）**：`.../storage/product/set`（编辑本地产品）、`.../storage/product/uploadPictures`（传图）。
> ⚠️ 写回慎用空值：`productSet` 对 `supplier_quote` 等传空会**清空**领星原数据，前端表单只提交非空字段规避。

### ✨ #7 亚马逊 Listing 接入要点（2026-07-30 完成）

- **触发**：`POST /api/v1/modules/lingxing/listings/sync`，body `{sids:[..], isPair?, isDelete?, listingUpdateStart?, listingUpdateEnd?, searchField?, searchValues?, exactSearch?}`
- **查询**：`GET /api/v1/modules/lingxing/listings?sid=&asin=&sellerSku=&status=`
- **令牌桶=1 铁律**：Service 按单线程逐店铺串行 + 翻页 sleep 500ms，绝不可并发（同账户多 appId 共享限流）
- **踩坑**：文档示例 `open_date` 是 `"2021-02-04 01:15:58 PST"`，实测返回却是 `"26/09/2018 09:56:40 MEST"`（dd/MM/yyyy + 欧洲时区缩写，文档与实际不符）。修复用 `open_date_display`（工整 `+03:00` 偏移格式）解析落 UTC，时区转换验证正确（+03:00 → UTC 减 3h）
- **实测**：sid=3977 意大利 412 条全量入库，open_date/seller_rank 412/412 落全，时区转换数学正确

---

## 二、用户关心的两块数据具体拉了什么

### 「财务」= #4 利润统计（`LingxingProfitAsinSyncService.java` 逐行核实）

逐日拆行（一个 asin×sid×日期×币种 一行），落库结构化字段：

| 字段 | 领星 key | 含义 |
|------|---------|------|
| 销量 | totalSalesQuantity | 总销售数量 |
| 销售额 | totalSalesAmount | 总销售金额 |
| 广告费 | totalAdsCost | 总广告花费 |
| 采购价 | cgPrice | 采购单价 |
| 采购运费 | cgTransportCosts | 采购运输成本 |
| 总成本 | totalCost | 综合成本 |
| **毛利** | grossProfit | 毛利润 |
| **毛利率** | grossRate | 毛利率 |

维度字段：asin/parentAsin/sid/storeName/countryCode/localSku/localName/itemName/currencyCode/dataDate。
除结构化列外，整包 `raw_json` 留底（领星 200+ 字段持续演进，未映射的也不丢）。

**约束**：`validateSpan` 校验 startDate~endDate 双闭区间 ≤7 天，超限抛 `时间窗跨度 N 天，超过上限 7 天`。分页 1000/页，每页 sleep 500ms 防限流。

### 「产品信息」= #2 本地产品（静态）+ #3 产品表现（动态）

- **本地产品**：SKU 主数据——名称、成本、图片、开发人、状态、多币种价格列表。是"产品是什么"。
- **产品表现**：销量/流量/转化等经营指标 + `tag_set` 标签。是"产品卖得怎样"。链路固定 `summary_field=sku/msku`、`is_recently_enum=false`（不只查活跃商品）。

---

## 三、触发真相（"每周"从哪来）

**没有自动调度。** 触发路径只有两条，都靠人：

| 路径 | 说明 |
|------|------|
| Java REST | 手动 `POST /api/v1/modules/lingxing/{resource}/sync`（sellers / local-products / product-performance / profit-asin / purchase 等）|
| Python 脚本 | 手跑 `scripts/lingxing_daily/*.py`（约 20+ 个），经 Java `/call` 透传领星 API |

**"每周"的真实含义**：运维每周挑一个周窗口手动跑一次。利润接口窗口硬上限 7 天恰好≈一周，是这个印象的技术来源，但**不代表机器每周自动跑**。

准确表述：
> 每周由人手动触发一次同步；利润按 ≤7 天窗口逐段拉，产品表现按 ≤92 天窗口拉；落库后再加工成 `lingxing_sku_weekly_performance`（周事实）→ `lingxing_sku_monthly_performance`（月聚合）。

---

## 四、依赖顺序（同步必须按此序）

```
① 店铺 seller/lists  ──拿到 sid──┐
                                 ├─→ ③ 产品表现（sid 必填）
② 本地产品 productList           ├─→ ④ 利润统计（sid 维度）
                                 └─→ ⑤⑥ 采购（sid 维度）
                                          │
        已落库产品表现 raw_json.tag_set ──┴─→ 6 标签 SKU 池 → SKU 周/月规范表
```

**铁律**：产品表现/利润/采购都按店铺维度取数，**必须先同步店铺拿 sid**，否则无从下手。

---

## 五、二次加工产物（不额外调 API）

这些表/模型只读已落库数据，可反复重算、不消耗领星配额：

| 产物 | 来源 | 接口 |
|------|------|------|
| 6 标签 SKU 池 | 产品表现 `raw_json.tag_set` + price_list | `/sku-pool/rebuild` |
| SKU 规范周/月表 | 产品表现 + SKU 池 | `/sku-data-layer/weekly\|monthly/*` |
| 精铺测品模型 | local_product + product_performance + profit_asin | `/sampling-model/analyze` |
| 第一版批次模型 | 采购事实层 + SKU 周事实 | `/sampling-model/batch-analyze` |

---

## 六、待解决与进展

### 6.1 产品表现 sync 代码 ⚠️（已查清：被主动清理删除）

~~"找不到产品表现同步代码"~~ → 真相在 `LingxingController.java:43-44` 注释里写明：**"2026-07 清理后的端点集合，只保留和当前 10 张 lingxing_* 表匹配的端点，废弃的 product-performance/sku-pool/sampling-model 端点已全部删除"**。

即产品表现实时同步代码曾存在，后被当作废弃主动删除。这与 `lingxing_product_performance` 表 0 行、加工层 `lingxing_sku_weekly_performance` 46 万行 的现象一致：加工表留用，原始同步端点删了。若要恢复实时同步产品表现，需重新实现（参考已接入的 listing 链路范式）。

### 6.2 ✅ 亚马逊 Listing 已接入（2026-07-30 完成）

曾经"销售板块 Listing 数据还没获取"的缺口已补上，详见第一节 #7。新增表 `lingxing_listing` + Service + Controller 端点，实测 sid=3977 拉取 412 条全量入库。令牌桶=1 严格串行。

### 6.3 无自动调度（仍待办）

对应 `领星中心.md` 待做的 **数据同步中心（前端触发 + 进度观察）**。若要"每周"成真规律：① 前端调度页；② `@Scheduled`（注意令牌桶限流，需串行 + 退避）。

### 6.4 其他（仍待办）

- API 调用日志/配额监控（credit_count 求和 + caller/call_location 归因）尚未做。
- Listing 全量店铺首次同步（当前仅落 1 个测试店铺 412 条）。
- Listing 前端模块页（工作台未接入 listing 入口）。
- data_sync_run 运行记录未写 listing 同步历史（要做"同步中心"页面才需要）。
</content>
