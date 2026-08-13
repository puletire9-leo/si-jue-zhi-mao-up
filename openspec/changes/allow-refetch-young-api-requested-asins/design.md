## Context

初筛判定集中在 `AsinImportService.filterRows()`（`AsinImportService.java:1409`），文件上传路径（`filterRowsAndCreateTask`）与八爪鱼流式路径（`filterPageAndAppend`）共用该分桶函数。

当前判定顺序：
```
ASIN格式 → 文件内去重 → SKIP_BLACKLIST(skip_asins) → SKIP_MAIN(competitor_products) → 价格 → 评论 → PASS
```
其中 `batchQueryExistingBlacklist`（`AsinImportService.java:1560`）通过 `SkipAsinMapper.selectExistingAsinsInList` 只返回"已存在的 ASIN 列表"，无法区分 `filter_reasons`。因此 `API已请求` 与历史淘汰（价格/评论/精筛不通过）混在同一黑名单桶里，无法做差异化放行。

需求：`API已请求` 的 ASIN 若上架天数 `< 90`，允许放过并重复走卖家精灵获取最新数据。

## Goals / Non-Goals

**Goals:**
- 仅对 `skip_asins.filter_reasons='API已请求'` 的记录，若主表 `competitor_products.listing_days < 90` 则放行进 PASS
- 判定顺序调整：价格/评论筛选通过后才做 API 重复请求检查
- 文件上传与八爪鱼流式两条路径行为一致

**Non-Goals:**
- 不修改主表已有（SKIP_MAIN）的去重语义
- 不修改其它历史淘汰原因（价格/评论/精筛不通过）的拦截行为
- 不改数据库表结构、不改前端代码、不新增表

## Decisions

### D1：黑名单查询按原因拆分
`batchQueryExistingBlacklist` 当前只返回 ASIN 集合。改为返回 `Map<String, String>`（asin → filter_reasons），或新增 Mapper 方法 `selectExistingWithReasonsInList` 返回 `{asin, filterReasons}` 记录列表，在 Service 层拆成两个集合：
- `hardBlacklistAsins`：`filter_reasons != 'API已请求'`（历史淘汰，继续硬拦）
- `apiRequestedAsins`：`filter_reasons = 'API已请求'`（进入放行判断）

**备选**：对 ASIN 集两次查询（一次查全部、一次只查 API已请求）。实现更简单但多一次 DB 往返；采用前者一次查全。

### D2：判定顺序调整（filterRows 内）
调整为：
```
ASIN格式 → 文件内去重 → SKIP_BLACKLIST(仅非API已请求) → SKIP_MAIN → 价格 → 评论 → API已请求放行判断 → PASS
```
- 非 `API已请求` 的黑名单仍在最前拦截（保持历史淘汰的强优先级）
- SKIP_MAIN 语义不变（主表已有，曾请求过 API，无论精筛是否通过）
- `API已请求` 检查移到价格/评论之后，满足"其他筛选都通过后再查重复"

### D3：上架天数来源（主表）
`API已请求` 记录本身未存 `listing_days`，且八爪鱼采集行无上架天数字段。约定从主表 `competitor_products` 批量查 `listing_days`：
- 新增 `CompetitorProductMapper.selectListingDaysInList(marketplace, asins)` 返回 `Map<asin, listing_days>`
- 判断：`listingDays != null && listingDays < 90` → 放过；`listingDays == null`（主表查不到）→ 不放过（保守，维持 SKIP_BLACKLIST）
- 阈值 90 定义为常量 `API_REQUESTED_REFETCH_MAX_LISTING_DAYS = 90`

### D4：放行后结果归桶
放行的 ASIN 进入 `PASS` 桶，正常落 `asin_import_results(status=PASS)`；`saveFilteredAsinsToSkipTable` 不会重写 `API已请求`（该函数只写 PRICE_FAIL/REVIEW_FAIL/SKIP_MAIN/DUPLICATE）。PASS 记录随后走请求中心重新调用卖家精灵，`markAsinsRequested` 幂等更新 `skip_asins`。

### D5：计数与详情
`SKIP_BLACKLIST` 桶拆出 `API已请求` 后，`filterRowsAndCreateTask`/`finishStreamingTask` 的 `skipBlacklist` 计数逻辑不变（集合为空自然归零）。被放行的 ASIN 计入 `passCount`，被拦截（≥90 天）的仍计入 `skipBlacklist`，明细 detail 可区分。

## Risks / Trade-offs

- [重复请求成本] 放行 90 天内新品会再次消耗卖家精灵 API 次数 → 阈值限制在 90 天 + 仅 `API已请求` 记录，影响面可控；请求中心 `markAsinsRequested` 幂等，不会产生重复 skip 记录
- [主表查不到 listing_days] 保守拦截，宁可少放行 → 默认不放过，避免无依据放行
- [顺序调整影响统计] 部分原 SKIP_BLACKLIST 转 PASS 或维持 → 前端预览数字自动反映，无需改动
- [流式与文件路径一致性] 两路径共用 filterRows，D2/D3 改动天然双路径生效 → 无需额外适配

## Migration Plan

纯代码改动，无表结构变更：
1. 修改 `SkipAsinMapper`（返回 reasons）+ `CompetitorProductMapper`（批量查 listing_days）
2. 重构 `AsinImportService.filterRows` 与 `batchQueryExistingBlacklist`
3. 单测：`AsinImportStreamingTest` 补充 <90 天放行、≥90 天拦截用例
4. 部署无需数据迁移，可随时回滚（还原判定顺序即可）

## Open Questions

无
