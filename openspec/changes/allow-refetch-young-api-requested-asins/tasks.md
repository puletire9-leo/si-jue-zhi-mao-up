## 1. Mapper 层扩展

- [x] 1.1 `SkipAsinMapper` 新增 `selectExistingWithReasonsInList(marketplace, asins)` 返回 `{asin, filterReasons}`，替换/并存 `selectExistingAsinsInList`；同步 `SkipAsinMapper.xml`
- [x] 1.2 `CompetitorProductMapper` 新增 `selectListingDaysInList(marketplace, asins)` 批量返回 `Map<asin, listing_days>`；同步 `CompetitorProductMapper.xml`
- [x] 1.3 补充/更新对应 Mapper XML 的映射与 SQL（只查 `API已请求` 记录可复用 `filter_reasons` 过滤）

## 2. AsinImportService 重构

- [x] 2.1 `batchQueryExistingBlacklist` 改为按原因拆分：返回硬黑名单集合（非 API已请求）与已采过 ASIN（含系统导入时间）
- [x] 2.2 新增常量 `API_REQUESTED_REFETCH_MAX_LISTING_DAYS = 90`
- [x] 2.3 重构 `filterRows` 判定顺序：硬黑名单/SKIP_MAIN 在前，价格/评论通过后追加「已采过放行判断」（上架<90天 + 系统导入超一月 → PASS；否则 SKIP_BLACKLIST）
- [x] 2.4 `filterPageAndAppend` 流式路径适配新的黑名单数据结构与放行逻辑（与文件路径共用分桶函数）
- [x] 2.5 `filterRowsAndCreateTask`/`finishStreamingTask` 计数与预览字段确认兼容（放行 ASIN 计入 PASS、拦截计入 SKIP_BLACKLIST）
- [x] 2.6 `saveResults` 为 SKIP_BLACKLIST 补充可区分 detail（上架≥90天 / 系统导入未超一月）

## 3. 测试

- [x] 3.1 更新/新增 `AsinImportStreamingTest`：覆盖 <90 天放行、≥90 天拦截、主表无 listing_days 保守拦截、导入未超一月拦截四个场景
- [x] 3.2 运行 `AsinImportStreamingTest` 及关联初筛单测，确认通过（用户统一测试）
  - 已通过线上 `/api/v1/asin-import/upload` 实际验证：第一版 5 场景（taskId 279/280/281）与第二版 4 场景（taskId 285），修复 filterRows 放行后未 continue 落入 SKIP_MAIN 的 bug，重新 build+部署后全部符合预期

## 4. 文档同步

- [x] 4.1 更新 `java-backend/AGENTS.md` 中初筛/黑名单语义描述（API已请求放行规则）
- [x] 4.2 更新 `docs/八爪鱼使用/` 相关文档（如需）说明新品 90 天重复获取规则
