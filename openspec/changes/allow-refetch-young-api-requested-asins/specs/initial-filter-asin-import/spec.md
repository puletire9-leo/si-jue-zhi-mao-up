## ADDED Requirements

### Requirement: 初筛判定按筛选优先级顺序执行
初筛分桶流程 SHALL 在价格与评论筛选全部通过之后，才执行「API 重复请求」放行判断。历史淘汰黑名单（`filter_reasons` 非 `API已请求`）与主表已有（SKIP_MAIN）的拦截仍在前置位置执行。

判定顺序固定为：ASIN 格式校验 → 文件内去重 → 硬性黑名单（非 API已请求）→ 主表已有 → 价格区间 → 评论上限 → API已请求放行判断 → PASS。

#### Scenario: 价格或评论未通过的 ASIN 不进入 API 重复请求判断
- **WHEN** 一个 ASIN 已被 `skip_asins` 标记为 `API已请求`，且其价格超出阈值
- **THEN** 该 ASIN 归入 PRICE_FAIL，不因 API已请求规则被放行

#### Scenario: 主表已有 ASIN 保持拦截
- **WHEN** 一个 ASIN 已存在于 `competitor_products`（无论精筛是否通过），且其 `filter_reasons` 不是 `API已请求`
- **THEN** 该 ASIN 归入 SKIP_MAIN，不被放行

### Requirement: 上架不足 90 天且系统导入超一月的 API已请求 ASIN 允许重复获取
对于 `skip_asins` 中 `filter_reasons='API已请求'` 或 `'初筛PASS'` 的 ASIN，若同时满足以下两个条件，初筛 SHALL 放过该 ASIN，归入 PASS，允许后续重新调用卖家精灵获取最新数据（作为新月度批次写入，旧批次数据保留）：

- 主表 `competitor_products` 中的 `listing_days < 90`
- 系统导入时间（`skip_asins.created_at`）距今超过 1 个月

- 上架天数阈值固定为 90 天。
- 上架天数取自 `competitor_products` 主表（`listing_days`），不作为采集行或 `skip_asins` 记录字段。
- 系统导入时间取自 `skip_asins.created_at`。
- 主表查不到该 ASIN 的 `listing_days` 时，SHALL 不放过，维持 SKIP_BLACKLIST 拦截。
- 系统导入未超一月时，SHALL 不放过（同月内不重复获取，避免覆盖旧批次），维持 SKIP_BLACKLIST 拦截。

#### Scenario: 上架不足 90 天且导入超一月的 API已请求 ASIN 被放行
- **WHEN** 一个 ASIN 在 `skip_asins` 中 `filter_reasons='API已请求'`，`competitor_products` 中 `listing_days = 45`，且 `skip_asins.created_at` 距今 60 天
- **THEN** 该 ASIN 归入 PASS，计入 passCount，可重新请求卖家精灵

#### Scenario: 上架满 90 天及以上的 API已请求 ASIN 仍被拦截
- **WHEN** 一个 ASIN 在 `skip_asins` 中 `filter_reasons='API已请求'`，且 `competitor_products` 中该 ASIN 的 `listing_days = 120`
- **THEN** 该 ASIN 归入 SKIP_BLACKLIST，计入 skipBlacklist，不重新请求

#### Scenario: 系统导入未超一月的 API已请求 ASIN 被拦截
- **WHEN** 一个 ASIN 在 `skip_asins` 中 `filter_reasons='API已请求'`，`listing_days = 45`，但 `skip_asins.created_at` 仅距今 5 天
- **THEN** 该 ASIN 归入 SKIP_BLACKLIST，不重新请求（同月内不重复获取）

#### Scenario: 主表查不到上架天数的 API已请求 ASIN 保守拦截
- **WHEN** 一个 ASIN 在 `skip_asins` 中 `filter_reasons='API已请求'`，但 `competitor_products` 中无该 ASIN 记录或 `listing_days` 为空
- **THEN** 该 ASIN 归入 SKIP_BLACKLIST，不重新请求

### Requirement: 文件上传与八爪鱼流式路径行为一致
文件上传路径（`filterRowsAndCreateTask`）与八爪鱼自动采集流式路径（`filterPageAndAppend`）共用同一分桶逻辑，SHALL 对「API已请求 + 上架<90 天」执行相同的放行规则。

#### Scenario: 八爪鱼流式初筛同样放行低上架天数 ASIN
- **WHEN** 八爪鱼自动采集流式初筛遇到一个 `API已请求` 且 `listing_days < 90` 的 ASIN
- **THEN** 该 ASIN 与文件上传路径一样归入 PASS

### Requirement: 放行后明细与去重记录正确
被放行的 ASIN SHALL 以 `status=PASS` 写入 `asin_import_results`；`skip_asins` 中该 ASIN 的 `API已请求` 记录保持不变，不因放行被删除或改写。

#### Scenario: 放行 ASIN 以 PASS 落明细
- **WHEN** 一个 ASIN 因「API已请求 + 上架<90 天」被放行
- **THEN** `asin_import_results` 新增一条 `status=PASS` 的记录，且 `skip_asins` 中原 `API已请求` 记录保留
