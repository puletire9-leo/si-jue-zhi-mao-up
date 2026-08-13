## Why

当前初筛流程中，只要 ASIN 命中 `skip_asins`（`filter_reasons='API已请求'`）就被硬性拦截为 SKIP_BLACKLIST，且判断发生在价格/评论筛选之前（`AsinImportService.filterRows` L1449-1464）。这导致上架不足 90 天的新品在首次采集后无法重复获取最新数据（价格/评论/BSR 随时变化），新品追踪失真。

## What Changes

- 调整初筛判定顺序：价格、评论等筛选全部通过之后，才进入「API 重复请求检查」。
- 在「API 重复请求检查」步骤新增放行规则：仅针对 `skip_asins` 中 `filter_reasons='API已请求'` 的记录，若该 ASIN 在主表 `competitor_products` 中的 `listing_days < 90`，则**放过**该 ASIN，允许重复获取（进 PASS 重新走卖家精灵）。
- 其余黑名单记录（价格/评论/精筛淘汰等历史淘汰）保持原拦截行为不变。
- 主表已有（SKIP_MAIN）的去重语义保持不变，不属于本次放行范围。
- 流式初筛路径（`filterPageAndAppend`，八爪鱼自动采集）与文件上传路径（`filterRowsAndCreateTask`）行为保持一致。

## Capabilities

### New Capabilities
- `initial-filter-asin-import`: 初筛判定流程（含黑名单/API已请求去重、价格评论分桶、PASS 落库），本次变更放宽"API已请求"对低上架天数新品的拦截。

### Modified Capabilities
<!-- 无既有 spec 涉及初筛流程 -->

## Impact

- 代码：`java-backend/sjzm-product/src/main/java/com/sjzm/product/service/AsinImportService.java`（`filterRows`、`filterPageAndAppend`、`batchQueryExistingBlacklist`）
- Mapper：`SkipAsinMapper`（需能区分 `API已请求` 与其它原因）、`CompetitorProductMapper`（需按 ASIN 批量查 `listing_days`）
- 数据流：初筛分桶计数（`SKIP_BLACKLIST` → 部分转为 `PASS`）可能变化；`skip_asins` 表结构不变
- 前端：八爪鱼采集控制台与 ASIN 导入预览的统计数字可能受影响（无需改前端代码）
- 不涉及数据库表结构变更
